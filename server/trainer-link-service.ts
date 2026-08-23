/**
 * The trainer ↔ trainee link.
 *
 * This is the authorization boundary of the whole trainer feature: a trainer
 * may read a trainee's workouts, meals and photos ONLY while an ACTIVE row
 * exists here. Every trainer-side read must call assertCanCoach() first —
 * never trust an id supplied by the caller.
 *
 * Consent is two-sided by construction: the trainer issues an invite code
 * (consent 1) and the trainee redeems it (consent 2). Either side can revoke
 * at any time. Photo sharing is a SEPARATE opt-in on top of the link, because
 * agreeing to be coached is not the same as agreeing to be photographed.
 */
import { and, eq, or } from "drizzle-orm";
import { trainerInvites, trainerTrainees, users } from "../drizzle/schema";
import { getDb } from "./db";
import { TOKEN_TTL, expiryFrom, generateInviteCode, isExpired, newId } from "./auth-service";

export class LinkError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

export type Roster = {
  linkId: string;
  userId: number;
  name: string;
  email: string | null;
  status: string;
  photosShared: boolean;
  since: string;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new LinkError("database_unavailable", 503, "Temporarily unavailable.");
  return db;
}

// ── Invites ─────────────────────────────────────────────────────────

export async function createInvite(trainer: { id: number; role: string }) {
  if (trainer.role !== "trainer" && trainer.role !== "admin") {
    throw new LinkError("not_a_trainer", 403, "Only a trainer can invite trainees.");
  }
  const db = await requireDb();

  // Retry on the astronomically unlikely code collision rather than 500.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const existing = await db.select().from(trainerInvites)
      .where(eq(trainerInvites.code, code)).limit(1);
    if (existing.length > 0) continue;

    const expiresAt = expiryFrom(new Date(), TOKEN_TTL.trainerInvite);
    await db.insert(trainerInvites).values({
      id: newId(), trainerId: trainer.id, code, expiresAt,
    });
    return { code, expiresAt: expiresAt.toISOString() };
  }
  throw new LinkError("invite_failed", 500, "Could not create an invite code.");
}

export async function redeemInvite(code: string, trainee: { id: number }) {
  const db = await requireDb();
  const normalized = (code ?? "").trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalized)) {
    throw new LinkError("invalid_code", 400, "That invite code is not valid.");
  }

  const found = await db.select().from(trainerInvites)
    .where(eq(trainerInvites.code, normalized)).limit(1);
  const invite = found[0];
  if (!invite) throw new LinkError("invalid_code", 404, "That invite code is not valid.");
  if (invite.usedAt) throw new LinkError("code_used", 409, "That invite code has already been used.");
  if (isExpired(invite.expiresAt)) throw new LinkError("code_expired", 410, "That invite code has expired.");
  if (invite.trainerId === trainee.id) {
    throw new LinkError("self_link", 400, "You cannot coach yourself.");
  }

  const already = await db.select().from(trainerTrainees).where(
    and(eq(trainerTrainees.trainerId, invite.trainerId), eq(trainerTrainees.traineeId, trainee.id)),
  ).limit(1);

  const now = new Date();
  if (already.length > 0) {
    if (already[0].status === "active") {
      throw new LinkError("already_linked", 409, "You are already linked to this trainer.");
    }
    // Re-linking after a revoke reuses the row but does NOT resurrect the old
    // photo consent — that must be given again, deliberately.
    await db.update(trainerTrainees)
      .set({ status: "active", respondedAt: now, revokedAt: null, photosSharedAt: null })
      .where(eq(trainerTrainees.id, already[0].id));
  } else {
    await db.insert(trainerTrainees).values({
      id: newId(), trainerId: invite.trainerId, traineeId: trainee.id,
      status: "active", respondedAt: now,
    });
  }

  await db.update(trainerInvites)
    .set({ usedByUserId: trainee.id, usedAt: now })
    .where(eq(trainerInvites.id, invite.id));

  return { trainerId: invite.trainerId, status: "active" as const };
}

// ── Authorization ───────────────────────────────────────────────────

/** True only while an ACTIVE link exists. No link, revoked, or reversed roles → false. */
export async function canCoach(trainerId: number, traineeId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(trainerTrainees).where(
    and(
      eq(trainerTrainees.trainerId, trainerId),
      eq(trainerTrainees.traineeId, traineeId),
      eq(trainerTrainees.status, "active"),
    ),
  ).limit(1);
  return rows.length > 0;
}

/** Call before ANY trainer-side read of a trainee's data. */
export async function assertCanCoach(trainerId: number, traineeId: number): Promise<void> {
  if (!(await canCoach(trainerId, traineeId))) {
    throw new LinkError("not_linked", 403, "You do not coach this athlete.");
  }
}

/** Photo access needs the link AND the trainee's separate, revocable consent. */
export async function canSeePhotos(trainerId: number, traineeId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(trainerTrainees).where(
    and(
      eq(trainerTrainees.trainerId, trainerId),
      eq(trainerTrainees.traineeId, traineeId),
      eq(trainerTrainees.status, "active"),
    ),
  ).limit(1);
  return rows.length > 0 && rows[0].photosSharedAt != null;
}

// ── Rosters ─────────────────────────────────────────────────────────

export async function listTrainees(trainerId: number): Promise<Roster[]> {
  const db = await requireDb();
  const rows = await db.select({
    linkId: trainerTrainees.id, status: trainerTrainees.status,
    photosSharedAt: trainerTrainees.photosSharedAt, createdAt: trainerTrainees.createdAt,
    userId: users.id, name: users.name, email: users.email,
  })
    .from(trainerTrainees)
    .innerJoin(users, eq(users.id, trainerTrainees.traineeId))
    .where(and(eq(trainerTrainees.trainerId, trainerId), eq(trainerTrainees.status, "active")));

  return rows.map((r) => ({
    linkId: r.linkId, userId: r.userId, name: r.name ?? "", email: r.email ?? null,
    status: r.status, photosShared: r.photosSharedAt != null,
    since: (r.createdAt ?? new Date()).toISOString(),
  }));
}

export async function listTrainers(traineeId: number): Promise<Roster[]> {
  const db = await requireDb();
  const rows = await db.select({
    linkId: trainerTrainees.id, status: trainerTrainees.status,
    photosSharedAt: trainerTrainees.photosSharedAt, createdAt: trainerTrainees.createdAt,
    userId: users.id, name: users.name, email: users.email,
  })
    .from(trainerTrainees)
    .innerJoin(users, eq(users.id, trainerTrainees.trainerId))
    .where(and(eq(trainerTrainees.traineeId, traineeId), eq(trainerTrainees.status, "active")));

  return rows.map((r) => ({
    linkId: r.linkId, userId: r.userId, name: r.name ?? "", email: r.email ?? null,
    status: r.status, photosShared: r.photosSharedAt != null,
    since: (r.createdAt ?? new Date()).toISOString(),
  }));
}

// ── Revoke + consent ────────────────────────────────────────────────

/** Either party may revoke; nobody else can touch the row. */
export async function revokeLink(actorUserId: number, linkId: string) {
  const db = await requireDb();
  const rows = await db.select().from(trainerTrainees)
    .where(eq(trainerTrainees.id, linkId)).limit(1);
  const link = rows[0];
  if (!link) throw new LinkError("not_found", 404, "That link no longer exists.");
  if (link.trainerId !== actorUserId && link.traineeId !== actorUserId) {
    throw new LinkError("forbidden", 403, "That link is not yours to change.");
  }
  await db.update(trainerTrainees)
    .set({ status: "revoked", revokedAt: new Date(), photosSharedAt: null })
    .where(eq(trainerTrainees.id, linkId));
  return { status: "revoked" as const };
}

/** Only the TRAINEE may grant or withdraw photo sharing. */
export async function setPhotoConsent(traineeUserId: number, linkId: string, shared: boolean) {
  const db = await requireDb();
  const rows = await db.select().from(trainerTrainees)
    .where(eq(trainerTrainees.id, linkId)).limit(1);
  const link = rows[0];
  if (!link) throw new LinkError("not_found", 404, "That link no longer exists.");
  if (link.traineeId !== traineeUserId) {
    throw new LinkError("forbidden", 403, "Only the athlete can change photo sharing.");
  }
  await db.update(trainerTrainees)
    .set({ photosSharedAt: shared ? new Date() : null })
    .where(eq(trainerTrainees.id, linkId));
  return { photosShared: shared };
}
