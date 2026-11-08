CREATE TABLE `container_run_quota` (
	`day` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `container_run_user_quota` (
	`user_id` text NOT NULL,
	`hour` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`user_id`, `hour`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `container_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`created_by` text,
	`digits` integer NOT NULL,
	`status` text NOT NULL,
	`steps` text NOT NULL,
	`error_code` text,
	`retry_of` text,
	`result_key` text,
	`result_preview` text,
	`result_bytes` integer,
	`compute_ms` integer,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `container_runs_workspace_id_created_at_idx` ON `container_runs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `container_runs_expires_at_idx` ON `container_runs` (`expires_at`);