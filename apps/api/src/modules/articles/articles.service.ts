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
import { ScoringService } from "../scoring/scoring.service.js";
import { ClassificationService } from "../scoring/classification.service.js";
import { ArticleNotFoundError, ProfileNotFoundError } from "./articles.errors.js";

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
    @inject(ScoringService) private readonly scoring: ScoringService,
    @inject(ClassificationService) private readonly classification: ClassificationService,
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
    return this.toggleFlag(db, id, "is_saved");
  }

  async toggleDismiss(db: TypedSupabaseClient, id: string): Promise<Article | null> {
    return this.toggleFlag(db, id, "is_dismissed");
  }

  private async toggleFlag(
    db: TypedSupabaseClient,
    id: string,
    column: "is_saved" | "is_dismissed",
  ): Promise<Article | null> {
    const { data: current, error: fetchError } = await db
      .from("articles")
      .select("is_saved, is_dismissed")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw toError(fetchError);
    if (!current) return null;

    const update =
      column === "is_saved"
        ? { is_saved: !current.is_saved }
        : { is_dismissed: !current.is_dismissed };

    const { data, error } = await db
      .from("articles")
      .update(update)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toError(error);
    return data ? articleFromRow(data) : null;
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
   * Manually (re)runs k-NN tag classification over the user's articles that
   * aren't yet tags_confirmed — both genuinely untagged articles (ingest no
   * longer auto-tags with a fixed taxonomy, see ClassificationService) and
   * previously machine-guessed ones, so a re-run benefits from confirmations
   * made since the last pass. Skips rows with no stored embedding yet (needs
   * the backfill script). Recomputes predicted_score/reason alongside tags
   * whenever a confident classification is found; leaves an article
   * untouched when the classifier still can't confidently tag it.
   */
  async classifyUnconfirmed(
    db: TypedSupabaseClient,
    userId: string,
    limit: number,
  ): Promise<{ candidatesConsidered: number; articlesTagged: number }> {
    const { data: profileRow, error: profileError } = await db.from("user_profiles").select("*").maybeSingle();
    if (profileError) throw toError(profileError);
    if (!profileRow) return { candidatesConsidered: 0, articlesTagged: 0 };

    const weights = { tagWeights: profileRow.tag_weights, keywordWeights: profileRow.keyword_weights };
    const tagKnn = {
      k: profileRow.tag_knn_k,
      minVotes: profileRow.tag_knn_min_votes,
      similarityFloor: profileRow.tag_knn_similarity_floor,
    };

    const { data: rows, error } = await db
      .from("articles")
      .select("id, embedding, title, content")
      .eq("tags_confirmed", false)
      .not("embedding", "is", null)
      .limit(limit);
    if (error) throw toError(error);
    const candidates = rows ?? [];

    let articlesTagged = 0;
    await Effect.runPromise(
      Effect.forEach(
        candidates,
        (row) =>
          Effect.tryPromise(async () => {
            const embedding = parseEmbedding(row.embedding);
            if (!embedding) return;

            const tags = await this.classification.classifyTags(db, userId, embedding, tagKnn);
            if (tags.length === 0) return;

            const ratedNeighbors = await this.classification.findRatedNeighbors(db, userId, embedding, tagKnn.k);
            const { score, reason } = this.scoring.scoreArticle(
              { tags, title: row.title, content: row.content },
              weights,
              ratedNeighbors,
            );

            const { error: updateError } = await db
              .from("articles")
              .update({ tags, predicted_score: score, reason })
              .eq("id", row.id);
            if (updateError) throw toError(updateError);
            articlesTagged++;
          }).pipe(Effect.ignore),
        { concurrency: 5 },
      ),
    );

    return { candidatesConsidered: candidates.length, articlesTagged };
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
              ? await this.classification.findRatedNeighbors(db, profileRow.id, rowEmbedding, profileRow.tag_knn_k)
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

      return articleFromRow(updatedRow);
    });
  }
}
