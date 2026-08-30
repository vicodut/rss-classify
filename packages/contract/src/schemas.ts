import { z } from "zod";

export const DEFAULT_TAGS = [
  "Tech",
  "Politics",
  "Art",
  "Science",
  "Sports",
  "Business",
  "Health",
  "Entertainment",
  "Education",
] as const;

export const articleSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  url: z.string().url(),
  title: z.string(),
  content: z.string().nullable(),
  source: z.string().nullable(),
  tags: z.array(z.string()),
  userRating: z.number().int().min(1).max(5).nullable(),
  predictedScore: z.number().min(0).max(5).nullable(),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  sourceId: z.string().uuid().nullable(),
  isSaved: z.boolean(),
  isDismissed: z.boolean(),
  reason: z.string().nullable(),
});
export type Article = z.infer<typeof articleSchema>;

export const listArticlesQuerySchema = z.object({
  tag: z.string().optional(),
  source: z.string().optional(),
  minScore: z.coerce.number().min(0).max(5).optional(),
  sourceId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  cursor: z.string().optional(),
});
export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;

export const searchArticlesQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const rateArticleBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string()).optional(),
});
export type RateArticleBody = z.infer<typeof rateArticleBodySchema>;

export const feedSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  url: z.string().url(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  lastFetched: z.string().datetime().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Feed = z.infer<typeof feedSchema>;

export const createFeedBodySchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
});
export type CreateFeedBody = z.infer<typeof createFeedBodySchema>;

export const refreshFeedsBodySchema = z.object({
  feedId: z.string().uuid().optional(),
});

export const refreshFeedsResultSchema = z.object({
  feedsProcessed: z.number(),
  articlesFetched: z.number(),
  articlesCreated: z.number(),
  errors: z.array(z.object({ feedId: z.string().uuid(), message: z.string() })),
});

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  tagWeights: z.record(z.string(), z.number()),
  keywordWeights: z.record(z.string(), z.number()),
  totalArticlesRated: z.number().int(),
  averageRating: z.number(),
  updatedAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateProfileBodySchema = z.object({
  tagWeights: z.record(z.string(), z.number().min(0).max(1)).optional(),
  keywordWeights: z.record(z.string(), z.number().min(0).max(1)).optional(),
});
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

export const statsSummarySchema = z.object({
  totalArticles: z.number(),
  totalFeeds: z.number(),
  totalRated: z.number(),
  averageRating: z.number(),
  averagePredictedScore: z.number(),
});

export const trendingTagSchema = z.object({
  tag: z.string(),
  count: z.number(),
  averageRating: z.number().nullable(),
});

export const statsTrendingQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const errorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});

export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
