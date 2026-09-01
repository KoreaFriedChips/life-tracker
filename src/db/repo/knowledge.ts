import { eq, or, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { causedBy } from "../errors";
import { connections, knowledgeEntries } from "../schema";

export type KnowledgeType = "book" | "article" | "paper" | "video";
export type KnowledgeStatus = "next" | "in_progress" | "completed";

export interface KnowledgeEntry {
  id: number;
  title: string;
  type: KnowledgeType;
  url: string | null;
  authors: string[];
  status: KnowledgeStatus;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NewKnowledgeEntry {
  title: string;
  type: KnowledgeType;
  url?: string;
  authors?: string[];
  status?: KnowledgeStatus;
  notes?: string;
  tags?: string[];
}

export interface UpdateKnowledgeEntryInput {
  title?: string;
  type?: KnowledgeType;
  url?: string | null;
  authors?: string[];
  status?: KnowledgeStatus;
  notes?: string;
  tags?: string[];
}

export interface Connection {
  id: number;
  entryIdA: number;
  entryIdB: number;
  label: string | null;
  createdAt: string;
}

export interface GraphNode {
  id: number;
  title: string;
  type: KnowledgeType;
  status: KnowledgeStatus;
  tags: string[];
  authors: string[];
  notesExcerpt: string;
}

export interface GraphLink {
  id: number;
  source: number;
  target: number;
  label: string | null;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ConnectionWithOtherEntry {
  id: number;
  otherEntryId: number;
  otherEntryTitle: string;
  label: string | null;
}

function toKnowledgeEntry(row: typeof knowledgeEntries.$inferSelect): KnowledgeEntry {
  return {
    id: row.id,
    title: row.title,
    type: row.type as KnowledgeType,
    url: row.url,
    authors: JSON.parse(row.authors),
    status: row.status as KnowledgeStatus,
    notes: row.notes,
    tags: JSON.parse(row.tags),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// --- Knowledge entries ---

export async function listKnowledgeEntries(db: AppDatabase): Promise<KnowledgeEntry[]> {
  return (await db.select().from(knowledgeEntries).all()).map(toKnowledgeEntry);
}

export async function getKnowledgeEntry(db: AppDatabase, id: number): Promise<KnowledgeEntry | null> {
  const row = await db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, id)).get();
  return row ? toKnowledgeEntry(row) : null;
}

export async function createKnowledgeEntry(
  db: AppDatabase,
  input: NewKnowledgeEntry,
): Promise<KnowledgeEntry> {
  const [row] = await db
    .insert(knowledgeEntries)
    .values({
      title: input.title,
      type: input.type,
      url: input.url ?? null,
      authors: JSON.stringify(input.authors ?? []),
      status: input.status ?? "next",
      notes: input.notes ?? "",
      tags: JSON.stringify(input.tags ?? []),
    })
    .returning()
    .all();
  return toKnowledgeEntry(row);
}

export async function updateKnowledgeEntry(
  db: AppDatabase,
  id: number,
  input: UpdateKnowledgeEntryInput,
): Promise<KnowledgeEntry> {
  const [row] = await db
    .update(knowledgeEntries)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.authors !== undefined ? { authors: JSON.stringify(input.authors) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.tags !== undefined ? { tags: JSON.stringify(input.tags) } : {}),
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(knowledgeEntries.id, id))
    .returning()
    .all();
  if (!row) throw new Error(`Knowledge entry ${id} not found`);
  return toKnowledgeEntry(row);
}

export async function deleteKnowledgeEntry(db: AppDatabase, id: number): Promise<void> {
  await db.delete(knowledgeEntries).where(eq(knowledgeEntries.id, id)).run();
}

// --- Connections ---

/** Adds an undirected connection between two entries, canonically storing the smaller id in entryIdA. */
export async function addConnection(
  db: AppDatabase,
  entryIdA: number,
  entryIdB: number,
  label?: string,
): Promise<Connection> {
  if (entryIdA === entryIdB) {
    throw new Error("Cannot connect a knowledge entry to itself.");
  }
  const [smaller, larger] = entryIdA < entryIdB ? [entryIdA, entryIdB] : [entryIdB, entryIdA];

  try {
    const [row] = await db
      .insert(connections)
      .values({ entryIdA: smaller, entryIdB: larger, label: label ?? null })
      .returning()
      .all();
    return row;
  } catch (err) {
    if (causedBy(err, "UNIQUE constraint failed")) {
      throw new Error("A connection between these two entries already exists.");
    }
    throw err;
  }
}

export async function deleteConnection(db: AppDatabase, id: number): Promise<void> {
  await db.delete(connections).where(eq(connections.id, id)).run();
}

/** All connections touching `entryId`, each resolved to the OTHER entry's id/title (either side of the pair). */
export async function listConnectionsForEntry(
  db: AppDatabase,
  entryId: number,
): Promise<ConnectionWithOtherEntry[]> {
  const rows = await db
    .select()
    .from(connections)
    .where(or(eq(connections.entryIdA, entryId), eq(connections.entryIdB, entryId)))
    .all();

  return Promise.all(
    rows.map(async (row) => {
      const otherEntryId = row.entryIdA === entryId ? row.entryIdB : row.entryIdA;
      const other = await getKnowledgeEntry(db, otherEntryId);
      return {
        id: row.id,
        otherEntryId,
        otherEntryTitle: other?.title ?? "Unknown entry",
        label: row.label,
      };
    }),
  );
}

const NOTES_EXCERPT_LENGTH = 200;

/** All entries as graph nodes (including unconnected ones), plus all connections as links. */
export async function getGraphData(db: AppDatabase): Promise<GraphData> {
  const entries = await db
    .select({
      id: knowledgeEntries.id,
      title: knowledgeEntries.title,
      type: knowledgeEntries.type,
      status: knowledgeEntries.status,
      tags: knowledgeEntries.tags,
      authors: knowledgeEntries.authors,
      notes: knowledgeEntries.notes,
    })
    .from(knowledgeEntries)
    .all();
  const edges = await db.select().from(connections).all();

  return {
    nodes: entries.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type as KnowledgeType,
      status: e.status as KnowledgeStatus,
      tags: JSON.parse(e.tags),
      authors: JSON.parse(e.authors),
      notesExcerpt:
        e.notes.length > NOTES_EXCERPT_LENGTH ? `${e.notes.slice(0, NOTES_EXCERPT_LENGTH)}…` : e.notes,
    })),
    links: edges.map((c) => ({ id: c.id, source: c.entryIdA, target: c.entryIdB, label: c.label })),
  };
}
