# Vercel + Turso + Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Life Tracker deployable to Vercel: swap the local better-sqlite3 database for Turso (hosted libSQL) and gate the whole app behind a single-password login.

**Architecture:** The Drizzle schema stays SQLite-dialect and the existing `drizzle/` migrations are reused as-is; only the driver changes (`better-sqlite3` → `@libsql/client`), which forces a mechanical sync→async conversion of the repo layer and every call site. Auth is a signed-JWT session cookie (jose) checked in two places: optimistically in `src/proxy.ts` (Next 16's renamed middleware) and authoritatively in `getDb()` — the single choke point every page and server action already goes through. Locally the app keeps using `file:data/life.db` with zero Turso dependency.

**Tech Stack:** Next.js 16.3.1 (App Router, `proxy.ts` convention), drizzle-orm 0.45.2, `@libsql/client`, jose, vitest, Turso, Vercel.

**Spec:** No separate spec doc — requirements were settled in conversation on 2026-08-30 and are captured in the Requirements section below.

## Requirements

1. App runs on Vercel with data persisting in Turso (hosted libSQL). Existing SQLite-dialect schema and `drizzle/` migration files are reused unchanged.
2. Local dev and tests keep working with no Turso account: dev defaults to `file:data/life.db`, tests use `:memory:`.
3. Every route and server action is behind a single shared password (`APP_PASSWORD` env var). Session = signed JWT in an httpOnly cookie, 30-day expiry. Login page matches the existing design system.
4. Auth enforced at the proxy (optimistic redirect) AND at the data access layer (`getDb()`), per Next.js guidance that proxy must not be the only line of defense.
5. All existing vitest tests keep passing (converted to async).
6. Existing behavior otherwise unchanged: same wire shapes (`Todo`, `Person`, etc. interfaces keep their fields), same error-message mapping (UNIQUE/FK constraint → readable messages), same migrate-and-seed-on-open behavior.

## Global Constraints

- **Next.js 16.3.1: middleware is named `proxy.ts`, NOT `middleware.ts`.** File goes at `src/proxy.ts` (same level as `app/`). Export a default async function. Proxy runs on the Node.js runtime. (Source: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.)
- Schema (`src/db/schema.ts`) and migration files (`drizzle/`) are **not modified** — same SQLite dialect, same `__drizzle_migrations` journal, so the existing local `data/life.db` keeps working.
- `drizzle.config.ts` is **not modified** — it's only used for `drizzle-kit generate`, which doesn't connect to a database. No schema changes are planned.
- Repo functions keep the `.all()` / `.get()` / `.run()` drizzle call style — they exist on the libsql driver too, just returning Promises. The diff is `async`/`await`/`Promise<>` only.
- libSQL local URLs **require the `file:` prefix** (e.g. `file:data/life.db`); `:memory:` works as-is.
- Env vars: `TURSO_DATABASE_URL` (unset locally → default `file:data/life.db`), `TURSO_AUTH_TOKEN` (remote only), `SESSION_SECRET` (JWT signing key), `APP_PASSWORD` (login password). All four documented in `.env.example`.
- Tests run with `npx vitest run`. Type check: `npx tsc --noEmit`. Build: `npm run build`.
- Work on branch `vercel-turso` off `master`. Commit after each task. **Note:** a previous session's permission config denied `git add`/`git commit` for Claude; if that recurs, hand the user the exact command to run with the `!` prefix instead of retrying.
- Commit trailer (org policy):
  ```
  Assisted by AI

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- **Task 1 intentionally leaves `tsc` failing** (app call sites not yet awaited); Task 2 restores it. Task 1's gate is vitest only. Every later task gates on vitest + tsc + build.

---

### Task 0: Branch

- [ ] **Step 1: Create the working branch**

```bash
git checkout -b vercel-turso
```

If git write is permission-denied, ask the user to run `! git checkout -b vercel-turso` and wait.

---

### Task 1: Swap the data layer to libSQL (client, seed, repos, tests)

Everything below `src/db/` moves from the sync better-sqlite3 driver to the async libsql driver in one atomic change (the files type-check against each other, so they convert together).

**Files:**
- Modify: `package.json` (deps, via npm commands)
- Modify: `next.config.ts`
- Modify: `src/db/client.ts` (full rewrite below)
- Modify: `src/db/seed.ts` (full rewrite below)
- Modify: `src/db/repo/todos.ts` (full rewrite below)
- Modify: `src/db/repo/people.ts` (per-function conversion below)
- Modify: `src/db/repo/knowledge.ts` (per-function conversion below)
- Test: `src/db/__tests__/todos.test.ts`, `people.test.ts`, `knowledge.test.ts`, `schema-and-seed.test.ts` (conversion rules + exact assertion changes below)

**Interfaces:**
- Consumes: existing `src/db/schema.ts` (unchanged), existing `drizzle/` migrations (unchanged).
- Produces (Task 2 and Task 4 rely on these exact signatures):
  - `createDb(url: string, authToken?: string): Promise<AppDatabase>` — opens, migrates, seeds.
  - `getDb(): Promise<AppDatabase>` — cached singleton promise.
  - `type AppDatabase = LibSQLDatabase<typeof schema>`
  - Every repo function keeps its name and parameter list; return types wrap in `Promise<...>` (e.g. `listTodos(db: AppDatabase): Promise<Todo[]>`, `deleteTodo(db: AppDatabase, id: number): Promise<void>`).

- [ ] **Step 1: Swap dependencies**

```bash
npm install @libsql/client
npm uninstall better-sqlite3 @types/better-sqlite3
```

(Dependency removal was approved as part of this plan.)

- [ ] **Step 2: Point `next.config.ts` at the new native package**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
```

- [ ] **Step 3: Rewrite `src/db/client.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import { seedCategories } from "./seed";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export type AppDatabase = LibSQLDatabase<typeof schema>;

/**
 * Opens (and migrates + seeds) a database at `url`. Local URLs need the
 * `file:` prefix; pass ':memory:' for an in-memory database. Remote Turso
 * URLs (libsql://...) also need `authToken`.
 */
export async function createDb(url: string, authToken?: string): Promise<AppDatabase> {
  const isLocal = url.startsWith("file:") || url === ":memory:";
  if (url.startsWith("file:")) {
    fs.mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
  }

  const client = createClient({ url, authToken });
  if (isLocal) {
    // Local SQLite defaults FKs off; Turso enforces them server-side (verified at deploy).
    await client.execute("PRAGMA foreign_keys = ON");
  }
  if (url.startsWith("file:")) {
    await client.execute("PRAGMA journal_mode = WAL");
  }

  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await seedCategories(db);

  return db;
}

declare global {
  var __lifeTrackerDbPromise: Promise<AppDatabase> | undefined;
}

/** The app-wide singleton database, cached on globalThis so dev HMR doesn't reopen handles. */
export function getDb(): Promise<AppDatabase> {
  if (!globalThis.__lifeTrackerDbPromise) {
    const url = process.env.TURSO_DATABASE_URL ?? "file:data/life.db";
    globalThis.__lifeTrackerDbPromise = createDb(url, process.env.TURSO_AUTH_TOKEN);
  }
  return globalThis.__lifeTrackerDbPromise;
}
```

(Note: Task 4 adds an auth guard to `getDb` — do not add it here.)

- [ ] **Step 4: Rewrite `src/db/seed.ts`**

```ts
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { categories } from "./schema";
import type * as schema from "./schema";

const DEFAULT_CATEGORIES: { name: string; sortOrder: number }[] = [
  { name: "Career & Work", sortOrder: 10 },
  { name: "Knowledge & Learning", sortOrder: 20 },
  { name: "Health & Fitness", sortOrder: 30 },
  { name: "Relationships & Social", sortOrder: 40 },
  { name: "Finances", sortOrder: 50 },
  { name: "Personal Projects & Creativity", sortOrder: 60 },
  { name: "Home & Environment", sortOrder: 70 },
  { name: "Mind & Wellbeing", sortOrder: 80 },
  { name: "Fun & Experiences", sortOrder: 90 },
];

/** Inserts the default categories, but only if the categories table is empty. */
export async function seedCategories(db: LibSQLDatabase<typeof schema>): Promise<void> {
  const existing = await db.select({ id: categories.id }).from(categories).limit(1).all();
  if (existing.length > 0) return;

  await db.insert(categories).values(DEFAULT_CATEGORIES).run();
}
```

- [ ] **Step 5: Rewrite `src/db/repo/todos.ts`**

Interfaces (`Category`, `NewCategory`, `Todo`, `NewTodo`, `UpdateTodoInput`) and `toTodo` are unchanged. Full converted function section:

```ts
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
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
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
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      throw new Error(`A category named "${input.name}" already exists.`);
    }
    throw err;
  }
}

export async function deleteCategory(db: AppDatabase, id: number): Promise<void> {
  try {
    await db.delete(categories).where(eq(categories.id, id)).run();
  } catch (err) {
    if (err instanceof Error && err.message.includes("FOREIGN KEY constraint failed")) {
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
```

- [ ] **Step 6: Convert `src/db/repo/people.ts`**

Same mechanical rule — every function becomes `async`, return type wraps in `Promise<>`, every `db.…all()/.get()/.run()` expression gains `await`. Interfaces and `toPerson` unchanged. New signatures (all previously sync):

| Function | New signature |
|---|---|
| `listPeople` | `(db: AppDatabase): Promise<Person[]>` — body: `return (await db.select().from(people).all()).map(toPerson);` |
| `getPerson` | `(db: AppDatabase, id: number): Promise<Person | null>` |
| `createPerson` | `(db: AppDatabase, input: NewPerson): Promise<Person>` |
| `updatePerson` | `(db: AppDatabase, id: number, input: UpdatePersonInput): Promise<Person>` |
| `deletePerson` | `(db: AppDatabase, id: number): Promise<void>` |
| `listTouchpoints` | `(db: AppDatabase, personId: number): Promise<Touchpoint[]>` |
| `addTouchpoint` | `(db: AppDatabase, input: NewTouchpoint): Promise<Touchpoint>` |
| `deleteTouchpoint` | `(db: AppDatabase, id: number): Promise<void>` |
| `listPeopleWithStaleness` | `(db: AppDatabase): Promise<PersonWithStaleness[]>` |

The one non-obvious body, `listPeopleWithStaleness` — only the query gains `await`; the `.map().sort()` post-processing is unchanged:

```ts
export async function listPeopleWithStaleness(db: AppDatabase): Promise<PersonWithStaleness[]> {
  const rows = await db
    .select({
      id: people.id,
      name: people.name,
      relationshipTags: people.relationshipTags,
      howWeMet: people.howWeMet,
      notes: people.notes,
      createdAt: people.createdAt,
      updatedAt: people.updatedAt,
      lastTouchpointDate: sql<string | null>`MAX(${touchpoints.date})`,
    })
    .from(people)
    .leftJoin(touchpoints, eq(touchpoints.personId, people.id))
    .groupBy(people.id)
    .all();

  return rows
    .map(/* unchanged */)
    .sort(/* unchanged */);
}
```

- [ ] **Step 7: Convert `src/db/repo/knowledge.ts`**

Same rule. Interfaces and `toKnowledgeEntry` unchanged. New signatures:

| Function | New signature |
|---|---|
| `listKnowledgeEntries` | `(db: AppDatabase): Promise<KnowledgeEntry[]>` — `return (await db.select().from(knowledgeEntries).all()).map(toKnowledgeEntry);` |
| `getKnowledgeEntry` | `(db: AppDatabase, id: number): Promise<KnowledgeEntry | null>` |
| `createKnowledgeEntry` | `(db: AppDatabase, input: NewKnowledgeEntry): Promise<KnowledgeEntry>` |
| `updateKnowledgeEntry` | `(db: AppDatabase, id: number, input: UpdateKnowledgeEntryInput): Promise<KnowledgeEntry>` |
| `deleteKnowledgeEntry` | `(db: AppDatabase, id: number): Promise<void>` |
| `addConnection` | `(db: AppDatabase, entryIdA: number, entryIdB: number, label?: string): Promise<Connection>` — the `db.insert(...).returning().all()` inside the `try` gains `await` (the UNIQUE-constraint catch keeps working because the awaited rejection is caught by the same try/catch) |
| `deleteConnection` | `(db: AppDatabase, id: number): Promise<void>` |
| `listConnectionsForEntry` | `(db: AppDatabase, entryId: number): Promise<ConnectionWithOtherEntry[]>` — see below |
| `getGraphData` | `(db: AppDatabase): Promise<GraphData>` — both queries awaited |

`listConnectionsForEntry` has a nested repo call inside `.map()`, which must become a `for` loop or `Promise.all` — use `Promise.all`:

```ts
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
```

- [ ] **Step 8: Convert the four test files**

Universal rules for `todos.test.ts`, `people.test.ts`, `knowledge.test.ts`:
- `beforeEach(() => { db = createDb(":memory:"); ... })` → `beforeEach(async () => { db = await createDb(":memory:"); ... })` (and `await` any repo call inside, e.g. `categoryId = (await listCategories(db))[0].id;`)
- Every `it("...", () => {` that touches the db → `it("...", async () => {`
- Every repo call gains `await`.

Exact assertion conversions (sync throw → async rejection):

| File:line (pre-conversion) | Old | New |
|---|---|---|
| knowledge.test.ts:78 | `expect(() => addConnection(db, a.id, b.id)).toThrow();` | `await expect(addConnection(db, a.id, b.id)).rejects.toThrow();` |
| knowledge.test.ts:79 | same pattern with `b.id, a.id` | same conversion |
| knowledge.test.ts:84 | same pattern with `a.id, a.id` | same conversion |
| todos.test.ts:92 | `expect(() => deleteCategory(db, categoryId)).toThrow();` | `await expect(deleteCategory(db, categoryId)).rejects.toThrow();` |
| todos.test.ts:103 | `expect(() => deleteCategory(db, category.id)).not.toThrow();` | `await expect(deleteCategory(db, category.id)).resolves.toBeUndefined();` |
| todos.test.ts:109 | `expect(() => createCategory(db, { name: existingName })).toThrow(…)` | `await expect(createCategory(db, { name: existingName })).rejects.toThrow(…)` (keep the message argument) |
| todos.test.ts:116 | `expect(() => updateCategory(db, second.id, { name: first.name })).toThrow(…)` | `await expect(updateCategory(db, second.id, { name: first.name })).rejects.toThrow(…)` |

`schema-and-seed.test.ts` additionally:
- Line 1: `import { migrate } from "drizzle-orm/better-sqlite3/migrator";` → `import { migrate } from "drizzle-orm/libsql/migrator";`
- `listTableNames` becomes async, takes `AppDatabase` (import the type; `ReturnType<typeof createDb>` is now a Promise so it's wrong):
  ```ts
  async function listTableNames(db: AppDatabase): Promise<string[]> {
    const rows = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name`,
    );
    return rows.map((row) => row.name);
  }
  ```
- Line 39: `expect(() => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })).not.toThrow();` → `await expect(migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })).resolves.toBeUndefined();`
- Line 48: `createDb(tmpPath)` → `` await createDb(`file:${tmpPath}`) `` (**libsql requires the `file:` prefix**; the `fs.existsSync(tmpPath)` assertion and `-wal`/`-shm` cleanup keep using the bare `tmpPath`).
- All `db.select()...all()`, `db.delete()...run()`, `db.update()...run()`, `seedCategories(db)` calls gain `await`; their enclosing `it` callbacks become async.

- [ ] **Step 9: Run the test suite**

Run: `npx vitest run`
Expected: all 4 test files PASS. (`npx tsc --noEmit` still fails — `src/app/` isn't converted yet; that's Task 2's gate.)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: swap better-sqlite3 for @libsql/client (async data layer)

Assisted by AI

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Await the database at every app call site

Purely mechanical: the 4 server-action files and 9 dynamic pages call the now-async `getDb()` and repo functions. `npx tsc --noEmit` is the completeness checker — when it's green, every call site is converted.

**Files:**
- Modify: `src/app/todos/actions.ts`, `src/app/people/actions.ts`, `src/app/knowledge/actions.ts`, `src/app/calendar/actions.ts`
- Modify: `src/app/todos/page.tsx`, `src/app/calendar/page.tsx`, `src/app/people/page.tsx`, `src/app/people/[id]/page.tsx`, `src/app/people/[id]/edit/page.tsx`, `src/app/knowledge/page.tsx`, `src/app/knowledge/[id]/page.tsx`, `src/app/knowledge/[id]/edit/page.tsx`, `src/app/knowledge/graph/page.tsx`

**Interfaces:**
- Consumes: `getDb(): Promise<AppDatabase>` and the async repo signatures from Task 1.
- Produces: nothing new — same routes, same rendered output.

**Conversion rules (apply to every file above):**
1. `const db = getDb();` → `const db = await getDb();`
2. Inline uses `repoFn(getDb(), …)` → `await repoFn(await getDb(), …)`
3. Every other repo call gains `await`.
4. Two page components are not yet async and must become so: `src/app/people/page.tsx` (`export default function PeoplePage()` → `export default async function PeoplePage()`) and `src/app/knowledge/graph/page.tsx` (same change to `KnowledgeGraphPage`). All server actions and the other pages are already `async`.
5. `generateMetadata` in the four `[id]`/`[id]/edit` pages contains the ternary pattern — convert as:
   `const person = Number.isFinite(id) ? getPerson(getDb(), id) : null;` → `const person = Number.isFinite(id) ? await getPerson(await getDb(), id) : null;` (same shape for `getKnowledgeEntry`).
6. **Keep `await getDb()` calls outside existing `try` blocks** (they already are — e.g. `addCategory` and `deleteCategoryAction` in `src/app/todos/actions.ts` fetch `db` before the `try`). Only the repo calls already inside a `try` gain `await` in place, so the catch still maps constraint errors to readable messages. This also matters in Task 4, when `getDb()` starts throwing `redirect()`.
7. Sequential multi-call actions (`moveCategory`: `listCategories` then two `updateCategory`; `addCategory`: `listCategories` then `createCategory`) stay sequential — just await each in order.

- [ ] **Step 1: Convert the four actions files** (12 exported actions total: 7 in todos, 5 in people, 5 in knowledge, 2 in calendar — the counts are your checklist)

- [ ] **Step 2: Convert the nine pages** (including the four `generateMetadata` functions)

- [ ] **Step 3: Verify types, tests, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc silent, tests PASS, build succeeds with the same route table as before (`/todos`, `/calendar`, `/people`, `/knowledge` etc.).

- [ ] **Step 4: Smoke-test dev against the existing local DB**

Run: `npm run dev` (background), then `curl -s localhost:3000/todos | grep -o "Life Tracker" | head -1`
Expected: page renders (the existing `data/life.db` opens fine under libsql — same file format, same migrations journal). Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: await async db layer at all call sites

Assisted by AI

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Session library and login page

Signed-JWT session cookie via jose, following the bundled Next.js auth guide (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`). Deliberate deviation from that guide: **no `server-only` import** in `session.ts` — it breaks vitest imports and this module is only reachable from server code (proxy, actions, `getDb`).

**Files:**
- Create: `src/lib/session.ts`
- Create: `src/lib/auth.ts`
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/page.tsx`
- Test: `src/lib/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `ui/` primitives (`Card` default export, `Button`, `Field`, `Input`), design tokens (`text-danger`, `text-muted`, etc.).
- Produces (Task 4 relies on these):
  - `SESSION_COOKIE: string` (= `"session"`), `verifySessionToken(token: string | undefined): Promise<boolean>` — pure, no `cookies()` dependency, safe to call from the proxy.
  - `createSessionCookie(): Promise<void>`, `deleteSessionCookie(): Promise<void>`
  - `requireSession(): Promise<void>` — redirects to `/login` when the request has no valid session.
  - `login(formData: FormData)`, `logout()` server actions in `@/app/login/actions`.

- [ ] **Step 1: Install jose**

```bash
npm install jose
```

- [ ] **Step 2: Write the failing session test** — `src/lib/__tests__/session.test.ts`

```ts
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-key-for-vitest-only";
});

describe("session tokens", () => {
  it("round-trips a freshly signed token", async () => {
    const { signSessionToken, verifySessionToken } = await import("@/lib/session");
    const token = await signSessionToken();
    await expect(verifySessionToken(token)).resolves.toBe(true);
  });

  it("rejects undefined, garbage, and tampered tokens", async () => {
    const { signSessionToken, verifySessionToken } = await import("@/lib/session");
    await expect(verifySessionToken(undefined)).resolves.toBe(false);
    await expect(verifySessionToken("not-a-jwt")).resolves.toBe(false);

    const token = await signSessionToken();
    await expect(verifySessionToken(token.slice(0, -2) + "xx")).resolves.toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/session.test.ts`
Expected: FAIL — cannot resolve `@/lib/session`.

- [ ] **Step 4: Write `src/lib/session.ts`**

```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Signs a session JWT (no payload beyond issued-at/expiry — the app has one user). */
export async function signSessionToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + SESSION_DURATION_MS))
    .sign(secretKey());
}

/** True if `token` is a valid, unexpired session JWT. Pure — usable from the proxy. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

/** Signs a fresh session JWT and sets it as an httpOnly cookie. */
export async function createSessionCookie(): Promise<void> {
  const token = await signSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(Date.now() + SESSION_DURATION_MS),
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
```

- [ ] **Step 5: Run the session test to verify it passes**

Run: `npx vitest run src/lib/__tests__/session.test.ts`
Expected: PASS (importing `next/headers` in vitest is fine as long as the test never calls `cookies()` — only the two pure functions are exercised).
If the `next/headers` import itself errors under vitest, split the pure functions (`SESSION_COOKIE`, `signSessionToken`, `verifySessionToken`, `secretKey`) into `src/lib/session-token.ts` re-exported from `session.ts`, and point the test at `@/lib/session-token`. Keep the public API identical either way.

- [ ] **Step 6: Write `src/lib/auth.ts`**

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** Redirects to /login unless the request carries a valid session cookie. */
export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    redirect("/login");
  }
}
```

- [ ] **Step 7: Write `src/app/login/actions.ts`**

```ts
"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createSessionCookie, deleteSessionCookie } from "@/lib/session";

/** Constant-time string comparison (hashes first to equalize lengths). */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/** Sets the session cookie and redirects home when the password matches APP_PASSWORD. */
export async function login(formData: FormData) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) throw new Error("APP_PASSWORD is not set");

  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, appPassword)) {
    redirect("/login?error=1");
  }

  await createSessionCookie();
  redirect("/todos");
}

/** Clears the session cookie and returns to the login screen. */
export async function logout() {
  await deleteSessionCookie();
  redirect("/login");
}
```

- [ ] **Step 8: Write `src/app/login/page.tsx`**

```tsx
import { Button } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const failed = typeof params.error === "string";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm items-center px-4">
      <Card className="w-full p-6">
        <h1 className="mb-4 text-lg font-semibold tracking-tight">Life Tracker</h1>
        <form action={login} className="flex flex-col gap-4">
          <Field label="Password">
            <Input type="password" name="password" autoFocus required />
          </Field>
          {failed && <p className="text-sm text-danger">Wrong password.</p>}
          <Button type="submit">Sign in</Button>
        </form>
      </Card>
    </main>
  );
}
```

(`PageProps<"/login">` is generated by Next's route typegen; it materializes during `next build`/`next dev`. The error-via-searchParams pattern mirrors `src/app/todos/page.tsx`.)

- [ ] **Step 9: Verify everything**

Run: `npm run build && npx tsc --noEmit && npx vitest run`
(Build first — it regenerates route types, which `PageProps<"/login">` needs before tsc can pass.)
Expected: all green; build's route table now includes `ƒ /login`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: jose session cookie + password login page

Assisted by AI

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Enforce auth — proxy, DAL guard, logout, env files

**Files:**
- Create: `src/proxy.ts` (**Next 16 name — NOT `middleware.ts`**)
- Modify: `src/db/client.ts` (auth guard in `getDb`)
- Modify: `src/components/Nav.tsx` (logout button; hide Nav on `/login`)
- Create: `.env.example`
- Create: `.env.local` (developer-local, stays untracked)
- Modify: `.gitignore` (un-ignore `.env.example`)

**Interfaces:**
- Consumes: `verifySessionToken`, `SESSION_COOKIE` from `@/lib/session`; `requireSession` from `@/lib/auth`; `logout` from `@/app/login/actions`.
- Produces: every route except `/login` (and Next static assets) requires a valid session, enforced at both the proxy and `getDb()`.

- [ ] **Step 1: Write `src/proxy.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** Optimistic auth check (Next 16 proxy, formerly middleware). Real enforcement lives in getDb(). */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);

  if (pathname === "/login") {
    if (authenticated) return NextResponse.redirect(new URL("/todos", req.nextUrl));
    return NextResponse.next();
  }
  if (!authenticated) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Add the DAL guard to `getDb` in `src/db/client.ts`**

Add `import { requireSession } from "@/lib/auth";` and make `getDb` async:

```ts
/**
 * The app-wide singleton database, cached on globalThis so dev HMR doesn't reopen handles.
 * Doubles as the data-access-layer auth gate: every page and server action reaches the
 * database through here, and unauthenticated requests are redirected before touching it.
 */
export async function getDb(): Promise<AppDatabase> {
  await requireSession();
  if (!globalThis.__lifeTrackerDbPromise) {
    const url = process.env.TURSO_DATABASE_URL ?? "file:data/life.db";
    globalThis.__lifeTrackerDbPromise = createDb(url, process.env.TURSO_AUTH_TOKEN);
  }
  return globalThis.__lifeTrackerDbPromise;
}
```

(Tests are unaffected — they call `createDb` directly. `requireSession` runs per call, so the session is checked on every request, while the connection stays cached.)

- [ ] **Step 3: Add logout to `src/components/Nav.tsx` and hide Nav on /login**

Nav is a client component; importing a server action into it is supported. Three edits:

1. Add imports: `import { logout } from "@/app/login/actions";`
2. First line of the `Nav` function body, after `const pathname = usePathname();`:
   ```tsx
   if (pathname === "/login") return null;
   ```
3. Inside `<nav>`, after the `</ul>`, a right-aligned logout button matching the existing inactive-link styling:
   ```tsx
   <form action={logout} className="ml-auto">
     <button
       type="submit"
       className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
     >
       Log out
     </button>
   </form>
   ```

- [ ] **Step 4: Create `.env.example`, `.env.local`, and un-ignore the example**

`.env.example`:
```bash
# Database — leave both unset for local dev (defaults to file:data/life.db).
# For Turso: TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io + a token.
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Auth
SESSION_SECRET=   # generate with: openssl rand -base64 32
APP_PASSWORD=     # the single login password
```

`.env.local` (generate a real secret inline):
```bash
SESSION_SECRET=$(openssl rand -base64 32)   # substitute the actual generated value
APP_PASSWORD=dev-password
```

`.gitignore`: directly under the existing `.env*` line, add:
```
!.env.example
```

- [ ] **Step 5: Verify locked-out and logged-in flows**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

Then `npm run dev` (background) and:
- `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" localhost:3000/todos` → `307 http://localhost:3000/login`
- `curl -s -o /dev/null -w "%{http_code}" localhost:3000/login` → `200`

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: enforce password auth via proxy + data-layer guard

Assisted by AI

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Full local verification (browser-level)

No new code — prove the whole thing works as a user would experience it, before deploying. Use the `run` skill (or drive a browser) against `npm run dev`.

- [ ] **Step 1: Launch the app** with `.env.local` in place (dev password `dev-password`).
- [ ] **Step 2: Verify the auth wall** — visiting `/todos` lands on the login card; wrong password shows "Wrong password."; correct password lands on `/todos` with the Nav visible and existing local data intact.
- [ ] **Step 3: Verify CRUD end to end** — create a todo, toggle it done, check it appears on `/calendar`; open a person, add a touchpoint; open a knowledge entry.
- [ ] **Step 4: Verify logout** — the Nav's "Log out" returns to `/login`, and `/todos` redirects to `/login` again.
- [ ] **Step 5: Fix anything found** (with a test where applicable), then commit fixes if any.

---

### Task 6: Turso + Vercel deployment — **USER-GATED**

Every step here touches external services (Turso, GitHub, Vercel). **Get an explicit go-ahead from the user before each external action, and have the user run the account-level commands themselves** (suggest the `! command` prefix so output lands in the conversation). CLI flags below may have drifted — the Turso dashboard (app.turso.tech) and Vercel dashboard are the fallback for every step.

- [ ] **Step 1 (user): Create the Turso database**

```bash
brew install tursodatabase/tap/turso   # or: curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup                      # or: turso auth login
turso db create life-tracker
turso db show life-tracker --url       # → TURSO_DATABASE_URL (libsql://…)
turso db tokens create life-tracker    # → TURSO_AUTH_TOKEN
```

- [ ] **Step 2 (user): Push the branch to GitHub** (`git push -u origin vercel-turso`, or merge to master first — user's call; see Execution Handoff).

- [ ] **Step 3 (user): Import the repo at vercel.com/new** and set four env vars for Production (and Preview if desired): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET` (fresh `openssl rand -base64 32` — not the dev one), `APP_PASSWORD` (the real password). Framework preset: Next.js, defaults otherwise. Deploy.

- [ ] **Step 4: Verify production** (user in browser, or curl against the deployment URL):
  - `/todos` unauthenticated → redirected to `/login`; wrong password rejected; right password in.
  - First login is slow-ish: the cold start runs migrations + seeds the 9 categories on the empty Turso DB. Verify the todos page shows all 9 categories.
  - Create a todo. Redeploy (or wait out the lambda), reload — **the todo must still be there.** This is the blocker-1 fix proven.
  - **FK enforcement check** (Turso is expected to enforce FKs server-side, but verify): create a throwaway person, add a touchpoint, delete the person, then `turso db shell life-tracker "select count(*) from touchpoints"` → the touchpoint must be gone (cascade). Also confirm deleting a category with todos is blocked with the readable error. If either fails, stop and report — the pragma strategy in `createDb` needs a follow-up for remote connections.

- [ ] **Step 5 (optional, user's call): Import existing local data**

Local `data/life.db` currently holds sample-scale data (2 todos, 1 person, 3 knowledge entries, 1 touchpoint, 2 connections; categories are the untouched defaults). Re-entering by hand is honestly faster. If importing anyway — after step 4 (schema must exist), export user tables only (order matters for FKs; categories are skipped because the seeded defaults already occupy ids 1–9 in the same order):

```bash
for t in people touchpoints knowledge_entries connections todos; do
  sqlite3 data/life.db ".mode insert $t" "select * from $t;"
done > /tmp/life-data.sql
turso db shell life-tracker < /tmp/life-data.sql
rm /tmp/life-data.sql
```

---

## Deferred / consciously out of scope

- **Login rate limiting** — single shared password on a public URL is brute-forceable in theory; a strong `APP_PASSWORD` is the mitigation. Revisit if it ever matters.
- **Session refresh** — sessions just expire after 30 days; log in again.
- **`drizzle-kit migrate` deploy-time flow** — migrations keep running on connection-open (existing behavior, zero ops). Tradeoff: a few extra round-trips per cold start and a theoretical migration race between concurrent cold starts; acceptable for a single-user app.
- **PR creation** — org policy says draft PRs; whether to PR or merge locally is decided at finishing time (superpowers:finishing-a-development-branch).
