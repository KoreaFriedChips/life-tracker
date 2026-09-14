import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { verifyAgentToken } from "@/lib/agentAuth";
import { requireSession } from "@/lib/auth";
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

/** The app-wide singleton database, cached on globalThis so dev HMR doesn't reopen handles. No auth check. */
function openDb(): Promise<AppDatabase> {
  if (!globalThis.__lifeTrackerDbPromise) {
    const url = process.env.TURSO_DATABASE_URL ?? "file:data/life.db";
    globalThis.__lifeTrackerDbPromise = createDb(url, process.env.TURSO_AUTH_TOKEN).catch((err) => {
      globalThis.__lifeTrackerDbPromise = undefined;
      throw err;
    });
  }
  return globalThis.__lifeTrackerDbPromise;
}

/**
 * The data-access-layer auth gate for the web UI: every page and server action reaches the
 * database through here, and unauthenticated requests are redirected before touching it.
 */
export async function getDb(): Promise<AppDatabase> {
  await requireSession();
  return openDb();
}

/**
 * The auth gate for AI agents (the /api/mcp route): returns the database only if `req`
 * carries the AGENT_API_TOKEN bearer token, otherwise null so the caller can respond 401.
 */
export async function getAgentDb(req: Request): Promise<AppDatabase | null> {
  if (!verifyAgentToken(req)) return null;
  return openDb();
}
