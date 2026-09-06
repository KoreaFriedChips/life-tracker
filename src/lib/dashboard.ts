import type { Todo } from "@/db/repo/todos";
import { addDays } from "@/lib/dates";

/**
 * Splits open todos into overdue (dueDate before `today`, sorted dueDate asc),
 * due-today (input order), and upcoming — due within the next `upcomingDays`
 * days, sorted dueDate asc. Done and undated todos, and anything due beyond the
 * window, are excluded. Dates compare lexicographically, same as the /todos
 * overdue check.
 */
export function selectTodayTodos(
  todos: Todo[],
  today: string,
  upcomingDays: number,
): { overdue: Todo[]; dueToday: Todo[]; upcoming: Todo[] } {
  const horizon = addDays(today, upcomingDays);
  const open = todos.filter((t) => !t.done && t.dueDate !== null);
  const byDueDate = (a: Todo, b: Todo) => a.dueDate!.localeCompare(b.dueDate!);

  return {
    overdue: open.filter((t) => t.dueDate! < today).sort(byDueDate),
    dueToday: open.filter((t) => t.dueDate === today),
    upcoming: open
      .filter((t) => t.dueDate! > today && t.dueDate! <= horizon)
      .sort(byDueDate),
  };
}
