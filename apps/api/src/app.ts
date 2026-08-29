import Fastify, { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { AppConfig } from "./core/config.js";
import { createAuthenticateHook } from "./common/guards/auth.guard.js";
import { globalErrorHandler } from "./common/filters/error.filter.js";
import { registerHealthModule } from "./modules/health/health.module.js";

export async function createApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.NODE_ENV === "development" ? "info" : "warn" },
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGIN });

  app.setErrorHandler(globalErrorHandler);

  await registerHealthModule(app);
  await app.register(protectedRoutes(config));

  return app;
}

/**
 * Every module registered inside this encapsulated context requires a valid
 * Supabase bearer token — Fastify plugin encapsulation keeps the auth hook
 * from leaking onto /health. Feature modules add themselves via
 * `registerModules` below.
 */
function protectedRoutes(config: AppConfig): FastifyPluginAsync {
  return async (app) => {
    app.addHook("preHandler", createAuthenticateHook(config));
    await registerModules(app);
  };
}

async function registerModules(app: FastifyInstance) {
  void app;
  // Feature modules (articles, feeds, profile, stats) register themselves
  // here, e.g. `await registerArticlesModule(app);`
}
