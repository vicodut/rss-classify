import { inject, injectable } from "tsyringe";
import { Effect } from "effect";
import {
  articleFromRow,
  parseEmbedding,
  type ArticleRow,
  type MatchRatedArticlesRow,
  type TypedSupabaseClient,
} from "@rss-agg/db";
import type { Article, ListArticlesQuery, RateArticleBody, UpdateArticleTagsBody } from "@rss-agg/contract";
import { toError, unwrap } from "../../common/utils/supabase.js";
import type { AppConfig } from "../../core/config.js";
import { APP_CONFIG } from "../../core/types.js";
import { ScoringService } from "../scoring/scoring.service.js";
import { ClassificationService } from "../scoring/classification.service.js";
import { KeywordTaggingService } from "../scoring/keyword-tagging.service.js";
import { EmbeddingsService, prepareTextForEmbedding } from "../embeddings/embeddings.service.js";
import { ArticleNotFoundError, ProfileNotFoundError } from "./articles.errors.js";
import { fetchArticleLink, type ArticleFetchError } from "./article-link.parser.js";

const UNIQUE_VIOLATION = "23505";

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

interface Cursor {
  score: number | null;
  id: string;
}

function encodeCursor(row: Pick<ArticleRow, "predicted_score" | "id">): string {
  const cursor: Cursor = { score: row.predicted_score, id: row.id };
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(cursor: string): Cursor {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Cursor;
}

/**
 * Any DB failure below is left untyped and surfaces as an Effect defect
 * (via Effect.orDie) rather than a value in the error channel — it's not
 * something a caller can meaningfully recover from, so it bubbles up to
 * Fastify's global error handler as a 500, same as a thrown exception would
 * in the plain async/await methods on this class.
 */
@injectable()
export class ArticlesService {
  constructor(
    @inject(APP_CONFIG) private readonly config: AppConfig,
    @inject(ScoringService) private readonly scoring: ScoringService,
    @inject(ClassificationService) private readonly classification: ClassificationService,
    @inject(KeywordTaggingService) private readonly tagging: KeywordTaggingService,
    @inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
  ) {}

  async list(db: TypedSupabaseClient, query: ListArticlesQuery): Promise<Page<Article>> {
    let builder = db
      .from("articles")
      .select("*")
      .order("predicted_score", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .limit(query.limit + 1);

    if (query.tag) builder = builder.contains("tags", [query.tag]);
    if (query.source) builder = builder.eq("source", query.source);
    if (query.sourceId) builder = builder.eq("source_id", query.sourceId);
    if (query.minScore !== undefined) builder = builder.gte("predicted_score", query.minScore);

    if (query.cursor) {
      const { score, id } = decodeCursor(query.cursor);
      builder =
        score === null
          ? builder.is("predicted_score", null).lt("id", id)
          : builder.or(`predicted_score.lt.${score},and(predicted_score.eq.${score},id.lt.${id})`);
    }

    const rows = unwrap(await builder);
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);

    return {
      items: page.map(articleFromRow),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  }

  async search(db: TypedSupabaseClient, q: string, limit: number): Promise<Page<Article>> {
    const rows = unwrap(
      await db
        .from("articles")
        .select("*")
        .textSearch("search_vector", q, { type: "websearch", config: "english" })
        .order("predicted_score", { ascending: false, nullsFirst: false })
        .limit(limit),
    );

    return { items: rows.map(articleFromRow), nextCursor: null };
  }

  async get(db: TypedSupabaseClient, id: string): Promise<Article | null> {
    const { data, error } = await db.from("articles").select("*").eq("id", id).maybeSingle();
    if (error) throw toError(error);
    return data ? articleFromRow(data) : null;
  }

  async remove(db: TypedSupabaseClient, id: string): Promise<boolean> {
    const { data, error } = await db.from("articles").delete().eq("id", id).select("id");
    if (error) throw toError(error);
    return (data?.length ?? 0) > 0;
  }

  async removeRating(db: TypedSupabaseClient, id: string): Promise<Article | null> {
    const { data, error } = await db
      .from("articles")
      .update({ user_rating: null })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toError(error);
    return data ? articleFromRow(data) : null;
  }

  async toggleSave(db: TypedSupabaseClient, id: string): Promise<Article | null> {
    const { data: current, error: fetchError } = await db
      .from("articles")
      .select("is_saved")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw toError(fetchError);
    if (!current) return null;

    const { data, error } = await db
      .from("articles")
      .update({ is_saved: !current.is_saved })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toError(error);
    return data ? articleFromRow(data) : null;
  }

  /**
   * Idempotent set, not a toggle — there's no UI path to see a dismissed
   * article again to un-dismiss it (Pool/Forecast both filter it out), so a
   * toggle here only ever served as a footgun: the keyboard "dismiss +
   * advance" shortcut fires this on the currently-selected article, and if
   * two presses landed close enough together that React hadn't yet
   * re-rendered with the advanced selection, both would hit the *same*
   * article and toggle it back off — net zero, even though each request
   * individually returned 200. A direct SET is immune to that by
   * construction, and also drops the extra read-before-write round trip.
   */
  async dismiss(db: TypedSupabaseClient, id: string): Promise<Article | null> {
    const { data, error } = await db
      .from("articles")
      .update({ is_dismissed: true })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toError(error);
    return data ? articleFromRow(data) : null;
  }

  /**
   * Adds a single article directly by URL — no feed subscription involved,
   * source_id stays null. Fetches and Readability-extracts the page
   * (article-link.parser.ts), then runs it through the exact same
   * tagging/embedding/scoring pipeline as a feed-ingested item
   * (feeds.service.ts's refreshOneFeed) so it's indistinguishable from any
   * other article afterward.
   */
  addFromUrl(
    db: TypedSupabaseClient,
    userId: string,
    url: string,
  ): Effect.Effect<{ article: Article } | { conflict: true }, ArticleFetchError | ProfileNotFoundError> {
    return Effect.gen(this, function* () {
      const profileRow = yield* Effect.tryPromise(async () => {
        const { data, error } = await db.from("user_profiles").select("*").maybeSingle();
        if (error) throw toError(error);
        return data;
      }).pipe(Effect.orDie);
      if (!profileRow) return yield* Effect.fail(new ProfileNotFoundError());

      const parsed = yield* fetchArticleLink(url, this.config.RSS_FETCH_TIMEOUT_MS);

      const embedding = (yield* Effect.tryPromise(() =>
        this.embeddings.embed([prepareTextForEmbedding(parsed.title, parsed.content)]),
      ).pipe(Effect.orDie))[0]!;

      const corpus = yield* Effect.tryPromise(async () => {
        const { data, error } = await db.from("articles").select("title, content");
        if (error) throw toError(error);
        return this.tagging.buildCorpusStats(data ?? []);
      }).pipe(Effect.orDie);
      const tags = this.tagging.extractTags(parsed.title, parsed.content, corpus);

      const weights = { tagWeights: profileRow.tag_weights, keywordWeights: profileRow.keyword_weights };
      const ratedNeighbors = yield* Effect.tryPromise(() =>
        this.classification.findRatedNeighbors(db, userId, embedding, profileRow.tag_knn_k),
      ).pipe(Effect.orDie);
      const { score, reason } = this.scoring.scoreArticle(
        { tags, title: parsed.title, content: parsed.content },
        weights,
        ratedNeighbors,
      );

      const result = yield* Effect.tryPromise(async () => {
        const { data, error } = await db
          .from("articles")
          .insert({
            user_id: userId,
            source_id: null,
            url,
            title: parsed.title,
            content: parsed.content,
            source: parsed.source,
            tags,
            predicted_score: score,
            reason,
            published_at: parsed.publishedAt,
            embedding,
            embedding_model: this.config.EMBEDDING_MODEL,
            tags_confirmed: false,
          })
          .select("*")
          .single();
        if (error) {
          if (error.code === UNIQUE_VIOLATION) return { conflict: true as const };
          throw toError(error);
        }
        return { article: articleFromRow(data) };
      }).pipe(Effect.orDie);

      return result;
    });
  }

  /**
   * Manual tag correction, decoupled from rating — a labeling event, not a
   * preference signal. Full-replacement semantics; sets tags_confirmed=true
   * (this article becomes eligible as a k-NN neighbor for future
   * classification/scoring) and recomputes only this article's score. Does
   * NOT call learnFromRating and does NOT trigger the unrated-articles
   * re-rank that rate() does.
   */
  async updateTags(
    db: TypedSupabaseClient,
    id: string,
    body: UpdateArticleTagsBody,
  ): Promise<Article | null> {
    const { data: articleRow, error: articleError } = await db
      .from("articles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (articleError) throw toError(articleError);
    if (!articleRow) return null;

    const { data: profileRow, error: profileError } = await db
      .from("user_profiles")
      .select("*")
      .maybeSingle();
    if (profileError) throw toError(profileError);
    if (!profileRow) return null;

    const weights = { tagWeights: profileRow.tag_weights, keywordWeights: profileRow.keyword_weights };
    const embedding = parseEmbedding(articleRow.embedding);
    const ratedNeighbors = embedding
      ? await this.classification.findRatedNeighbors(db, profileRow.id, embedding, profileRow.tag_knn_k)
      : [];
    const { score, reason } = this.scoring.scoreArticle(
      { tags: body.tags, title: articleRow.title, content: articleRow.content },
      weights,
      ratedNeighbors,
    );

    const { data, error } = await db
      .from("articles")
      .update({ tags: body.tags, tags_confirmed: true, predicted_score: score, reason })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toError(error);
    return data ? articleFromRow(data) : null;
  }

  /**
   * Manually (re)runs content-based tag extraction (KeywordTaggingService —
   * TF-IDF over the user's own corpus, not a k-NN vote against previously
   * assigned tags) over the user's articles that aren't yet tags_confirmed:
   * both genuinely untagged articles and previously machine-tagged ones, so
   * a re-run benefits from the corpus having grown since the last pass.
   * Recomputes predicted_score/reason alongside tags, since the score is a
   * function of tags. Automatic tag extraction otherwise only ever runs
   * once, at ingest, for genuinely new articles (feeds.service.ts) — this is
   * the other of the two places it's allowed to run: an explicit manual
   * trigger, never as a side effect of rating or rescoring.
   */
  async classifyTags(
    db: TypedSupabaseClient,
    userId: string,
    limit: number,
  ): Promise<{ candidatesConsidered: number; articlesUpdated: number }> {
    const { data: profileRow, error: profileError } = await db.from("user_profiles").select("*").maybeSingle();
    if (profileError) throw toError(profileError);
    if (!profileRow) return { candidatesConsidered: 0, articlesUpdated: 0 };

    const weights = { tagWeights: profileRow.tag_weights, keywordWeights: profileRow.keyword_weights };
    const scoringNeighborCount = profileRow.tag_knn_k;

    const { data: allArticles, error: corpusError } = await db.from("articles").select("title, content");
    if (corpusError) throw toError(corpusError);
    const corpus = this.tagging.buildCorpusStats(allArticles ?? []);

    const { data: rows, error } = await db
      .from("articles")
      .select("id, embedding, title, content")
      .eq("tags_confirmed", false)
      .limit(limit);
    if (error) throw toError(error);
    const candidates = rows ?? [];

    let articlesUpdated = 0;
    await Effect.runPromise(
      Effect.forEach(
        candidates,
        (row) =>
          Effect.tryPromise(async () => {
            const tags = this.tagging.extractTags(row.title, row.content, corpus);

            const embedding = parseEmbedding(row.embedding);
            const ratedNeighbors = embedding
              ? await this.classification.findRatedNeighbors(db, userId, embedding, scoringNeighborCount)
              : [];
            const { score, reason } = this.scoring.scoreArticle(
              { tags, title: row.title, content: row.content },
              weights,
              ratedNeighbors,
            );

            // Always write the fresh result, even an empty tag list — a
            // candidate that no longer clears the relevance bar should
            // visibly lose its old (now-considered-irrelevant) tags rather
            // than silently keeping whatever a previous, looser pass wrote.
            const { error: updateError } = await db
              .from("articles")
              .update({ tags, predicted_score: score, reason })
              .eq("id", row.id);
            if (updateError) throw toError(updateError);
            if (tags.length > 0) articlesUpdated++;
          }).pipe(Effect.ignore),
        { concurrency: 5 },
      ),
    );

    return { candidatesConsidered: candidates.length, articlesUpdated };
  }

  /**
   * Manually re-runs the k-NN-over-ratings scoring pass (the same mechanism
   * as rate()'s backgrounded re-rank) on demand — for example after tuning
   * tag_knn_k/keywordWeights in profile settings, without waiting for a new
   * rating to trigger it. Only touches predicted_score/reason; tags are
   * never extracted or changed here, keeping this fully separate from
   * classifyTags (content -> tags) as two distinct, independently-triggered
   * operations.
   */
  async rescoreFromRatings(
    db: TypedSupabaseClient,
    limit: number,
  ): Promise<{ candidatesConsidered: number; articlesUpdated: number }> {
    const { data: profileRow, error: profileError } = await db.from("user_profiles").select("*").maybeSingle();
    if (profileError) throw toError(profileError);
    if (!profileRow) return { candidatesConsidered: 0, articlesUpdated: 0 };

    const weights = { tagWeights: profileRow.tag_weights, keywordWeights: profileRow.keyword_weights };

    const { data: rows, error } = await db
      .from("articles")
      .select("id, embedding, tags, title, content")
      .is("user_rating", null)
      .limit(limit);
    if (error) throw toError(error);
    const candidates = rows ?? [];

    let articlesUpdated = 0;
    await Effect.runPromise(
      Effect.forEach(
        candidates,
        (row) =>
          Effect.tryPromise(async () => {
            const embedding = parseEmbedding(row.embedding);
            const ratedNeighbors = embedding
              ? await this.classification.findRatedNeighbors(db, profileRow.id, embedding, profileRow.tag_knn_k)
              : [];
            const { score, reason } = this.scoring.scoreArticle(
              { tags: row.tags, title: row.title, content: row.content },
              weights,
              ratedNeighbors,
            );

            const { error: updateError } = await db
              .from("articles")
              .update({ predicted_score: score, reason })
              .eq("id", row.id);
            if (updateError) throw toError(updateError);
            articlesUpdated++;
          }).pipe(Effect.ignore),
        { concurrency: 5 },
      ),
    );

    return { candidatesConsidered: candidates.length, articlesUpdated };
  }

  /**
   * Rate an article, run the Phase 2 learning update on the user's tag
   * weights, and recalculate predicted_score for the user's unrated
   * articles. Uses Effect for the typed not-found errors and the concurrent
   * recalculation pass (RSS_AGGREGATOR_SPECS.md "Scoring Algorithm" Phase 2).
   */
  rate(
    db: TypedSupabaseClient,
    id: string,
    body: RateArticleBody,
  ): Effect.Effect<Article, ArticleNotFoundError | ProfileNotFoundError> {
    return Effect.gen(this, function* () {
      const articleRow = yield* Effect.tryPromise(async () => {
        const { data, error } = await db.from("articles").select("*").eq("id", id).maybeSingle();
        if (error) throw toError(error);
        return data;
      }).pipe(Effect.orDie);
      if (!articleRow) return yield* Effect.fail(new ArticleNotFoundError());

      const profileRow = yield* Effect.tryPromise(async () => {
        const { data, error } = await db.from("user_profiles").select("*").maybeSingle();
        if (error) throw toError(error);
        return data;
      }).pipe(Effect.orDie);
      if (!profileRow) return yield* Effect.fail(new ProfileNotFoundError());

      const tags = body.tags ?? articleRow.tags;
      const newTagWeights = this.scoring.learnFromRating(profileRow.tag_weights, tags, body.rating);
      const weights = { tagWeights: newTagWeights, keywordWeights: profileRow.keyword_weights };
      const ownEmbedding = parseEmbedding(articleRow.embedding);
      const ownNeighbors = yield* ownEmbedding
        ? Effect.tryPromise(() =>
            this.classification.findRatedNeighbors(db, profileRow.id, ownEmbedding, profileRow.tag_knn_k),
          ).pipe(Effect.orDie)
        : Effect.succeed<MatchRatedArticlesRow[]>([]);
      const { score: newScore, reason: newReason } = this.scoring.scoreArticle(
        { tags, title: articleRow.title, content: articleRow.content },
        weights,
        ownNeighbors,
      );

      const newTotal = profileRow.total_articles_rated + 1;
      const newAverage =
        (profileRow.average_rating * profileRow.total_articles_rated + body.rating) / newTotal;

      yield* Effect.tryPromise(async () => {
        const { error } = await db
          .from("user_profiles")
          .update({
            tag_weights: newTagWeights,
            total_articles_rated: newTotal,
            average_rating: newAverage,
          })
          .eq("id", profileRow.id);
        if (error) throw toError(error);
      }).pipe(Effect.orDie);

      const updatedRow = yield* Effect.tryPromise(async () => {
        const { data, error } = await db
          .from("articles")
          .update({
            tags,
            user_rating: body.rating,
            predicted_score: newScore,
            reason: newReason,
            // Only a human touching tags is eligible k-NN training data —
            // the keyword heuristic/k-NN classifier never sets this itself.
            ...(body.tags ? { tags_confirmed: true } : {}),
          })
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw toError(error);
        return data;
      }).pipe(Effect.orDie);

      // Refining every other unrated article's score is a background
      // nice-to-have, not something the user should wait on — forked
      // (not yielded) so rating stays fast regardless of corpus size,
      // instead of blocking the response on N sequential k-NN RPC round
      // trips (70 unrated articles at concurrency 5 was ~14 sequential
      // network round trips, ~2s, before this change).
      Effect.runFork(
        Effect.gen(this, function* () {
          const unrated = yield* Effect.tryPromise(async () => {
            const { data, error } = await db
              .from("articles")
              .select("*")
              .is("user_rating", null)
              .neq("id", id);
            if (error) throw toError(error);
            return data;
          }).pipe(Effect.orDie);

          yield* Effect.forEach(
            unrated,
            (row) =>
              Effect.tryPromise(async () => {
                const rowEmbedding = parseEmbedding(row.embedding);
                const neighbors = rowEmbedding
                  ? await this.classification.findRatedNeighbors(
                      db,
                      profileRow.id,
                      rowEmbedding,
                      profileRow.tag_knn_k,
                    )
                  : [];
                const { score, reason } = this.scoring.scoreArticle(
                  { tags: row.tags, title: row.title, content: row.content },
                  weights,
                  neighbors,
                );
                const { error } = await db
                  .from("articles")
                  .update({ predicted_score: score, reason })
                  .eq("id", row.id);
                if (error) throw toError(error);
              }).pipe(Effect.ignore),
            { concurrency: 5 },
          );
        }),
      );

      return articleFromRow(updatedRow);
    });
  }
}
