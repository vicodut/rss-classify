import type { FastifyInstance } from "fastify";
import { initServer } from "@ts-rest/fastify";
import { container } from "tsyringe";
import { contract } from "@rss-agg/contract";
import { StatsService } from "./stats.service.js";

const s = initServer();

export async function registerStatsModule(app: FastifyInstance) {
  const service = container.resolve(StatsService);

  const statsRouter = s.router(contract.stats, {
    summary: async ({ request }) => ({ status: 200, body: await service.summary(request.db) }),
    trending: async ({ query, request }) => ({
      status: 200,
      body: await service.trending(request.db, query.days),
    }),
  });

  await app.register(s.plugin(statsRouter));
}
