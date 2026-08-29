import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  articleSchema,
  createFeedBodySchema,
  errorResponseSchema,
  feedSchema,
  listArticlesQuerySchema,
  paginatedSchema,
  rateArticleBodySchema,
  refreshFeedsBodySchema,
  refreshFeedsResultSchema,
  searchArticlesQuerySchema,
  statsSummarySchema,
  statsTrendingQuerySchema,
  trendingTagSchema,
  updateProfileBodySchema,
  userProfileSchema,
} from "./schemas.js";

const c = initContract();

/**
 * Documents that protected routes expect a Supabase access token. Optional at
 * the type level so a shared client fetcher can inject it on every call
 * without every call site repeating it — actual enforcement happens
 * server-side in the Fastify auth guard, independent of this schema.
 */
const authHeaders = z.object({
  authorization: z.string().describe("Bearer <supabase access token>").optional(),
});

const articlesContract = c.router(
  {
    list: {
      method: "GET",
      path: "/articles",
      query: listArticlesQuerySchema,
      responses: {
        200: paginatedSchema(articleSchema),
        401: errorResponseSchema,
      },
      summary: "List articles with filters, sorted by predicted score",
    },
    search: {
      method: "GET",
      path: "/articles/search",
      query: searchArticlesQuerySchema,
      responses: {
        200: paginatedSchema(articleSchema),
        401: errorResponseSchema,
      },
      summary: "Full-text search articles",
    },
    get: {
      method: "GET",
      path: "/articles/:id",
      responses: {
        200: articleSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Get article detail",
    },
    rate: {
      method: "POST",
      path: "/articles/:id/rate",
      body: rateArticleBodySchema,
      responses: {
        200: articleSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Rate an article (1-5) and optionally correct its tags",
    },
    removeRating: {
      method: "DELETE",
      path: "/articles/:id/rating",
      body: z.object({}).optional(),
      responses: {
        200: articleSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Remove a user's rating from an article",
    },
    remove: {
      method: "DELETE",
      path: "/articles/:id",
      body: z.object({}).optional(),
      responses: {
        200: z.object({ success: z.literal(true) }),
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Delete an article",
    },
  },
  { baseHeaders: authHeaders },
);

const feedsContract = c.router(
  {
    list: {
      method: "GET",
      path: "/feeds",
      responses: {
        200: z.array(feedSchema),
        401: errorResponseSchema,
      },
      summary: "List the current user's feeds",
    },
    get: {
      method: "GET",
      path: "/feeds/:id",
      responses: {
        200: feedSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Get feed details",
    },
    create: {
      method: "POST",
      path: "/feeds",
      body: createFeedBodySchema,
      responses: {
        201: feedSchema,
        401: errorResponseSchema,
        409: errorResponseSchema,
      },
      summary: "Register a new feed",
    },
    remove: {
      method: "DELETE",
      path: "/feeds/:id",
      body: z.object({}).optional(),
      responses: {
        200: z.object({ success: z.literal(true) }),
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
      summary: "Delete a feed",
    },
    refresh: {
      method: "POST",
      path: "/feeds/refresh",
      body: refreshFeedsBodySchema,
      responses: {
        200: refreshFeedsResultSchema,
        401: errorResponseSchema,
      },
      summary: "Fetch all active feeds (or one specific feed)",
    },
  },
  { baseHeaders: authHeaders },
);

const profileContract = c.router(
  {
    get: {
      method: "GET",
      path: "/profile",
      responses: {
        200: userProfileSchema,
        401: errorResponseSchema,
      },
      summary: "Get the current user's tag/keyword weights",
    },
    update: {
      method: "PATCH",
      path: "/profile",
      body: updateProfileBodySchema,
      responses: {
        200: userProfileSchema,
        401: errorResponseSchema,
      },
      summary: "Manually adjust preference weights",
    },
    reset: {
      method: "POST",
      path: "/profile/reset",
      body: z.object({}).optional(),
      responses: {
        200: userProfileSchema,
        401: errorResponseSchema,
      },
      summary: "Reset all learned preferences",
    },
  },
  { baseHeaders: authHeaders },
);

const statsContract = c.router(
  {
    summary: {
      method: "GET",
      path: "/stats/summary",
      responses: {
        200: statsSummarySchema,
        401: errorResponseSchema,
      },
      summary: "Overview stats",
    },
    trending: {
      method: "GET",
      path: "/stats/trending",
      query: statsTrendingQuerySchema,
      responses: {
        200: z.array(trendingTagSchema),
        401: errorResponseSchema,
      },
      summary: "Trending tags over time",
    },
  },
  { baseHeaders: authHeaders },
);

export const contract = c.router(
  {
    health: {
      method: "GET",
      path: "/health",
      responses: {
        200: z.object({ status: z.literal("ok"), uptime: z.number() }),
      },
      summary: "Service health check (unauthenticated)",
    },
    articles: articlesContract,
    feeds: feedsContract,
    profile: profileContract,
    stats: statsContract,
  },
  { pathPrefix: "/api" },
);

export type Contract = typeof contract;
