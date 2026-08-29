import type { FastifyInstance } from "fastify";
import { initServer } from "@ts-rest/fastify";
import { container } from "tsyringe";
import { Effect } from "effect";
import { contract } from "@rss-agg/contract";
import { FeedsService } from "./feeds.service.js";

const s = initServer();

export async function registerFeedsModule(app: FastifyInstance) {
  const service = container.resolve(FeedsService);

  const feedsRouter = s.router(contract.feeds, {
    list: async ({ request }) => ({ status: 200, body: await service.list(request.db) }),
    get: async ({ params, request }) => {
      const feed = await service.get(request.db, params.id);
      if (!feed) return { status: 404, body: { error: { message: "Feed not found" } } };
      return { status: 200, body: feed };
    },
    create: async ({ body, request }) => {
      const result = await service.create(request.db, request.user.id, body);
      if ("conflict" in result) {
        return { status: 409, body: { error: { message: "Feed already exists" } } };
      }
      return { status: 201, body: result.feed };
    },
    remove: async ({ params, request }) => {
      const removed = await service.remove(request.db, params.id);
      if (!removed) return { status: 404, body: { error: { message: "Feed not found" } } };
      return { status: 200, body: { success: true as const } };
    },
    refresh: async ({ body, request }) => ({
      status: 200,
      body: await Effect.runPromise(service.refresh(request.db, body.feedId)),
    }),
  });

  await app.register(s.plugin(feedsRouter));
}
