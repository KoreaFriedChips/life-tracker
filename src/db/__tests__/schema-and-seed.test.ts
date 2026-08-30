import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDb, type AppDatabase } from "@/db/client";
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

async function listTableNames(db: AppDatabase): Promise<string[]> {
  const rows = await db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

describe("schema migrations", () => {
  it("creates all six tables on a fresh database and is idempotent when migrated twice", async () => {
    const db = await createDb(":memory:");

    expect(await listTableNames(db)).toEqual([...ALL_TABLES].sort());

    await expect(migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })).resolves.toBeUndefined();

    expect(await listTableNames(db)).toEqual([...ALL_TABLES].sort());
  });

  it("initializes correctly against a real temp-file path", async () => {
    const tmpPath = path.join(os.tmpdir(), `life-tracker-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

    try {
      const db = await createDb(`file:${tmpPath}`);

      expect(fs.existsSync(tmpPath)).toBe(true);
      expect(await listTableNames(db)).toEqual([...ALL_TABLES].sort());

      const cats = await db.select().from(categories).all();
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
  it("inserts the 9 defaults with correct names and sort order into an empty table", async () => {
    const db = await createDb(":memory:");

    const cats = await db.select().from(categories).orderBy(categories.sortOrder).all();

    expect(cats.map((c) => c.name)).toEqual(DEFAULT_CATEGORY_NAMES);
    expect(cats.map((c) => c.sortOrder)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it("does not re-add a category after it has been deleted", async () => {
    const db = await createDb(":memory:");

    await db.delete(categories).where(sql`${categories.name} = 'Fun & Experiences'`).run();

    await seedCategories(db);

    const cats = await db.select().from(categories).all();
    expect(cats).toHaveLength(8);
    expect(cats.find((c) => c.name === "Fun & Experiences")).toBeUndefined();
  });

  it("does not re-add a category after it has been renamed", async () => {
    const db = await createDb(":memory:");

    await db.update(categories)
      .set({ name: "Renamed Category" })
      .where(sql`${categories.name} = 'Finances'`)
      .run();

    await seedCategories(db);

    const cats = await db.select().from(categories).all();
    expect(cats).toHaveLength(9);
    expect(cats.find((c) => c.name === "Finances")).toBeUndefined();
    expect(cats.find((c) => c.name === "Renamed Category")).toBeDefined();
  });
});
