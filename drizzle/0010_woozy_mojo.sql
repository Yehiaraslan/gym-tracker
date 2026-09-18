CREATE TABLE `coach_notes` (
	`id` varchar(64) NOT NULL,
	`trainerId` int NOT NULL,
	`traineeId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `coach_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `push_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`platform` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `push_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `cn_pair_idx` ON `coach_notes` (`trainerId`,`traineeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `pt_user_idx` ON `push_tokens` (`userId`);