import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createDb, type AppDatabase } from "@/db/client";
import { createTodo, listCategories, listTodos, toggleTodoDone } from "@/db/repo/todos";
import { POST } from "@/app/api/mcp/route";

const TOKEN = "test-agent-token";

let db: AppDatabase;
let nextId = 1;

function rpc(method: string, params: unknown, token: string | null = TOKEN): Promise<Response> {
  return POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    }),
  );
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const res = await rpc("tools/call", { name, arguments: args });
  expect(res.status).toBe(200);
  const body = await res.json();
  const result = body.result as { content: { text: string }[]; isError?: boolean };
  return { isError: result.isError ?? false, text: result.content[0].text };
}

beforeEach(async () => {
  vi.stubEnv("AGENT_API_TOKEN", TOKEN);
  db = await createDb(":memory:");
  // getAgentDb() hands out this cached singleton once the token checks out.
  globalThis.__lifeTrackerDbPromise = Promise.resolve(db);
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__lifeTrackerDbPromise = undefined;
});

describe("/api/mcp auth", () => {
  it("rejects requests without the bearer token", async () => {
    expect((await rpc("tools/list", {}, null)).status).toBe(401);
    expect((await rpc("tools/list", {}, "wrong")).status).toBe(401);
  });

  it("rejects everything when AGENT_API_TOKEN is unset", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "");
    expect((await rpc("tools/list", {})).status).toBe(401);
  });

  it("lists the to-do tools for an authorized agent", async () => {
    const res = await rpc("tools/list", {});
    expect(res.status).toBe(200);
    const names = (await res.json()).result.tools.map((t: { name: string }) => t.name);
    expect(names.sort()).toEqual(["create_todo", "list_categories", "list_todos"]);
  });
});

describe("/api/mcp tools", () => {
  it("create_todo resolves a category by name (case-insensitive) and stores the to-do", async () => {
    const [category] = await listCategories(db);
    const { isError, text } = await callTool("create_todo", {
      title: "  Renew passport  ",
      category: category.name.toUpperCase(),
      notes: "See [gov site](https://example.com)",
      dueDate: "2026-10-01",
    });

    expect(isError).toBe(false);
    expect(JSON.parse(text)).toMatchObject({ title: "Renew passport", category: category.name });
    const [todo] = await listTodos(db);
    expect(todo).toMatchObject({
      title: "Renew passport",
      categoryId: category.id,
      notes: "See [gov site](https://example.com)",
      dueDate: "2026-10-01",
      done: false,
    });
  });

  it("create_todo rejects an unknown category, a missing category, a blank title, and a bad date", async () => {
    const [category] = await listCategories(db);
    const unknown = await callTool("create_todo", { title: "x", category: "Nope" });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain(category.name);

    expect((await callTool("create_todo", { title: "x" })).isError).toBe(true);
    expect((await callTool("create_todo", { title: "x", categoryId: 99999 })).isError).toBe(true);
    expect((await callTool("create_todo", { title: "   ", categoryId: category.id })).isError).toBe(true);
    expect(
      (await callTool("create_todo", { title: "x", categoryId: category.id, dueDate: "2026-02-30" })).isError,
    ).toBe(true);
    expect(
      (await callTool("create_todo", { title: "x", categoryId: category.id, dueDate: "tomorrow" })).isError,
    ).toBe(true);

    expect(await listTodos(db)).toHaveLength(0);
  });

  it("list_todos returns open to-dos by default and done ones on request", async () => {
    const [category] = await listCategories(db);
    await createTodo(db, { title: "open", categoryId: category.id });
    const done = await createTodo(db, { title: "done", categoryId: category.id });
    await toggleTodoDone(db, done.id);

    const open = JSON.parse((await callTool("list_todos")).text);
    expect(open.map((t: { title: string }) => t.title)).toEqual(["open"]);
    expect(open[0].category).toBe(category.name);

    const all = JSON.parse((await callTool("list_todos", { includeDone: true })).text);
    expect(all.map((t: { title: string }) => t.title).sort()).toEqual(["done", "open"]);
  });

  it("list_categories returns ids and names", async () => {
    const categories = await listCategories(db);
    expect(JSON.parse((await callTool("list_categories")).text)).toEqual(
      categories.map(({ id, name }) => ({ id, name })),
    );
  });
});
