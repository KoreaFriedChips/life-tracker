function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns today's date as YYYY-MM-DD in the local timezone. */
export function localToday(): string {
  return toLocalDateString(new Date());
}

/** Local calendar date (YYYY-MM-DD) of a SQLite UTC datetime ("YYYY-MM-DD HH:MM:SS"). */
export function localDateOf(utcDatetime: string): string {
  return toLocalDateString(new Date(utcDatetime.replace(" ", "T") + "Z"));
}

export interface CalendarMonth {
  year: number;
  /** 1-12 */
  month: number;
}

/** Parses a "?month=YYYY-MM" value; null on missing or malformed input. */
export function parseMonthParam(value: string | undefined): CalendarMonth | null {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

/** Parses a "?day=YYYY-MM-DD" value; null on missing, malformed, or calendar-invalid input (e.g. 2026-02-31). */
export function parseDayParam(value: string | undefined): string | null {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return toLocalDateString(new Date(year, month - 1, day)) === value ? value : null;
}

/** Day arithmetic with month/year rollover (Date-constructor, DST-safe); delta may be negative. */
export function addDays(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return toLocalDateString(new Date(year, month - 1, day + delta));
}

/** The month containing today (local time). */
export function currentMonth(): CalendarMonth {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Month arithmetic with year rollover; delta may be negative. */
export function addMonths(m: CalendarMonth, delta: number): CalendarMonth {
  const d = new Date(m.year, m.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** "YYYY-MM", for ?month= links. */
export function formatMonthParam(m: CalendarMonth): string {
  return `${m.year}-${String(m.month).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "August 2026" */
export function monthLabel(m: CalendarMonth): string {
  return `${MONTH_NAMES[m.month - 1]} ${m.year}`;
}

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** "Monday, August 31, 2026" */
export function dayLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()];
  return `${weekday}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

/**
 * Local dates (YYYY-MM-DD) filling the month's calendar grid: whole weeks from
 * Sunday, including leading/trailing out-of-month days. Length is a multiple of 7.
 * Cells are generated with per-index Date constructor arithmetic (never ms math)
 * so 23h/25h DST days can't skip or duplicate a date.
 */
export function monthGridDates(m: CalendarMonth): string[] {
  const firstOfMonth = new Date(m.year, m.month - 1, 1);
  const lastOfMonth = new Date(m.year, m.month, 0);
  const leading = firstOfMonth.getDay();
  const trailing = 6 - lastOfMonth.getDay();
  const count = leading + lastOfMonth.getDate() + trailing;
  return Array.from({ length: count }, (_, i) =>
    toLocalDateString(new Date(m.year, m.month - 1, 1 - leading + i)),
  );
}

/** Whole calendar days between `dateStr` (YYYY-MM-DD, local) and today (local). */
export function daysSince(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const then = new Date(year, month - 1, day).getTime();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return Math.round((today - then) / 86_400_000);
}
