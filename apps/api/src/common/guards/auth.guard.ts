import type { FastifyReply, FastifyRequest } from "fastify";
import { createUserScopedClient } from "@rss-agg/db";
import type { AppConfig } from "../../core/config.js";

/**
 * Verifies the `Authorization: Bearer <token>` header against Supabase and
 * attaches `request.user` + a user-scoped `request.db` client (RLS-enforced).
 * Register as a `preHandler` on every route group except /health.
 */
export function createAuthenticateHook(config: AppConfig) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (!token) {
      return reply.code(401).send({ error: { message: "Missing bearer token" } });
    }

    const db = createUserScopedClient(
      {
        url: config.SUPABASE_URL,
        anonKey: config.SUPABASE_ANON_KEY,
        serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
      },
      token,
    );

    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) {
      return reply.code(401).send({ error: { message: "Invalid or expired token" } });
    }

    request.user = data.user;
    request.db = db;
  };
}
