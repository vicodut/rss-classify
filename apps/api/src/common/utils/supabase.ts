import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Unwraps a Supabase `{ data, error }` result, throwing on error so it
 * surfaces as a 500 via the global Fastify error handler. Only use for
 * failures that indicate a genuine backend problem, not "not found" (callers
 * should check for null data themselves when a missing row is expected).
 */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw result.error;
  if (result.data === null) throw new Error("Expected Supabase row but got null");
  return result.data;
}
