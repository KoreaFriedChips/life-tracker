import { desc, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const knowledgeEntries = sqliteTable(
  "knowledge_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    type: text("type").notNull(),
    authors: text("authors").notNull().default("[]"),
    status: text("status").notNull().default("want_to_read"),
    notes: text("notes").notNull().default(""),
    tags: text("tags").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    check("knowledge_entries_type_check", sql`${table.type} IN ('book','article','paper')`),
    check(
      "knowledge_entries_status_check",
      sql`${table.status} IN ('want_to_read','reading','finished')`,
    ),
  ],
);

export const connections = sqliteTable(
  "connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryIdA: integer("entry_id_a")
      .notNull()
      .references(() => knowledgeEntries.id, { onDelete: "cascade" }),
    entryIdB: integer("entry_id_b")
      .notNull()
      .references(() => knowledgeEntries.id, { onDelete: "cascade" }),
    label: text("label"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    check("connections_pair_order_check", sql`${table.entryIdA} < ${table.entryIdB}`),
    unique("connections_pair_unique").on(table.entryIdA, table.entryIdB),
  ],
);

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  relationshipTags: text("relationship_tags").notNull().default("[]"),
  howWeMet: text("how_we_met").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const touchpoints = sqliteTable(
  "touchpoints",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    summary: text("summary").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_touchpoints_person_date").on(table.personId, desc(table.date))],
);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const todos = sqliteTable(
  "todos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    done: integer("done").notNull().default(0),
    dueDate: text("due_date"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    completedAt: text("completed_at"),
  },
  (table) => [index("idx_todos_category").on(table.categoryId)],
);
