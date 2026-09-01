"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { toggleTodoDone } from "@/db/repo/todos";

const HOME_PATH = "/";
const TODOS_PATH = "/todos";
const CALENDAR_PATH = "/calendar";

function requireNumber(formData: FormData, key: string): number {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) throw new Error(`Missing or invalid "${key}"`);
  return value;
}

/** Toggles a todo's done state (sets/clears completedAt). */
export async function toggleTodo(formData: FormData) {
  const id = requireNumber(formData, "id");
  await toggleTodoDone(await getDb(), id);
  revalidatePath(HOME_PATH);
  revalidatePath(TODOS_PATH);
  revalidatePath(CALENDAR_PATH);
}
