import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { listCategories } from "@/db/repo/todos";
import GoalForm from "@/components/GoalForm";
import { createGoalAction } from "../actions";

export const metadata: Metadata = {
  title: "Add goal",
};

// Reads the category list at request time so newly added categories show up here.
export const dynamic = "force-dynamic";

export default function NewGoalPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Add goal</h1>
      <GoalForm categories={listCategories(getDb())} action={createGoalAction} />
    </div>
  );
}
