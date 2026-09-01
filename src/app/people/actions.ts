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
import { parseBirthday } from "@/lib/birthdays";

const PEOPLE_PATH = "/people";
const BIRTHDAY_ERROR = "Birthday must be YYYY-MM-DD or --MM-DD.";

/** Trimmed birthday value, or null when the field is empty (= no birthday). */
function readBirthday(formData: FormData): string | null {
  const raw = String(formData.get("birthday") ?? "").trim();
  return raw === "" ? null : raw;
}

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

  const birthday = readBirthday(formData);
  if (birthday !== null && !parseBirthday(birthday)) {
    revalidatePath(PEOPLE_PATH);
    redirect(`${PEOPLE_PATH}/new?error=${encodeURIComponent(BIRTHDAY_ERROR)}`);
  }

  const person = await createPerson(await getDb(), {
    name,
    relationshipTags: parseTags(formData),
    howWeMet: String(formData.get("howWeMet") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    birthday,
  });

  revalidatePath(PEOPLE_PATH);
  redirect(`${PEOPLE_PATH}/${person.id}`);
}

/** Updates a person and redirects back to their profile. Empty names are ignored. */
export async function updatePersonAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const birthday = readBirthday(formData);
  if (birthday !== null && !parseBirthday(birthday)) {
    revalidatePath(`${PEOPLE_PATH}/${id}`);
    redirect(`${PEOPLE_PATH}/${id}/edit?error=${encodeURIComponent(BIRTHDAY_ERROR)}`);
  }

  await updatePerson(await getDb(), id, {
    name,
    relationshipTags: parseTags(formData),
    howWeMet: String(formData.get("howWeMet") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    birthday,
  });

  revalidatePath(PEOPLE_PATH);
  revalidatePath(`${PEOPLE_PATH}/${id}`);
  redirect(`${PEOPLE_PATH}/${id}`);
}

/** Deletes a person (cascades their touchpoints) and redirects to the list. */
export async function deletePersonAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  await deletePerson(await getDb(), id);

  revalidatePath(PEOPLE_PATH);
  redirect(PEOPLE_PATH);
}

/** Adds a touchpoint for a person. Empty dates or summaries are ignored. */
export async function addTouchpointAction(formData: FormData) {
  const personId = requireNumber(formData, "personId");
  const date = String(formData.get("date") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();

  if (date && summary) {
    await addTouchpoint(await getDb(), { personId, date, summary });
  }

  revalidatePath(`${PEOPLE_PATH}/${personId}`);
  revalidatePath(PEOPLE_PATH);
}

/** Deletes a touchpoint. */
export async function deleteTouchpointAction(formData: FormData) {
  const id = requireNumber(formData, "id");
  const personId = requireNumber(formData, "personId");
  await deleteTouchpoint(await getDb(), id);

  revalidatePath(`${PEOPLE_PATH}/${personId}`);
  revalidatePath(PEOPLE_PATH);
}
