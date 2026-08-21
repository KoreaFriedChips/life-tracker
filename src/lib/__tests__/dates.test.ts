process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";
import {
  addMonths,
  currentMonth,
  formatMonthParam,
  localDateOf,
  localToday,
  monthGridDates,
  monthLabel,
  parseMonthParam,
} from "@/lib/dates";

describe("localDateOf", () => {
  it("maps a midday UTC datetime to the same local day", () => {
    expect(localDateOf("2026-08-15 16:00:00")).toBe("2026-08-15");
  });

  it("maps a late-evening local completion stored as next-day UTC back to the local day", () => {
    expect(localDateOf("2026-08-20 02:30:00")).toBe("2026-08-19");
  });

  it("rolls over at exactly 04:00 UTC during EDT (UTC-4)", () => {
    expect(localDateOf("2026-08-15 03:59:59")).toBe("2026-08-14");
    expect(localDateOf("2026-08-15 04:00:00")).toBe("2026-08-15");
  });

  it("rolls over at exactly 05:00 UTC during EST (UTC-5)", () => {
    expect(localDateOf("2026-01-15 04:59:59")).toBe("2026-01-14");
    expect(localDateOf("2026-01-15 05:00:00")).toBe("2026-01-15");
  });
});

describe("parseMonthParam", () => {
  it("parses a valid YYYY-MM value", () => {
    expect(parseMonthParam("2026-08")).toEqual({ year: 2026, month: 8 });
  });

  it("returns null for undefined", () => {
    expect(parseMonthParam(undefined)).toBeNull();
  });

  it("rejects month 13", () => {
    expect(parseMonthParam("2026-13")).toBeNull();
  });

  it("rejects month 00", () => {
    expect(parseMonthParam("2026-00")).toBeNull();
  });

  it("rejects a non-zero-padded month", () => {
    expect(parseMonthParam("2026-8")).toBeNull();
  });

  it("rejects arbitrary garbage", () => {
    expect(parseMonthParam("garbage")).toBeNull();
  });
});

describe("currentMonth", () => {
  it("agrees with localToday", () => {
    const today = localToday();
    const m = currentMonth();
    expect(formatMonthParam(m)).toBe(today.slice(0, 7));
  });
});

describe("addMonths", () => {
  it("rolls forward across a year boundary", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("rolls backward across a year boundary", () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("returns the same month for delta 0", () => {
    expect(addMonths({ year: 2026, month: 8 }, 0)).toEqual({ year: 2026, month: 8 });
  });

  it("handles multi-year deltas", () => {
    expect(addMonths({ year: 2026, month: 8 }, 18)).toEqual({ year: 2028, month: 2 });
  });
});

describe("formatMonthParam", () => {
  it("zero-pads the month", () => {
    expect(formatMonthParam({ year: 2027, month: 1 })).toBe("2027-01");
  });
});

describe("monthLabel", () => {
  it("renders an English month name and year", () => {
    expect(monthLabel({ year: 2026, month: 8 })).toBe("August 2026");
  });
});

describe("monthGridDates", () => {
  it("pads August 2026 to 42 cells from the prior Sunday through the next Saturday", () => {
    const dates = monthGridDates({ year: 2026, month: 8 });
    expect(dates).toHaveLength(42);
    expect(dates[0]).toBe("2026-07-26");
    expect(dates[dates.length - 1]).toBe("2026-09-05");
    expect(dates).toContain("2026-08-19");
  });

  it("returns exactly 28 cells for February 2026, which starts on a Sunday", () => {
    const dates = monthGridDates({ year: 2026, month: 2 });
    expect(dates).toHaveLength(28);
    expect(dates[0]).toBe("2026-02-01");
    expect(dates[dates.length - 1]).toBe("2026-02-28");
  });

  it("produces consecutive unique dates across the spring-forward transition (March 2026)", () => {
    const dates = monthGridDates({ year: 2026, month: 3 });
    expect(dates.length % 7).toBe(0);
    expect(new Set(dates).size).toBe(dates.length);
    for (let i = 1; i < dates.length; i++) {
      expect(daysBetween(dates[i - 1], dates[i])).toBe(1);
    }
  });

  it("produces consecutive unique dates across the fall-back transition (November 2026)", () => {
    const dates = monthGridDates({ year: 2026, month: 11 });
    expect(dates.length % 7).toBe(0);
    expect(new Set(dates).size).toBe(dates.length);
    for (let i = 1; i < dates.length; i++) {
      expect(daysBetween(dates[i - 1], dates[i])).toBe(1);
    }
  });
});

/** Whole calendar days from `a` to `b` (both local YYYY-MM-DD), DST-safe via Math.round. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ams = new Date(ay, am - 1, ad).getTime();
  const bms = new Date(by, bm - 1, bd).getTime();
  return Math.round((bms - ams) / 86_400_000);
}
