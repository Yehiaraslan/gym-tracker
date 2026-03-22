CREATE TABLE `body_weight_entries` (
	`id` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`date` varchar(10) NOT NULL,
	`weightKg` decimal(5,2),
	`bodyFatPercent` decimal(4,1),
	`chestCm` decimal(5,1),
	`waistCm` decimal(5,1),
	`hipsCm` decimal(5,1),
	`armsCm` decimal(5,1),
	`thighsCm` decimal(5,1),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `body_weight_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `food_entries` (
	`id` varchar(64) NOT NULL,
	`nutritionDayId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`date` varchar(10) NOT NULL,
	`mealNumber` int NOT NULL,
	`foodName` varchar(255) NOT NULL,
	`protein` decimal(6,2) NOT NULL,
	`carbs` decimal(6,2) NOT NULL,
	`fat` decimal(6,2) NOT NULL,
	`calories` int NOT NULL,
	`servingGrams` int,
	`entryTimestamp` varchar(30),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `food_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_coach_sessions` (
	`id` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`exerciseName` varchar(128) NOT NULL,
	`date` varchar(10) NOT NULL,
	`totalReps` int NOT NULL DEFAULT 0,
	`avgFormScore` decimal(5,2),
	`peakFormScore` decimal(5,2),
	`issuesJson` text,
	`durationSeconds` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_coach_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutrition_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`date` varchar(10) NOT NULL,
	`isTrainingDay` boolean NOT NULL DEFAULT true,
	`targetCalories` int,
	`targetProtein` int,
	`targetCarbs` int,
	`targetFat` int,
	`supplementsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutrition_days_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personal_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`exerciseName` varchar(128) NOT NULL,
	`weightKg` decimal(6,2) NOT NULL,
	`reps` int NOT NULL,
	`estimated1rm` decimal(6,2),
	`sessionType` varchar(32),
	`date` varchar(10) NOT NULL,
	`sessionId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `personal_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sleep_entries` (
	`id` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`date` varchar(10) NOT NULL,
	`bedtime` varchar(10),
	`wakeTime` varchar(10),
	`durationHours` decimal(4,2),
	`qualityRating` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sleep_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_exercise_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`exerciseName` varchar(128) NOT NULL,
	`exerciseOrder` int NOT NULL DEFAULT 0,
	`skipped` boolean NOT NULL DEFAULT false,
	`skipReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workout_exercise_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`date` varchar(10) NOT NULL,
	`sessionType` varchar(32) NOT NULL,
	`startTime` varchar(30) NOT NULL,
	`endTime` varchar(30),
	`completed` boolean NOT NULL DEFAULT false,
	`durationMinutes` int,
	`totalVolumeKg` decimal(10,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workout_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_set_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exerciseLogId` int NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`setNumber` int NOT NULL,
	`weightKg` decimal(6,2) NOT NULL,
	`reps` int NOT NULL,
	`rpe` int,
	`isWarmup` boolean NOT NULL DEFAULT false,
	`e1rm` decimal(6,2),
	`setTimestamp` varchar(30),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workout_set_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_streaks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`currentStreak` int NOT NULL DEFAULT 0,
	`bestStreak` int NOT NULL DEFAULT 0,
	`lastWorkoutDate` varchar(10),
	`workoutDatesJson` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workout_streaks_id` PRIMARY KEY(`id`),
	CONSTRAINT `workout_streaks_userOpenId_unique` UNIQUE(`userOpenId`)
);
--> statement-breakpoint
CREATE INDEX `bwe_user_date_idx` ON `body_weight_entries` (`userOpenId`,`date`);--> statement-breakpoint
CREATE INDEX `fe_day_idx` ON `food_entries` (`nutritionDayId`);--> statement-breakpoint
CREATE INDEX `fe_user_date_idx` ON `food_entries` (`userOpenId`,`date`);--> statement-breakpoint
CREATE INDEX `fcs_user_date_idx` ON `form_coach_sessions` (`userOpenId`,`date`);--> statement-breakpoint
CREATE INDEX `fcs_user_ex_idx` ON `form_coach_sessions` (`userOpenId`,`exerciseName`);--> statement-breakpoint
CREATE INDEX `nd_user_date_idx` ON `nutrition_days` (`userOpenId`,`date`);--> statement-breakpoint
CREATE INDEX `pr_user_ex_idx` ON `personal_records` (`userOpenId`,`exerciseName`);--> statement-breakpoint
CREATE INDEX `se_user_date_idx` ON `sleep_entries` (`userOpenId`,`date`);--> statement-breakpoint
CREATE INDEX `wel_session_idx` ON `workout_exercise_logs` (`sessionId`);--> statement-breakpoint
CREATE INDEX `wel_user_ex_idx` ON `workout_exercise_logs` (`userOpenId`,`exerciseName`);--> statement-breakpoint
CREATE INDEX `ws_user_date_idx` ON `workout_sessions` (`userOpenId`,`date`);--> statement-breakpoint
CREATE INDEX `ws_user_type_idx` ON `workout_sessions` (`userOpenId`,`sessionType`);--> statement-breakpoint
CREATE INDEX `wsl_exercise_log_idx` ON `workout_set_logs` (`exerciseLogId`);--> statement-breakpoint
CREATE INDEX `wsl_session_idx` ON `workout_set_logs` (`sessionId`);--> statement-breakpoint
CREATE INDEX `wsl_user_idx` ON `workout_set_logs` (`userOpenId`);