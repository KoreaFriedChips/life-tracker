import { describe, expect, it } from "vitest";
import { createDb } from "@/db/client";

describe("createDb error handling", () => {
  // getDb() (src/db/client.ts) caches createDb's promise on globalThis and, on
  // rejection, resets the cache to undefined so the next request retries instead
  // of reusing a wedged rejected promise forever. getDb() itself can't be unit
  // tested here -- it calls requireSession(), which calls cookies() and needs
  // request context. What we CAN verify at the createDb surface is the invariant
  // the fix depends on: createDb has no hidden state that would make a second
  // call behave differently after the first one failed, i.e. it's safe to just
  // call it again.
  it("rejects cleanly on an invalid URL, and rejects the same way on a retry", async () => {
    const invalidUrl = "not-a-valid-url";

    await expect(createDb(invalidUrl)).rejects.toThrow(/URL_INVALID/);
    await expect(createDb(invalidUrl)).rejects.toThrow(/URL_INVALID/);
  });
});
