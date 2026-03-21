CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`title` varchar(255),
	`coachingMode` enum('auto','aggressive','recovery','science') NOT NULL DEFAULT 'auto',
	`contextSnapshot` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whoop_data_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`recoveryJson` text,
	`sleepJson` text,
	`cycleJson` text,
	`workoutJson` text,
	`lastSyncedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whoop_data_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `whoop_data_cache_userOpenId_unique` UNIQUE(`userOpenId`)
);
--> statement-breakpoint
CREATE TABLE `whoop_oauth_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`state` varchar(64) NOT NULL,
	`userOpenId` varchar(64),
	`expiresAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whoop_oauth_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `whoop_oauth_state_state_unique` UNIQUE(`state`)
);
--> statement-breakpoint
CREATE TABLE `whoop_recovery_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`date` varchar(10) NOT NULL,
	`recoveryScore` int,
	`hrv` int,
	`rhr` int,
	`spo2` int,
	`strainX10` int,
	`sleepPerformance` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whoop_recovery_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whoop_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text NOT NULL,
	`expiresAt` bigint NOT NULL,
	`scope` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whoop_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `whoop_tokens_userOpenId_unique` UNIQUE(`userOpenId`)
);
--> statement-breakpoint
CREATE INDEX `ai_conv_user_idx` ON `ai_conversations` (`userOpenId`);--> statement-breakpoint
CREATE INDEX `ai_msg_conv_idx` ON `ai_messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `whoop_oauth_state_state_idx` ON `whoop_oauth_state` (`state`);--> statement-breakpoint
CREATE INDEX `whoop_oauth_state_expiresAt_idx` ON `whoop_oauth_state` (`expiresAt`);