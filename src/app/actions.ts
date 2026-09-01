"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { listKnowledgeEntries, createKnowledgeEntry } from "@/db/repo/knowledge";
import { addTouchpoint, listPeople } from "@/db/repo/people";
import { createTodo, listCategories, listTodos, toggleTodoDone, type Category } from "@/db/repo/todos";
import { localToday } from "@/lib/dates";
import {
  KNOWLEDGE_TYPES,
  searchPaletteData,
  type CaptureResult,
  type PaletteResults,
} from "@/lib/paletteSearch";
import { getViewerTimeZone } from "@/lib/timezone";

const HOME_PATH = "/";
const TODOS_PATH = "/todos";
const CALENDAR_PATH = "/calendar";
const KNOWLEDGE_PATH = "/knowledge";
const PEOPLE_PATH = "/people";

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

/** Searches open todos, people, and knowledge entries for the command palette. */
export async function searchPalette(query: string): Promise<PaletteResults> {
  const db = await getDb();
  const [todos, people, entries] = await Promise.all([
    listTodos(db),
    listPeople(db),
    listKnowledgeEntries(db),
  ]);
  return searchPaletteData({ todos, people, entries }, query);
}

/** Categories for the palette's quick-create todo select, in sort order. */
export async function getCaptureCategories(): Promise<Category[]> {
  return listCategories(await getDb());
}

/** Quick-creates a todo from the palette. */
export async function createPaletteTodo(input: {
  title: string;
  categoryId: number;
}): Promise<CaptureResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (!Number.isFinite(input.categoryId)) return { ok: false, error: "Pick a category." };
  // Outside the try: getDb's auth redirect must propagate, not become a capture error.
  const db = await getDb();
  try {
    await createTodo(db, { title, categoryId: input.categoryId });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add to-do." };
  }
  revalidatePath(HOME_PATH);
  revalidatePath(TODOS_PATH);
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/** Quick-creates a knowledge entry from the palette (status defaults to "next"). */
export async function createPaletteKnowledge(input: {
  title: string;
  type: string;
}): Promise<CaptureResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };
  const type = KNOWLEDGE_TYPES.find((t) => t === input.type) ?? "book";
  // Outside the try: getDb's auth redirect must propagate, not become a capture error.
  const db = await getDb();
  try {
    await createKnowledgeEntry(db, { title, type });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add entry." };
  }
  revalidatePath(HOME_PATH);
  revalidatePath(KNOWLEDGE_PATH);
  return { ok: true };
}

/** Logs a touchpoint from the palette, dated the viewer's today. */
export async function createPaletteTouchpoint(input: {
  personId: number;
  summary: string;
}): Promise<CaptureResult> {
  const summary = input.summary.trim();
  if (!summary) return { ok: false, error: "Summary is required." };
  if (!Number.isFinite(input.personId)) return { ok: false, error: "Pick a person." };
  const date = localToday(await getViewerTimeZone());
  // Outside the try: getDb's auth redirect must propagate, not become a capture error.
  const db = await getDb();
  try {
    await addTouchpoint(db, { personId: input.personId, date, summary });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not log touchpoint." };
  }
  revalidatePath(HOME_PATH);
  revalidatePath(PEOPLE_PATH);
  revalidatePath(`${PEOPLE_PATH}/${input.personId}`);
  return { ok: true };
}
