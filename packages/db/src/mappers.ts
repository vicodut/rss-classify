import type { Article, Feed, UserProfile } from "@rss-agg/contract";
import type { ArticleRow, FeedRow, UserProfileRow } from "./types.js";

export function articleFromRow(row: ArticleRow): Article {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    title: row.title,
    content: row.content,
    source: row.source,
    tags: row.tags,
    userRating: row.user_rating,
    predictedScore: row.predicted_score,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    sourceId: row.source_id,
    isSaved: row.is_saved,
    isDismissed: row.is_dismissed,
    reason: row.reason,
    tagsConfirmed: row.tags_confirmed,
  };
}

/**
 * PostgREST returns pgvector columns as their text representation
 * (`"[0.1,0.2,...]"`), which happens to be valid JSON — never as a parsed
 * array. Centralized here since it's specifically about interpreting a DB
 * column value, not an apps/api-specific concern.
 */
export function parseEmbedding(value: string | number[] | null): number[] | null {
  if (value === null) return null;
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as number[]) : null;
  } catch {
    return null;
  }
}

export function feedFromRow(row: FeedRow): Feed {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    title: row.title,
    description: row.description,
    lastFetched: row.last_fetched,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function profileFromRow(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    tagWeights: row.tag_weights,
    keywordWeights: row.keyword_weights,
    totalArticlesRated: row.total_articles_rated,
    averageRating: row.average_rating,
    updatedAt: row.updated_at,
    tagKnnK: row.tag_knn_k,
    tagKnnMinVotes: row.tag_knn_min_votes,
    tagKnnSimilarityFloor: row.tag_knn_similarity_floor,
  };
}
