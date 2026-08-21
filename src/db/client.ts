import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { seedCategories } from "./seed";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export type AppDatabase = BetterSQLite3Database<typeof schema>;

/** Opens (and migrates + seeds) a database at `dbPath`. Pass ':memory:' for an in-memory database. */
export function createDb(dbPath: string): AppDatabase {
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  seedCategories(db);

  return db;
}

declare global {
  var __lifeTrackerDb: AppDatabase | undefined;
}

/** The app-wide singleton database, cached on globalThis so dev HMR doesn't reopen handles. */
export function getDb(): AppDatabase {
  if (!globalThis.__lifeTrackerDb) {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    globalThis.__lifeTrackerDb = createDb(path.join(dataDir, "life.db"));
  }
  return globalThis.__lifeTrackerDb;
}
