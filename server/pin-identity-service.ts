/**
 * PIN Identity Service
 *
 * Provides cross-device sync identity via a 6-digit PIN.
 * The PIN is hashed with SHA-256 before storage — never stored in plaintext.
 *
 * Flow:
 *  1. First device: setupPin(deviceId, pin, displayName)
 *     → creates a new userOpenId, stores pinHash, links deviceId
 *  2. Second device: loginWithPin(deviceId, pin)
 *     → looks up pinHash, links deviceId to existing userOpenId
 *  3. All sync calls use the resolved userOpenId instead of deviceId
 */

import { createHash, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { deviceIdentities, pinIdentities } from "../drizzle/schema";

function hashPin(pin: string): string {
  return createHash("sha256").update(`gymtrackr:${pin}`).digest("hex");
}

export interface PinSetupResult {
  success: true;
  userOpenId: string;
  isNew: boolean;
}

/**
 * Set up a new PIN for a device. If the PIN already exists, this is treated
 * as a login and the device is linked to the existing userOpenId.
 */
export async function setupOrLoginPin(
  deviceId: string,
  pin: string,
  displayName?: string,
): Promise<PinSetupResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const pinHash = hashPin(pin);

  // Check if PIN already exists
  const existing = await db
    .select()
    .from(pinIdentities)
    .where(eq(pinIdentities.pinHash, pinHash))
    .limit(1);

  let userOpenId: string;
  let isNew: boolean;

  if (existing.length > 0) {
    // PIN exists — link this device to existing identity
    userOpenId = existing[0].userOpenId;
    isNew = false;
  } else {
    // New PIN — create a new identity
    userOpenId = randomUUID();
    await db.insert(pinIdentities).values({
      userOpenId,
      pinHash,
      displayName: displayName ?? null,
    });
    isNew = true;
  }

  // Link (or update) device → userOpenId
  await db
    .insert(deviceIdentities)
    .values({
      deviceId,
      userOpenId,
      lastSeenAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        userOpenId,
        lastSeenAt: new Date(),
      },
    });

  return { success: true, userOpenId, isNew };
}

/**
 * Resolve a deviceId to its linked userOpenId.
 * Returns null if the device hasn't set up a PIN yet.
 */
export async function resolveUserOpenId(deviceId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(deviceIdentities)
    .where(eq(deviceIdentities.deviceId, deviceId))
    .limit(1);

  return rows.length > 0 ? rows[0].userOpenId : null;
}

/**
 * Unlink a device from its PIN identity (e.g., "sign out").
 * The PIN identity and other devices remain intact.
 */
export async function unlinkDevice(deviceId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .delete(deviceIdentities)
    .where(eq(deviceIdentities.deviceId, deviceId));
}

/**
 * Check if a PIN is already taken (useful for setup UI).
 */
export async function isPinTaken(pin: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const pinHash = hashPin(pin);
  const rows = await db
    .select({ id: pinIdentities.id })
    .from(pinIdentities)
    .where(eq(pinIdentities.pinHash, pinHash))
    .limit(1);

  return rows.length > 0;
}

/**
 * Get the display name for a PIN identity.
 */
export async function getDisplayName(userOpenId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({ displayName: pinIdentities.displayName })
    .from(pinIdentities)
    .where(eq(pinIdentities.userOpenId, userOpenId))
    .limit(1);

  return rows.length > 0 ? rows[0].displayName : null;
}
