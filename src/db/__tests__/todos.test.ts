import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type AppDatabase } from "@/db/client";
import {
  createCategory,
  createTodo,
  deleteCategory,
  deleteTodo,
  getTodo,
  listCategories,
  listTodos,
  toggleTodoDone,
  updateCategory,
  updateTodo,
} from "@/db/repo/todos";

describe("todos repo", () => {
  let db: AppDatabase;
  let categoryId: number;

  beforeEach(() => {
    db = createDb(":memory:");
    categoryId = listCategories(db)[0].id;
  });

  it("round-trips a created todo through typed DTOs", () => {
    const created = createTodo(db, {
      title: "Write task-2 report",
      notes: "keep it concise",
      categoryId,
      dueDate: "2026-08-20",
    });

    expect(created).toMatchObject({
      title: "Write task-2 report",
      notes: "keep it concise",
      categoryId,
      dueDate: "2026-08-20",
      done: false,
      completedAt: null,
    });
    expect(typeof created.id).toBe("number");
    expect(typeof created.createdAt).toBe("string");

    const fetched = getTodo(db, created.id);
    expect(fetched).toEqual(created);
  });

  it("defaults notes to empty string and dueDate to null when omitted", () => {
    const created = createTodo(db, { title: "Minimal todo", categoryId });
    expect(created.notes).toBe("");
    expect(created.dueDate).toBeNull();
  });

  it("updates a todo's fields", () => {
    const created = createTodo(db, { title: "Original", categoryId });

    const updated = updateTodo(db, created.id, { title: "Renamed", notes: "updated notes" });

    expect(updated.title).toBe("Renamed");
    expect(updated.notes).toBe("updated notes");
    expect(updated.id).toBe(created.id);
  });

  it("deletes a todo", () => {
    const created = createTodo(db, { title: "Temp", categoryId });
    deleteTodo(db, created.id);
    expect(getTodo(db, created.id)).toBeNull();
  });

  it("lists all todos", () => {
    createTodo(db, { title: "A", categoryId });
    createTodo(db, { title: "B", categoryId });
    expect(listTodos(db).map((t) => t.title).sort()).toEqual(["A", "B"]);
  });

  it("toggling done sets completedAt, and toggling again clears it", () => {
    const created = createTodo(db, { title: "Ship it", categoryId });
    expect(created.done).toBe(false);
    expect(created.completedAt).toBeNull();

    const done = toggleTodoDone(db, created.id);
    expect(done.done).toBe(true);
    expect(typeof done.completedAt).toBe("string");

    const undone = toggleTodoDone(db, created.id);
    expect(undone.done).toBe(false);
    expect(undone.completedAt).toBeNull();
  });

  it("throws a clear error when deleting a category that still has todos", () => {
    createTodo(db, { title: "Blocks deletion", categoryId });
    expect(() => deleteCategory(db, categoryId)).toThrow();
  });

  it("updates a category's name and sortOrder", () => {
    const category = createCategory(db, { name: "Original Category", sortOrder: 5 });
    const updated = updateCategory(db, category.id, { name: "Renamed Category", sortOrder: 15 });
    expect(updated).toEqual({ id: category.id, name: "Renamed Category", sortOrder: 15 });
  });

  it("deletes a category successfully when it has no todos", () => {
    const category = createCategory(db, { name: "Temp Category" });
    expect(() => deleteCategory(db, category.id)).not.toThrow();
    expect(listCategories(db).find((c) => c.id === category.id)).toBeUndefined();
  });

  it("throws a readable error when creating a category with a duplicate name", () => {
    const existingName = listCategories(db)[0].name;
    expect(() => createCategory(db, { name: existingName })).toThrow(
      `A category named "${existingName}" already exists.`,
    );
  });

  it("throws a readable error when renaming a category to a duplicate name", () => {
    const [first, second] = listCategories(db);
    expect(() => updateCategory(db, second.id, { name: first.name })).toThrow(
      `A category named "${first.name}" already exists.`,
    );
  });
});
