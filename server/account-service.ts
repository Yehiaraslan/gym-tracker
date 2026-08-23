/**
 * Real-account signup and login, backed by MariaDB.
 *
 * Guest auth stays where it is and keeps working; this is additive, so the
 * currently-installed APK is unaffected until a new build ships.
 *
 * Deliberate choices worth knowing:
 *  - Identity is the account's openId ("acct-<uuid>"), minted server-side.
 *    A caller can never choose or claim one.
 *  - Login failures are counted per-email AND per-IP. Either exceeding its
 *    window locks out, so one account cannot be ground down and one source
 *    cannot spray many accounts.
 *  - Wrong-email and wrong-password return the SAME error and both pay the
 *    scrypt cost, so the endpoint does not disclose which emails exist.
 *  - Sessions are rows storing a token hash, so they can be revoked. Absence
 *    of a row is not treated as invalid yet — that flips on with the new APK.
 */
import { eq, sql } from "drizzle-orm";
import { authSessions, users } from "../drizzle/schema";
import { getDb } from "./db";
import {
  RATE_LIMIT, TOKEN_TTL, expiryFrom, hashPassword, hashToken, isValidEmail,
  newId, normalizeEmail, validatePassword, verifyPassword,
} from "./auth-service";

export type AccountRole = "user" | "trainer";

export type PublicUser = {
  id: number;
  openId: string;
  name: string;
  email: string | null;
  role: string;
  loginMethod: string;
  emailVerified: boolean;
  lastSignedIn: string;
};

export class AccountError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    openId: row.openId,
    name: row.name ?? "",
    email: row.email ?? null,
    role: row.role,
    loginMethod: row.loginMethod ?? "password",
    emailVerified: row.emailVerifiedAt != null,
    lastSignedIn: (row.lastSignedIn ?? new Date()).toISOString(),
  };
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new AccountError("database_unavailable", 503, "Accounts are temporarily unavailable.");
  return db;
}

// ── Rate limiting ───────────────────────────────────────────────────

async function recordAttempt(identifier: string, ip: string | null, success: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.execute(
    sql`INSERT INTO login_attempts (identifier, ip, success) VALUES (${identifier}, ${ip}, ${success})`,
  );
}

/**
 * Throws when either the identifier or the source IP has spent its failure
 * budget for the window. Successful logins do not count against it.
 */
async function assertNotThrottled(identifier: string, ip: string | null) {
  const db = await getDb();
  if (!db) return;
  const since = new Date(Date.now() - RATE_LIMIT.windowMs);

  const byId = await db.execute(
    sql`SELECT COUNT(*) AS c FROM login_attempts
        WHERE identifier = ${identifier} AND success = false AND attemptedAt >= ${since}`,
  );
  const idCount = Number((byId as any)[0]?.[0]?.c ?? (byId as any)[0]?.c ?? 0);
  if (idCount >= RATE_LIMIT.maxPerIdentifier) {
    throw new AccountError("too_many_attempts", 429, "Too many attempts. Try again in 15 minutes.");
  }

  if (ip) {
    const byIp = await db.execute(
      sql`SELECT COUNT(*) AS c FROM login_attempts
          WHERE ip = ${ip} AND success = false AND attemptedAt >= ${since}`,
    );
    const ipCount = Number((byIp as any)[0]?.[0]?.c ?? (byIp as any)[0]?.c ?? 0);
    if (ipCount >= RATE_LIMIT.maxPerIp) {
      throw new AccountError("too_many_attempts", 429, "Too many attempts. Try again in 15 minutes.");
    }
  }
}

// ── Sessions ────────────────────────────────────────────────────────

export async function recordSession(userId: number, sessionToken: string, userAgent?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.insert(authSessions).values({
    id: newId(),
    userId,
    tokenHash: hashToken(sessionToken),
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
    expiresAt: expiryFrom(new Date(), TOKEN_TTL.session),
  });
}

export async function revokeSession(sessionToken: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.tokenHash, hashToken(sessionToken)));
}

// ── Signup / login ──────────────────────────────────────────────────

export async function signup(params: {
  email: string; password: string; name?: string; role?: AccountRole;
}): Promise<PublicUser> {
  const db = await requireDb();

  if (!isValidEmail(params.email)) {
    throw new AccountError("invalid_email", 400, "Enter a valid email address.");
  }
  const pw = validatePassword(params.password);
  if (pw.ok === false) {
    throw new AccountError("weak_password", 400, pw.reason);
  }

  const role: AccountRole = params.role === "trainer" ? "trainer" : "user";
  const emailNormalized = normalizeEmail(params.email);

  const existing = await db.select().from(users)
    .where(eq(users.emailNormalized, emailNormalized)).limit(1);
  if (existing.length > 0) {
    throw new AccountError("email_taken", 409, "That email is already registered.");
  }

  const openId = `acct-${newId()}`;
  const now = new Date();
  await db.insert(users).values({
    openId,
    name: (params.name ?? "").trim().slice(0, 64) || emailNormalized.split("@")[0],
    email: params.email.trim(),
    emailNormalized,
    passwordHash: await hashPassword(params.password),
    role,
    loginMethod: "password",
    lastSignedIn: now,
  });

  const created = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (created.length === 0) {
    throw new AccountError("signup_failed", 500, "Could not create the account.");
  }
  return toPublicUser(created[0]);
}

export async function login(params: {
  email: string; password: string; ip?: string | null;
}): Promise<PublicUser> {
  const db = await requireDb();
  const emailNormalized = normalizeEmail(params.email ?? "");
  const ip = params.ip ?? null;

  await assertNotThrottled(emailNormalized, ip);

  const found = await db.select().from(users)
    .where(eq(users.emailNormalized, emailNormalized)).limit(1);
  const row = found[0];

  // Always run a verification, even with no such user, so that response time
  // does not reveal whether the email exists.
  const ok = await verifyPassword(
    params.password ?? "",
    row?.passwordHash ?? "scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  );

  if (!row || !ok) {
    await recordAttempt(emailNormalized, ip, false);
    throw new AccountError("invalid_credentials", 401, "Email or password is incorrect.");
  }
  if (row.disabledAt) {
    await recordAttempt(emailNormalized, ip, false);
    throw new AccountError("account_disabled", 403, "This account has been disabled.");
  }

  await recordAttempt(emailNormalized, ip, true);
  const now = new Date();
  await db.update(users).set({ lastSignedIn: now }).where(eq(users.id, row.id));
  return toPublicUser({ ...row, lastSignedIn: now });
}

export async function getAccountByOpenId(openId: string): Promise<PublicUser | null> {
  const db = await getDb();
  if (!db) return null;
  const found = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return found.length ? toPublicUser(found[0]) : null;
}
