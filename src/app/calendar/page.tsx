import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listCategories, listTodos, type Todo } from "@/db/repo/todos";
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
import CalendarTodoItem from "@/components/CalendarTodoItem";
import { Button, buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/fields";
import { addTodo, toggleTodo } from "./actions";

export const metadata: Metadata = {
  title: "Calendar",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CELL_ENTRIES = 5;

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const params = await searchParams;
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const month = parseMonthParam(monthParam) ?? currentMonth();

  const db = getDb();
  const categories = listCategories(db);
  const todos = listTodos(db);
  const today = localToday();

  const completedByDay = new Map<string, Todo[]>();
  for (const todo of todos) {
    if (!todo.done || !todo.completedAt) continue;
    const day = localDateOf(todo.completedAt);
    const list = completedByDay.get(day) ?? [];
    list.push(todo);
    completedByDay.set(day, list);
  }
  for (const list of completedByDay.values()) {
    list.sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  }
  const openTodos = todos.filter((todo) => !todo.done);

  const monthPrefix = formatMonthParam(month);

  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-1">
          <Link
            href={`/calendar?month=${formatMonthParam(addMonths(month, -1))}`}
            className={buttonClassName("ghost", "sm")}
          >
            ← Prev
          </Link>
          <span className="px-2 text-sm font-medium">{monthLabel(month)}</span>
          <Link
            href={`/calendar?month=${formatMonthParam(addMonths(month, 1))}`}
            className={buttonClassName("ghost", "sm")}
          >
            Next →
          </Link>
          <Link href="/calendar" className={buttonClassName("ghost", "sm")}>
            Today
          </Link>
        </div>
      </div>

      {categories.length > 0 && (
        <form action={addTodo} className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            name="title"
            placeholder="Add a to-do..."
            required
            className="min-w-[10rem] flex-1"
          />
          <Select name="categoryId">
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      )}

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-1.5 text-center text-xs font-medium text-faint">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-border">
          {monthGridDates(month).map((date) => {
            const completed = completedByDay.get(date) ?? [];
            const open = date === today ? openTodos : [];
            const visibleCompleted = completed.slice(0, MAX_CELL_ENTRIES);
            const visibleOpen = open.slice(0, Math.max(0, MAX_CELL_ENTRIES - completed.length));
            const overflow =
              completed.length + open.length - visibleCompleted.length - visibleOpen.length;
            const dayNumber = Number(date.slice(8));

            return (
              <div key={date} className="min-h-24 bg-surface p-1.5">
                {date === today ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent-soft-fg">
                    {dayNumber}
                  </span>
                ) : (
                  <span
                    className={
                      date.startsWith(monthPrefix) ? "text-xs text-muted" : "text-xs text-faint"
                    }
                  >
                    {dayNumber}
                  </span>
                )}

                {(visibleCompleted.length > 0 || visibleOpen.length > 0) && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {visibleCompleted.map((todo) => (
                      <CalendarTodoItem
                        key={todo.id}
                        todo={todo}
                        overdue={false}
                        toggleTodo={toggleTodo}
                      />
                    ))}
                    {visibleOpen.map((todo) => (
                      <CalendarTodoItem
                        key={todo.id}
                        todo={todo}
                        overdue={!!todo.dueDate && todo.dueDate < today}
                        toggleTodo={toggleTodo}
                      />
                    ))}
                  </div>
                )}

                {overflow > 0 && <p className="mt-0.5 text-xs text-faint">+{overflow} more</p>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
