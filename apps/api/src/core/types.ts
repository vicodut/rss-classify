import "fastify";
import type { User } from "@supabase/supabase-js";
import type { TypedSupabaseClient } from "@rss-agg/db";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the `authenticate` hook on every route under the protected prefix. */
    user: User;
    /** Client scoped to `user`'s access token — RLS enforces isolation. */
    db: TypedSupabaseClient;
  }
}

export const APP_CONFIG = Symbol("AppConfig");
