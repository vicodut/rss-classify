import { inject, injectable } from "tsyringe";
import type { MatchRatedArticlesRow, TypedSupabaseClient } from "@rss-agg/db";
import { APP_CONFIG } from "../../core/types.js";
import type { AppConfig } from "../../core/config.js";
import { toError } from "../../common/utils/supabase.js";

/**
 * k-NN over embeddings for score prediction (see specs/ML_CLASSIFICATION_SPEC.md)
 * — a live query, not a trained model. Tag *naming* is handled separately by
 * KeywordTaggingService (content-based extraction, not embedding similarity):
 * a k-NN vote can only ever reproduce tags that already exist in a confirmed
 * pool, which is fine for scoring (there's no "inventing" a rating) but wrong
 * for tagging, where the whole point is to name what an article is actually
 * about.
 */
@injectable()
export class ClassificationService {
  constructor(@inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Raw neighbor data for ScoringService's knnScore term — kept pure/DB-free itself. */
  async findRatedNeighbors(
    db: TypedSupabaseClient,
    userId: string,
    embedding: number[],
    k: number,
  ): Promise<MatchRatedArticlesRow[]> {
    const { data, error } = await db.rpc("match_rated_articles", {
      query_embedding: embedding,
      match_user_id: userId,
      match_model: this.config.EMBEDDING_MODEL,
      match_count: k,
    });
    if (error) throw toError(error);
    return data ?? [];
  }
}
