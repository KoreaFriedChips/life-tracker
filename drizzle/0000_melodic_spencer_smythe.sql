CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id_a` integer NOT NULL,
	`entry_id_b` integer NOT NULL,
	`label` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`entry_id_a`) REFERENCES `knowledge_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id_b`) REFERENCES `knowledge_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "connections_pair_order_check" CHECK("connections"."entry_id_a" < "connections"."entry_id_b")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_pair_unique` ON `connections` (`entry_id_a`,`entry_id_b`);--> statement-breakpoint
CREATE TABLE `knowledge_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`authors` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'want_to_read' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "knowledge_entries_type_check" CHECK("knowledge_entries"."type" IN ('book','article','paper')),
	CONSTRAINT "knowledge_entries_status_check" CHECK("knowledge_entries"."status" IN ('want_to_read','reading','finished'))
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`relationship_tags` text DEFAULT '[]' NOT NULL,
	`how_we_met` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`category_id` integer NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`due_date` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_todos_category` ON `todos` (`category_id`);--> statement-breakpoint
CREATE TABLE `touchpoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`date` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_touchpoints_person_date` ON `touchpoints` (`person_id`,"date" desc);