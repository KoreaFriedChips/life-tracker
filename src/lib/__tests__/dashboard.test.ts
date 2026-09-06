import { describe, expect, it } from "vitest";
import type { Todo } from "@/db/repo/todos";
import { selectTodayTodos } from "@/lib/dashboard";

const TODAY = "2026-08-31";

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
    const { overdue, dueToday } = selectTodayTodos([past, atBoundary], TODAY);
    expect(overdue.map((t) => t.id)).toEqual([1]);
    expect(dueToday.map((t) => t.id)).toEqual([2]);
  });

  it("excludes done todos even with a past dueDate", () => {
    const doneOverdue = todo({ id: 1, dueDate: "2026-08-01", done: true, completedAt: "2026-08-02 10:00:00" });
    const doneToday = todo({ id: 2, dueDate: TODAY, done: true, completedAt: "2026-08-31 10:00:00" });
    const { overdue, dueToday } = selectTodayTodos([doneOverdue, doneToday], TODAY);
    expect(overdue).toEqual([]);
    expect(dueToday).toEqual([]);
  });

  it("excludes todos with null or future dueDate", () => {
    const undated = todo({ id: 1, dueDate: null });
    const future = todo({ id: 2, dueDate: "2026-09-01" });
    const { overdue, dueToday } = selectTodayTodos([undated, future], TODAY);
    expect(overdue).toEqual([]);
    expect(dueToday).toEqual([]);
  });

  it("sorts overdue by dueDate ascending and keeps dueToday in input order", () => {
    const a = todo({ id: 1, dueDate: "2026-08-29" });
    const b = todo({ id: 2, dueDate: "2026-08-15" });
    const c = todo({ id: 3, dueDate: TODAY });
    const d = todo({ id: 4, dueDate: TODAY });
    const { overdue, dueToday } = selectTodayTodos([a, b, c, d], TODAY);
    expect(overdue.map((t) => t.id)).toEqual([2, 1]);
    expect(dueToday.map((t) => t.id)).toEqual([3, 4]);
  });

  it("returns empty arrays for empty input", () => {
    expect(selectTodayTodos([], TODAY)).toEqual({ overdue: [], dueToday: [] });
  });
});
