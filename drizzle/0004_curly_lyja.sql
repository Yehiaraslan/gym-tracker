CREATE TABLE `device_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `device_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_identities_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `pin_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`pinHash` varchar(64) NOT NULL,
	`displayName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pin_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `pin_identities_userOpenId_unique` UNIQUE(`userOpenId`),
	CONSTRAINT `pin_identities_pinHash_unique` UNIQUE(`pinHash`)
);
--> statement-breakpoint
CREATE INDEX `di_device_idx` ON `device_identities` (`deviceId`);--> statement-breakpoint
CREATE INDEX `di_user_idx` ON `device_identities` (`userOpenId`);--> statement-breakpoint
CREATE INDEX `pi_pin_hash_idx` ON `pin_identities` (`pinHash`);