PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_knowledge_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`url` text,
	`authors` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'next' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "knowledge_entries_type_check" CHECK("__new_knowledge_entries"."type" IN ('book','article','paper','video')),
	CONSTRAINT "knowledge_entries_status_check" CHECK("__new_knowledge_entries"."status" IN ('next','in_progress','completed'))
);
--> statement-breakpoint
INSERT INTO `__new_knowledge_entries`("id", "title", "type", "url", "authors", "status", "notes", "tags", "created_at", "updated_at") SELECT "id", "title", "type", "url", "authors", CASE "status" WHEN 'want_to_read' THEN 'next' WHEN 'reading' THEN 'in_progress' WHEN 'finished' THEN 'completed' ELSE "status" END, "notes", "tags", "created_at", "updated_at" FROM `knowledge_entries`;--> statement-breakpoint
DROP TABLE `knowledge_entries`;--> statement-breakpoint
ALTER TABLE `__new_knowledge_entries` RENAME TO `knowledge_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;