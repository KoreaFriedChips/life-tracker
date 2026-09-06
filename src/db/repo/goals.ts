import { and, asc, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { goals } from "../schema";

export type GoalHorizon = "short" | "long";
export type GoalStatus = "active" | "achieved" | "dropped";

export const GOAL_HORIZONS: readonly GoalHorizon[] = ["short", "long"] as const;
export const GOAL_STATUSES: readonly GoalStatus[] = ["active", "achieved", "dropped"] as const;

export interface Goal {
  id: number;
  title: string;
  horizon: GoalHorizon;
  categoryId: number | null;
  targetDate: string | null;
  notes: string;
  status: GoalStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  achievedAt: string | null;
}

export interface NewGoal {
  title: string;
  horizon: GoalHorizon;
  categoryId?: number | null;
  targetDate?: string | null;
  notes?: string;
  sortOrder?: number;
}

export interface UpdateGoalInput {
  title?: string;
  horizon?: GoalHorizon;
  categoryId?: number | null;
  targetDate?: string | null;
  notes?: string;
  sortOrder?: number;
}

function toGoal(row: typeof goals.$inferSelect): Goal {
  return {
    id: row.id,
    title: row.title,
    horizon: row.horizon as GoalHorizon,
    categoryId: row.categoryId,
    targetDate: row.targetDate,
    notes: row.notes,
    status: row.status as GoalStatus,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    achievedAt: row.achievedAt,
  };
}

/** Short-term goals first, then long-term; each block in manual sort order. */
const GOAL_ORDER = [sql`CASE ${goals.horizon} WHEN 'short' THEN 0 ELSE 1 END`, asc(goals.sortOrder), asc(goals.id)];

export async function listGoals(db: AppDatabase): Promise<Goal[]> {
  return (await db.select().from(goals).orderBy(...GOAL_ORDER).all()).map(toGoal);
}

/** The goals worth showing on the daily reminder banner. */
export async function listActiveGoals(db: AppDatabase): Promise<Goal[]> {
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.status, "active"))
    .orderBy(...GOAL_ORDER)
    .all();
  return rows.map(toGoal);
}

export async function getGoal(db: AppDatabase, id: number): Promise<Goal | null> {
  const row = await db.select().from(goals).where(eq(goals.id, id)).get();
  return row ? toGoal(row) : null;
}

export async function createGoal(db: AppDatabase, input: NewGoal): Promise<Goal> {
  const [row] = await db
    .insert(goals)
    .values({
      title: input.title,
      horizon: input.horizon,
      categoryId: input.categoryId ?? null,
      targetDate: input.targetDate ?? null,
      notes: input.notes ?? "",
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()
    .all();
  return toGoal(row);
}

export async function updateGoal(
  db: AppDatabase,
  id: number,
  input: UpdateGoalInput,
): Promise<Goal> {
  const [row] = await db
    .update(goals)
    .set({ ...input, updatedAt: sql`(datetime('now'))` })
    .where(eq(goals.id, id))
    .returning()
    .all();
  if (!row) throw new Error(`Goal ${id} not found`);
  return toGoal(row);
}

/** Sets a goal's status, stamping achievedAt when it becomes achieved and clearing it otherwise. */
export async function setGoalStatus(
  db: AppDatabase,
  id: number,
  status: GoalStatus,
): Promise<Goal> {
  const [row] = await db
    .update(goals)
    .set({
      status,
      achievedAt: status === "achieved" ? sql`(datetime('now'))` : null,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(goals.id, id))
    .returning()
    .all();
  if (!row) throw new Error(`Goal ${id} not found`);
  return toGoal(row);
}

export async function deleteGoal(db: AppDatabase, id: number): Promise<void> {
  await db.delete(goals).where(eq(goals.id, id)).run();
}

/** The next sortOrder for a new goal in `horizon`, spaced by 10 like the seeded categories. */
export async function nextGoalSortOrder(
  db: AppDatabase,
  horizon: GoalHorizon,
): Promise<number> {
  const rows = await db
    .select({ sortOrder: goals.sortOrder })
    .from(goals)
    .where(eq(goals.horizon, horizon))
    .all();
  return rows.reduce((max, r) => Math.max(max, r.sortOrder), 0) + 10;
}

/**
 * Reorders a goal by swapping sortOrder with its up/down neighbor *within the same
 * horizon*, so a short-term goal never trades places with a long-term one.
 * No-ops when the goal is missing or already at the end of its block.
 */
export async function moveGoal(
  db: AppDatabase,
  id: number,
  direction: "up" | "down",
): Promise<void> {
  const goal = await db.select().from(goals).where(eq(goals.id, id)).get();
  if (!goal) return;

  const siblings = await db
    .select()
    .from(goals)
    .where(and(eq(goals.horizon, goal.horizon), eq(goals.status, goal.status)))
    .orderBy(asc(goals.sortOrder), asc(goals.id))
    .all();

  const index = siblings.findIndex((g) => g.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const neighbor = siblings[swapIndex];
  // Equal sortOrders (e.g. both defaulted to 0) would make the swap a no-op, so
  // fall back to spacing them apart rather than silently doing nothing.
  const [a, b] =
    goal.sortOrder === neighbor.sortOrder
      ? direction === "up"
        ? [neighbor.sortOrder - 1, neighbor.sortOrder]
        : [neighbor.sortOrder + 1, neighbor.sortOrder]
      : [neighbor.sortOrder, goal.sortOrder];

  await db.update(goals).set({ sortOrder: a }).where(eq(goals.id, goal.id)).run();
  await db.update(goals).set({ sortOrder: b }).where(eq(goals.id, neighbor.id)).run();
}
