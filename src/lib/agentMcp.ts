import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AppDatabase } from "@/db/client";
import { createTodo, getTodo, listCategories, listTodos, type Category } from "@/db/repo/todos";

const NOTES_PREVIEW_LENGTH = 200;

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** True if `value` is a real calendar date in YYYY-MM-DD form (rejects e.g. 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function resolveCategory(
  categories: Category[],
  input: { categoryId?: number; category?: string },
): Category | string {
  const names = categories.map((c) => `"${c.name}" (id ${c.id})`).join(", ");
  if (input.categoryId !== undefined) {
    return (
      categories.find((c) => c.id === input.categoryId) ??
      `No category with id ${input.categoryId}. Categories: ${names}.`
    );
  }
  const name = input.category?.trim().toLowerCase();
  if (name) {
    return (
      categories.find((c) => c.name.toLowerCase() === name) ??
      `No category named "${input.category}". Categories: ${names}.`
    );
  }
  return `Pass categoryId or category. Categories: ${names}.`;
}

/** Builds the Life Tracker MCP server (to-do read + create tools) over an already-authorized database. */
export function createAgentMcpServer(db: AppDatabase): McpServer {
  const server = new McpServer({ name: "life-tracker", version: "1.0.0" });

  server.registerTool(
    "list_categories",
    {
      title: "List to-do categories",
      description:
        "Lists the to-do categories in the user's Life Tracker. Every to-do belongs to exactly one category; call this before create_todo to pick the right one.",
      annotations: { readOnlyHint: true },
    },
    async () => json((await listCategories(db)).map(({ id, name }) => ({ id, name }))),
  );

  server.registerTool(
    "list_todos",
    {
      title: "List to-dos",
      description:
        "Lists to-dos in the user's Life Tracker (open ones by default). Check this before create_todo to avoid adding duplicates.",
      inputSchema: {
        includeDone: z.boolean().optional().describe("Also include completed to-dos. Default false."),
        categoryId: z.number().int().optional().describe("Only list to-dos in this category."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ includeDone = false, categoryId }) => {
      const [todos, categories] = await Promise.all([listTodos(db), listCategories(db)]);
      const categoryName = new Map(categories.map((c) => [c.id, c.name]));
      return json(
        todos
          .filter((t) => (includeDone || !t.done) && (categoryId === undefined || t.categoryId === categoryId))
          .map((t) => ({
            id: t.id,
            title: t.title,
            category: categoryName.get(t.categoryId) ?? null,
            dueDate: t.dueDate,
            done: t.done,
            notes:
              t.notes.length > NOTES_PREVIEW_LENGTH ? `${t.notes.slice(0, NOTES_PREVIEW_LENGTH)}…` : t.notes,
          })),
      );
    },
  );

  server.registerTool(
    "get_todo",
    {
      title: "Get a to-do",
      description:
        "Returns one to-do with its full Markdown notes (list_todos truncates notes), e.g. to read links in them.",
      inputSchema: {
        id: z.number().int().describe("To-do id."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const todo = await getTodo(db, id);
      if (!todo) return toolError(`No to-do with id ${id}.`);
      const category = (await listCategories(db)).find((c) => c.id === todo.categoryId);
      return json({ ...todo, category: category?.name ?? null });
    },
  );

  server.registerTool(
    "create_todo",
    {
      title: "Create a to-do",
      description:
        "Adds a to-do to the user's Life Tracker. Identify the category by categoryId or by exact category name (case-insensitive); call list_categories if unsure.",
      inputSchema: {
        title: z.string().describe("Short, action-oriented title."),
        categoryId: z.number().int().optional().describe("Category id from list_categories."),
        category: z.string().optional().describe("Category name, used when categoryId is not given."),
        notes: z.string().optional().describe("Optional Markdown notes (links, details, checklists)."),
        dueDate: z.string().optional().describe("Optional due date as YYYY-MM-DD."),
      },
    },
    async ({ title, categoryId, category, notes, dueDate }) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return toolError("Title is required.");

      const trimmedDueDate = dueDate?.trim() || null;
      if (trimmedDueDate && !isIsoDate(trimmedDueDate)) {
        return toolError(`Invalid dueDate "${dueDate}": use a real date in YYYY-MM-DD form.`);
      }

      const resolved = resolveCategory(await listCategories(db), { categoryId, category });
      if (typeof resolved === "string") return toolError(resolved);

      const todo = await createTodo(db, {
        title: trimmedTitle,
        categoryId: resolved.id,
        notes: notes ?? "",
        dueDate: trimmedDueDate,
      });
      revalidatePath("/");
      revalidatePath("/todos");
      revalidatePath("/calendar");
      return json({ ...todo, category: resolved.name });
    },
  );

  return server;
}
