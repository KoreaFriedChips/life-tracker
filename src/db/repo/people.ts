import { desc, eq, sql } from "drizzle-orm";
import { daysSince } from "@/lib/dates";
import type { AppDatabase } from "../client";
import { people, touchpoints } from "../schema";

export interface Person {
  id: number;
  name: string;
  relationshipTags: string[];
  howWeMet: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewPerson {
  name: string;
  relationshipTags?: string[];
  howWeMet?: string;
  notes?: string;
}

export interface UpdatePersonInput {
  name?: string;
  relationshipTags?: string[];
  howWeMet?: string;
  notes?: string;
}

export interface Touchpoint {
  id: number;
  personId: number;
  date: string;
  summary: string;
  createdAt: string;
}

export interface NewTouchpoint {
  personId: number;
  date: string;
  summary: string;
}

export interface PersonWithStaleness extends Person {
  lastTouchpointDate: string | null;
  daysSinceContact: number | null;
}

function toPerson(row: typeof people.$inferSelect): Person {
  return {
    id: row.id,
    name: row.name,
    relationshipTags: JSON.parse(row.relationshipTags),
    howWeMet: row.howWeMet,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// --- People ---

export function listPeople(db: AppDatabase): Person[] {
  return db.select().from(people).all().map(toPerson);
}

export function getPerson(db: AppDatabase, id: number): Person | null {
  const row = db.select().from(people).where(eq(people.id, id)).get();
  return row ? toPerson(row) : null;
}

export function createPerson(db: AppDatabase, input: NewPerson): Person {
  const [row] = db
    .insert(people)
    .values({
      name: input.name,
      relationshipTags: JSON.stringify(input.relationshipTags ?? []),
      howWeMet: input.howWeMet ?? "",
      notes: input.notes ?? "",
    })
    .returning()
    .all();
  return toPerson(row);
}

export function updatePerson(db: AppDatabase, id: number, input: UpdatePersonInput): Person {
  const [row] = db
    .update(people)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.relationshipTags !== undefined
        ? { relationshipTags: JSON.stringify(input.relationshipTags) }
        : {}),
      ...(input.howWeMet !== undefined ? { howWeMet: input.howWeMet } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(people.id, id))
    .returning()
    .all();
  if (!row) throw new Error(`Person ${id} not found`);
  return toPerson(row);
}

export function deletePerson(db: AppDatabase, id: number): void {
  db.delete(people).where(eq(people.id, id)).run();
}

// --- Touchpoints ---

export function listTouchpoints(db: AppDatabase, personId: number): Touchpoint[] {
  return db
    .select()
    .from(touchpoints)
    .where(eq(touchpoints.personId, personId))
    .orderBy(desc(touchpoints.date))
    .all();
}

export function addTouchpoint(db: AppDatabase, input: NewTouchpoint): Touchpoint {
  const [row] = db
    .insert(touchpoints)
    .values({
      personId: input.personId,
      date: input.date,
      summary: input.summary,
    })
    .returning()
    .all();
  return row;
}

export function deleteTouchpoint(db: AppDatabase, id: number): void {
  db.delete(touchpoints).where(eq(touchpoints.id, id)).run();
}

// --- Staleness ---

/**
 * All people with their derived last-touchpoint date and days-since-contact.
 * Sorted longest-since-contact first, with never-contacted people at the very top.
 */
export function listPeopleWithStaleness(db: AppDatabase): PersonWithStaleness[] {
  const rows = db
    .select({
      id: people.id,
      name: people.name,
      relationshipTags: people.relationshipTags,
      howWeMet: people.howWeMet,
      notes: people.notes,
      createdAt: people.createdAt,
      updatedAt: people.updatedAt,
      lastTouchpointDate: sql<string | null>`MAX(${touchpoints.date})`,
    })
    .from(people)
    .leftJoin(touchpoints, eq(touchpoints.personId, people.id))
    .groupBy(people.id)
    .all();

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      relationshipTags: JSON.parse(row.relationshipTags) as string[],
      howWeMet: row.howWeMet,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastTouchpointDate: row.lastTouchpointDate,
      daysSinceContact: row.lastTouchpointDate === null ? null : daysSince(row.lastTouchpointDate),
    }))
    .sort((a, b) => {
      if (a.lastTouchpointDate === null && b.lastTouchpointDate === null) return 0;
      if (a.lastTouchpointDate === null) return -1;
      if (b.lastTouchpointDate === null) return 1;
      return a.lastTouchpointDate < b.lastTouchpointDate ? -1 : a.lastTouchpointDate > b.lastTouchpointDate ? 1 : 0;
    });
}
