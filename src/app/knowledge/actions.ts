"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  addConnection,
  createKnowledgeEntry,
  deleteConnection,
  deleteKnowledgeEntry,
  updateKnowledgeEntry,
  type KnowledgeStatus,
  type KnowledgeType,
} from "@/db/repo/knowledge";

const KNOWLEDGE_PATH = "/knowledge";

function requireNumber(formData: FormData, key: string): number {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) throw new Error(`Missing or invalid "${key}"`);
  return value;
}

function parseList(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Creates a new knowledge entry and redirects to its detail page. Empty titles are ignored. */
export async function createEntryAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const entry = await createKnowledgeEntry(await getDb(), {
    title,
    type: String(formData.get("type") ?? "book") as KnowledgeType,
    url: String(formData.get("url") ?? "").trim() || undefined,
    authors: parseList(formData, "authors"),
    status: String(formData.get("status") ?? "next") as KnowledgeStatus,
    notes: String(formData.get("notes") ?? "").trim(),
    tags: parseList(formData, "tags"),
  });

  revalidatePath(KNOWLEDGE_PATH);
  redirect(`${KNOWLEDGE_PATH}/${entry.id}`);
}

/** Updates a knowledge entry and redirects back to its detail page. Empty titles are ignored. */
export async function updateEntryAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await updateKnowledgeEntry(await getDb(), id, {
    title,
    type: String(formData.get("type") ?? "book") as KnowledgeType,
    url: String(formData.get("url") ?? "").trim() || null,
    authors: parseList(formData, "authors"),
    status: String(formData.get("status") ?? "next") as KnowledgeStatus,
    notes: String(formData.get("notes") ?? "").trim(),
    tags: parseList(formData, "tags"),
  });

  revalidatePath(KNOWLEDGE_PATH);
  revalidatePath(`${KNOWLEDGE_PATH}/${id}`);
  redirect(`${KNOWLEDGE_PATH}/${id}`);
}

/** Deletes a knowledge entry (cascades its connections) and redirects to the list. */
export async function deleteEntryAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  await deleteKnowledgeEntry(await getDb(), id);

  revalidatePath(KNOWLEDGE_PATH);
  redirect(KNOWLEDGE_PATH);
}

/**
 * Adds a connection between two entries. Duplicate (either order) or self connections are
 * rejected by the repo; the readable error is surfaced back on the source entry's page.
 */
export async function addConnectionAction(formData: FormData) {
  const entryId = requireNumber(formData, "entryId");
  // The combobox submits an empty id when nothing was picked (the old <select> couldn't).
  const otherEntryId = Number(formData.get("otherEntryId"));
  if (!Number.isFinite(otherEntryId)) {
    redirect(`${KNOWLEDGE_PATH}/${entryId}?error=${encodeURIComponent("Pick an entry to connect.")}`);
  }
  const label = String(formData.get("label") ?? "").trim();

  let errorMessage: string | null = null;
  const db = await getDb();
  try {
    await addConnection(db, entryId, otherEntryId, label || undefined);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Could not add connection.";
  }

  revalidatePath(`${KNOWLEDGE_PATH}/${entryId}`);
  revalidatePath(`${KNOWLEDGE_PATH}/${otherEntryId}`);

  if (errorMessage) {
    redirect(`${KNOWLEDGE_PATH}/${entryId}?error=${encodeURIComponent(errorMessage)}`);
  }
}

/** Removes a connection; revalidates both entries' detail pages since it appears on both. */
export async function deleteConnectionAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const entryId = requireNumber(formData, "entryId");
  const otherEntryId = requireNumber(formData, "otherEntryId");
  await deleteConnection(await getDb(), id);

  revalidatePath(`${KNOWLEDGE_PATH}/${entryId}`);
  revalidatePath(`${KNOWLEDGE_PATH}/${otherEntryId}`);
  refresh(); // the graph page removes connections too, and it lives on neither revalidated path
}

export interface ConnectEntriesState {
  error: string | null;
  /** Bumped on every success so the form can reset its combobox by key. */
  succeededAt: number;
}

/**
 * `useActionState` variant of addConnectionAction for the graph side panel: errors are
 * returned inline instead of redirecting, so the user never leaves the graph.
 */
export async function connectEntriesAction(
  prev: ConnectEntriesState,
  formData: FormData,
): Promise<ConnectEntriesState> {
  const entryId = requireNumber(formData, "entryId");
  const otherEntryId = Number(formData.get("otherEntryId"));
  if (!Number.isFinite(otherEntryId)) {
    return { error: "Pick an entry to connect.", succeededAt: prev.succeededAt };
  }
  const label = String(formData.get("label") ?? "").trim();

  try {
    await addConnection(await getDb(), entryId, otherEntryId, label || undefined);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not add connection.",
      succeededAt: prev.succeededAt,
    };
  }

  revalidatePath(`${KNOWLEDGE_PATH}/${entryId}`);
  revalidatePath(`${KNOWLEDGE_PATH}/${otherEntryId}`);
  refresh();
  return { error: null, succeededAt: Date.now() };
}
