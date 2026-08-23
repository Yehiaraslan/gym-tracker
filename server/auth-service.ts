/**
 * Real account auth for Banana Pro Gym.
 *
 * Built for public signup (strangers), so the defaults are conservative:
 *  - passwords hashed with scrypt (Node built-in — no native dependency to
 *    build or keep patched), OWASP parameters N=2^16, r=8, p=1 (~200ms here)
 *  - every hash is self-describing, so parameters can be raised later without
 *    invalidating existing passwords (see needsRehash)
 *  - all tokens (session, verification, reset) are stored as SHA-256 hashes;
 *    a database leak must not yield a usable session or reset link
 *  - login is throttled per-email AND per-IP
 *  - comparisons are timing-safe
 *
 * Guest auth is deliberately left untouched and still works: the installed
 * APK depends on it, and it must keep working until a new build ships.
 */
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual, type ScryptOptions } from "crypto";

/**
 * Hand-rolled rather than promisify(scrypt): promisify's typings drop the
 * options overload, and the options are exactly what carry the cost parameters.
 */
function scryptAsync(
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/** Current cost parameters. Raise over time; old hashes keep verifying. */
export const SCRYPT_PARAMS = { N: 65536, r: 8, p: 1, keylen: 32 } as const;
const MAXMEM = 256 * 1024 * 1024;

export const TOKEN_TTL = {
  session: 30 * 24 * 60 * 60 * 1000, // 30 days
  emailVerification: 24 * 60 * 60 * 1000, // 24 hours
  passwordReset: 60 * 60 * 1000, // 1 hour — deliberately short
  trainerInvite: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

/** Failed logins allowed inside the window before the identifier is locked out. */
export const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxPerIdentifier: 8,
  maxPerIp: 30,
} as const;

// ── Passwords ───────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  const { N, r, p, keylen } = SCRYPT_PARAMS;
  const salt = randomBytes(16);
  const derived = await scryptAsync(plain, salt, keylen, { N, r, p, maxmem: MAXMEM });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * Verify against a stored hash, reading the cost parameters back out of the
 * hash itself so that raising SCRYPT_PARAMS never locks anyone out.
 * Returns false (never throws) on a malformed or absent hash.
 */
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  try {
    const derived = await scryptAsync(plain, salt, expected.length, { N, r, p, maxmem: MAXMEM });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** True when a stored hash was made with weaker parameters than we now use. */
export function needsRehash(stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < SCRYPT_PARAMS.N;
}

// ── Tokens ──────────────────────────────────────────────────────────

/** Raw token goes to the user exactly once; only its hash is ever stored. */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newId(): string {
  return randomUUID();
}

/** Unambiguous invite code: no O/0, I/1, or similar look-alikes. */
export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// ── Email + validation ──────────────────────────────────────────────

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return e.length >= 3 && e.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/**
 * Deliberately minimal: length is what actually protects a password, and
 * composition rules push people toward predictable substitutions.
 */
export function validatePassword(plain: string): { ok: true } | { ok: false; reason: string } {
  if (typeof plain !== "string") return { ok: false, reason: "Password is required." };
  if (plain.length < 10) return { ok: false, reason: "Password must be at least 10 characters." };
  if (plain.length > 200) return { ok: false, reason: "Password must be at most 200 characters." };
  const lowered = plain.toLowerCase();
  const common = ["password", "12345678", "qwerty", "letmein", "iloveyou", "admin123"];
  if (common.some((c) => lowered.includes(c))) {
    return { ok: false, reason: "That password is too easy to guess." };
  }
  return { ok: true };
}

export function expiryFrom(now: Date, ttlMs: number): Date {
  return new Date(now.getTime() + ttlMs);
}

export function isExpired(expiresAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true;
  const t = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return !(t.getTime() > now.getTime());
}
