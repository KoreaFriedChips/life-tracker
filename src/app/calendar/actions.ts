"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { createTodo, toggleTodoDone } from "@/db/repo/todos";

const CALENDAR_PATH = "/calendar";
const TODOS_PATH = "/todos";

function requireNumber(formData: FormData, key: string): number {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) throw new Error(`Missing or invalid "${key}"`);
  return value;
}

/** Adds a new open todo from the calendar quick-add form. Empty titles are ignored. */
export async function addTodo(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const categoryId = requireNumber(formData, "categoryId");

  if (title) {
    await createTodo(await getDb(), { title, categoryId, dueDate: null });
  }

  revalidatePath(CALENDAR_PATH);
  revalidatePath(TODOS_PATH);
}

/** Toggles a todo's done state (sets/clears completedAt). */
export async function toggleTodo(formData: FormData) {
  const id = requireNumber(formData, "id");
  await toggleTodoDone(await getDb(), id);
  revalidatePath(CALENDAR_PATH);
  revalidatePath(TODOS_PATH);
}
