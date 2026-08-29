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
  };
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
  };
}
