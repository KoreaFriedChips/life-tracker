import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/timezone", () => ({ getViewerTimeZone: vi.fn(async () => "UTC") }));

import { getDb } from "@/db/client";
import {
  createPaletteKnowledge,
  createPaletteTodo,
  createPaletteTouchpoint,
} from "@/app/actions";

// requireSession's redirect("/login") signals by throwing; getDb propagates it.
// The capture actions must rethrow it (so Next redirects) instead of swallowing
// it into { ok: false, error: "NEXT_REDIRECT" } via their catch-all.
const authRedirect = Object.assign(new Error("NEXT_REDIRECT"), {
  digest: "NEXT_REDIRECT;replace;/login;307;",
});

beforeEach(() => {
  vi.mocked(getDb).mockRejectedValue(authRedirect);
});

describe("palette capture actions", () => {
  it("createPaletteTodo propagates the auth redirect instead of catching it", async () => {
    await expect(createPaletteTodo({ title: "buy milk", categoryId: 1 })).rejects.toBe(
      authRedirect,
    );
  });

  it("createPaletteKnowledge propagates the auth redirect instead of catching it", async () => {
    await expect(createPaletteKnowledge({ title: "SICP", type: "book" })).rejects.toBe(
      authRedirect,
    );
  });

  it("createPaletteTouchpoint propagates the auth redirect instead of catching it", async () => {
    await expect(createPaletteTouchpoint({ personId: 1, summary: "coffee" })).rejects.toBe(
      authRedirect,
    );
  });
});
