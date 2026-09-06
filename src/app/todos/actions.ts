"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  createCategory,
  createTodo,
  deleteCategory,
  deleteTodo as deleteTodoRepo,
  listCategories,
  toggleTodoDone,
  updateCategory,
} from "@/db/repo/todos";

const TODOS_PATH = "/todos";

function requireNumber(formData: FormData, key: string): number {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) throw new Error(`Missing or invalid "${key}"`);
  return value;
}

/** Adds a new todo to the given category. Empty titles are ignored. */
export async function addTodo(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const categoryId = requireNumber(formData, "categoryId");
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (title) {
    await createTodo(await getDb(), { title, categoryId, dueDate: dueDate || null });
  }

  revalidatePath(TODOS_PATH);
}

/** Toggles a todo's done state (sets/clears completedAt). */
export async function toggleTodo(formData: FormData) {
  const id = requireNumber(formData, "id");
  await toggleTodoDone(await getDb(), id);
  revalidatePath(TODOS_PATH);
}

/** Permanently deletes a todo (used for completed items). */
export async function deleteTodoAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  await deleteTodoRepo(await getDb(), id);
  revalidatePath(TODOS_PATH);
}

/** Adds a new category at the end of the sort order. Empty names are ignored. */
export async function addCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  let errorMessage: string | null = null;
  if (name) {
    const db = await getDb();
    const existing = await listCategories(db);
    const maxSortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0);
    try {
      await createCategory(db, { name, sortOrder: maxSortOrder + 10 });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Could not add category.";
    }
  }

  revalidatePath(TODOS_PATH);

  if (errorMessage) {
    redirect(`${TODOS_PATH}?error=${encodeURIComponent(errorMessage)}`);
  }
}

/** Renames a category. Empty names are ignored. */
export async function renameCategory(formData: FormData) {
  const id = requireNumber(formData, "id");
  const name = String(formData.get("name") ?? "").trim();

  let errorMessage: string | null = null;
  if (name) {
    const db = await getDb();
    try {
      await updateCategory(db, id, { name });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Could not rename category.";
    }
  }

  revalidatePath(TODOS_PATH);

  if (errorMessage) {
    redirect(`${TODOS_PATH}?error=${encodeURIComponent(errorMessage)}`);
  }
}

/** Reorders a category by swapping sort_order with its up/down neighbor. */
export async function moveCategory(formData: FormData) {
  const id = requireNumber(formData, "id");
  const direction = String(formData.get("direction") ?? "");

  const db = await getDb();
  const ordered = await listCategories(db);
  const index = ordered.findIndex((c) => c.id === id);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= ordered.length) return;

  const current = ordered[index];
  const neighbor = ordered[swapIndex];
  await updateCategory(db, current.id, { sortOrder: neighbor.sortOrder });
  await updateCategory(db, neighbor.id, { sortOrder: current.sortOrder });

  revalidatePath(TODOS_PATH);
}

/** Deletes a category. Blocked (redirects with a readable error) if it still has todos. */
export async function deleteCategoryAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const db = await getDb();

  let errorMessage: string | null = null;
  try {
    await deleteCategory(db, id);
  } catch {
    errorMessage = "Cannot delete category: move or delete its to-dos first.";
  }

  revalidatePath(TODOS_PATH);

  if (errorMessage) {
    redirect(`${TODOS_PATH}?error=${encodeURIComponent(errorMessage)}`);
  }
}
