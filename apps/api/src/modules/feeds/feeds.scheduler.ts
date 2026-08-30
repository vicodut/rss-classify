import { scheduleJob, type Job } from "node-schedule";
import { Effect } from "effect";
import { container } from "tsyringe";
import type { FastifyBaseLogger } from "fastify";
import { createServiceRoleClient } from "@rss-agg/db";
import type { AppConfig } from "../../core/config.js";
import type { PreferenceWeights } from "../scoring/scoring.service.js";
import type { TagKnnSettings } from "../scoring/classification.service.js";
import { FeedsService } from "./feeds.service.js";

/**
 * Refreshes every user's active feeds using the service-role client — the
 * one legitimate use of createServiceRoleClient outside a request handler,
 * since this job spans all users and there is no per-request bearer token
 * for RLS to key off of.
 */
export async function refreshAllUsersFeeds(config: AppConfig, feedsService: FeedsService): Promise<void> {
  const db = createServiceRoleClient({
    url: config.SUPABASE_URL,
    anonKey: config.SUPABASE_ANON_KEY,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
  });

  const { data: feeds, error: feedsError } = await db.from("feeds").select("*").eq("is_active", true);
  if (feedsError) throw feedsError;
  if (!feeds || feeds.length === 0) return;

  const { data: profiles, error: profilesError } = await db.from("user_profiles").select("*");
  if (profilesError) throw profilesError;

  const weightsByUser = new Map<string, PreferenceWeights>(
    (profiles ?? []).map((p) => [p.id, { tagWeights: p.tag_weights, keywordWeights: p.keyword_weights }]),
  );
  const tagKnnByUser = new Map<string, TagKnnSettings>(
    (profiles ?? []).map((p) => [
      p.id,
      { k: p.tag_knn_k, minVotes: p.tag_knn_min_votes, similarityFloor: p.tag_knn_similarity_floor },
    ]),
  );
  const fallbackWeights: PreferenceWeights = { tagWeights: {}, keywordWeights: {} };
  const fallbackTagKnn: TagKnnSettings = { k: 10, minVotes: 2, similarityFloor: 0.18 };

  await Effect.runPromise(
    Effect.forEach(
      feeds,
      (feed) =>
        feedsService.refreshOneFeed(
          db,
          feed,
          weightsByUser.get(feed.user_id) ?? fallbackWeights,
          tagKnnByUser.get(feed.user_id) ?? fallbackTagKnn,
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

  const runAndReschedule = async () => {
    try {
      await refreshAllUsersFeeds(config, feedsService);
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
