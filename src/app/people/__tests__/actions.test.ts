import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  // Mirrors the real redirect(): it signals by throwing.
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;push;${url};307;` });
  }),
}));
// Birthday validation must reject before the data layer is reached; a call
// that gets past it fails loudly with "db reached".
vi.mock("@/db/client", () => ({
  getDb: vi.fn(async () => {
    throw new Error("db reached");
  }),
}));
vi.mock("@/lib/timezone", () => ({ getViewerTimeZone: vi.fn(async () => "UTC") }));

import { redirect } from "next/navigation";
import { createPersonAction, updatePersonAction } from "@/app/people/actions";

const FUTURE_ERROR_PARAM = encodeURIComponent("Birthday can't be in the future.");
const FORMAT_ERROR_PARAM = encodeURIComponent("Birthday must be YYYY-MM-DD or --MM-DD.");

function personForm(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("person action birthday validation", () => {
  it("createPersonAction rejects a future full-date birthday with an error redirect", async () => {
    await expect(
      createPersonAction(personForm({ name: "Ada", birthday: "2999-01-01" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/people/new?error=${FUTURE_ERROR_PARAM}`);
  });

  it("updatePersonAction rejects a future full-date birthday with an error redirect", async () => {
    await expect(
      updatePersonAction(personForm({ id: "7", name: "Ada", birthday: "2999-01-01" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/people/7/edit?error=${FUTURE_ERROR_PARAM}`);
  });

  it("still forwards past birthdays to the data layer", async () => {
    await expect(
      createPersonAction(personForm({ name: "Ada", birthday: "1990-01-01" })),
    ).rejects.toThrow("db reached");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("still rejects calendar-invalid birthdays with the format error", async () => {
    await expect(
      createPersonAction(personForm({ name: "Ada", birthday: "2026-02-30" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/people/new?error=${FORMAT_ERROR_PARAM}`);
  });
});
