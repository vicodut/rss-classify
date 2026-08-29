/**
 * ts-rest mutation/query errors are thrown response objects ({ status, body })
 * for known status codes, `{ status, body: unknown }` for unmapped ones, or a
 * plain Error for network failures. Extract a displayable message from any of
 * those shapes.
 */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof Error) return fallback;
  if (err && typeof err === "object" && "body" in err) {
    const body = (err as { body?: unknown }).body;
    if (body && typeof body === "object" && "error" in body) {
      const inner = (body as { error?: { message?: unknown } }).error;
      if (inner && typeof inner.message === "string") return inner.message;
    }
  }
  return fallback;
}
