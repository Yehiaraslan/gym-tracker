import { bigint, boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── WHOOP OAuth Tokens ──────────────────────────────────────
export const whoopTokens = mysqlTable("whoop_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken").notNull(),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  scope: varchar("scope", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WhoopToken = typeof whoopTokens.$inferSelect;
export type InsertWhoopToken = typeof whoopTokens.$inferInsert;

// ── WHOOP OAuth State (CSRF protection) ─────────────────────
export const whoopOAuthState = mysqlTable("whoop_oauth_state", {
  id: int("id").autoincrement().primaryKey(),
  state: varchar("state", { length: 64 }).notNull().unique(),
  userOpenId: varchar("userOpenId", { length: 64 }),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  stateIdx: index("whoop_oauth_state_state_idx").on(table.state),
  expiresAtIdx: index("whoop_oauth_state_expiresAt_idx").on(table.expiresAt),
}));

export type WhoopOAuthState = typeof whoopOAuthState.$inferSelect;
export type InsertWhoopOAuthState = typeof whoopOAuthState.$inferInsert;

// ── WHOOP Data Cache ────────────────────────────────────────
export const whoopDataCache = mysqlTable("whoop_data_cache", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull().unique(),
  recoveryJson: text("recoveryJson"),
  sleepJson: text("sleepJson"),
  cycleJson: text("cycleJson"),
  workoutJson: text("workoutJson"),
  lastSyncedAt: timestamp("lastSyncedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WhoopDataCache = typeof whoopDataCache.$inferSelect;

// ── WHOOP Recovery History ──────────────────────────────────
export const whoopRecoveryHistory = mysqlTable("whoop_recovery_history", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  recoveryScore: int("recoveryScore"),
  hrv: int("hrv"),
  rhr: int("rhr"),
  spo2: int("spo2"),
  strainX10: int("strainX10"),
  sleepPerformance: int("sleepPerformance"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WhoopRecoveryHistory = typeof whoopRecoveryHistory.$inferSelect;
export type InsertWhoopRecoveryHistory = typeof whoopRecoveryHistory.$inferInsert;

// ── AI Coach Conversations ──────────────────────────────────
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }),
  coachingMode: mysqlEnum("coachingMode", ["auto", "aggressive", "recovery", "science"]).notNull().default("auto"),
  contextSnapshot: text("contextSnapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("ai_conv_user_idx").on(table.userOpenId),
}));

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;

// ── AI Coach Messages ───────────────────────────────────────
export const aiMessages = mysqlTable("ai_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  convIdx: index("ai_msg_conv_idx").on(table.conversationId),
}));

export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = typeof aiMessages.$inferInsert;

// ════════════════════════════════════════════════════════════
// WORKOUT TRACKING TABLES
// ════════════════════════════════════════════════════════════

// ── Workout Sessions ────────────────────────────────────────
// One row per completed (or in-progress) workout session
export const workoutSessions = mysqlTable("workout_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(), // client-generated UUID
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  sessionType: varchar("sessionType", { length: 32 }).notNull(), // upper-a, lower-a, etc.
  startTime: varchar("startTime", { length: 30 }).notNull(),
  endTime: varchar("endTime", { length: 30 }),
  completed: boolean("completed").notNull().default(false),
  durationMinutes: int("durationMinutes"),
  totalVolumeKg: decimal("totalVolumeKg", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userDateIdx: index("ws_user_date_idx").on(table.userOpenId, table.date),
  userTypeIdx: index("ws_user_type_idx").on(table.userOpenId, table.sessionType),
}));

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;

// ── Workout Exercise Logs ───────────────────────────────────
// One row per exercise within a session
export const workoutExerciseLogs = mysqlTable("workout_exercise_logs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  exerciseName: varchar("exerciseName", { length: 128 }).notNull(),
  exerciseOrder: int("exerciseOrder").notNull().default(0),
  skipped: boolean("skipped").notNull().default(false),
  skipReason: varchar("skipReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("wel_session_idx").on(table.sessionId),
  userExIdx: index("wel_user_ex_idx").on(table.userOpenId, table.exerciseName),
  sessionExerciseUniq: uniqueIndex("wel_session_exercise_uniq").on(table.sessionId, table.exerciseName),
}));

export type WorkoutExerciseLog = typeof workoutExerciseLogs.$inferSelect;
export type InsertWorkoutExerciseLog = typeof workoutExerciseLogs.$inferInsert;

// ── Workout Set Logs ────────────────────────────────────────
// One row per set within an exercise log
export const workoutSetLogs = mysqlTable("workout_set_logs", {
  id: int("id").autoincrement().primaryKey(),
  exerciseLogId: int("exerciseLogId").notNull(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  setNumber: int("setNumber").notNull(),
  weightKg: decimal("weightKg", { precision: 6, scale: 2 }).notNull(),
  reps: int("reps").notNull(),
  rpe: int("rpe"), // 6-10
  isWarmup: boolean("isWarmup").notNull().default(false),
  e1rm: decimal("e1rm", { precision: 6, scale: 2 }), // Epley 1RM estimate
  setTimestamp: varchar("setTimestamp", { length: 30 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  exerciseLogIdx: index("wsl_exercise_log_idx").on(table.exerciseLogId),
  sessionIdx: index("wsl_session_idx").on(table.sessionId),
  userIdx: index("wsl_user_idx").on(table.userOpenId),
}));

export type WorkoutSetLog = typeof workoutSetLogs.$inferSelect;
export type InsertWorkoutSetLog = typeof workoutSetLogs.$inferInsert;

// ── Form Coach Sessions ─────────────────────────────────────
// AI form analysis sessions (from pose detection)
export const formCoachSessions = mysqlTable("form_coach_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  exerciseName: varchar("exerciseName", { length: 128 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  totalReps: int("totalReps").notNull().default(0),
  avgFormScore: decimal("avgFormScore", { precision: 5, scale: 2 }),
  peakFormScore: decimal("peakFormScore", { precision: 5, scale: 2 }),
  issuesJson: text("issuesJson"), // JSON array of form issues
  durationSeconds: int("durationSeconds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index("fcs_user_date_idx").on(table.userOpenId, table.date),
  userExIdx: index("fcs_user_ex_idx").on(table.userOpenId, table.exerciseName),
}));

export type FormCoachSession = typeof formCoachSessions.$inferSelect;
export type InsertFormCoachSession = typeof formCoachSessions.$inferInsert;

// ════════════════════════════════════════════════════════════
// NUTRITION TABLES
// ════════════════════════════════════════════════════════════

// ── Daily Nutrition Summary ─────────────────────────────────
export const nutritionDays = mysqlTable("nutrition_days", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  isTrainingDay: boolean("isTrainingDay").notNull().default(true),
  targetCalories: int("targetCalories"),
  targetProtein: int("targetProtein"),
  targetCarbs: int("targetCarbs"),
  targetFat: int("targetFat"),
  supplementsJson: text("supplementsJson"), // JSON array of SupplementCheck
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userDateIdx: index("nd_user_date_idx").on(table.userOpenId, table.date),
}));

export type NutritionDay = typeof nutritionDays.$inferSelect;
export type InsertNutritionDay = typeof nutritionDays.$inferInsert;

// ── Food Entries ────────────────────────────────────────────
export const foodEntries = mysqlTable("food_entries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  nutritionDayId: int("nutritionDayId").notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  mealNumber: int("mealNumber").notNull(), // 1-5
  foodName: varchar("foodName", { length: 255 }).notNull(),
  protein: decimal("protein", { precision: 6, scale: 2 }).notNull(),
  carbs: decimal("carbs", { precision: 6, scale: 2 }).notNull(),
  fat: decimal("fat", { precision: 6, scale: 2 }).notNull(),
  calories: int("calories").notNull(),
  servingGrams: int("servingGrams"),
  entryTimestamp: varchar("entryTimestamp", { length: 30 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  dayIdx: index("fe_day_idx").on(table.nutritionDayId),
  userDateIdx: index("fe_user_date_idx").on(table.userOpenId, table.date),
}));

export type FoodEntry = typeof foodEntries.$inferSelect;
export type InsertFoodEntry = typeof foodEntries.$inferInsert;

// ════════════════════════════════════════════════════════════
// BODY METRICS TABLES
// ════════════════════════════════════════════════════════════

// ── Body Weight & Measurements ──────────────────────────────
export const bodyWeightEntries = mysqlTable("body_weight_entries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  weightKg: decimal("weightKg", { precision: 5, scale: 2 }),
  bodyFatPercent: decimal("bodyFatPercent", { precision: 4, scale: 1 }),
  chestCm: decimal("chestCm", { precision: 5, scale: 1 }),
  waistCm: decimal("waistCm", { precision: 5, scale: 1 }),
  hipsCm: decimal("hipsCm", { precision: 5, scale: 1 }),
  armsCm: decimal("armsCm", { precision: 5, scale: 1 }),
  thighsCm: decimal("thighsCm", { precision: 5, scale: 1 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index("bwe_user_date_idx").on(table.userOpenId, table.date),
}));

export type BodyWeightEntry = typeof bodyWeightEntries.$inferSelect;
export type InsertBodyWeightEntry = typeof bodyWeightEntries.$inferInsert;

// ── Sleep Entries ───────────────────────────────────────────
export const sleepEntries = mysqlTable("sleep_entries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  bedtime: varchar("bedtime", { length: 10 }), // HH:MM
  wakeTime: varchar("wakeTime", { length: 10 }), // HH:MM
  durationHours: decimal("durationHours", { precision: 4, scale: 2 }),
  qualityRating: int("qualityRating"), // 1-5
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index("se_user_date_idx").on(table.userOpenId, table.date),
}));

export type SleepEntry = typeof sleepEntries.$inferSelect;
export type InsertSleepEntry = typeof sleepEntries.$inferInsert;

// ════════════════════════════════════════════════════════════
// STREAK & PROGRESS TABLES
// ════════════════════════════════════════════════════════════

// ── Workout Streak ──────────────────────────────────────────
export const workoutStreaks = mysqlTable("workout_streaks", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull().unique(),
  currentStreak: int("currentStreak").notNull().default(0),
  bestStreak: int("bestStreak").notNull().default(0),
  lastWorkoutDate: varchar("lastWorkoutDate", { length: 10 }),
  workoutDatesJson: text("workoutDatesJson"), // JSON array of YYYY-MM-DD strings
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkoutStreak = typeof workoutStreaks.$inferSelect;
export type InsertWorkoutStreak = typeof workoutStreaks.$inferInsert;

// ── Personal Records ────────────────────────────────────────
export const personalRecords = mysqlTable("personal_records", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  exerciseName: varchar("exerciseName", { length: 128 }).notNull(),
  weightKg: decimal("weightKg", { precision: 6, scale: 2 }).notNull(),
  reps: int("reps").notNull(),
  estimated1rm: decimal("estimated1rm", { precision: 6, scale: 2 }),
  sessionType: varchar("sessionType", { length: 32 }),
  date: varchar("date", { length: 10 }).notNull(),
  sessionId: varchar("sessionId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userExIdx: index("pr_user_ex_idx").on(table.userOpenId, table.exerciseName),
}));

export type PersonalRecord = typeof personalRecords.$inferSelect;
export type InsertPersonalRecord = typeof personalRecords.$inferInsert;

// ════════════════════════════════════════════════════════════
// ZAKI SESSION MEMORY
// ════════════════════════════════════════════════════════════

// ── Zaki Session IDs ────────────────────────────────────────
// Persists the openclaw-bridge session_id against device ID
// so Zaki remembers conversation context across app restarts
export const zakiSessions = mysqlTable("zaki_sessions", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 128 }).notNull().unique(),
  zakiSessionId: varchar("zakiSessionId", { length: 256 }).notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  deviceIdx: index("zs_device_idx").on(table.deviceId),
}));

export type ZakiSession = typeof zakiSessions.$inferSelect;
export type InsertZakiSession = typeof zakiSessions.$inferInsert;

// ════════════════════════════════════════════════════════════
// PIN IDENTITY — Cross-Device Sync
// ════════════════════════════════════════════════════════════
// Maps a 6-digit PIN to a stable userOpenId so the same data
// is accessible from any device. The PIN is hashed (SHA-256)
// before storage. A device registers its deviceId under the
// PIN's userOpenId so all sync operations use the same key.
export const pinIdentities = mysqlTable("pin_identities", {
  id: int("id").autoincrement().primaryKey(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull().unique(),
  pinHash: varchar("pinHash", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  pinHashIdx: index("pi_pin_hash_idx").on(table.pinHash),
}));
export type PinIdentity = typeof pinIdentities.$inferSelect;
export type InsertPinIdentity = typeof pinIdentities.$inferInsert;

export const deviceIdentities = mysqlTable("device_identities", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 128 }).notNull().unique(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  deviceIdx: index("di_device_idx").on(table.deviceId),
  userIdx: index("di_user_idx").on(table.userOpenId),
}));
export type DeviceIdentity = typeof deviceIdentities.$inferSelect;
export type InsertDeviceIdentity = typeof deviceIdentities.$inferInsert;

// ════════════════════════════════════════════════════════════
// SCHEDULE OVERRIDES — Cloud-synced Zaki schedule changes
// ════════════════════════════════════════════════════════════
// Stores the active schedule override so Zaki's changes persist
// across app reinstalls and device changes. Only the latest
// override per device/user is active.
export const scheduleOverrides = mysqlTable("schedule_overrides", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 128 }).notNull(),
  scheduleJson: json("scheduleJson").notNull(), // { sunday: 'rest', monday: 'upper-a', ... }
  description: varchar("description", { length: 512 }),
  appliedByZaki: boolean("appliedByZaki").default(false).notNull(),
  weightAdjustments: text("weightAdjustments"),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  deviceIdx: index("so_device_idx").on(table.deviceId),
  appliedAtIdx: index("so_applied_at_idx").on(table.appliedAt),
}));
export type ScheduleOverride = typeof scheduleOverrides.$inferSelect;
export type InsertScheduleOverride = typeof scheduleOverrides.$inferInsert;
