/**
 * WHOOP OAuth State Manager (CSRF protection)
 */
import crypto from "crypto";
import { eq, lt } from "drizzle-orm";
import { getDb } from "./db";
import { whoopOAuthState } from "../drizzle/schema";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function createState(userOpenId?: string): Promise<string> {
  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + STATE_TTL_MS;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(whoopOAuthState).values({
    state,
    userOpenId: userOpenId ?? null,
    expiresAt,
  });

  return state;
}

export async function validateAndConsumeState(state: string): Promise<{ valid: boolean; userOpenId?: string }> {
  const db = await getDb();
  if (!db) return { valid: false };

  const rows = await db
    .select()
    .from(whoopOAuthState)
    .where(eq(whoopOAuthState.state, state))
    .limit(1);

  if (rows.length === 0) return { valid: false };

  const row = rows[0];

  // Delete the state (one-time use)
  await db.delete(whoopOAuthState).where(eq(whoopOAuthState.state, state));

  // Check expiration
  if (row.expiresAt < Date.now()) return { valid: false };

  return { valid: true, userOpenId: row.userOpenId ?? undefined };
}

export async function cleanupExpiredStates(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(whoopOAuthState).where(lt(whoopOAuthState.expiresAt, Date.now()));
}
