import { inject, injectable } from "tsyringe";
import { Effect } from "effect";
import { feedFromRow, type FeedRow, type TypedSupabaseClient } from "@rss-agg/db";
import type { CreateFeedBody, Feed } from "@rss-agg/contract";
import type { AppConfig } from "../../core/config.js";
import { APP_CONFIG } from "../../core/types.js";
import { toError } from "../../common/utils/supabase.js";
import { ScoringService, type PreferenceWeights } from "../scoring/scoring.service.js";
import { ClassificationService } from "../scoring/classification.service.js";
import { KeywordTaggingService, type CorpusStats } from "../scoring/keyword-tagging.service.js";
import { EmbeddingsService, prepareTextForEmbedding } from "../embeddings/embeddings.service.js";
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
    @inject(ScoringService) private readonly scoring: ScoringService,
    @inject(ClassificationService) private readonly classification: ClassificationService,
    @inject(KeywordTaggingService) private readonly tagging: KeywordTaggingService,
    @inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
  ) {}

  async list(db: TypedSupabaseClient): Promise<Feed[]> {
    const { data, error } = await db.from("feeds").select("*").order("created_at", { ascending: false });
    if (error) throw toError(error);
    return (data ?? []).map(feedFromRow);
  }

  async get(db: TypedSupabaseClient, id: string): Promise<Feed | null> {
    const { data, error } = await db.from("feeds").select("*").eq("id", id).maybeSingle();
    if (error) throw toError(error);
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
      throw toError(error);
    }
    return { feed: feedFromRow(data) };
  }

  async remove(db: TypedSupabaseClient, id: string): Promise<boolean> {
    const { data, error } = await db.from("feeds").delete().eq("id", id).select("id");
    if (error) throw toError(error);
    return (data?.length ?? 0) > 0;
  }

  /**
   * Fetches one feed, tags + scores its new items, and upserts them
   * (deduped on the (user_id, url) unique constraint). Never fails — errors
   * are reported in the returned outcome so a bad feed doesn't abort a
   * concurrent batch (see refresh() / feeds.scheduler.ts). `corpus` is built
   * once per refresh() call (see below) and shared across every feed/item in
   * that batch rather than recomputed per item.
   */
  refreshOneFeed(
    db: TypedSupabaseClient,
    feed: FeedRow,
    weights: PreferenceWeights,
    corpus: CorpusStats,
    scoringNeighborCount: number,
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
            // One batched model call for every new item in this feed, not
            // one call per item.
            const embeddings = yield* Effect.tryPromise(() =>
              this.embeddings.embed(parsed.items.map((item) => prepareTextForEmbedding(item.title, item.content))),
            ).pipe(Effect.orDie);

            const rows = yield* Effect.forEach(
              parsed.items,
              (item, index) =>
                Effect.gen(this, function* () {
                  const embedding = embeddings[index]!;
                  const tags = this.tagging.extractTags(item.title, item.content, corpus);
                  const ratedNeighbors = yield* Effect.tryPromise(() =>
                    this.classification.findRatedNeighbors(db, feed.user_id, embedding, scoringNeighborCount),
                  ).pipe(Effect.orDie);
                  const { score, reason } = this.scoring.scoreArticle(
                    { tags, title: item.title, content: item.content },
                    weights,
                    ratedNeighbors,
                  );
                  return {
                    user_id: feed.user_id,
                    source_id: feed.id,
                    url: item.url,
                    title: item.title,
                    content: item.content,
                    source: feed.title ?? parsed.title ?? null,
                    tags,
                    predicted_score: score,
                    reason,
                    published_at: item.publishedAt,
                    embedding,
                    embedding_model: this.config.EMBEDDING_MODEL,
                    tags_confirmed: false,
                  };
                }),
              { concurrency: this.config.RSS_FETCH_CONCURRENCY },
            );

            const created = yield* Effect.tryPromise(async () => {
              if (rows.length === 0) return 0;
              const { data, error } = await db
                .from("articles")
                .upsert(rows, { onConflict: "user_id,url", ignoreDuplicates: true })
                .select("id");
              if (error) throw toError(error);
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
        if (error) throw toError(error);
        return data ?? [];
      }).pipe(Effect.orDie);

      if (feedRows.length === 0) {
        return { feedsProcessed: 0, articlesFetched: 0, articlesCreated: 0, errors: [] };
      }

      const profileRow = yield* Effect.tryPromise(async () => {
        const { data, error } = await db.from("user_profiles").select("*").maybeSingle();
        if (error) throw toError(error);
        return data;
      }).pipe(Effect.orDie);

      const weights: PreferenceWeights = profileRow
        ? { tagWeights: profileRow.tag_weights, keywordWeights: profileRow.keyword_weights }
        : { tagWeights: {}, keywordWeights: {} };
      const scoringNeighborCount = profileRow?.tag_knn_k ?? 10;

      // Built once per refresh, shared across every feed/item in this batch,
      // from the user's existing articles — new items being ingested right
      // now aren't in it yet, which is fine (and avoids weird self-reference
      // for a large batch).
      const corpus = yield* Effect.tryPromise(async () => {
        const { data, error } = await db.from("articles").select("title, content");
        if (error) throw toError(error);
        return this.tagging.buildCorpusStats(data ?? []);
      }).pipe(Effect.orDie);

      const outcomes = yield* Effect.forEach(
        feedRows,
        (feed) => this.refreshOneFeed(db, feed, weights, corpus, scoringNeighborCount),
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
