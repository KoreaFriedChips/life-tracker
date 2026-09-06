import Link from "next/link";
import type { Goal, GoalHorizon } from "@/db/repo/goals";
import Badge from "@/components/ui/Badge";
import { HORIZON_LABELS, targetBadge } from "@/lib/goals";

const HORIZONS: GoalHorizon[] = ["short", "long"];

/**
 * The always-visible reminder of your active goals, pinned to the top of /todos so
 * you read them before anything else. Read-only by design — editing lives on /goals.
 */
export default function GoalsBanner({ goals, today }: { goals: Goal[]; today: string }) {
  return (
    <section className="rounded-xl border border-accent/25 bg-accent-soft/40 px-4 py-3 shadow-xs">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-accent-soft-fg uppercase">
          Your goals
        </h2>
        <Link
          href="/goals"
          className="text-xs font-medium text-muted transition-colors hover:text-foreground"
        >
          Manage →
        </Link>
      </div>

      {goals.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No goals yet.{" "}
          <Link href="/goals/new" className="font-medium text-accent hover:underline">
            Write down what you&apos;re working toward
          </Link>
          .
        </p>
      ) : (
        <dl className="mt-2 flex flex-col gap-2">
          {HORIZONS.map((horizon) => {
            const forHorizon = goals.filter((goal) => goal.horizon === horizon);
            if (forHorizon.length === 0) return null;

            return (
              <div key={horizon} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                <dt className="w-20 shrink-0 pt-0.5 text-xs font-medium tracking-wide text-faint uppercase">
                  {HORIZON_LABELS[horizon]}
                </dt>
                <dd className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
                  {forHorizon.map((goal) => {
                    const badge = targetBadge(goal.targetDate, today);
                    return (
                      <span key={goal.id} className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/goals/${goal.id}`}
                          className="text-sm font-medium transition-colors hover:text-accent"
                        >
                          {goal.title}
                        </Link>
                        {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
                      </span>
                    );
                  })}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
