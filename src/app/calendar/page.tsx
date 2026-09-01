import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listPeople } from "@/db/repo/people";
import { listCategories, listTodos, type Todo } from "@/db/repo/todos";
import { birthdayOn } from "@/lib/birthdays";
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
import { getViewerTimeZone } from "@/lib/timezone";
import CalendarTodoItem from "@/components/CalendarTodoItem";
import TodoItem from "@/components/TodoItem";
import Badge from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/fields";
import { addTodo, toggleTodo } from "./actions";

export const metadata: Metadata = {
  title: "Calendar",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CELL_ENTRIES = 5;

const TOGGLE_ACTIVE =
  "inline-flex h-8 items-center rounded-lg bg-surface-subtle px-3 text-xs font-medium text-foreground";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const params = await searchParams;
  const tz = await getViewerTimeZone();
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const month = parseMonthParam(monthParam) ?? currentMonth(tz);
  const day = parseDayParam(typeof params.day === "string" ? params.day : undefined);

  const db = await getDb();
  const categories = await listCategories(db);
  const todos = await listTodos(db);
  const peopleWithBirthdays = (await listPeople(db)).filter((p) => p.birthday !== null);
  const today = localToday(tz);

  const completedByDay = new Map<string, Todo[]>();
  for (const todo of todos) {
    if (!todo.done || !todo.completedAt) continue;
    const day = localDateOf(todo.completedAt, tz);
    const list = completedByDay.get(day) ?? [];
    list.push(todo);
    completedByDay.set(day, list);
  }
  for (const list of completedByDay.values()) {
    list.sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  }
  const openTodos = todos.filter((todo) => !todo.done);

  const completedOnDay = day ? (completedByDay.get(day) ?? []) : [];
  const openForDay =
    day === null ? [] : day === today ? openTodos : openTodos.filter((todo) => todo.dueDate === day);

  const gridDates = monthGridDates(month);
  const birthdaysByDay = new Map<string, { id: number; name: string }[]>();
  for (const date of gridDates) {
    for (const person of peopleWithBirthdays) {
      if (!birthdayOn(person.birthday!, date)) continue;
      const list = birthdaysByDay.get(date) ?? [];
      list.push({ id: person.id, name: person.name });
      birthdaysByDay.set(date, list);
    }
  }

  const birthdaysOnDay =
    day === null
      ? []
      : peopleWithBirthdays.flatMap((person) => {
          const match = birthdayOn(person.birthday!, day);
          return match ? [{ id: person.id, name: person.name, turningAge: match.turningAge }] : [];
        });

  const monthPrefix = formatMonthParam(month);

  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-1">
          <Link
            href={`/calendar?month=${day ? day.slice(0, 7) : formatMonthParam(month)}`}
            className={day ? buttonClassName("ghost", "sm") : TOGGLE_ACTIVE}
          >
            Month
          </Link>
          <Link
            href={`/calendar?day=${day ?? today}`}
            className={day ? TOGGLE_ACTIVE : buttonClassName("ghost", "sm")}
          >
            Day
          </Link>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {day ? (
            <>
              <Link
                href={`/calendar?day=${addDays(day, -1)}`}
                className={buttonClassName("ghost", "sm")}
              >
                ← Prev
              </Link>
              <span className="px-2 text-sm font-medium">{dayLabel(day)}</span>
              <Link
                href={`/calendar?day=${addDays(day, 1)}`}
                className={buttonClassName("ghost", "sm")}
              >
                Next →
              </Link>
              <Link href={`/calendar?day=${today}`} className={buttonClassName("ghost", "sm")}>
                Today
              </Link>
            </>
          ) : (
            <>
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
            </>
          )}
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

      {day ? (
        <div className="flex flex-col gap-4">
          {birthdaysOnDay.length > 0 && (
            <Card className="p-0">
              <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Birthdays</h2>
              <div className="divide-y divide-border">
                {birthdaysOnDay.map((birthday) => (
                  <div key={birthday.id} className="flex items-center gap-2 px-4 py-3">
                    <Link
                      href={`/people/${birthday.id}`}
                      className="text-sm font-medium transition-colors hover:text-accent"
                    >
                      {birthday.name}
                    </Link>
                    {birthday.turningAge != null && (
                      <Badge tone="accent">turns {birthday.turningAge}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{day === today ? "Open" : "Due"}</h2>
              <span className="text-xs text-faint">{openForDay.length} open</span>
            </div>
            {openForDay.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">
                {day === today ? "No open to-dos." : "Nothing due on this day."}
              </p>
            ) : (
              <div className="divide-y divide-border px-4">
                {openForDay.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    overdue={!!todo.dueDate && todo.dueDate < today}
                    toggleTodo={toggleTodo}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Completed</h2>
              <span className="text-xs text-faint">{completedOnDay.length} done</span>
            </div>
            {completedOnDay.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Nothing completed on this day.</p>
            ) : (
              <div className="divide-y divide-border px-4">
                {completedOnDay.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} overdue={false} toggleTodo={toggleTodo} />
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-1.5 text-center text-xs font-medium text-faint">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-border">
          {gridDates.map((date) => {
            const birthdays = birthdaysByDay.get(date) ?? [];
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
                  <Link
                    href={`/calendar?day=${date}`}
                    aria-label={dayLabel(date)}
                    className="inline-flex size-5 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent-soft-fg"
                  >
                    {dayNumber}
                  </Link>
                ) : (
                  <Link
                    href={`/calendar?day=${date}`}
                    aria-label={dayLabel(date)}
                    className={
                      date.startsWith(monthPrefix)
                        ? "text-xs text-muted hover:underline"
                        : "text-xs text-faint hover:underline"
                    }
                  >
                    {dayNumber}
                  </Link>
                )}

                {(birthdays.length > 0 || visibleCompleted.length > 0 || visibleOpen.length > 0) && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {birthdays.map((birthday) => (
                      <Link
                        key={`birthday-${birthday.id}`}
                        href={`/people/${birthday.id}`}
                        className="block truncate rounded-full bg-accent-soft px-1.5 py-0.5 text-xs text-accent-soft-fg hover:bg-accent-soft/80"
                      >
                        {birthday.name}
                      </Link>
                    ))}
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
      )}
    </div>
  );
}
