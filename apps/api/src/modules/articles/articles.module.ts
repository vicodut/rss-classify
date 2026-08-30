import type { FastifyInstance } from "fastify";
import { initServer } from "@ts-rest/fastify";
import { container } from "tsyringe";
import { Effect } from "effect";
import { contract } from "@rss-agg/contract";
import { ArticlesService } from "./articles.service.js";

const s = initServer();

export async function registerArticlesModule(app: FastifyInstance) {
  const service = container.resolve(ArticlesService);

  const articlesRouter = s.router(contract.articles, {
    list: async ({ query, request }) => ({
      status: 200,
      body: await service.list(request.db, query),
    }),
    search: async ({ query, request }) => ({
      status: 200,
      body: await service.search(request.db, query.q, query.limit),
    }),
    get: async ({ params, request }) => {
      const article = await service.get(request.db, params.id);
      if (!article) return { status: 404, body: { error: { message: "Article not found" } } };
      return { status: 200, body: article };
    },
    rate: ({ params, body, request }) =>
      Effect.runPromise(
        service.rate(request.db, params.id, body).pipe(
          Effect.map((article) => ({ status: 200 as const, body: article })),
          Effect.catchTags({
            ArticleNotFoundError: () =>
              Effect.succeed({
                status: 404 as const,
                body: { error: { message: "Article not found" } },
              }),
            ProfileNotFoundError: () =>
              Effect.succeed({
                status: 404 as const,
                body: { error: { message: "User profile not found" } },
              }),
          }),
        ),
      ),
    updateTags: async ({ params, body, request }) => {
      const article = await service.updateTags(request.db, params.id, body);
      if (!article) return { status: 404, body: { error: { message: "Article not found" } } };
      return { status: 200, body: article };
    },
    removeRating: async ({ params, request }) => {
      const article = await service.removeRating(request.db, params.id);
      if (!article) return { status: 404, body: { error: { message: "Article not found" } } };
      return { status: 200, body: article };
    },
    remove: async ({ params, request }) => {
      const removed = await service.remove(request.db, params.id);
      if (!removed) return { status: 404, body: { error: { message: "Article not found" } } };
      return { status: 200, body: { success: true as const } };
    },
    toggleSave: async ({ params, request }) => {
      const article = await service.toggleSave(request.db, params.id);
      if (!article) return { status: 404, body: { error: { message: "Article not found" } } };
      return { status: 200, body: article };
    },
    dismiss: async ({ params, request }) => {
      const article = await service.dismiss(request.db, params.id);
      if (!article) return { status: 404, body: { error: { message: "Article not found" } } };
      return { status: 200, body: article };
    },
    classify: async ({ body, request }) => {
      const result =
        body.mode === "ratings"
          ? await service.rescoreFromRatings(request.db, body.limit ?? 100)
          : await service.classifyTags(request.db, request.user.id, body.limit ?? 100);
      return { status: 200, body: result };
    },
    addLink: ({ body, request }) =>
      Effect.runPromise(
        service.addFromUrl(request.db, request.user.id, body.url).pipe(
          Effect.map((result) =>
            "conflict" in result
              ? { status: 409 as const, body: { error: { message: "You've already added this URL" } } }
              : { status: 201 as const, body: result.article },
          ),
          Effect.catchTags({
            ProfileNotFoundError: () =>
              Effect.succeed({
                status: 404 as const,
                body: { error: { message: "User profile not found" } },
              }),
            ArticleFetchError: (err) =>
              Effect.succeed({
                status: 422 as const,
                body: { error: { message: err.message } },
              }),
          }),
        ),
      ),
  });

  await app.register(s.plugin(articlesRouter));
}
