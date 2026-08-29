import type { FastifyInstance } from "fastify";
import { initServer } from "@ts-rest/fastify";
import { contract } from "@rss-agg/contract";

const s = initServer();

const healthRouter = s.router(
  { health: contract.health },
  {
    health: async () => ({
      status: 200,
      body: { status: "ok" as const, uptime: process.uptime() },
    }),
  },
);

export async function registerHealthModule(app: FastifyInstance) {
  await app.register(s.plugin(healthRouter));
}
