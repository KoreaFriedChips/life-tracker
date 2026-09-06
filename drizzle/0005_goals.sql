CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`horizon` text NOT NULL,
	`category_id` integer,
	`target_date` text,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`achieved_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "goals_horizon_check" CHECK("goals"."horizon" IN ('short','long')),
	CONSTRAINT "goals_status_check" CHECK("goals"."status" IN ('active','achieved','dropped'))
);
--> statement-breakpoint
CREATE INDEX `idx_goals_horizon_sort` ON `goals` (`horizon`,`sort_order`);