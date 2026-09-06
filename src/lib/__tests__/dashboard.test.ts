import { describe, expect, it } from "vitest";
import type { Todo } from "@/db/repo/todos";
import { selectTodayTodos } from "@/lib/dashboard";

const TODAY = "2026-08-31";
const UPCOMING_DAYS = 7;

function todo(overrides: Partial<Todo> & { id: number }): Todo {
  return {
    title: `todo ${overrides.id}`,
    notes: "",
    categoryId: 1,
    done: false,
    dueDate: null,
    createdAt: "2026-01-01 00:00:00",
    completedAt: null,
    ...overrides,
  };
}

describe("selectTodayTodos", () => {
  it("splits overdue (dueDate < today) from dueToday (dueDate === today)", () => {
    const past = todo({ id: 1, dueDate: "2026-08-30" });
    const atBoundary = todo({ id: 2, dueDate: TODAY });
    const { overdue, dueToday } = selectTodayTodos([past, atBoundary], TODAY, UPCOMING_DAYS);
    expect(overdue.map((t) => t.id)).toEqual([1]);
    expect(dueToday.map((t) => t.id)).toEqual([2]);
  });

  it("excludes done todos even with a past dueDate", () => {
    const doneOverdue = todo({ id: 1, dueDate: "2026-08-01", done: true, completedAt: "2026-08-02 10:00:00" });
    const doneToday = todo({ id: 2, dueDate: TODAY, done: true, completedAt: "2026-08-31 10:00:00" });
    const { overdue, dueToday } = selectTodayTodos([doneOverdue, doneToday], TODAY, UPCOMING_DAYS);
    expect(overdue).toEqual([]);
    expect(dueToday).toEqual([]);
  });

  it("excludes undated todos from every bucket", () => {
    const undated = todo({ id: 1, dueDate: null });
    expect(selectTodayTodos([undated], TODAY, UPCOMING_DAYS)).toEqual({
      overdue: [],
      dueToday: [],
      upcoming: [],
    });
  });

  it("sorts overdue by dueDate ascending and keeps dueToday in input order", () => {
    const a = todo({ id: 1, dueDate: "2026-08-29" });
    const b = todo({ id: 2, dueDate: "2026-08-15" });
    const c = todo({ id: 3, dueDate: TODAY });
    const d = todo({ id: 4, dueDate: TODAY });
    const { overdue, dueToday } = selectTodayTodos([a, b, c, d], TODAY, UPCOMING_DAYS);
    expect(overdue.map((t) => t.id)).toEqual([2, 1]);
    expect(dueToday.map((t) => t.id)).toEqual([3, 4]);
  });

  it("returns empty arrays for empty input", () => {
    expect(selectTodayTodos([], TODAY, UPCOMING_DAYS)).toEqual({
      overdue: [],
      dueToday: [],
      upcoming: [],
    });
  });

  it("puts todos due after today, through today + upcomingDays, in upcoming", () => {
    const tomorrow = todo({ id: 1, dueDate: "2026-09-01" });
    const lastDayOfWindow = todo({ id: 2, dueDate: "2026-09-07" });
    const { upcoming } = selectTodayTodos([tomorrow, lastDayOfWindow], TODAY, UPCOMING_DAYS);
    expect(upcoming.map((t) => t.id)).toEqual([1, 2]);
  });

  it("excludes todos due past the upcoming window", () => {
    const justPastWindow = todo({ id: 1, dueDate: "2026-09-08" });
    const { upcoming } = selectTodayTodos([justPastWindow], TODAY, UPCOMING_DAYS);
    expect(upcoming).toEqual([]);
  });

  it("keeps today and overdue todos out of upcoming", () => {
    const past = todo({ id: 1, dueDate: "2026-08-30" });
    const atBoundary = todo({ id: 2, dueDate: TODAY });
    const { upcoming } = selectTodayTodos([past, atBoundary], TODAY, UPCOMING_DAYS);
    expect(upcoming).toEqual([]);
  });

  it("sorts upcoming by dueDate ascending", () => {
    const later = todo({ id: 1, dueDate: "2026-09-05" });
    const sooner = todo({ id: 2, dueDate: "2026-09-02" });
    const middle = todo({ id: 3, dueDate: "2026-09-03" });
    const { upcoming } = selectTodayTodos([later, sooner, middle], TODAY, UPCOMING_DAYS);
    expect(upcoming.map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it("excludes done todos from upcoming", () => {
    const doneSoon = todo({ id: 1, dueDate: "2026-09-02", done: true, completedAt: "2026-08-31 09:00:00" });
    const { upcoming } = selectTodayTodos([doneSoon], TODAY, UPCOMING_DAYS);
    expect(upcoming).toEqual([]);
  });

  it("spans a month boundary when the window crosses into the next month", () => {
    const endOfMonth = todo({ id: 1, dueDate: "2026-09-30" });
    const nextMonth = todo({ id: 2, dueDate: "2026-10-04" });
    const outside = todo({ id: 3, dueDate: "2026-10-06" });
    const { upcoming } = selectTodayTodos(
      [endOfMonth, nextMonth, outside],
      "2026-09-28",
      UPCOMING_DAYS,
    );
    expect(upcoming.map((t) => t.id)).toEqual([1, 2]);
  });
});
