CREATE TABLE `auth_sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`userAgent` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `as_token_idx` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `email_verifications` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	CONSTRAINT `email_verifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `ev_token_idx` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`identifier` varchar(320) NOT NULL,
	`ip` varchar(64),
	`success` boolean NOT NULL DEFAULT false,
	`attemptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	CONSTRAINT `password_resets_id` PRIMARY KEY(`id`),
	CONSTRAINT `pr_token_idx` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `trainer_invites` (
	`id` varchar(64) NOT NULL,
	`trainerId` int NOT NULL,
	`code` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`usedByUserId` int,
	`usedAt` timestamp,
	CONSTRAINT `trainer_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `ti_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `trainer_trainees` (
	`id` varchar(64) NOT NULL,
	`trainerId` int NOT NULL,
	`traineeId` int NOT NULL,
	`status` enum('pending','active','revoked') NOT NULL DEFAULT 'pending',
	`photosSharedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	`revokedAt` timestamp,
	CONSTRAINT `trainer_trainees_id` PRIMARY KEY(`id`),
	CONSTRAINT `tt_pair_idx` UNIQUE(`trainerId`,`traineeId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','trainer','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `emailNormalized` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `disabledAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_norm_idx` UNIQUE(`emailNormalized`);--> statement-breakpoint
CREATE INDEX `as_user_idx` ON `auth_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `ev_user_idx` ON `email_verifications` (`userId`);--> statement-breakpoint
CREATE INDEX `la_identifier_idx` ON `login_attempts` (`identifier`,`attemptedAt`);--> statement-breakpoint
CREATE INDEX `la_ip_idx` ON `login_attempts` (`ip`,`attemptedAt`);--> statement-breakpoint
CREATE INDEX `pr_user_idx` ON `password_resets` (`userId`);--> statement-breakpoint
CREATE INDEX `ti_trainer_idx` ON `trainer_invites` (`trainerId`);--> statement-breakpoint
CREATE INDEX `tt_trainer_idx` ON `trainer_trainees` (`trainerId`);--> statement-breakpoint
CREATE INDEX `tt_trainee_idx` ON `trainer_trainees` (`traineeId`);