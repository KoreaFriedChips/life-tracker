import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type AppDatabase } from "@/db/client";
import {
  createTodo,
  getTodo,
  listCategories,
  type Category,
  type Todo,
} from "@/db/repo/todos";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Actions reach the data layer through getDb(); point it at a fresh in-memory
// database so the assertions below run against real SQL, not a mock.
let db: AppDatabase;
vi.mock("@/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/client")>();
  return { ...actual, getDb: vi.fn(async () => db) };
});

import { updateTodoAction } from "@/app/todos/actions";

function todoForm(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

describe("updateTodoAction", () => {
  let categories: Category[];
  let todo: Todo;

  beforeEach(async () => {
    db = await createDb(":memory:");
    categories = await listCategories(db);
    todo = await createTodo(db, {
      title: "Write task-2 report",
      notes: "keep it concise",
      categoryId: categories[0].id,
      dueDate: "2026-08-20",
    });
  });

  it("saves an edited title, notes, due date and category", async () => {
    await updateTodoAction(
      todoForm({
        id: String(todo.id),
        title: "  Write task-3 report  ",
        notes: "Spec at [RFC-12](https://example.com/rfc12).",
        categoryId: String(categories[1].id),
        dueDate: "2026-09-01",
      }),
    );

    expect(await getTodo(db, todo.id)).toMatchObject({
      title: "Write task-3 report",
      notes: "Spec at [RFC-12](https://example.com/rfc12).",
      categoryId: categories[1].id,
      dueDate: "2026-09-01",
    });
  });

  it("clears the due date when the field is submitted empty", async () => {
    await updateTodoAction(
      todoForm({
        id: String(todo.id),
        title: todo.title,
        notes: todo.notes,
        categoryId: String(todo.categoryId),
        dueDate: "",
      }),
    );

    expect((await getTodo(db, todo.id))?.dueDate).toBeNull();
  });

  it("leaves the todo untouched when the title is blank", async () => {
    await updateTodoAction(
      todoForm({
        id: String(todo.id),
        title: "   ",
        notes: "should not be saved",
        categoryId: String(todo.categoryId),
        dueDate: "2026-08-20",
      }),
    );

    expect(await getTodo(db, todo.id)).toMatchObject({
      title: "Write task-2 report",
      notes: "keep it concise",
    });
  });
});
