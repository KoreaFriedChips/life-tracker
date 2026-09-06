import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { listKnowledgeEntries } from "@/db/repo/knowledge";
import { listPeopleWithStaleness, upcomingBirthdays, type UpcomingBirthday } from "@/db/repo/people";
import { listTodos } from "@/db/repo/todos";
import { daysUntilLabel } from "@/lib/birthdays";
import { selectTodayTodos } from "@/lib/dashboard";
import { dayLabel, localToday } from "@/lib/dates";
import { getViewerTimeZone } from "@/lib/timezone";
import { stalenessLabel, stalenessTone } from "@/components/staleness";
import TodoItem from "@/components/TodoItem";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { toggleTodo } from "./actions";

export const metadata: Metadata = {
  title: "Today",
};

const BIRTHDAY_WINDOW_DAYS = 14;
const STALEST_PEOPLE_COUNT = 3;

function Section({
  title,
  viewAll,
  children,
}: {
  title: string;
  viewAll: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href={viewAll.href} className="text-xs text-muted transition-colors hover:text-accent">
          {viewAll.label}
        </Link>
      </div>
      {children}
    </Card>
  );
}

export default async function Home() {
  const tz = await getViewerTimeZone();
  const db = await getDb();
  const today = localToday(tz);

  const todos = await listTodos(db);
  const { overdue, dueToday } = selectTodayTodos(todos, today);
  const stalePeople = (await listPeopleWithStaleness(db, tz)).slice(0, STALEST_PEOPLE_COUNT);
  const inProgress = (await listKnowledgeEntries(db))
    .filter((entry) => entry.status === "in_progress")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const birthdays: UpcomingBirthday[] = await upcomingBirthdays(db, today, BIRTHDAY_WINDOW_DAYS);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-sm text-muted">{dayLabel(today)}</p>
      </div>

      <Section title="To-dos" viewAll={{ href: "/todos", label: "All to-dos" }}>
        {overdue.length === 0 && dueToday.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">Nothing due today.</p>
        ) : (
          <div className="divide-y divide-border px-4">
            {[...overdue, ...dueToday].map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                overdue={todo.dueDate! < today}
                toggleTodo={toggleTodo}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Reconnect" viewAll={{ href: "/people", label: "All people" }}>
        {stalePeople.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">No people yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {stalePeople.map((person) => (
              <div key={person.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <Link
                  href={`/people/${person.id}`}
                  className="text-sm font-medium transition-colors hover:text-accent"
                >
                  {person.name}
                </Link>
                <Badge tone={stalenessTone(person.daysSinceContact)}>
                  {stalenessLabel(person.daysSinceContact)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="In progress" viewAll={{ href: "/knowledge", label: "All knowledge" }}>
        {inProgress.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">Nothing in progress.</p>
        ) : (
          <div className="divide-y divide-border">
            {inProgress.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <Link
                  href={`/knowledge/${entry.id}`}
                  className="text-sm font-medium transition-colors hover:text-accent"
                >
                  {entry.title}
                </Link>
                <Badge tone="neutral">{entry.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Birthdays" viewAll={{ href: "/people", label: "All people" }}>
        {birthdays.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">
            No birthdays in the next {BIRTHDAY_WINDOW_DAYS} days.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {birthdays.map((birthday) => (
              <div key={birthday.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <Link
                  href={`/people/${birthday.id}`}
                  className="text-sm font-medium transition-colors hover:text-accent"
                >
                  {birthday.name}
                </Link>
                <Badge tone="accent">
                  {daysUntilLabel(birthday.daysUntil)}
                  {birthday.turningAge !== null && ` · turns ${birthday.turningAge}`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
