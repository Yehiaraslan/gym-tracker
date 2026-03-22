CREATE TABLE `zaki_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`zakiSessionId` varchar(256) NOT NULL,
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zaki_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `zaki_sessions_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE INDEX `zs_device_idx` ON `zaki_sessions` (`deviceId`);