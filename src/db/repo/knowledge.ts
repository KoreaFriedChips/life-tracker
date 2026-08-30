import { eq, or, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { connections, knowledgeEntries } from "../schema";

export type KnowledgeType = "book" | "article" | "paper";
export type KnowledgeStatus = "want_to_read" | "reading" | "finished";

export interface KnowledgeEntry {
  id: number;
  title: string;
  type: KnowledgeType;
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
  authors?: string[];
  status?: KnowledgeStatus;
  notes?: string;
  tags?: string[];
}

export interface UpdateKnowledgeEntryInput {
  title?: string;
  type?: KnowledgeType;
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

export interface GraphData {
  nodes: { id: number; title: string; type: KnowledgeType }[];
  links: { source: number; target: number; label: string | null }[];
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
    authors: JSON.parse(row.authors),
    status: row.status as KnowledgeStatus,
    notes: row.notes,
    tags: JSON.parse(row.tags),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * True if `err` — or the underlying driver error libsql wraps it in via `.cause` —
 * has a message containing `substring`. Needed because drizzle's libsql driver wraps
 * driver errors in a `DrizzleQueryError` whose own `.message` is a generic "Failed
 * query: ..." string; the original SQLite message (e.g. "UNIQUE constraint failed: ...")
 * lives one level down at `err.cause.message`.
 */
function causedBy(err: unknown, substring: string): boolean {
  const message =
    err instanceof Error && err.cause instanceof Error ? err.cause.message : err instanceof Error ? err.message : "";
  return message.includes(substring);
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
      authors: JSON.stringify(input.authors ?? []),
      status: input.status ?? "want_to_read",
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

/** All entries as graph nodes (including unconnected ones), plus all connections as links. */
export async function getGraphData(db: AppDatabase): Promise<GraphData> {
  const entries = await db
    .select({ id: knowledgeEntries.id, title: knowledgeEntries.title, type: knowledgeEntries.type })
    .from(knowledgeEntries)
    .all();
  const edges = await db.select().from(connections).all();

  return {
    nodes: entries.map((e) => ({ id: e.id, title: e.title, type: e.type as KnowledgeType })),
    links: edges.map((c) => ({ source: c.entryIdA, target: c.entryIdB, label: c.label })),
  };
}
