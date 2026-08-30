import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-key-for-vitest-only";
});

describe("session tokens", () => {
  it("round-trips a freshly signed token", async () => {
    const { signSessionToken, verifySessionToken } = await import("@/lib/session");
    const token = await signSessionToken();
    await expect(verifySessionToken(token)).resolves.toBe(true);
  });

  it("rejects undefined, garbage, and tampered tokens", async () => {
    const { signSessionToken, verifySessionToken } = await import("@/lib/session");
    await expect(verifySessionToken(undefined)).resolves.toBe(false);
    await expect(verifySessionToken("not-a-jwt")).resolves.toBe(false);

    const token = await signSessionToken();
    await expect(verifySessionToken(token.slice(0, -2) + "xx")).resolves.toBe(false);
  });
});
