CREATE TABLE `data_aqms` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`station_uuid` varchar(36) NOT NULL,
	`pm25` float,
	`no2` float,
	`co` float,
	`temp` float,
	`hum` float,
	`ws` float,
	`wd` float,
	`measured_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_aqms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_soc` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`station_uuid` varchar(36) NOT NULL,
	`ph` float,
	`no2` float,
	`ec` float,
	`temp` float,
	`hum` float,
	`n` float,
	`p` float,
	`k` float,
	`measured_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_soc_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `firmware_release` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_name` varchar(100) NOT NULL,
	`version` varchar(20) NOT NULL,
	`bin_file_url` varchar(255) NOT NULL,
	`release_notes` text,
	`is_latest` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `firmware_release_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`ticket_id` bigint NOT NULL,
	`engineer_id` int NOT NULL,
	`action_taken` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maintenance_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_tickets` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`station_uuid` varchar(36) NOT NULL,
	`reported_by_user_id` int NOT NULL,
	`assigned_to_engineer_id` int,
	`issue_title` varchar(255) NOT NULL,
	`issue_description` text NOT NULL,
	`status` enum('open','in_progress','resolved') NOT NULL DEFAULT 'open',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` timestamp,
	CONSTRAINT `maintenance_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `raw_sensor_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`station_uuid` varchar(36) NOT NULL,
	`firmware_version` varchar(20),
	`data_payload` json NOT NULL,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `raw_sensor_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `station` (
	`uuid` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`project_name` varchar(100) NOT NULL,
	`mac_address` varchar(20),
	`current_version` varchar(20),
	`type` enum('aqms','soc') NOT NULL,
	`last_seen_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `station_uuid` PRIMARY KEY(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`role` enum('admin','engineer','user') NOT NULL DEFAULT 'user',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `data_aqms` ADD CONSTRAINT `data_aqms_station_uuid_station_uuid_fk` FOREIGN KEY (`station_uuid`) REFERENCES `station`(`uuid`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_soc` ADD CONSTRAINT `data_soc_station_uuid_station_uuid_fk` FOREIGN KEY (`station_uuid`) REFERENCES `station`(`uuid`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_log` ADD CONSTRAINT `maintenance_log_ticket_id_maintenance_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `maintenance_tickets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_log` ADD CONSTRAINT `maintenance_log_engineer_id_users_id_fk` FOREIGN KEY (`engineer_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_tickets` ADD CONSTRAINT `maintenance_tickets_station_uuid_station_uuid_fk` FOREIGN KEY (`station_uuid`) REFERENCES `station`(`uuid`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_tickets` ADD CONSTRAINT `maintenance_tickets_reported_by_user_id_users_id_fk` FOREIGN KEY (`reported_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_tickets` ADD CONSTRAINT `maintenance_tickets_assigned_to_engineer_id_users_id_fk` FOREIGN KEY (`assigned_to_engineer_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;