import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listGoals, type Goal, type GoalHorizon } from "@/db/repo/goals";
import { listCategories } from "@/db/repo/todos";
import { localDateOf, localToday } from "@/lib/dates";
import { getViewerTimeZone } from "@/lib/timezone";
import { HORIZON_LABELS, targetBadge } from "@/lib/goals";
import Badge from "@/components/ui/Badge";
import { Button, ButtonLink, buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { moveGoalAction, setGoalStatusAction } from "./actions";

export const metadata: Metadata = {
  title: "Goals",
};

export const dynamic = "force-dynamic";

const HORIZONS: GoalHorizon[] = ["short", "long"];

export default async function GoalsPage({ searchParams }: PageProps<"/goals">) {
  const params = await searchParams;
  const showArchived = params.showArchived === "1";

  const tz = await getViewerTimeZone();
  const db = await getDb();
  const allGoals = await listGoals(db);
  const today = localToday(tz);
  const categoryNameById = new Map((await listCategories(db)).map((c) => [c.id, c.name]));

  const active = allGoals.filter((goal) => goal.status === "active");
  const archived = allGoals.filter((goal) => goal.status !== "active");

  function renderRow(goal: Goal, index: number, siblings: Goal[]) {
    const badge = targetBadge(goal.targetDate, today);
    const categoryName = goal.categoryId ? categoryNameById.get(goal.categoryId) : null;

    return (
      <div key={goal.id} className="flex items-start gap-3 py-3">
        <form action={moveGoalAction} className="flex gap-1 pt-0.5">
          <input type="hidden" name="id" value={goal.id} />
          <Button
            type="submit"
            name="direction"
            value="up"
            disabled={index === 0}
            variant="secondary"
            size="sm"
            aria-label={`Move "${goal.title}" up`}
          >
            {"↑"}
          </Button>
          <Button
            type="submit"
            name="direction"
            value="down"
            disabled={index === siblings.length - 1}
            variant="secondary"
            size="sm"
            aria-label={`Move "${goal.title}" down`}
          >
            {"↓"}
          </Button>
        </form>

        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <Link href={`/goals/${goal.id}`} className="text-sm font-medium hover:text-accent">
              {goal.title}
            </Link>
            {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
            {categoryName && <Badge tone="accent">{categoryName}</Badge>}
          </div>
          {goal.notes && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{goal.notes}</p>}
        </div>

        <form action={setGoalStatusAction} className="pt-0.5">
          <input type="hidden" name="id" value={goal.id} />
          <Button type="submit" name="status" value="achieved" variant="secondary" size="sm">
            Achieved
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <ButtonLink href="/goals/new" size="sm">
          Add goal
        </ButtonLink>
      </div>

      {active.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted">
            No active goals. These show at the top of your to-dos every day.
          </p>
          <ButtonLink href="/goals/new" variant="secondary" size="sm">
            Add your first goal
          </ButtonLink>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {HORIZONS.map((horizon) => {
          const forHorizon = active.filter((goal) => goal.horizon === horizon);
          if (forHorizon.length === 0) return null;

          return (
            <Card key={horizon} className="p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">{HORIZON_LABELS[horizon]}</h2>
                <span className="text-xs text-faint">{forHorizon.length} active</span>
              </div>
              <div className="divide-y divide-border px-4">
                {forHorizon.map((goal, index) => renderRow(goal, index, forHorizon))}
              </div>
            </Card>
          );
        })}
      </div>

      <section>
        <Link
          href={showArchived ? "/goals" : "/goals?showArchived=1"}
          className={buttonClassName("ghost", "sm")}
        >
          {showArchived ? "Hide achieved & dropped" : "Show achieved & dropped"}
        </Link>

        {showArchived && (
          <Card className="mt-3 p-0">
            <div className="divide-y divide-border px-4">
              {archived.length === 0 ? (
                <p className="py-3 text-sm text-muted">Nothing achieved or dropped yet.</p>
              ) : (
                archived.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link
                        href={`/goals/${goal.id}`}
                        className="text-sm text-muted line-through hover:text-foreground"
                      >
                        {goal.title}
                      </Link>
                      <Badge tone={goal.status === "achieved" ? "success" : "neutral"}>
                        {goal.status === "achieved"
                          ? `achieved${goal.achievedAt ? ` · ${localDateOf(goal.achievedAt, tz)}` : ""}`
                          : "dropped"}
                      </Badge>
                    </div>
                    <form action={setGoalStatusAction}>
                      <input type="hidden" name="id" value={goal.id} />
                      <Button type="submit" name="status" value="active" variant="ghost" size="sm">
                        Reactivate
                      </Button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
