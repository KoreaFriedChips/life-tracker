"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  addTouchpoint,
  createPerson,
  deletePerson,
  deleteTouchpoint,
  updatePerson,
} from "@/db/repo/people";

const PEOPLE_PATH = "/people";

function requireNumber(formData: FormData, key: string): number {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) throw new Error(`Missing or invalid "${key}"`);
  return value;
}

function parseTags(formData: FormData): string[] {
  return String(formData.get("relationshipTags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Creates a new person and redirects to their profile. Empty names are ignored. */
export async function createPersonAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const person = createPerson(getDb(), {
    name,
    relationshipTags: parseTags(formData),
    howWeMet: String(formData.get("howWeMet") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });

  revalidatePath(PEOPLE_PATH);
  redirect(`${PEOPLE_PATH}/${person.id}`);
}

/** Updates a person and redirects back to their profile. Empty names are ignored. */
export async function updatePersonAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  updatePerson(getDb(), id, {
    name,
    relationshipTags: parseTags(formData),
    howWeMet: String(formData.get("howWeMet") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });

  revalidatePath(PEOPLE_PATH);
  revalidatePath(`${PEOPLE_PATH}/${id}`);
  redirect(`${PEOPLE_PATH}/${id}`);
}

/** Deletes a person (cascades their touchpoints) and redirects to the list. */
export async function deletePersonAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  deletePerson(getDb(), id);

  revalidatePath(PEOPLE_PATH);
  redirect(PEOPLE_PATH);
}

/** Adds a touchpoint for a person. Empty dates or summaries are ignored. */
export async function addTouchpointAction(formData: FormData) {
  const personId = requireNumber(formData, "personId");
  const date = String(formData.get("date") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();

  if (date && summary) {
    addTouchpoint(getDb(), { personId, date, summary });
  }

  revalidatePath(`${PEOPLE_PATH}/${personId}`);
  revalidatePath(PEOPLE_PATH);
}

/** Deletes a touchpoint. */
export async function deleteTouchpointAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const personId = requireNumber(formData, "personId");
  deleteTouchpoint(getDb(), id);

  revalidatePath(`${PEOPLE_PATH}/${personId}`);
  revalidatePath(PEOPLE_PATH);
}
