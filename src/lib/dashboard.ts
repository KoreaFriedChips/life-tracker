import type { Todo } from "@/db/repo/todos";

/**
 * Splits open todos into overdue (dueDate before `today`, sorted dueDate asc)
 * and due-today (input order). Done, undated, and future-dated todos are
 * excluded. Dates compare lexicographically, same as the /todos overdue check.
 */
export function selectTodayTodos(
  todos: Todo[],
  today: string,
): { overdue: Todo[]; dueToday: Todo[] } {
  const due = todos.filter((t) => !t.done && t.dueDate !== null && t.dueDate <= today);
  return {
    overdue: due
      .filter((t) => t.dueDate! < today)
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)),
    dueToday: due.filter((t) => t.dueDate === today),
  };
}
