process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  currentMonth,
  dayLabel,
  formatMonthParam,
  localDateOf,
  localToday,
  monthGridDates,
  monthLabel,
  parseDayParam,
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

describe("parseDayParam", () => {
  it("parses a valid YYYY-MM-DD value to the same string", () => {
    expect(parseDayParam("2026-08-31")).toBe("2026-08-31");
  });

  it("returns null for undefined", () => {
    expect(parseDayParam(undefined)).toBeNull();
  });

  it("rejects arbitrary garbage", () => {
    expect(parseDayParam("garbage")).toBeNull();
  });

  it("rejects a non-zero-padded month or day", () => {
    expect(parseDayParam("2026-8-03")).toBeNull();
    expect(parseDayParam("2026-08-3")).toBeNull();
  });

  it("rejects month 13 and month 00", () => {
    expect(parseDayParam("2026-13-01")).toBeNull();
    expect(parseDayParam("2026-00-01")).toBeNull();
  });

  it("rejects day 00 and day 32", () => {
    expect(parseDayParam("2026-08-00")).toBeNull();
    expect(parseDayParam("2026-08-32")).toBeNull();
  });

  it("rejects trailing garbage", () => {
    expect(parseDayParam("2026-08-31x")).toBeNull();
  });

  it("rejects calendar-overflow days that regex alone would allow", () => {
    expect(parseDayParam("2026-02-31")).toBeNull();
    expect(parseDayParam("2026-04-31")).toBeNull();
  });

  it("rejects Feb 29 in a non-leap year but accepts it in a leap year", () => {
    expect(parseDayParam("2026-02-29")).toBeNull();
    expect(parseDayParam("2028-02-29")).toBe("2028-02-29");
  });
});

describe("addDays", () => {
  it("steps forward and backward within a month", () => {
    expect(addDays("2026-08-15", 1)).toBe("2026-08-16");
    expect(addDays("2026-08-15", -1)).toBe("2026-08-14");
  });

  it("returns the same day for delta 0", () => {
    expect(addDays("2026-08-15", 0)).toBe("2026-08-15");
  });

  it("handles multi-day deltas", () => {
    expect(addDays("2026-08-15", 40)).toBe("2026-09-24");
  });

  it("rolls over month boundaries both ways", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("rolls over year boundaries both ways", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap and non-leap February ends", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("steps cleanly across the spring-forward transition (23h day)", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-03-09", -1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", -1)).toBe("2026-03-07");
  });

  it("steps cleanly across the fall-back transition (25h day)", () => {
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-11-02", -1)).toBe("2026-11-01");
  });
});

describe("dayLabel", () => {
  it("renders weekday, month name, day, and year", () => {
    expect(dayLabel("2026-08-31")).toBe("Monday, August 31, 2026");
  });

  it("renders a Sunday", () => {
    expect(dayLabel("2026-08-30")).toBe("Sunday, August 30, 2026");
  });

  it("does not zero-pad the day", () => {
    expect(dayLabel("2027-01-05")).toBe("Tuesday, January 5, 2027");
  });

  it("labels the first day of a year correctly", () => {
    expect(dayLabel("2026-01-01")).toBe("Thursday, January 1, 2026");
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
