import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: vi.fn(),
}));
vi.mock("@/lib/timezone", () => ({ getViewerTimeZone: vi.fn(async () => "UTC") }));

import { createDb, getDb } from "@/db/client";
import { listKnowledgeEntries } from "@/db/repo/knowledge";
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

  it("createPaletteKnowledge stores a thought capture as type thought, not the book fallback", async () => {
    const db = await createDb(":memory:");
    vi.mocked(getDb).mockResolvedValue(db);

    const result = await createPaletteKnowledge({ title: "Careers compound", type: "thought" });

    expect(result).toEqual({ ok: true });
    const [entry] = await listKnowledgeEntries(db);
    expect(entry.type).toBe("thought");
  });
});
