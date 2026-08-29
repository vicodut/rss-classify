import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface SupabaseEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

/**
 * Per-request client scoped to the caller's Supabase access token, so
 * Postgres RLS policies enforce per-user isolation automatically — no
 * service role, no manual `.eq("user_id", ...)` bugs to worry about.
 */
export function createUserScopedClient(
  env: SupabaseEnv,
  accessToken: string,
): TypedSupabaseClient {
  return createClient<Database>(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Bypasses RLS. Only for trusted server-side jobs that must span every
 * user, e.g. the scheduled feed-refresh cron. Never expose to a request
 * handler that hasn't independently authenticated the caller.
 */
export function createServiceRoleClient(env: SupabaseEnv): TypedSupabaseClient {
  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
