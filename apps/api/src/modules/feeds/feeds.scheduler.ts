import { scheduleJob, type Job } from "node-schedule";
import { Effect } from "effect";
import { container } from "tsyringe";
import type { FastifyBaseLogger } from "fastify";
import { createServiceRoleClient } from "@rss-agg/db";
import { toError } from "../../common/utils/supabase.js";
import type { AppConfig } from "../../core/config.js";
import type { PreferenceWeights } from "../scoring/scoring.service.js";
import { KeywordTaggingService, type CorpusStats } from "../scoring/keyword-tagging.service.js";
import { FeedsService } from "./feeds.service.js";

/**
 * Refreshes every user's active feeds using the service-role client — the
 * one legitimate use of createServiceRoleClient outside a request handler,
 * since this job spans all users and there is no per-request bearer token
 * for RLS to key off of.
 */
export async function refreshAllUsersFeeds(
  config: AppConfig,
  feedsService: FeedsService,
  tagging: KeywordTaggingService,
): Promise<void> {
  const db = createServiceRoleClient({
    url: config.SUPABASE_URL,
    anonKey: config.SUPABASE_ANON_KEY,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
  });

  const { data: feeds, error: feedsError } = await db.from("feeds").select("*").eq("is_active", true);
  if (feedsError) throw toError(feedsError);
  if (!feeds || feeds.length === 0) return;

  const { data: profiles, error: profilesError } = await db.from("user_profiles").select("*");
  if (profilesError) throw toError(profilesError);

  const weightsByUser = new Map<string, PreferenceWeights>(
    (profiles ?? []).map((p) => [p.id, { tagWeights: p.tag_weights, keywordWeights: p.keyword_weights }]),
  );
  const scoringNeighborCountByUser = new Map<string, number>((profiles ?? []).map((p) => [p.id, p.tag_knn_k]));
  const fallbackWeights: PreferenceWeights = { tagWeights: {}, keywordWeights: {} };

  // Corpus stats (for tag extraction) are per-user — each user's tag
  // vocabulary is derived only from their own articles, never shared.
  const { data: allArticles, error: articlesError } = await db.from("articles").select("user_id, title, content");
  if (articlesError) throw toError(articlesError);
  const articlesByUser = new Map<string, { title: string; content: string | null }[]>();
  for (const row of allArticles ?? []) {
    const list = articlesByUser.get(row.user_id) ?? [];
    list.push({ title: row.title, content: row.content });
    articlesByUser.set(row.user_id, list);
  }
  const corpusByUser = new Map<string, CorpusStats>(
    [...articlesByUser.entries()].map(([userId, docs]) => [userId, tagging.buildCorpusStats(docs)]),
  );
  const emptyCorpus = tagging.buildCorpusStats([]);

  await Effect.runPromise(
    Effect.forEach(
      feeds,
      (feed) =>
        feedsService.refreshOneFeed(
          db,
          feed,
          weightsByUser.get(feed.user_id) ?? fallbackWeights,
          corpusByUser.get(feed.user_id) ?? emptyCorpus,
          scoringNeighborCountByUser.get(feed.user_id) ?? 10,
        ),
      { concurrency: config.RSS_FETCH_CONCURRENCY },
    ),
  );
}

/**
 * node-schedule doesn't have a native "every N ms" rule, so the job
 * reschedules itself after each run to approximate a fixed-interval timer.
 */
export function startFeedsScheduler(config: AppConfig, logger: FastifyBaseLogger): Job {
  const feedsService = container.resolve(FeedsService);
  const tagging = container.resolve(KeywordTaggingService);

  const runAndReschedule = async () => {
    try {
      await refreshAllUsersFeeds(config, feedsService, tagging);
      logger.info("Scheduled feed refresh completed");
    } catch (err) {
      logger.error({ err }, "Scheduled feed refresh failed");
    } finally {
      job.reschedule(new Date(Date.now() + config.REFRESH_INTERVAL_MS));
    }
  };

  const job = scheduleJob(new Date(Date.now() + config.REFRESH_INTERVAL_MS), runAndReschedule);
  return job;
}
