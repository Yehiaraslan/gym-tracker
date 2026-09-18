CREATE TABLE `coach_meal_plans` (
	`id` varchar(64) NOT NULL,
	`trainerId` int NOT NULL,
	`traineeId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`planJson` json NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coach_meal_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coach_messages` (
	`id` varchar(64) NOT NULL,
	`senderId` int NOT NULL,
	`recipientId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `coach_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coach_workout_plans` (
	`id` varchar(64) NOT NULL,
	`trainerId` int NOT NULL,
	`traineeId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`planJson` json NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coach_workout_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cmp_trainee_idx` ON `coach_meal_plans` (`traineeId`,`status`);--> statement-breakpoint
CREATE INDEX `cmp_trainer_idx` ON `coach_meal_plans` (`trainerId`);--> statement-breakpoint
CREATE INDEX `cm_pair_idx` ON `coach_messages` (`senderId`,`recipientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cm_inbox_idx` ON `coach_messages` (`recipientId`,`readAt`);--> statement-breakpoint
CREATE INDEX `cwp_trainee_idx` ON `coach_workout_plans` (`traineeId`,`status`);--> statement-breakpoint
CREATE INDEX `cwp_trainer_idx` ON `coach_workout_plans` (`trainerId`);