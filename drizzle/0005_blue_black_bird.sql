CREATE TABLE `schedule_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`scheduleJson` json NOT NULL,
	`description` varchar(512),
	`appliedByZaki` boolean NOT NULL DEFAULT false,
	`weightAdjustments` text,
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schedule_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `so_device_idx` ON `schedule_overrides` (`deviceId`);--> statement-breakpoint
CREATE INDEX `so_applied_at_idx` ON `schedule_overrides` (`appliedAt`);