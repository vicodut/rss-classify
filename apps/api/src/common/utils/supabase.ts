import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Supabase/PostgREST errors are plain objects, not `Error` instances.
 * Fastify's reply pipeline only routes a thrown value to the error handler
 * when `payload instanceof Error` — throwing a raw PostgrestError is
 * silently serialized as a *successful* 200 response body instead of
 * producing a 500. Always wrap before throwing; never `throw error` directly
 * on a Supabase result.
 */
export function toError(error: PostgrestError): Error {
  const wrapped = new Error(error.message);
  wrapped.name = "PostgrestError";
  Object.assign(wrapped, { code: error.code, details: error.details, hint: error.hint });
  return wrapped;
}

/**
 * Unwraps a Supabase `{ data, error }` result, throwing on error so it
 * surfaces as a 500 via the global Fastify error handler. Only use for
 * failures that indicate a genuine backend problem, not "not found" (callers
 * should check for null data themselves when a missing row is expected).
 */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw toError(result.error);
  if (result.data === null) throw new Error("Expected Supabase row but got null");
  return result.data;
}
