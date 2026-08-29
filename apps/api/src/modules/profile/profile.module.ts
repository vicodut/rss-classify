import type { FastifyInstance } from "fastify";
import { initServer } from "@ts-rest/fastify";
import { container } from "tsyringe";
import { contract } from "@rss-agg/contract";
import { ProfileService } from "./profile.service.js";

const s = initServer();

export async function registerProfileModule(app: FastifyInstance) {
  const service = container.resolve(ProfileService);

  const profileRouter = s.router(contract.profile, {
    get: async ({ request }) => ({ status: 200, body: await service.get(request.db) }),
    update: async ({ body, request }) => ({ status: 200, body: await service.update(request.db, body) }),
    reset: async ({ request }) => ({ status: 200, body: await service.reset(request.db) }),
  });

  await app.register(s.plugin(profileRouter));
}
