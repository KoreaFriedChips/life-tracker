import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { categories } from "@/db/schema";
import { seedCategories } from "@/db/seed";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
const ALL_TABLES = ["categories", "connections", "knowledge_entries", "people", "todos", "touchpoints"];

const DEFAULT_CATEGORY_NAMES = [
  "Career & Work",
  "Knowledge & Learning",
  "Health & Fitness",
  "Relationships & Social",
  "Finances",
  "Personal Projects & Creativity",
  "Home & Environment",
  "Mind & Wellbeing",
  "Fun & Experiences",
];

function listTableNames(db: ReturnType<typeof createDb>): string[] {
  const rows = db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

describe("schema migrations", () => {
  it("creates all six tables on a fresh database and is idempotent when migrated twice", () => {
    const db = createDb(":memory:");

    expect(listTableNames(db)).toEqual([...ALL_TABLES].sort());

    expect(() => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })).not.toThrow();

    expect(listTableNames(db)).toEqual([...ALL_TABLES].sort());
  });

  it("initializes correctly against a real temp-file path", () => {
    const tmpPath = path.join(os.tmpdir(), `life-tracker-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

    try {
      const db = createDb(tmpPath);

      expect(fs.existsSync(tmpPath)).toBe(true);
      expect(listTableNames(db)).toEqual([...ALL_TABLES].sort());

      const cats = db.select().from(categories).all();
      expect(cats).toHaveLength(9);
    } finally {
      for (const suffix of ["", "-wal", "-shm"]) {
        const file = tmpPath + suffix;
        if (fs.existsSync(file)) fs.rmSync(file);
      }
    }
  });
});

describe("category seeding", () => {
  it("inserts the 9 defaults with correct names and sort order into an empty table", () => {
    const db = createDb(":memory:");

    const cats = db.select().from(categories).orderBy(categories.sortOrder).all();

    expect(cats.map((c) => c.name)).toEqual(DEFAULT_CATEGORY_NAMES);
    expect(cats.map((c) => c.sortOrder)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it("does not re-add a category after it has been deleted", () => {
    const db = createDb(":memory:");

    db.delete(categories).where(sql`${categories.name} = 'Fun & Experiences'`).run();

    seedCategories(db);

    const cats = db.select().from(categories).all();
    expect(cats).toHaveLength(8);
    expect(cats.find((c) => c.name === "Fun & Experiences")).toBeUndefined();
  });

  it("does not re-add a category after it has been renamed", () => {
    const db = createDb(":memory:");

    db.update(categories)
      .set({ name: "Renamed Category" })
      .where(sql`${categories.name} = 'Finances'`)
      .run();

    seedCategories(db);

    const cats = db.select().from(categories).all();
    expect(cats).toHaveLength(9);
    expect(cats.find((c) => c.name === "Finances")).toBeUndefined();
    expect(cats.find((c) => c.name === "Renamed Category")).toBeDefined();
  });
});
