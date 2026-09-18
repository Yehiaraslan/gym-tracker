/**
 * Push notifications via Expo's push API.
 *
 * Delivery is best-effort and never blocks the caller: a failed push must not
 * fail a plan assignment or a message. Tokens that Expo reports as no longer
 * registered are dropped so we stop sending to dead devices.
 *
 * Android delivery additionally needs FCM credentials on the EAS project
 * (google-services.json + FCM V1 key). Until that is configured Expo accepts
 * the ticket but the device never receives it — see notes/push-setup.md.
 */
import { eq, inArray } from "drizzle-orm";
import { pushTokens } from "../drizzle/schema";
import { getDb } from "./db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export function isExpoPushToken(token: string): boolean {
  return /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token);
}

export async function registerToken(userId: number, token: string, platform: string): Promise<{ ok: true }> {
  const db = await getDb();
  if (!db) return { ok: true };
  const existing = await db.select().from(pushTokens).where(eq(pushTokens.token, token)).limit(1);
  if (existing[0]) {
    if (existing[0].userId !== userId || existing[0].platform !== platform) {
      await db.update(pushTokens).set({ userId, platform }).where(eq(pushTokens.token, token));
    }
  } else {
    await db.insert(pushTokens).values({ userId, token, platform });
  }
  return { ok: true };
}

export async function unregisterToken(userId: number, token: string): Promise<{ ok: true }> {
  const db = await getDb();
  if (!db) return { ok: true };
  const rows = await db.select().from(pushTokens).where(eq(pushTokens.token, token)).limit(1);
  // Only the current owner may remove it — a stale device cannot silence a
  // token that has since been re-homed to another account.
  if (rows[0] && rows[0].userId === userId) {
    await db.delete(pushTokens).where(eq(pushTokens.token, token));
  }
  return { ok: true };
}

export async function tokensFor(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, userId));
  return rows.map((r) => r.token);
}

type ExpoTicket = { status: "ok" | "error"; message?: string; details?: { error?: string } };

/** Fire-and-forget. Resolves to the number of tickets Expo accepted. */
export async function notifyUser(userId: number, payload: PushPayload): Promise<number> {
  try {
    const tokens = (await tokensFor(userId)).filter(isExpoPushToken);
    if (tokens.length === 0) return 0;
    const messages = tokens.map((to) => ({
      to, sound: "default", title: payload.title, body: payload.body, data: payload.data ?? {},
      channelId: "coach", priority: "high",
    }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.warn("[push] expo responded", res.status);
      return 0;
    }
    const json = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = json.data ?? [];
    const dead: string[] = [];
    let accepted = 0;
    tickets.forEach((t, i) => {
      if (t.status === "ok") accepted += 1;
      else if (t.details?.error === "DeviceNotRegistered") dead.push(tokens[i]);
      else console.warn("[push] ticket error", t.message, t.details);
    });
    if (dead.length) {
      const db = await getDb();
      if (db) await db.delete(pushTokens).where(inArray(pushTokens.token, dead));
    }
    return accepted;
  } catch (error) {
    console.warn("[push] send failed", error instanceof Error ? error.message : error);
    return 0;
  }
}
