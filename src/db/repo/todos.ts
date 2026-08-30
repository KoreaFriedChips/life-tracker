import { eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { categories, todos } from "../schema";

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
}

export interface NewCategory {
  name: string;
  sortOrder?: number;
}

export interface Todo {
  id: number;
  title: string;
  notes: string;
  categoryId: number;
  done: boolean;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface NewTodo {
  title: string;
  notes?: string;
  categoryId: number;
  dueDate?: string | null;
}

export interface UpdateTodoInput {
  title?: string;
  notes?: string;
  categoryId?: number;
  dueDate?: string | null;
}

function toTodo(row: typeof todos.$inferSelect): Todo {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    categoryId: row.categoryId,
    done: row.done !== 0,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
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

// --- Categories ---

export async function listCategories(db: AppDatabase): Promise<Category[]> {
  return db.select().from(categories).orderBy(categories.sortOrder).all();
}

export async function createCategory(db: AppDatabase, input: NewCategory): Promise<Category> {
  try {
    const [row] = await db
      .insert(categories)
      .values({ name: input.name, sortOrder: input.sortOrder ?? 0 })
      .returning()
      .all();
    return row;
  } catch (err) {
    if (causedBy(err, "UNIQUE constraint failed")) {
      throw new Error(`A category named "${input.name}" already exists.`);
    }
    throw err;
  }
}

export async function updateCategory(
  db: AppDatabase,
  id: number,
  input: Partial<NewCategory>,
): Promise<Category> {
  try {
    const [row] = await db
      .update(categories)
      .set(input)
      .where(eq(categories.id, id))
      .returning()
      .all();
    if (!row) throw new Error(`Category ${id} not found`);
    return row;
  } catch (err) {
    if (causedBy(err, "UNIQUE constraint failed")) {
      throw new Error(`A category named "${input.name}" already exists.`);
    }
    throw err;
  }
}

export async function deleteCategory(db: AppDatabase, id: number): Promise<void> {
  try {
    await db.delete(categories).where(eq(categories.id, id)).run();
  } catch (err) {
    if (causedBy(err, "FOREIGN KEY constraint failed")) {
      throw new Error("Cannot delete category: it still has todos assigned to it.");
    }
    throw err;
  }
}

// --- Todos ---

export async function listTodos(db: AppDatabase): Promise<Todo[]> {
  return (await db.select().from(todos).all()).map(toTodo);
}

export async function getTodo(db: AppDatabase, id: number): Promise<Todo | null> {
  const row = await db.select().from(todos).where(eq(todos.id, id)).get();
  return row ? toTodo(row) : null;
}

export async function createTodo(db: AppDatabase, input: NewTodo): Promise<Todo> {
  const [row] = await db
    .insert(todos)
    .values({
      title: input.title,
      notes: input.notes ?? "",
      categoryId: input.categoryId,
      dueDate: input.dueDate ?? null,
    })
    .returning()
    .all();
  return toTodo(row);
}

export async function updateTodo(
  db: AppDatabase,
  id: number,
  input: UpdateTodoInput,
): Promise<Todo> {
  const [row] = await db.update(todos).set(input).where(eq(todos.id, id)).returning().all();
  if (!row) throw new Error(`Todo ${id} not found`);
  return toTodo(row);
}

export async function deleteTodo(db: AppDatabase, id: number): Promise<void> {
  await db.delete(todos).where(eq(todos.id, id)).run();
}

/** Marks a todo done (setting completedAt to now) or undone (clearing completedAt) based on its current state. */
export async function toggleTodoDone(db: AppDatabase, id: number): Promise<Todo> {
  const existing = await db.select().from(todos).where(eq(todos.id, id)).get();
  if (!existing) throw new Error(`Todo ${id} not found`);

  const willBeDone = existing.done === 0;
  const [row] = await db
    .update(todos)
    .set({
      done: willBeDone ? 1 : 0,
      completedAt: willBeDone ? sql`(datetime('now'))` : null,
    })
    .where(eq(todos.id, id))
    .returning()
    .all();
  return toTodo(row);
}
