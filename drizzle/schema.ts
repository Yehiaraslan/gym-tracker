import { bigint, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
