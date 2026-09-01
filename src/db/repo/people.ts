import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { nextOccurrence } from "@/lib/birthdays";
import { daysSince } from "@/lib/dates";
import type { AppDatabase } from "../client";
import { people, touchpoints } from "../schema";

export interface Person {
  id: number;
  name: string;
  relationshipTags: string[];
  howWeMet: string;
  notes: string;
  /** "YYYY-MM-DD", or "--MM-DD" when the year is unknown. */
  birthday: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewPerson {
  name: string;
  relationshipTags?: string[];
  howWeMet?: string;
  notes?: string;
  birthday?: string | null;
}

export interface UpdatePersonInput {
  name?: string;
  relationshipTags?: string[];
  howWeMet?: string;
  notes?: string;
  /** Null clears the birthday. */
  birthday?: string | null;
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
    birthday: row.birthday,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// --- People ---

export async function listPeople(db: AppDatabase): Promise<Person[]> {
  return (await db.select().from(people).all()).map(toPerson);
}

export async function getPerson(db: AppDatabase, id: number): Promise<Person | null> {
  const row = await db.select().from(people).where(eq(people.id, id)).get();
  return row ? toPerson(row) : null;
}

export async function createPerson(db: AppDatabase, input: NewPerson): Promise<Person> {
  const [row] = await db
    .insert(people)
    .values({
      name: input.name,
      relationshipTags: JSON.stringify(input.relationshipTags ?? []),
      howWeMet: input.howWeMet ?? "",
      notes: input.notes ?? "",
      birthday: input.birthday ?? null,
    })
    .returning()
    .all();
  return toPerson(row);
}

export async function updatePerson(
  db: AppDatabase,
  id: number,
  input: UpdatePersonInput,
): Promise<Person> {
  const [row] = await db
    .update(people)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.relationshipTags !== undefined
        ? { relationshipTags: JSON.stringify(input.relationshipTags) }
        : {}),
      ...(input.howWeMet !== undefined ? { howWeMet: input.howWeMet } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.birthday !== undefined ? { birthday: input.birthday } : {}),
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(people.id, id))
    .returning()
    .all();
  if (!row) throw new Error(`Person ${id} not found`);
  return toPerson(row);
}

export async function deletePerson(db: AppDatabase, id: number): Promise<void> {
  await db.delete(people).where(eq(people.id, id)).run();
}

// --- Touchpoints ---

export async function listTouchpoints(db: AppDatabase, personId: number): Promise<Touchpoint[]> {
  return db
    .select()
    .from(touchpoints)
    .where(eq(touchpoints.personId, personId))
    .orderBy(desc(touchpoints.date))
    .all();
}

export async function addTouchpoint(db: AppDatabase, input: NewTouchpoint): Promise<Touchpoint> {
  const [row] = await db
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

export async function deleteTouchpoint(db: AppDatabase, id: number): Promise<void> {
  await db.delete(touchpoints).where(eq(touchpoints.id, id)).run();
}

// --- Staleness ---

/**
 * All people with their derived last-touchpoint date and days-since-contact.
 * Sorted longest-since-contact first, with never-contacted people at the very top.
 */
export async function listPeopleWithStaleness(
  db: AppDatabase,
  tz: string,
): Promise<PersonWithStaleness[]> {
  const rows = await db
    .select({
      id: people.id,
      name: people.name,
      relationshipTags: people.relationshipTags,
      howWeMet: people.howWeMet,
      notes: people.notes,
      birthday: people.birthday,
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
      birthday: row.birthday,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastTouchpointDate: row.lastTouchpointDate,
      daysSinceContact: row.lastTouchpointDate === null ? null : daysSince(row.lastTouchpointDate, tz),
    }))
    .sort((a, b) => {
      if (a.lastTouchpointDate === null && b.lastTouchpointDate === null) return 0;
      if (a.lastTouchpointDate === null) return -1;
      if (b.lastTouchpointDate === null) return 1;
      return a.lastTouchpointDate < b.lastTouchpointDate ? -1 : a.lastTouchpointDate > b.lastTouchpointDate ? 1 : 0;
    });
}

// --- Birthdays ---

export interface UpcomingBirthday {
  id: number;
  name: string;
  birthday: string;
  daysUntil: number;
  turningAge: number | null;
}

/**
 * People whose next birthday celebration falls within `windowDays` of
 * `todayISO`, inclusive on both ends (daysUntil 0 = today). Sorted by
 * daysUntil, then name.
 */
export async function upcomingBirthdays(
  db: AppDatabase,
  todayISO: string,
  windowDays: number,
): Promise<UpcomingBirthday[]> {
  const rows = await db
    .select({ id: people.id, name: people.name, birthday: people.birthday })
    .from(people)
    .where(isNotNull(people.birthday))
    .all();

  return rows
    .flatMap((row) => {
      const occurrence = nextOccurrence(row.birthday!, todayISO);
      if (!occurrence || occurrence.daysUntil > windowDays) return [];
      return [
        {
          id: row.id,
          name: row.name,
          birthday: row.birthday!,
          daysUntil: occurrence.daysUntil,
          turningAge: occurrence.turningAge,
        },
      ];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}
