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

  beforeEach(async () => {
    db = await createDb(":memory:");
    categoryId = (await listCategories(db))[0].id;
  });

  it("round-trips a created todo through typed DTOs", async () => {
    const created = await createTodo(db, {
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

    const fetched = await getTodo(db, created.id);
    expect(fetched).toEqual(created);
  });

  it("defaults notes to empty string and dueDate to null when omitted", async () => {
    const created = await createTodo(db, { title: "Minimal todo", categoryId });
    expect(created.notes).toBe("");
    expect(created.dueDate).toBeNull();
  });

  it("updates a todo's fields", async () => {
    const created = await createTodo(db, { title: "Original", categoryId });

    const updated = await updateTodo(db, created.id, { title: "Renamed", notes: "updated notes" });

    expect(updated.title).toBe("Renamed");
    expect(updated.notes).toBe("updated notes");
    expect(updated.id).toBe(created.id);
  });

  it("deletes a todo", async () => {
    const created = await createTodo(db, { title: "Temp", categoryId });
    await deleteTodo(db, created.id);
    expect(await getTodo(db, created.id)).toBeNull();
  });

  it("lists all todos", async () => {
    await createTodo(db, { title: "A", categoryId });
    await createTodo(db, { title: "B", categoryId });
    expect((await listTodos(db)).map((t) => t.title).sort()).toEqual(["A", "B"]);
  });

  it("toggling done sets completedAt, and toggling again clears it", async () => {
    const created = await createTodo(db, { title: "Ship it", categoryId });
    expect(created.done).toBe(false);
    expect(created.completedAt).toBeNull();

    const done = await toggleTodoDone(db, created.id);
    expect(done.done).toBe(true);
    expect(typeof done.completedAt).toBe("string");

    const undone = await toggleTodoDone(db, created.id);
    expect(undone.done).toBe(false);
    expect(undone.completedAt).toBeNull();
  });

  it("throws a clear error when deleting a category that still has todos", async () => {
    await createTodo(db, { title: "Blocks deletion", categoryId });
    await expect(deleteCategory(db, categoryId)).rejects.toThrow();
  });

  it("updates a category's name and sortOrder", async () => {
    const category = await createCategory(db, { name: "Original Category", sortOrder: 5 });
    const updated = await updateCategory(db, category.id, { name: "Renamed Category", sortOrder: 15 });
    expect(updated).toEqual({ id: category.id, name: "Renamed Category", sortOrder: 15 });
  });

  it("deletes a category successfully when it has no todos", async () => {
    const category = await createCategory(db, { name: "Temp Category" });
    await expect(deleteCategory(db, category.id)).resolves.toBeUndefined();
    expect((await listCategories(db)).find((c) => c.id === category.id)).toBeUndefined();
  });

  it("throws a readable error when creating a category with a duplicate name", async () => {
    const existingName = (await listCategories(db))[0].name;
    await expect(createCategory(db, { name: existingName })).rejects.toThrow(
      `A category named "${existingName}" already exists.`,
    );
  });

  it("throws a readable error when renaming a category to a duplicate name", async () => {
    const [first, second] = await listCategories(db);
    await expect(updateCategory(db, second.id, { name: first.name })).rejects.toThrow(
      `A category named "${first.name}" already exists.`,
    );
  });
});
