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

// --- Categories ---

export function listCategories(db: AppDatabase): Category[] {
  return db.select().from(categories).orderBy(categories.sortOrder).all();
}

export function createCategory(db: AppDatabase, input: NewCategory): Category {
  try {
    const [row] = db
      .insert(categories)
      .values({ name: input.name, sortOrder: input.sortOrder ?? 0 })
      .returning()
      .all();
    return row;
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      throw new Error(`A category named "${input.name}" already exists.`);
    }
    throw err;
  }
}

export function updateCategory(db: AppDatabase, id: number, input: Partial<NewCategory>): Category {
  try {
    const [row] = db.update(categories).set(input).where(eq(categories.id, id)).returning().all();
    if (!row) throw new Error(`Category ${id} not found`);
    return row;
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      throw new Error(`A category named "${input.name}" already exists.`);
    }
    throw err;
  }
}

export function deleteCategory(db: AppDatabase, id: number): void {
  try {
    db.delete(categories).where(eq(categories.id, id)).run();
  } catch (err) {
    if (err instanceof Error && err.message.includes("FOREIGN KEY constraint failed")) {
      throw new Error("Cannot delete category: it still has todos assigned to it.");
    }
    throw err;
  }
}

// --- Todos ---

export function listTodos(db: AppDatabase): Todo[] {
  return db.select().from(todos).all().map(toTodo);
}

export function getTodo(db: AppDatabase, id: number): Todo | null {
  const row = db.select().from(todos).where(eq(todos.id, id)).get();
  return row ? toTodo(row) : null;
}

export function createTodo(db: AppDatabase, input: NewTodo): Todo {
  const [row] = db
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

export function updateTodo(db: AppDatabase, id: number, input: UpdateTodoInput): Todo {
  const [row] = db.update(todos).set(input).where(eq(todos.id, id)).returning().all();
  if (!row) throw new Error(`Todo ${id} not found`);
  return toTodo(row);
}

export function deleteTodo(db: AppDatabase, id: number): void {
  db.delete(todos).where(eq(todos.id, id)).run();
}

/** Marks a todo done (setting completedAt to now) or undone (clearing completedAt) based on its current state. */
export function toggleTodoDone(db: AppDatabase, id: number): Todo {
  const existing = db.select().from(todos).where(eq(todos.id, id)).get();
  if (!existing) throw new Error(`Todo ${id} not found`);

  const willBeDone = existing.done === 0;
  const [row] = db
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
