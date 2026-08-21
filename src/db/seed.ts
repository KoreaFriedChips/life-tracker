import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
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
export function seedCategories(db: BetterSQLite3Database<typeof schema>): void {
  const existing = db.select({ id: categories.id }).from(categories).limit(1).all();
  if (existing.length > 0) return;

  db.insert(categories).values(DEFAULT_CATEGORIES).run();
}
