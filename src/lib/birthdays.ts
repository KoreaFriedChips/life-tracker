export interface ParsedBirthday {
  year: number | null;
  month: number;
  day: number;
}

const WITH_YEAR = /^(\d{4})-(\d{2})-(\d{2})$/;
const NO_YEAR = /^--(\d{2})-(\d{2})$/;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in `month` for `year`; a null year permits Feb 29 (the birth year could be a leap year). */
function daysInMonth(month: number, year: number | null): number {
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28;
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Parses a stored birthday: "YYYY-MM-DD" or ISO no-year "--MM-DD". Strict
 * zero-padded format plus a real-calendar check ("--02-29" is valid;
 * "YYYY-02-29" only in leap years). Null on anything else.
 */
export function parseBirthday(value: string): ParsedBirthday | null {
  const match = value.match(WITH_YEAR) ?? value.match(NO_YEAR);
  if (!match) return null;
  const year = match.length === 4 ? Number(match[1]) : null;
  const month = Number(match[match.length - 2]);
  const day = Number(match[match.length - 1]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(month, year)) return null;
  return { year, month, day };
}

/**
 * True when `birthday` is a full date after `todayISO` (a year typo like 2062
 * for 1962). No-year birthdays are never future; unparseable input is not
 * flagged. Both strings are zero-padded ISO, so string order is date order.
 */
export function isFutureBirthday(birthday: string, todayISO: string): boolean {
  const parsed = parseBirthday(birthday);
  return parsed !== null && parsed.year !== null && birthday > todayISO;
}

/** "March 14, 1998" for full dates, "March 14" when the year is unknown; unparseable values pass through. */
export function formatBirthday(birthday: string): string {
  const parsed = parseBirthday(birthday);
  if (!parsed) return birthday;
  const monthDay = `${MONTH_NAMES[parsed.month - 1]} ${parsed.day}`;
  return parsed.year === null ? monthDay : `${monthDay}, ${parsed.year}`;
}

/** The birthday's celebration date in `year`: Feb 29 maps to Feb 28 in non-leap years. */
function occurrenceInYear(month: number, day: number, year: number): string {
  const mappedDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  return `${year}-${String(month).padStart(2, "0")}-${String(mappedDay).padStart(2, "0")}`;
}

function utcMs(dateISO: string): number {
  const [year, month, day] = dateISO.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * The next celebration of `birthday` on or after `todayISO` (daysUntil 0 =
 * today). Feb 29 birthdays are celebrated on Feb 28 in non-leap years.
 * `turningAge` only when the birth year is known. Null on unparseable input.
 */
export function nextOccurrence(
  birthday: string,
  todayISO: string,
): { date: string; daysUntil: number; turningAge: number | null } | null {
  const parsed = parseBirthday(birthday);
  if (!parsed) return null;

  let candidateYear = Number(todayISO.slice(0, 4));
  let date = occurrenceInYear(parsed.month, parsed.day, candidateYear);
  if (date < todayISO) {
    candidateYear += 1;
    date = occurrenceInYear(parsed.month, parsed.day, candidateYear);
  }

  return {
    date,
    daysUntil: Math.round((utcMs(date) - utcMs(todayISO)) / 86_400_000),
    turningAge: parsed.year === null ? null : candidateYear - parsed.year,
  };
}

/**
 * Whether `birthday` is celebrated on `dateISO` (Feb 29 birthdays match Feb 28
 * of non-leap years, never Feb 28 of leap years). Null on no match, on
 * unparseable input, or on dates before a known birth year; `turningAge` 0 is
 * the birth date itself.
 */
export function birthdayOn(
  birthday: string,
  dateISO: string,
): { turningAge: number | null } | null {
  const parsed = parseBirthday(birthday);
  if (!parsed) return null;

  const [dateYear, month, day] = dateISO.split("-").map(Number);
  const feb29Fallback =
    parsed.month === 2 && parsed.day === 29 && month === 2 && day === 28 && !isLeapYear(dateYear);
  if (!(month === parsed.month && day === parsed.day) && !feb29Fallback) return null;
  if (parsed.year !== null && dateYear < parsed.year) return null;

  return { turningAge: parsed.year === null ? null : dateYear - parsed.year };
}

/** "today", "in 1 day", "in N days". */
export function daysUntilLabel(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  return daysUntil === 1 ? "in 1 day" : `in ${daysUntil} days`;
}
