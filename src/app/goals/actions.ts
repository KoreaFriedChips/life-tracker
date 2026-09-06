"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  createGoal,
  deleteGoal,
  moveGoal,
  nextGoalSortOrder,
  setGoalStatus,
  updateGoal,
  type GoalHorizon,
  type GoalStatus,
  GOAL_HORIZONS,
  GOAL_STATUSES,
} from "@/db/repo/goals";

const GOALS_PATH = "/goals";
/** The goals banner lives on /todos, so every goal mutation has to revalidate it too. */
const TODOS_PATH = "/todos";

function requireNumber(formData: FormData, key: string): number {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) throw new Error(`Missing or invalid "${key}"`);
  return value;
}

function parseHorizon(formData: FormData): GoalHorizon {
  const value = String(formData.get("horizon") ?? "");
  return (GOAL_HORIZONS as readonly string[]).includes(value) ? (value as GoalHorizon) : "short";
}

/** "" (the "no category" option) becomes null; anything unparseable does too. */
function parseCategoryId(formData: FormData): number | null {
  const raw = String(formData.get("categoryId") ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseTargetDate(formData: FormData): string | null {
  return String(formData.get("targetDate") ?? "").trim() || null;
}

/** Creates a goal at the end of its horizon block and opens its detail page. Empty titles are ignored. */
export async function createGoalAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const db = getDb();
  const horizon = parseHorizon(formData);

  const goal = createGoal(db, {
    title,
    horizon,
    categoryId: parseCategoryId(formData),
    targetDate: parseTargetDate(formData),
    notes: String(formData.get("notes") ?? "").trim(),
    sortOrder: nextGoalSortOrder(db, horizon),
  });

  revalidatePath(GOALS_PATH);
  revalidatePath(TODOS_PATH);
  redirect(`${GOALS_PATH}/${goal.id}`);
}

/** Updates a goal and returns to its detail page. Empty titles are ignored. */
export async function updateGoalAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  updateGoal(getDb(), id, {
    title,
    horizon: parseHorizon(formData),
    categoryId: parseCategoryId(formData),
    targetDate: parseTargetDate(formData),
    notes: String(formData.get("notes") ?? "").trim(),
  });

  revalidatePath(GOALS_PATH);
  revalidatePath(`${GOALS_PATH}/${id}`);
  revalidatePath(TODOS_PATH);
  redirect(`${GOALS_PATH}/${id}`);
}

/** Marks a goal achieved, dropped, or active again. Unknown statuses are ignored. */
export async function setGoalStatusAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const status = String(formData.get("status") ?? "");
  if (!(GOAL_STATUSES as readonly string[]).includes(status)) return;

  setGoalStatus(getDb(), id, status as GoalStatus);

  revalidatePath(GOALS_PATH);
  revalidatePath(`${GOALS_PATH}/${id}`);
  revalidatePath(TODOS_PATH);
}

/** Reorders a goal within its horizon block. */
export async function moveGoalAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const direction = String(formData.get("direction") ?? "") === "up" ? "up" : "down";

  moveGoal(getDb(), id, direction);

  revalidatePath(GOALS_PATH);
  revalidatePath(TODOS_PATH);
}

/** Permanently deletes a goal and returns to the list. */
export async function deleteGoalAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  deleteGoal(getDb(), id);

  revalidatePath(GOALS_PATH);
  revalidatePath(TODOS_PATH);
  redirect(GOALS_PATH);
}
