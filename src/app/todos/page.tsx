import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listCategories, listTodos, type Todo } from "@/db/repo/todos";
import { localToday } from "@/lib/dates";
import TodoItem from "@/components/TodoItem";
import { Button, buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/fields";
import {
  addCategory,
  addTodo,
  deleteCategoryAction,
  deleteTodoAction,
  moveCategory,
  renameCategory,
  toggleTodo,
} from "./actions";

export const metadata: Metadata = {
  title: "To-dos",
};

export default async function TodosPage({ searchParams }: PageProps<"/todos">) {
  const params = await searchParams;
  const showCompleted = params.showCompleted === "1";
  const error = typeof params.error === "string" ? params.error : null;

  const db = getDb();
  const categories = listCategories(db);
  const allTodos = listTodos(db);
  const today = localToday();

  const openTodosByCategory = new Map<number, Todo[]>();
  for (const todo of allTodos) {
    if (todo.done) continue;
    const list = openTodosByCategory.get(todo.categoryId) ?? [];
    list.push(todo);
    openTodosByCategory.set(todo.categoryId, list);
  }

  const completedTodos = allTodos
    .filter((todo) => todo.done)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">To-dos</h1>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      {categories.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted">No categories yet.</p>
          <a href="#manage-categories" className={buttonClassName("secondary", "sm")}>
            Add a category to get started
          </a>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {categories.map((category) => {
          const todos = openTodosByCategory.get(category.id) ?? [];
          return (
            <Card key={category.id} className="p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">{category.name}</h2>
                <span className="text-xs text-faint">
                  {todos.length} open
                </span>
              </div>

              <form
                action={addTodo}
                className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
              >
                <input type="hidden" name="categoryId" value={category.id} />
                <Input
                  type="text"
                  name="title"
                  placeholder="Add a to-do..."
                  required
                  className="min-w-[10rem] flex-1"
                />
                <Input type="date" name="dueDate" />
                <Button type="submit" size="sm">
                  Add
                </Button>
              </form>

              {todos.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">No open to-dos.</p>
              ) : (
                <div className="divide-y divide-border px-4">
                  {todos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      overdue={!!todo.dueDate && todo.dueDate < today}
                      toggleTodo={toggleTodo}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <section>
        <Link
          href={showCompleted ? "/todos" : "/todos?showCompleted=1"}
          className={buttonClassName("ghost", "sm")}
        >
          {showCompleted ? "Hide completed" : "Show completed"}
        </Link>

        {showCompleted && (
          <Card className="mt-3 p-0">
            <div className="divide-y divide-border px-4">
              {completedTodos.length === 0 ? (
                <p className="py-3 text-sm text-muted">No completed to-dos yet.</p>
              ) : (
                completedTodos.map((todo) => (
                  <form
                    key={todo.id}
                    action={deleteTodoAction}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <input type="hidden" name="id" value={todo.id} />
                    <span className="text-sm text-muted line-through">
                      {todo.title}
                      <span className="ml-2 text-xs text-faint no-underline">
                        {categoryNameById.get(todo.categoryId)}
                      </span>
                    </span>
                    <Button type="submit" variant="danger" size="sm">
                      Delete
                    </Button>
                  </form>
                ))
              )}
            </div>
          </Card>
        )}
      </section>

      <details
        id="manage-categories"
        className="rounded-xl border border-border bg-surface shadow-xs"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold select-none">
          Manage categories
        </summary>

        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          {categories.map((category, index) => (
            <div key={category.id} className="flex items-center gap-2">
              <form action={moveCategory} className="flex gap-1">
                <input type="hidden" name="id" value={category.id} />
                <Button
                  type="submit"
                  name="direction"
                  value="up"
                  disabled={index === 0}
                  variant="secondary"
                  size="sm"
                >
                  {"↑"}
                </Button>
                <Button
                  type="submit"
                  name="direction"
                  value="down"
                  disabled={index === categories.length - 1}
                  variant="secondary"
                  size="sm"
                >
                  {"↓"}
                </Button>
              </form>

              <form action={renameCategory} className="flex flex-1 gap-2">
                <input type="hidden" name="id" value={category.id} />
                <Input type="text" name="name" defaultValue={category.name} className="flex-1" />
                <Button type="submit" variant="secondary">
                  Save
                </Button>
              </form>

              <form action={deleteCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                <Button type="submit" variant="danger" size="sm">
                  Delete
                </Button>
              </form>
            </div>
          ))}

          <form action={addCategory} className="mt-2 flex gap-2">
            <Input
              type="text"
              name="name"
              placeholder="New category name"
              required
              className="flex-1"
            />
            <Button type="submit" variant="secondary">
              Add category
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}
