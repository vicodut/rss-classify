import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { Database } from "./types.js";

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface SupabaseEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

/**
 * We never use Supabase Realtime, but the client constructs a RealtimeClient
 * unconditionally and — on supabase-js >=2.7x's realtime-js — that construction
 * throws immediately on Node <22 unless a WebSocket implementation is supplied,
 * since there's no global `WebSocket` until Node 22. Supplying `ws` here is
 * enough to satisfy that check; nothing actually opens a socket since no code
 * path ever calls `.channel()`/`.subscribe()`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const realtime = { transport: WebSocket as any };

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
    realtime,
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
    realtime,
  });
}
