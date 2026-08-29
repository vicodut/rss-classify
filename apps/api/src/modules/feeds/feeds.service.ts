import { inject, injectable } from "tsyringe";
import { Effect } from "effect";
import { feedFromRow, type FeedRow, type TypedSupabaseClient } from "@rss-agg/db";
import type { CreateFeedBody, Feed } from "@rss-agg/contract";
import type { AppConfig } from "../../core/config.js";
import { APP_CONFIG } from "../../core/types.js";
import { ScoringService, type PreferenceWeights } from "../scoring/scoring.service.js";
import { TaggingService } from "../scoring/tagging.service.js";
import { fetchFeed } from "./feeds.parser.js";

const UNIQUE_VIOLATION = "23505";

export interface FeedRefreshOutcome {
  feedId: string;
  articlesFetched: number;
  articlesCreated: number;
  error: string | null;
}

export interface RefreshFeedsResult {
  feedsProcessed: number;
  articlesFetched: number;
  articlesCreated: number;
  errors: { feedId: string; message: string }[];
}

@injectable()
export class FeedsService {
  constructor(
    @inject(APP_CONFIG) private readonly config: AppConfig,
    @inject(TaggingService) private readonly tagging: TaggingService,
    @inject(ScoringService) private readonly scoring: ScoringService,
  ) {}

  async list(db: TypedSupabaseClient): Promise<Feed[]> {
    const { data, error } = await db.from("feeds").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(feedFromRow);
  }

  async get(db: TypedSupabaseClient, id: string): Promise<Feed | null> {
    const { data, error } = await db.from("feeds").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? feedFromRow(data) : null;
  }

  async create(
    db: TypedSupabaseClient,
    userId: string,
    body: CreateFeedBody,
  ): Promise<{ feed: Feed } | { conflict: true }> {
    const { data, error } = await db
      .from("feeds")
      .insert({ user_id: userId, url: body.url, title: body.title ?? null })
      .select("*")
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { conflict: true };
      throw error;
    }
    return { feed: feedFromRow(data) };
  }

  async remove(db: TypedSupabaseClient, id: string): Promise<boolean> {
    const { data, error } = await db.from("feeds").delete().eq("id", id).select("id");
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  /**
   * Fetches one feed, tags + scores its new items, and upserts them
   * (deduped on the (user_id, url) unique constraint). Never fails — errors
   * are reported in the returned outcome so a bad feed doesn't abort a
   * concurrent batch (see refresh() / feeds.scheduler.ts).
   */
  refreshOneFeed(
    db: TypedSupabaseClient,
    feed: FeedRow,
    weights: PreferenceWeights,
  ): Effect.Effect<FeedRefreshOutcome, never> {
    return fetchFeed(feed.url, this.config.RSS_FETCH_TIMEOUT_MS).pipe(
      Effect.matchEffect({
        onFailure: (err) =>
          Effect.succeed<FeedRefreshOutcome>({
            feedId: feed.id,
            articlesFetched: 0,
            articlesCreated: 0,
            error: err.message,
          }),
        onSuccess: (parsed) =>
          Effect.gen(this, function* () {
            const rows = parsed.items.map((item) => {
              const tags = this.tagging.tagArticle(item.title, item.content);
              const predictedScore = this.scoring.scoreArticle(
                { tags, title: item.title, content: item.content },
                weights,
              );
              return {
                user_id: feed.user_id,
                source_id: feed.id,
                url: item.url,
                title: item.title,
                content: item.content,
                source: feed.title ?? parsed.title ?? null,
                tags,
                predicted_score: predictedScore,
                published_at: item.publishedAt,
              };
            });

            const created = yield* Effect.tryPromise(async () => {
              if (rows.length === 0) return 0;
              const { data, error } = await db
                .from("articles")
                .upsert(rows, { onConflict: "user_id,url", ignoreDuplicates: true })
                .select("id");
              if (error) throw error;
              return data?.length ?? 0;
            }).pipe(Effect.catchAll(() => Effect.succeed(0)));

            yield* Effect.tryPromise(() =>
              db.from("feeds").update({ last_fetched: new Date().toISOString() }).eq("id", feed.id),
            ).pipe(Effect.ignore);

            return {
              feedId: feed.id,
              articlesFetched: rows.length,
              articlesCreated: created,
              error: null,
            };
          }),
      }),
    );
  }

  /**
   * Refreshes either one feed (feedId) or all of the current user's active
   * feeds, concurrently (RSS_FETCH_CONCURRENCY). Request-scoped — relies on
   * `db` being the caller's RLS-scoped client, so no explicit user_id filter
   * is needed.
   */
  refresh(db: TypedSupabaseClient, feedId: string | undefined): Effect.Effect<RefreshFeedsResult, never> {
    return Effect.gen(this, function* () {
      const feedRows = yield* Effect.tryPromise(async () => {
        const query = feedId
          ? db.from("feeds").select("*").eq("id", feedId)
          : db.from("feeds").select("*").eq("is_active", true);
        const { data, error } = await query;
        if (error) throw error;
        return data ?? [];
      }).pipe(Effect.orDie);

      if (feedRows.length === 0) {
        return { feedsProcessed: 0, articlesFetched: 0, articlesCreated: 0, errors: [] };
      }

      const profileRow = yield* Effect.tryPromise(async () => {
        const { data, error } = await db.from("user_profiles").select("*").maybeSingle();
        if (error) throw error;
        return data;
      }).pipe(Effect.orDie);

      const weights: PreferenceWeights = profileRow
        ? { tagWeights: profileRow.tag_weights, keywordWeights: profileRow.keyword_weights }
        : { tagWeights: {}, keywordWeights: {} };

      const outcomes = yield* Effect.forEach(
        feedRows,
        (feed) => this.refreshOneFeed(db, feed, weights),
        { concurrency: this.config.RSS_FETCH_CONCURRENCY },
      );

      return {
        feedsProcessed: outcomes.length,
        articlesFetched: outcomes.reduce((sum, o) => sum + o.articlesFetched, 0),
        articlesCreated: outcomes.reduce((sum, o) => sum + o.articlesCreated, 0),
        errors: outcomes
          .filter((o): o is FeedRefreshOutcome & { error: string } => o.error !== null)
          .map((o) => ({ feedId: o.feedId, message: o.error })),
      };
    });
  }
}
