import { injectable } from "tsyringe";
import { profileFromRow, type TypedSupabaseClient, type UserProfileRow } from "@rss-agg/db";
import type { UpdateProfileBody, UserProfile } from "@rss-agg/contract";
import { clamp } from "../../common/utils/math.js";
import { toError } from "../../common/utils/supabase.js";

function mergeClamped(
  existing: Record<string, number>,
  partial: Record<string, number> | undefined,
): Record<string, number> {
  if (!partial) return existing;
  const merged = { ...existing };
  for (const [key, value] of Object.entries(partial)) {
    merged[key] = clamp(value, 0, 1);
  }
  return merged;
}

/**
 * The RLS policy on user_profiles scopes every row to `auth.uid() = id`, so
 * there is always exactly one row visible to the current user — `.single()`
 * with no explicit filter is safe and intentional here, not a missed filter.
 */
@injectable()
export class ProfileService {
  async get(db: TypedSupabaseClient): Promise<UserProfile> {
    const { data, error } = await db.from("user_profiles").select("*").single();
    if (error) throw toError(error);
    return profileFromRow(data);
  }

  async update(db: TypedSupabaseClient, body: UpdateProfileBody): Promise<UserProfile> {
    const existing = await this.getRow(db);

    const { data, error } = await db
      .from("user_profiles")
      .update({
        tag_weights: mergeClamped(existing.tag_weights, body.tagWeights),
        keyword_weights: mergeClamped(existing.keyword_weights, body.keywordWeights),
        ...(body.tagKnnK !== undefined ? { tag_knn_k: body.tagKnnK } : {}),
        ...(body.tagKnnMinVotes !== undefined ? { tag_knn_min_votes: body.tagKnnMinVotes } : {}),
        ...(body.tagKnnSimilarityFloor !== undefined
          ? { tag_knn_similarity_floor: body.tagKnnSimilarityFloor }
          : {}),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw toError(error);
    return profileFromRow(data);
  }

  async reset(db: TypedSupabaseClient): Promise<UserProfile> {
    const existing = await this.getRow(db);

    const { data, error } = await db
      .from("user_profiles")
      .update({
        tag_weights: {},
        keyword_weights: {},
        total_articles_rated: 0,
        average_rating: 0,
        tag_knn_k: 10,
        tag_knn_min_votes: 2,
        tag_knn_similarity_floor: 0.18,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw toError(error);
    return profileFromRow(data);
  }

  private async getRow(db: TypedSupabaseClient): Promise<UserProfileRow> {
    const { data, error } = await db.from("user_profiles").select("*").single();
    if (error) throw toError(error);
    return data;
  }
}
