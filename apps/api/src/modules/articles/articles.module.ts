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
    toggleDismiss: async ({ params, request }) => {
      const article = await service.toggleDismiss(request.db, params.id);
      if (!article) return { status: 404, body: { error: { message: "Article not found" } } };
      return { status: 200, body: article };
    },
  });

  await app.register(s.plugin(articlesRouter));
}
