/**
 * Coach ↔ trainee: plans, meal plans, messages, progress.
 *
 * Authorization lives in trainer-link-service (assertCanCoach). This module
 * never trusts a caller-supplied trainee id without that check, and a trainee
 * can only ever read plans addressed to their own user id (taken from ctx).
 */
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  bodyWeightEntries, coachMealPlans, coachMessages, coachWorkoutPlans, foodEntries,
  nutritionDays, personalRecords, trainerTrainees, users, workoutExerciseLogs,
  workoutSessions, workoutStreaks,
} from "../drizzle/schema";
import type {
  CoachMealPlan, CoachMealPlanBody, CoachMessage, CoachThread, CoachWorkoutPlan,
  CoachWorkoutPlanBody, TraineeProgress,
} from "../shared/coach-types";
import { newId } from "./auth-service";
import { getDb } from "./db";
import { LinkError, assertCanCoach, canCoach, canSeePhotos } from "./trainer-link-service";

// ── Input schemas ───────────────────────────────────────────────────

const macro = z.object({
  calories: z.number().int().min(0).max(20000),
  protein: z.number().int().min(0).max(2000),
  carbs: z.number().int().min(0).max(5000),
  fat: z.number().int().min(0).max(2000),
});

const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const workoutPlanSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().max(2000).default(""),
  durationWeeks: z.number().int().min(1).max(52).default(4),
  sessions: z.array(z.object({
    id: z.string().min(1).max(32).regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(1).max(64),
    exercises: z.array(z.object({
      name: z.string().trim().min(1).max(128),
      sets: z.number().int().min(1).max(20),
      repsMin: z.number().int().min(1).max(500),
      repsMax: z.number().int().min(1).max(500),
      restSeconds: z.number().int().min(0).max(900),
      notes: z.string().max(500).default(""),
      muscleGroup: z.enum(["upper", "lower", "core"]).default("upper"),
      bodyPart: z.string().max(32).default("Other"),
      category: z.enum(["compound", "isolation"]).default("compound"),
    })).min(1).max(30),
  })).min(1).max(14),
  weeklySchedule: z.object(Object.fromEntries(weekDays.map((d) => [d, z.string().max(32)])) as Record<(typeof weekDays)[number], z.ZodString>),
  notes: z.string().max(2000).default(""),
}).superRefine((plan, ctx) => {
  const ids = new Set(plan.sessions.map((s) => s.id));
  if (ids.size !== plan.sessions.length) {
    ctx.addIssue({ code: "custom", message: "Session ids must be unique." });
  }
  for (const day of weekDays) {
    const v = plan.weeklySchedule[day];
    if (v !== "rest" && !ids.has(v)) {
      ctx.addIssue({ code: "custom", message: `${day} points at an unknown session "${v}".` });
    }
  }
  if (!weekDays.some((d) => plan.weeklySchedule[d] !== "rest")) {
    ctx.addIssue({ code: "custom", message: "Schedule at least one training day." });
  }
});

export const mealPlanSchema = z.object({
  name: z.string().trim().min(1).max(128),
  trainingDay: macro,
  restDay: macro,
  meals: z.array(z.object({
    mealNumber: z.number().int().min(1).max(5),
    name: z.string().trim().min(1).max(64),
    time: z.string().max(32).default(""),
    foods: z.array(z.object({
      foodName: z.string().trim().min(1).max(128),
      servingGrams: z.number().min(0).max(5000),
      calories: z.number().min(0).max(10000),
      protein: z.number().min(0).max(1000),
      carbs: z.number().min(0).max(1000),
      fat: z.number().min(0).max(1000),
    })).max(20),
    notes: z.string().max(500).default(""),
  })).max(5),
  notes: z.string().max(2000).default(""),
});

// ── Helpers ─────────────────────────────────────────────────────────

async function requireDb() {
  const db = await getDb();
  if (!db) throw new LinkError("database_unavailable", 503, "Temporarily unavailable.");
  return db;
}

async function userById(id: number) {
  const db = await requireDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/** MariaDB hands JSON columns back as text through mysql2; MySQL 8 as objects. */
function parseJson<T>(v: unknown): T {
  return (typeof v === "string" ? JSON.parse(v) : v) as T;
}

function toWorkoutPlan(row: typeof coachWorkoutPlans.$inferSelect, coachName: string): CoachWorkoutPlan {
  const body = parseJson<CoachWorkoutPlanBody>(row.planJson);
  return {
    ...body,
    id: row.id, trainerId: row.trainerId, traineeId: row.traineeId, coachName,
    status: row.status, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

function toMealPlan(row: typeof coachMealPlans.$inferSelect, coachName: string): CoachMealPlan {
  const body = parseJson<CoachMealPlanBody>(row.planJson);
  return {
    ...body,
    id: row.id, trainerId: row.trainerId, traineeId: row.traineeId, coachName,
    status: row.status, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Plans (coach writes) ────────────────────────────────────────────

export async function assignWorkoutPlan(trainer: { id: number; name: string | null }, traineeId: number, plan: CoachWorkoutPlanBody) {
  await assertCanCoach(trainer.id, traineeId);
  const db = await requireDb();
  await db.update(coachWorkoutPlans)
    .set({ status: "archived" })
    .where(and(eq(coachWorkoutPlans.trainerId, trainer.id), eq(coachWorkoutPlans.traineeId, traineeId), eq(coachWorkoutPlans.status, "active")));
  const id = newId();
  await db.insert(coachWorkoutPlans).values({ id, trainerId: trainer.id, traineeId, name: plan.name, planJson: plan, status: "active" });
  const rows = await db.select().from(coachWorkoutPlans).where(eq(coachWorkoutPlans.id, id)).limit(1);
  return toWorkoutPlan(rows[0], trainer.name ?? "Coach");
}

export async function assignMealPlan(trainer: { id: number; name: string | null }, traineeId: number, plan: CoachMealPlanBody) {
  await assertCanCoach(trainer.id, traineeId);
  const db = await requireDb();
  await db.update(coachMealPlans)
    .set({ status: "archived" })
    .where(and(eq(coachMealPlans.trainerId, trainer.id), eq(coachMealPlans.traineeId, traineeId), eq(coachMealPlans.status, "active")));
  const id = newId();
  await db.insert(coachMealPlans).values({ id, trainerId: trainer.id, traineeId, name: plan.name, planJson: plan, status: "active" });
  const rows = await db.select().from(coachMealPlans).where(eq(coachMealPlans.id, id)).limit(1);
  return toMealPlan(rows[0], trainer.name ?? "Coach");
}

/** Coach-side read of what they assigned to one trainee. */
export async function plansForTraineeAsCoach(trainerId: number, traineeId: number) {
  await assertCanCoach(trainerId, traineeId);
  const trainer = await userById(trainerId);
  const coachName = trainer?.name ?? "Coach";
  const db = await requireDb();
  const w = await db.select().from(coachWorkoutPlans)
    .where(and(eq(coachWorkoutPlans.trainerId, trainerId), eq(coachWorkoutPlans.traineeId, traineeId), eq(coachWorkoutPlans.status, "active")))
    .orderBy(desc(coachWorkoutPlans.createdAt)).limit(1);
  const m = await db.select().from(coachMealPlans)
    .where(and(eq(coachMealPlans.trainerId, trainerId), eq(coachMealPlans.traineeId, traineeId), eq(coachMealPlans.status, "active")))
    .orderBy(desc(coachMealPlans.createdAt)).limit(1);
  return {
    workoutPlan: w[0] ? toWorkoutPlan(w[0], coachName) : null,
    mealPlan: m[0] ? toMealPlan(m[0], coachName) : null,
  };
}

/**
 * Trainee-side read: the active plans addressed to me, but ONLY from coaches
 * I am still linked to. A revoked coach's plan stops being delivered.
 */
export async function myPlans(traineeId: number) {
  const db = await requireDb();
  const links = await db.select({ trainerId: trainerTrainees.trainerId, name: users.name })
    .from(trainerTrainees)
    .innerJoin(users, eq(users.id, trainerTrainees.trainerId))
    .where(and(eq(trainerTrainees.traineeId, traineeId), eq(trainerTrainees.status, "active")));
  if (links.length === 0) return { workoutPlan: null, mealPlan: null };
  const trainerIds = links.map((l) => l.trainerId);
  const nameOf = new Map(links.map((l) => [l.trainerId, l.name ?? "Coach"]));

  const w = await db.select().from(coachWorkoutPlans)
    .where(and(eq(coachWorkoutPlans.traineeId, traineeId), eq(coachWorkoutPlans.status, "active"), inArray(coachWorkoutPlans.trainerId, trainerIds)))
    .orderBy(desc(coachWorkoutPlans.createdAt)).limit(1);
  const m = await db.select().from(coachMealPlans)
    .where(and(eq(coachMealPlans.traineeId, traineeId), eq(coachMealPlans.status, "active"), inArray(coachMealPlans.trainerId, trainerIds)))
    .orderBy(desc(coachMealPlans.createdAt)).limit(1);
  return {
    workoutPlan: w[0] ? toWorkoutPlan(w[0], nameOf.get(w[0].trainerId) ?? "Coach") : null,
    mealPlan: m[0] ? toMealPlan(m[0], nameOf.get(m[0].trainerId) ?? "Coach") : null,
  };
}

// ── Messages ────────────────────────────────────────────────────────

async function assertCanMessage(a: number, b: number) {
  if (a === b) throw new LinkError("self_message", 400, "You cannot message yourself.");
  if (!(await canCoach(a, b)) && !(await canCoach(b, a))) {
    throw new LinkError("not_linked", 403, "You are not linked to this person.");
  }
}

export async function sendMessage(senderId: number, recipientId: number, body: string): Promise<CoachMessage> {
  const text = body.trim();
  if (!text) throw new LinkError("empty", 400, "Write something first.");
  if (text.length > 4000) throw new LinkError("too_long", 400, "Message is too long.");
  await assertCanMessage(senderId, recipientId);
  const db = await requireDb();
  const id = newId();
  await db.insert(coachMessages).values({ id, senderId, recipientId, body: text, createdAt: new Date() });
  const rows = await db.select().from(coachMessages).where(eq(coachMessages.id, id)).limit(1);
  const r = rows[0];
  return { id: r.id, senderId: r.senderId, recipientId: r.recipientId, body: r.body, createdAt: r.createdAt.toISOString(), readAt: null };
}

/** Both directions between me and one peer, oldest first. Marks their messages to me as read. */
export async function thread(me: number, peerId: number, limit = 200): Promise<CoachMessage[]> {
  const db = await requireDb();
  // History stays readable after a revoke, but a stranger gets nothing:
  // the query is scoped to rows where I am sender or recipient.
  const rows = await db.select().from(coachMessages)
    .where(or(
      and(eq(coachMessages.senderId, me), eq(coachMessages.recipientId, peerId)),
      and(eq(coachMessages.senderId, peerId), eq(coachMessages.recipientId, me)),
    ))
    .orderBy(desc(coachMessages.createdAt)).limit(limit);
  await db.update(coachMessages)
    .set({ readAt: new Date() })
    .where(and(eq(coachMessages.senderId, peerId), eq(coachMessages.recipientId, me), isNull(coachMessages.readAt)));
  return rows.reverse().map((r) => ({
    id: r.id, senderId: r.senderId, recipientId: r.recipientId, body: r.body,
    createdAt: r.createdAt.toISOString(), readAt: r.readAt ? r.readAt.toISOString() : null,
  }));
}

export async function unreadCount(me: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ c: sql<number>`count(*)` }).from(coachMessages)
    .where(and(eq(coachMessages.recipientId, me), isNull(coachMessages.readAt)));
  return Number(rows[0]?.c ?? 0);
}

/** One row per active link partner (trainee for a coach, coach for a trainee). */
export async function threads(me: number, iAmCoach: boolean): Promise<CoachThread[]> {
  const db = await requireDb();
  const peerCol = iAmCoach ? trainerTrainees.traineeId : trainerTrainees.trainerId;
  const meCol = iAmCoach ? trainerTrainees.trainerId : trainerTrainees.traineeId;
  const links = await db.select({ peerId: peerCol, name: users.name, email: users.email })
    .from(trainerTrainees)
    .innerJoin(users, eq(users.id, peerCol))
    .where(and(eq(meCol, me), eq(trainerTrainees.status, "active")));

  const out: CoachThread[] = [];
  for (const l of links) {
    const last = await db.select().from(coachMessages)
      .where(or(
        and(eq(coachMessages.senderId, me), eq(coachMessages.recipientId, l.peerId)),
        and(eq(coachMessages.senderId, l.peerId), eq(coachMessages.recipientId, me)),
      ))
      .orderBy(desc(coachMessages.createdAt)).limit(1);
    const unread = await db.select({ c: sql<number>`count(*)` }).from(coachMessages)
      .where(and(eq(coachMessages.senderId, l.peerId), eq(coachMessages.recipientId, me), isNull(coachMessages.readAt)));
    out.push({
      peerId: l.peerId, peerName: l.name ?? "", peerEmail: l.email ?? null,
      lastMessage: last[0]?.body ?? null, lastAt: last[0]?.createdAt.toISOString() ?? null,
      unread: Number(unread[0]?.c ?? 0),
    });
  }
  out.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return out;
}

// ── Progress (coach reads a trainee) ────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function traineeProgress(trainerId: number, traineeId: number): Promise<TraineeProgress> {
  await assertCanCoach(trainerId, traineeId);
  const trainee = await userById(traineeId);
  if (!trainee) throw new LinkError("not_found", 404, "Athlete not found.");
  const db = await requireDb();
  const openId = trainee.openId;
  const photosShared = await canSeePhotos(trainerId, traineeId);

  const sessions = await db.select().from(workoutSessions)
    .where(and(eq(workoutSessions.userOpenId, openId), gte(workoutSessions.date, daysAgo(60))))
    .orderBy(desc(workoutSessions.date)).limit(60);
  const workouts = [];
  for (const s of sessions) {
    const ex = await db.select({ c: sql<number>`count(*)` }).from(workoutExerciseLogs).where(eq(workoutExerciseLogs.sessionId, s.id));
    workouts.push({
      id: s.id, date: s.date, sessionType: s.sessionType, completed: s.completed,
      durationMinutes: s.durationMinutes ?? null,
      totalVolumeKg: s.totalVolumeKg != null ? Number(s.totalVolumeKg) : null,
      exerciseCount: Number(ex[0]?.c ?? 0),
    });
  }
  const d7 = daysAgo(7), d30 = daysAgo(30);
  const workoutsLast7 = workouts.filter((w) => w.completed && w.date >= d7).length;
  const workoutsLast30 = workouts.filter((w) => w.completed && w.date >= d30).length;

  const bw = await db.select().from(bodyWeightEntries)
    .where(eq(bodyWeightEntries.userOpenId, openId)).orderBy(desc(bodyWeightEntries.date)).limit(30);
  const bodyWeight = bw.map((b) => ({
    date: b.date, weightKg: b.weightKg != null ? Number(b.weightKg) : null,
    bodyFatPercent: b.bodyFatPercent != null ? Number(b.bodyFatPercent) : null,
  })).reverse();

  const days = await db.select().from(nutritionDays)
    .where(and(eq(nutritionDays.userOpenId, openId), gte(nutritionDays.date, daysAgo(14))))
    .orderBy(desc(nutritionDays.date)).limit(14);
  const nutrition = [];
  for (const d of days) {
    const foods = await db.select().from(foodEntries).where(eq(foodEntries.nutritionDayId, d.id));
    const tot = foods.reduce((a, f) => ({
      calories: a.calories + Number(f.calories), protein: a.protein + Number(f.protein),
      carbs: a.carbs + Number(f.carbs), fat: a.fat + Number(f.fat),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    nutrition.push({
      date: d.date, targetCalories: d.targetCalories ?? null, targetProtein: d.targetProtein ?? null,
      calories: Math.round(tot.calories), protein: Math.round(tot.protein), carbs: Math.round(tot.carbs), fat: Math.round(tot.fat),
      mealCount: foods.length,
    });
  }

  const prs = await db.select().from(personalRecords)
    .where(eq(personalRecords.userOpenId, openId)).orderBy(desc(personalRecords.date)).limit(12);
  const streakRows = await db.select().from(workoutStreaks).where(eq(workoutStreaks.userOpenId, openId)).limit(1);
  const plans = await plansForTraineeAsCoach(trainerId, traineeId);

  return {
    trainee: { id: trainee.id, name: trainee.name ?? "", email: trainee.email ?? null, photosShared },
    workouts, workoutsLast7, workoutsLast30, bodyWeight, nutrition,
    personalRecords: prs.map((p) => ({ exerciseName: p.exerciseName, weightKg: Number(p.weightKg), reps: p.reps, date: p.date })),
    streak: streakRows[0]
      ? { currentStreak: streakRows[0].currentStreak, bestStreak: streakRows[0].bestStreak, lastWorkoutDate: streakRows[0].lastWorkoutDate ?? null }
      : null,
    activeWorkoutPlan: plans.workoutPlan ? { id: plans.workoutPlan.id, name: plans.workoutPlan.name, createdAt: plans.workoutPlan.createdAt } : null,
    activeMealPlan: plans.mealPlan ? { id: plans.mealPlan.id, name: plans.mealPlan.name, createdAt: plans.mealPlan.createdAt } : null,
  };
}

/** Roster enriched with the signals a coach scans first. */
export async function rosterOverview(trainerId: number) {
  const db = await requireDb();
  const links = await db.select({
    linkId: trainerTrainees.id, userId: users.id, openId: users.openId, name: users.name, email: users.email,
    photosSharedAt: trainerTrainees.photosSharedAt, since: trainerTrainees.createdAt,
  }).from(trainerTrainees)
    .innerJoin(users, eq(users.id, trainerTrainees.traineeId))
    .where(and(eq(trainerTrainees.trainerId, trainerId), eq(trainerTrainees.status, "active")));

  const out = [];
  for (const l of links) {
    const last = await db.select({ date: workoutSessions.date }).from(workoutSessions)
      .where(and(eq(workoutSessions.userOpenId, l.openId), eq(workoutSessions.completed, true)))
      .orderBy(desc(workoutSessions.date)).limit(1);
    const wk = await db.select({ c: sql<number>`count(*)` }).from(workoutSessions)
      .where(and(eq(workoutSessions.userOpenId, l.openId), eq(workoutSessions.completed, true), gte(workoutSessions.date, daysAgo(7))));
    const unread = await db.select({ c: sql<number>`count(*)` }).from(coachMessages)
      .where(and(eq(coachMessages.senderId, l.userId), eq(coachMessages.recipientId, trainerId), isNull(coachMessages.readAt)));
    const wp = await db.select({ name: coachWorkoutPlans.name }).from(coachWorkoutPlans)
      .where(and(eq(coachWorkoutPlans.trainerId, trainerId), eq(coachWorkoutPlans.traineeId, l.userId), eq(coachWorkoutPlans.status, "active"))).limit(1);
    const mp = await db.select({ name: coachMealPlans.name }).from(coachMealPlans)
      .where(and(eq(coachMealPlans.trainerId, trainerId), eq(coachMealPlans.traineeId, l.userId), eq(coachMealPlans.status, "active"))).limit(1);
    out.push({
      linkId: l.linkId, userId: l.userId, name: l.name ?? "", email: l.email ?? null,
      photosShared: l.photosSharedAt != null, since: (l.since ?? new Date()).toISOString(),
      lastWorkoutDate: last[0]?.date ?? null, workoutsLast7: Number(wk[0]?.c ?? 0),
      unread: Number(unread[0]?.c ?? 0),
      workoutPlanName: wp[0]?.name ?? null, mealPlanName: mp[0]?.name ?? null,
    });
  }
  return out;
}
