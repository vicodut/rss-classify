import { inject, injectable } from "tsyringe";
import type { MatchRatedArticlesRow, TypedSupabaseClient } from "@rss-agg/db";
import { APP_CONFIG } from "../../core/types.js";
import type { AppConfig } from "../../core/config.js";
import { toError } from "../../common/utils/supabase.js";

export interface TagKnnSettings {
  k: number;
  minVotes: number;
  similarityFloor: number;
}

/**
 * The k-NN mechanism used for both tag classification and score prediction
 * (see specs/ML_CLASSIFICATION_SPEC.md) — live queries over embeddings
 * already stored on `articles`, not a trained model or a per-tag
 * prototype/centroid. Both RPC functions (`match_confirmed_tags`,
 * `match_rated_articles`, defined in migration 0003) run with the caller's
 * privileges, so RLS on `articles` still applies exactly as it would through
 * a normal select.
 */
@injectable()
export class ClassificationService {
  constructor(@inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * Votes across the K nearest tags_confirmed=true neighbors, gated by a
   * similarity floor. There is no fixed tag taxonomy and no keyword-based
   * fallback — tags are entirely open-ended and only ever come from the
   * user's own confirmed examples. Returns [] when there isn't yet enough
   * confirmed history to classify with any confidence (cold start), or when
   * no tag clears the vote threshold; the caller decides what to do with an
   * empty result (e.g. leave the article untagged until the user manually
   * tags something, or a later re-run of /articles/classify picks it up
   * once more confirmed examples exist).
   */
  async classifyTags(
    db: TypedSupabaseClient,
    userId: string,
    embedding: number[],
    settings: TagKnnSettings,
  ): Promise<string[]> {
    const { data, error } = await db.rpc("match_confirmed_tags", {
      query_embedding: embedding,
      match_user_id: userId,
      match_model: this.config.EMBEDDING_MODEL,
      match_count: settings.k,
    });
    if (error) throw toError(error);

    const neighbors = data ?? [];
    const bestSimilarity = neighbors[0]?.similarity ?? -Infinity;
    if (neighbors.length === 0 || bestSimilarity < settings.similarityFloor) {
      return [];
    }

    const votes = new Map<string, number>();
    for (const neighbor of neighbors) {
      for (const tag of neighbor.tags) {
        votes.set(tag, (votes.get(tag) ?? 0) + 1);
      }
    }
    return [...votes.entries()].filter(([, count]) => count >= settings.minVotes).map(([tag]) => tag);
  }

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
