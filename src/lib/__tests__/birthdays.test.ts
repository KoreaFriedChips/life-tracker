import { describe, expect, it } from "vitest";
import {
  birthdayOn,
  daysUntilLabel,
  formatBirthday,
  isFutureBirthday,
  nextOccurrence,
  parseBirthday,
} from "@/lib/birthdays";

describe("parseBirthday", () => {
  it("parses a full YYYY-MM-DD date", () => {
    expect(parseBirthday("1998-03-14")).toEqual({ year: 1998, month: 3, day: 14 });
  });

  it("parses a no-year --MM-DD date", () => {
    expect(parseBirthday("--03-14")).toEqual({ year: null, month: 3, day: 14 });
  });

  it("accepts --02-29 when the year is unknown", () => {
    expect(parseBirthday("--02-29")).toEqual({ year: null, month: 2, day: 29 });
  });

  it("accepts Feb 29 in a leap year", () => {
    expect(parseBirthday("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it("rejects Feb 29 in a non-leap year", () => {
    expect(parseBirthday("2023-02-29")).toBeNull();
  });

  it("rejects calendar-invalid days", () => {
    expect(parseBirthday("--02-30")).toBeNull();
  });

  it("rejects invalid months", () => {
    expect(parseBirthday("--00-10")).toBeNull();
    expect(parseBirthday("--13-01")).toBeNull();
  });

  it("rejects MM-DD without the -- prefix", () => {
    expect(parseBirthday("03-14")).toBeNull();
  });

  it("rejects non-zero-padded dates", () => {
    expect(parseBirthday("1998-3-4")).toBeNull();
  });

  it("rejects empty and whitespace junk", () => {
    expect(parseBirthday("")).toBeNull();
    expect(parseBirthday("  ")).toBeNull();
  });
});

describe("nextOccurrence", () => {
  it("returns daysUntil 0 and turningAge on the birthday itself", () => {
    expect(nextOccurrence("1998-03-14", "2026-03-14")).toEqual({
      date: "2026-03-14",
      daysUntil: 0,
      turningAge: 28,
    });
  });

  it("finds an occurrence later this year", () => {
    expect(nextOccurrence("1998-03-14", "2026-03-01")).toEqual({
      date: "2026-03-14",
      daysUntil: 13,
      turningAge: 28,
    });
  });

  it("rolls to next year when this year's occurrence has passed", () => {
    expect(nextOccurrence("1998-03-14", "2026-03-15")).toEqual({
      date: "2027-03-14",
      daysUntil: 364,
      turningAge: 29,
    });
  });

  it("wraps December to January", () => {
    expect(nextOccurrence("--01-02", "2026-12-28")).toEqual({
      date: "2027-01-02",
      daysUntil: 5,
      turningAge: null,
    });
  });

  it("celebrates Feb 29 birthdays on Feb 28 in non-leap years", () => {
    expect(nextOccurrence("2000-02-29", "2026-02-20")).toEqual({
      date: "2026-02-28",
      daysUntil: 8,
      turningAge: 26,
    });
  });

  it("keeps Feb 29 in leap years", () => {
    expect(nextOccurrence("--02-29", "2028-02-01")).toEqual({
      date: "2028-02-29",
      daysUntil: 28,
      turningAge: null,
    });
  });

  it("re-applies the leap mapping after rolling to next year", () => {
    expect(nextOccurrence("--02-29", "2028-03-01")).toEqual({
      date: "2029-02-28",
      daysUntil: 364,
      turningAge: null,
    });
  });

  it("returns null for unparseable birthdays", () => {
    expect(nextOccurrence("not-a-date", "2026-03-14")).toBeNull();
  });
});

describe("birthdayOn", () => {
  it("matches the exact month/day and computes turningAge", () => {
    expect(birthdayOn("1998-03-14", "2026-03-14")).toEqual({ turningAge: 28 });
  });

  it("returns null turningAge when the year is unknown", () => {
    expect(birthdayOn("--03-14", "2026-03-14")).toEqual({ turningAge: null });
  });

  it("does not match other days", () => {
    expect(birthdayOn("1998-03-14", "2026-03-15")).toBeNull();
  });

  it("matches Feb 29 birthdays on Feb 28 of non-leap years only", () => {
    expect(birthdayOn("--02-29", "2025-02-28")).toEqual({ turningAge: null });
    expect(birthdayOn("--02-29", "2024-02-28")).toBeNull();
    expect(birthdayOn("2000-02-29", "2024-02-29")).toEqual({ turningAge: 24 });
  });

  it("never matches dates before the birth year", () => {
    expect(birthdayOn("1998-03-14", "1997-03-14")).toBeNull();
  });

  it("allows turningAge 0 on the birth date itself", () => {
    expect(birthdayOn("1998-03-14", "1998-03-14")).toEqual({ turningAge: 0 });
  });

  it("returns null for unparseable birthdays", () => {
    expect(birthdayOn("junk", "2026-03-14")).toBeNull();
  });
});

describe("isFutureBirthday", () => {
  it("flags a full date after today", () => {
    expect(isFutureBirthday("2062-03-14", "2026-08-31")).toBe(true);
    expect(isFutureBirthday("2026-09-01", "2026-08-31")).toBe(true);
  });

  it("accepts today and past dates", () => {
    expect(isFutureBirthday("2026-08-31", "2026-08-31")).toBe(false);
    expect(isFutureBirthday("1962-03-14", "2026-08-31")).toBe(false);
  });

  it("never flags no-year birthdays, even later in the year", () => {
    expect(isFutureBirthday("--12-31", "2026-08-31")).toBe(false);
  });

  it("never flags unparseable input", () => {
    expect(isFutureBirthday("2062-02-30", "2026-08-31")).toBe(false);
  });
});

describe("formatBirthday", () => {
  it("formats a full date with year", () => {
    expect(formatBirthday("1998-03-14")).toBe("March 14, 1998");
  });

  it("formats a no-year date without year", () => {
    expect(formatBirthday("--03-14")).toBe("March 14");
  });
});

describe("daysUntilLabel", () => {
  it("says today for 0", () => {
    expect(daysUntilLabel(0)).toBe("today");
  });

  it("uses the singular for 1", () => {
    expect(daysUntilLabel(1)).toBe("in 1 day");
  });

  it("uses the plural otherwise", () => {
    expect(daysUntilLabel(12)).toBe("in 12 days");
  });
});
