import { describe, expect, it } from "vitest";
import { stalenessLabel, stalenessTone } from "@/components/staleness";

describe("stalenessTone", () => {
  it("returns success up to 30 days", () => {
    expect(stalenessTone(0)).toBe("success");
    expect(stalenessTone(30)).toBe("success");
  });

  it("returns warning from 31 to 90 days", () => {
    expect(stalenessTone(31)).toBe("warning");
    expect(stalenessTone(90)).toBe("warning");
  });

  it("returns danger past 90 days", () => {
    expect(stalenessTone(91)).toBe("danger");
  });

  it("returns danger for never contacted", () => {
    expect(stalenessTone(null)).toBe("danger");
  });
});

describe("stalenessLabel", () => {
  it("labels never-contacted people", () => {
    expect(stalenessLabel(null)).toBe("never");
  });

  it("labels days since contact", () => {
    expect(stalenessLabel(5)).toBe("last talked: 5 days ago");
  });
});
