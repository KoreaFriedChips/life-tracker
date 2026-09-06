import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getGoal } from "@/db/repo/goals";
import { listCategories } from "@/db/repo/todos";
import { localDateOf, localToday } from "@/lib/dates";
import { getViewerTimeZone } from "@/lib/timezone";
import { HORIZON_LABELS, STATUS_LABELS, targetBadge } from "@/lib/goals";
import Markdown from "@/components/Markdown";
import DeleteButton from "@/components/DeleteButton";
import Badge from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { deleteGoalAction, setGoalStatusAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/goals/[id]">): Promise<Metadata> {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const goal = Number.isFinite(id) ? await getGoal(await getDb(), id) : null;
  return { title: goal?.title ?? "Goal not found" };
}

export default async function GoalPage({ params }: PageProps<"/goals/[id]">) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const tz = await getViewerTimeZone();
  const db = await getDb();
  const goal = Number.isFinite(id) ? await getGoal(db, id) : null;
  if (!goal) notFound();

  const badge = targetBadge(goal.targetDate, localToday(tz));
  const categoryName = goal.categoryId
    ? ((await listCategories(db)).find((c) => c.id === goal.categoryId)?.name ?? null)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{goal.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{HORIZON_LABELS[goal.horizon]}</Badge>
            {categoryName && <Badge>{categoryName}</Badge>}
            {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
            {goal.status !== "active" && (
              <Badge tone={goal.status === "achieved" ? "success" : "neutral"}>
                {STATUS_LABELS[goal.status]}
                {goal.status === "achieved" && goal.achievedAt
                  ? ` · ${localDateOf(goal.achievedAt, tz)}`
                  : ""}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href={`/goals/${goal.id}/edit`} variant="secondary" size="sm">
            Edit
          </ButtonLink>
          <DeleteButton
            action={deleteGoalAction}
            hiddenId={goal.id}
            confirmMessage={`Delete "${goal.title}"? This can't be undone.`}
          >
            Delete
          </DeleteButton>
        </div>
      </div>

      {goal.notes ? (
        <Markdown>{goal.notes}</Markdown>
      ) : (
        <p className="text-sm text-muted">
          No &ldquo;why&rdquo; written down yet — the reason is what keeps a goal alive.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
        {goal.status === "active" ? (
          <>
            <form action={setGoalStatusAction}>
              <input type="hidden" name="id" value={goal.id} />
              <Button type="submit" name="status" value="achieved" size="sm">
                Mark achieved
              </Button>
            </form>
            <form action={setGoalStatusAction}>
              <input type="hidden" name="id" value={goal.id} />
              <Button type="submit" name="status" value="dropped" variant="ghost" size="sm">
                Drop this goal
              </Button>
            </form>
          </>
        ) : (
          <form action={setGoalStatusAction}>
            <input type="hidden" name="id" value={goal.id} />
            <Button type="submit" name="status" value="active" variant="secondary" size="sm">
              Make active again
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
