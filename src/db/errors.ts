/**
 * True if `err` — or the underlying driver error libsql wraps it in via `.cause` —
 * has a message containing `substring`. Needed because drizzle's libsql driver wraps
 * driver errors in a `DrizzleQueryError` whose own `.message` is a generic "Failed
 * query: ..." string; the original SQLite message (e.g. "UNIQUE constraint failed: ...")
 * lives one level down at `err.cause.message`.
 */
export function causedBy(err: unknown, substring: string): boolean {
  const message =
    err instanceof Error && err.cause instanceof Error ? err.cause.message : err instanceof Error ? err.message : "";
  return message.includes(substring);
}
