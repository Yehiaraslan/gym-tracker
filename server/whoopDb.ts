/**
 * WHOOP Database Helpers
 */
import { eq, and, gte, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  whoopTokens,
  whoopDataCache,
  whoopRecoveryHistory,
  type InsertWhoopToken,
  type InsertWhoopRecoveryHistory,
} from "../drizzle/schema";

// ── Token helpers ────────────────────────────────────────────
export async function saveWhoopTokens(data: InsertWhoopToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(whoopTokens).values(data).onDuplicateKeyUpdate({
    set: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      scope: data.scope,
    },
  });
}

export async function getWhoopTokens(userOpenId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(whoopTokens)
    .where(eq(whoopTokens.userOpenId, userOpenId))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteWhoopTokens(userOpenId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(whoopTokens).where(eq(whoopTokens.userOpenId, userOpenId));
  await db.delete(whoopDataCache).where(eq(whoopDataCache.userOpenId, userOpenId));
}

// ── Cache helpers ────────────────────────────────────────────
export async function saveWhoopCache(
  userOpenId: string,
  data: {
    recoveryJson?: string;
    sleepJson?: string;
    cycleJson?: string;
    workoutJson?: string;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(whoopDataCache)
    .values({
      userOpenId,
      recoveryJson: data.recoveryJson ?? null,
      sleepJson: data.sleepJson ?? null,
      cycleJson: data.cycleJson ?? null,
      workoutJson: data.workoutJson ?? null,
      lastSyncedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        ...(data.recoveryJson !== undefined && { recoveryJson: data.recoveryJson }),
        ...(data.sleepJson !== undefined && { sleepJson: data.sleepJson }),
        ...(data.cycleJson !== undefined && { cycleJson: data.cycleJson }),
        ...(data.workoutJson !== undefined && { workoutJson: data.workoutJson }),
        lastSyncedAt: new Date(),
      },
    });
}

export async function getWhoopCache(userOpenId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(whoopDataCache)
    .where(eq(whoopDataCache.userOpenId, userOpenId))
    .limit(1);
  return rows[0] ?? null;
}

// ── Recovery History helpers ─────────────────────────────────
export async function upsertRecoveryHistory(data: InsertWhoopRecoveryHistory) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(whoopRecoveryHistory)
    .where(
      and(
        eq(whoopRecoveryHistory.userOpenId, data.userOpenId),
        eq(whoopRecoveryHistory.date, data.date)
      )
    );
  await db.insert(whoopRecoveryHistory).values(data);
}

export async function getRecoveryHistory(userOpenId: string, days = 7) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const rows = await db
    .select()
    .from(whoopRecoveryHistory)
    .where(
      and(
        eq(whoopRecoveryHistory.userOpenId, userOpenId),
        gte(whoopRecoveryHistory.date, cutoffStr)
      )
    )
    .orderBy(desc(whoopRecoveryHistory.date))
    .limit(days);
  return rows;
}
