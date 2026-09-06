import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getGoal } from "@/db/repo/goals";
import { listCategories } from "@/db/repo/todos";
import GoalForm from "@/components/GoalForm";
import { updateGoalAction } from "../../actions";

export async function generateMetadata({
  params,
}: PageProps<"/goals/[id]/edit">): Promise<Metadata> {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const goal = Number.isFinite(id) ? getGoal(getDb(), id) : null;
  return { title: goal ? `Edit ${goal.title}` : "Goal not found" };
}

export default async function EditGoalPage({ params }: PageProps<"/goals/[id]/edit">) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const db = getDb();
  const goal = Number.isFinite(id) ? getGoal(db, id) : null;
  if (!goal) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {goal.title}</h1>
      <GoalForm goal={goal} categories={listCategories(db)} action={updateGoalAction} />
    </div>
  );
}
