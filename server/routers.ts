import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as trainerLink from "./trainer-link-service";
import * as coachSvc from "./coach-service";
import * as push from "./push-service";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as whoopService from "./whoopService";
import * as whoopStateDb from "./whoopStateDb";
import * as whoopDb from "./whoopDb";
import * as aiCoach from "./ai-coaching-service";
import * as zaki from "./zakiService";
import * as zakiProgram from "./zakiProgramService";
import * as zakiDigest from "./zakiDailyDigest";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { checkAndNotifyStagnation } from "./stagnationScheduler";
import { ENV } from './_core/env';
import { transcribeAudio } from './_core/voiceTranscription';
import * as dataSync from "./data-sync-service";
import * as db from "./db";
import { lookupHowto } from "./exerciseHowto";
import * as pinIdentity from "./pin-identity-service";

// All WHOOP and sync procedures use a device-level identifier (deviceId) instead of
// requiring user authentication. The app generates a persistent UUID on first launch
// and passes it with every request. This allows the app to work fully offline-first
// without requiring user accounts.

const deviceIdInput = z.object({ deviceId: z.string().min(1) });


/** Surfaces LinkError codes as tRPC errors instead of opaque 500s. */
async function wrapLink<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof trainerLink.LinkError) {
      const map: Record<number, "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "PRECONDITION_FAILED" | "INTERNAL_SERVER_ERROR"> = {
        400: "BAD_REQUEST", 403: "FORBIDDEN", 404: "NOT_FOUND",
        409: "CONFLICT", 410: "PRECONDITION_FAILED", 503: "INTERNAL_SERVER_ERROR",
      };
      throw new TRPCError({ code: map[error.status] ?? "INTERNAL_SERVER_ERROR", message: error.message });
    }
    throw error;
  }
}

export const appRouter = router({
  system: systemRouter,
  // Trainer ↔ trainee link. Every procedure is protected and takes its actor
  // from ctx.user — never from the request body. Passing someone else's id is
  // not a supported operation, it is simply impossible here.
  trainerLink: router({
    createInvite: protectedProcedure.mutation(async ({ ctx }) => {
      return wrapLink(() => trainerLink.createInvite({ id: ctx.user.id, role: ctx.user.role }));
    }),

    redeem: protectedProcedure
      .input(z.object({ code: z.string().min(1).max(16) }))
      .mutation(async ({ ctx, input }) => {
        return wrapLink(() => trainerLink.redeemInvite(input.code, { id: ctx.user.id }));
      }),

    myTrainees: protectedProcedure.query(async ({ ctx }) => {
      return wrapLink(() => trainerLink.listTrainees(ctx.user.id));
    }),

    myTrainers: protectedProcedure.query(async ({ ctx }) => {
      return wrapLink(() => trainerLink.listTrainers(ctx.user.id));
    }),

    revoke: protectedProcedure
      .input(z.object({ linkId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        return wrapLink(() => trainerLink.revokeLink(ctx.user.id, input.linkId));
      }),

    setPhotoConsent: protectedProcedure
      .input(z.object({ linkId: z.string().min(1).max(64), shared: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return wrapLink(() => trainerLink.setPhotoConsent(ctx.user.id, input.linkId, input.shared));
      }),
  }),

  // Coach ↔ trainee: plans, meals, messages, progress. Actor always from ctx.
  coach: router({
    // — coach side —
    roster: protectedProcedure.query(async ({ ctx }) => {
      return wrapLink(() => coachSvc.rosterOverview(ctx.user.id));
    }),
    traineeProgress: protectedProcedure
      .input(z.object({ traineeId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return wrapLink(() => coachSvc.traineeProgress(ctx.user.id, input.traineeId));
      }),
    traineePlans: protectedProcedure
      .input(z.object({ traineeId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return wrapLink(() => coachSvc.plansForTraineeAsCoach(ctx.user.id, input.traineeId));
      }),
    assignWorkoutPlan: protectedProcedure
      .input(z.object({ traineeId: z.number().int().positive(), plan: coachSvc.workoutPlanSchema }))
      .mutation(async ({ ctx, input }) => {
        return wrapLink(() => coachSvc.assignWorkoutPlan({ id: ctx.user.id, name: ctx.user.name }, input.traineeId, input.plan));
      }),
    assignMealPlan: protectedProcedure
      .input(z.object({ traineeId: z.number().int().positive(), plan: coachSvc.mealPlanSchema }))
      .mutation(async ({ ctx, input }) => {
        return wrapLink(() => coachSvc.assignMealPlan({ id: ctx.user.id, name: ctx.user.name }, input.traineeId, input.plan));
      }),
    // — trainee side —
    myPlans: protectedProcedure.query(async ({ ctx }) => {
      return wrapLink(() => coachSvc.myPlans(ctx.user.id));
    }),
    // — both sides —
    threads: protectedProcedure.query(async ({ ctx }) => {
      const iAmCoach = ctx.user.role === "trainer" || ctx.user.role === "admin";
      return wrapLink(() => coachSvc.threads(ctx.user.id, iAmCoach));
    }),
    thread: protectedProcedure
      .input(z.object({ peerId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return wrapLink(() => coachSvc.thread(ctx.user.id, input.peerId));
      }),
    sendMessage: protectedProcedure
      .input(z.object({ peerId: z.number().int().positive(), body: z.string().min(1).max(4000) }))
      .mutation(async ({ ctx, input }) => {
        return wrapLink(() => coachSvc.sendMessage(ctx.user.id, input.peerId, input.body));
      }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return coachSvc.unreadCount(ctx.user.id);
    }),
    // — coach only: private notes + broadcast —
    notes: protectedProcedure
      .input(z.object({ traineeId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return wrapLink(() => coachSvc.listNotes(ctx.user.id, input.traineeId));
      }),
    addNote: protectedProcedure
      .input(z.object({ traineeId: z.number().int().positive(), body: z.string().min(1).max(2000) }))
      .mutation(async ({ ctx, input }) => {
        return wrapLink(() => coachSvc.addNote(ctx.user.id, input.traineeId, input.body));
      }),
    deleteNote: protectedProcedure
      .input(z.object({ noteId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        return wrapLink(() => coachSvc.deleteNote(ctx.user.id, input.noteId));
      }),
    broadcast: protectedProcedure
      .input(z.object({ body: z.string().min(1).max(4000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "trainer" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only a coach can broadcast." });
        }
        return wrapLink(() => coachSvc.broadcast(ctx.user.id, input.body));
      }),
  }),

  // Device push tokens. The token is bound to the calling user; a phone that
  // changes accounts simply re-registers under the new one.
  push: router({
    register: protectedProcedure
      .input(z.object({ token: z.string().min(10).max(255), platform: z.enum(["android", "ios", "web"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!push.isExpoPushToken(input.token)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Not an Expo push token." });
        }
        return push.registerToken(ctx.user.id, input.token, input.platform);
      }),
    unregister: protectedProcedure
      .input(z.object({ token: z.string().min(10).max(255) }))
      .mutation(async ({ ctx, input }) => {
        return push.unregisterToken(ctx.user.id, input.token);
      }),
  }),

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── WHOOP Integration ─────────────────────────────────────
  whoop: router({
    // Get WHOOP connection status
    status: protectedProcedure
      .input(deviceIdInput)
      .query(async ({ input }) => {
        const stored = await whoopDb.getWhoopTokens(input.deviceId);
        const connected = stored !== null;
        const tokenExpired = connected && stored!.expiresAt < Date.now() + 5 * 60 * 1000;
        let profile: Record<string, unknown> | null = null;
        if (connected && !tokenExpired) {
          try {
            profile = await whoopService.getProfile(input.deviceId) as Record<string, unknown>;
          } catch {
            // Profile fetch may fail (e.g. expired token), still show as connected
          }
        }
        return { connected, tokenExpired, profile };
      }),

    // Start OAuth flow - returns auth URL
    authUrl: protectedProcedure
      .input(deviceIdInput)
      .query(async ({ input }) => {
        const state = await whoopStateDb.createState(input.deviceId);
        const url = whoopService.buildAuthUrl(state);
        return { url };
      }),

    // Exchange OAuth code for tokens
    callback: protectedProcedure
      .input(z.object({ code: z.string(), state: z.string() }))
      .mutation(async ({ input }) => {
        const stateResult = await whoopStateDb.validateAndConsumeState(input.state);
        if (!stateResult.valid || !stateResult.userOpenId) {
          throw new Error("Invalid or expired OAuth state");
        }
        const result = await whoopService.exchangeCodeForTokens(
          input.code,
          stateResult.userOpenId,
        );
        return result;
      }),

    // Disconnect WHOOP
    disconnect: protectedProcedure
      .input(deviceIdInput)
      .mutation(async ({ input }) => {
        await whoopService.disconnect(input.deviceId);
        return { success: true };
      }),

    // Get recovery data (latest + history)
    recovery: protectedProcedure
      .input(deviceIdInput.extend({ days: z.number().min(1).max(30).default(7).optional() }))
      .query(async ({ input }) => {
        const days = input.days ?? 7;
        try {
          const data = await whoopService.getRecoveryCollection(input.deviceId, days);
          console.log('[WHOOP DEBUG] recovery raw:', JSON.stringify(data).slice(0, 3000));
          await whoopDb.saveWhoopCache(input.deviceId, {
            recoveryJson: JSON.stringify(data),
          });
          if (data?.records) {
            for (const record of data.records) {
              if (record.score) {
                const date = record.created_at?.split("T")[0] || new Date().toISOString().split("T")[0];
                await whoopDb.upsertRecoveryHistory({
                  userOpenId: input.deviceId,
                  date,
                  recoveryScore: Math.round(record.score.recovery_score ?? 0),
                  hrv: Math.round(record.score.hrv_rmssd_milli ?? 0),
                  rhr: Math.round(record.score.resting_heart_rate ?? 0),
                  spo2: record.score.spo2_percentage ? Math.round(record.score.spo2_percentage) : null,
                  strainX10: null,
                  sleepPerformance: null,
                });
              }
            }
          }
          return data;
        } catch (error) {
          const cached = await whoopDb.getWhoopCache(input.deviceId);
          if (cached?.recoveryJson) {
            return { ...JSON.parse(cached.recoveryJson), cached: true };
          }
          throw error;
        }
      }),

    // Get sleep data
    sleep: protectedProcedure
      .input(deviceIdInput.extend({ days: z.number().min(1).max(30).default(7).optional() }))
      .query(async ({ input }) => {
        const days = input.days ?? 7;
        try {
          const data = await whoopService.getSleepCollection(input.deviceId, days);
          console.log('[WHOOP DEBUG] sleep raw:', JSON.stringify(data).slice(0, 3000));
          await whoopDb.saveWhoopCache(input.deviceId, { sleepJson: JSON.stringify(data) });
          return data;
        } catch (error) {
          const cached = await whoopDb.getWhoopCache(input.deviceId);
          if (cached?.sleepJson) return { ...JSON.parse(cached.sleepJson), cached: true };
          throw error;
        }
      }),

    // Get strain/cycle data
    cycles: protectedProcedure
      .input(deviceIdInput.extend({ days: z.number().min(1).max(30).default(7).optional() }))
      .query(async ({ input }) => {
        const days = input.days ?? 7;
        try {
          const data = await whoopService.getCycleCollection(input.deviceId, days);
          await whoopDb.saveWhoopCache(input.deviceId, { cycleJson: JSON.stringify(data) });
          return data;
        } catch (error) {
          const cached = await whoopDb.getWhoopCache(input.deviceId);
          if (cached?.cycleJson) return { ...JSON.parse(cached.cycleJson), cached: true };
          throw error;
        }
      }),

    // Get workout data
    workouts: protectedProcedure
      .input(deviceIdInput.extend({ limit: z.number().min(1).max(50).default(10).optional() }))
      .query(async ({ input }) => {
        const limit = input.limit ?? 10;
        try {
          const data = await whoopService.getWorkoutCollection(input.deviceId, limit);
          await whoopDb.saveWhoopCache(input.deviceId, { workoutJson: JSON.stringify(data) });
          return data;
        } catch (error) {
          const cached = await whoopDb.getWhoopCache(input.deviceId);
          if (cached?.workoutJson) return { ...JSON.parse(cached.workoutJson), cached: true };
          throw error;
        }
      }),

    // Get body measurement
    bodyMeasurement: protectedProcedure
      .input(deviceIdInput)
      .query(async ({ input }) => {
        return whoopService.getBodyMeasurement(input.deviceId);
      }),

    // Get recovery history from DB
    recoveryHistory: protectedProcedure
      .input(deviceIdInput.extend({ days: z.number().min(1).max(90).default(7).optional() }))
      .query(async ({ input }) => {
        const days = input.days ?? 7;
        return whoopDb.getRecoveryHistory(input.deviceId, days);
      }),
  }),

  // ── Data Sync (Cloud Persistence) ────────────────────────
  sync: router({
    upsertWorkout: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        session: z.object({
          id: z.string(),
          date: z.string(),
          sessionType: z.string(),
          startTime: z.string(),
          endTime: z.string().optional(),
          completed: z.boolean(),
          durationMinutes: z.number().optional(),
          totalVolumeKg: z.number().optional(),
          exercises: z.array(z.object({
            exerciseName: z.string(),
            exerciseOrder: z.number(),
            skipped: z.boolean(),
            skipReason: z.string().optional(),
            sets: z.array(z.object({
              setNumber: z.number(),
              weightKg: z.number(),
              reps: z.number(),
              rpe: z.number().optional(),
              isWarmup: z.boolean().optional(),
              e1rm: z.number().optional(),
              timestamp: z.string().optional(),
            })),
          })),
        }).passthrough(),
      }))
      .mutation(async ({ ctx, input }) => {
        await dataSync.upsertWorkoutSession(ctx.user.openId, input.session);
        return { success: true };
      }),

    getWorkouts: protectedProcedure
      .input(deviceIdInput.extend({ limit: z.number().min(1).max(200).default(50).optional() }))
      .query(async ({ ctx, input }) => {
        return dataSync.getWorkoutSessions(ctx.user.openId, input.limit ?? 50);
      }),

    bulkUpsertWorkouts: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        sessions: z.array(z.object({
          id: z.string(),
          date: z.string(),
          sessionType: z.string(),
          startTime: z.string(),
          endTime: z.string().optional(),
          completed: z.boolean(),
          durationMinutes: z.number().optional(),
          totalVolumeKg: z.number().optional(),
          exercises: z.array(z.object({
            exerciseName: z.string(),
            exerciseOrder: z.number(),
            skipped: z.boolean(),
            skipReason: z.string().optional(),
            sets: z.array(z.object({
              setNumber: z.number(),
              weightKg: z.number(),
              reps: z.number(),
              rpe: z.number().optional(),
              isWarmup: z.boolean().optional(),
              e1rm: z.number().optional(),
              timestamp: z.string().optional(),
            })),
          })),
        }).passthrough()),
      }))
      .mutation(async ({ ctx, input }) => {
        const count = await dataSync.bulkUpsertWorkoutSessions(ctx.user.openId, input.sessions);
        return { count };
      }),

    upsertFormCoach: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        session: z.object({
          id: z.string(),
          exerciseName: z.string(),
          date: z.string(),
          totalReps: z.number(),
          avgFormScore: z.number().optional(),
          peakFormScore: z.number().optional(),
          issues: z.array(z.string()).optional(),
          durationSeconds: z.number().optional(),
        }).passthrough(),
      }))
      .mutation(async ({ ctx, input }) => {
        await dataSync.upsertFormCoachSession(ctx.user.openId, input.session);
        return { success: true };
      }),

    getFormCoachSessions: protectedProcedure
      .input(deviceIdInput.extend({ limit: z.number().min(1).max(100).default(50).optional() }))
      .query(async ({ ctx, input }) => {
        return dataSync.getFormCoachSessions(ctx.user.openId, input.limit ?? 50);
      }),

    bulkUpsertFormCoach: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        sessions: z.array(z.object({
          id: z.string(),
          exerciseName: z.string(),
          date: z.string(),
          totalReps: z.number(),
          avgFormScore: z.number().optional(),
          peakFormScore: z.number().optional(),
          issues: z.array(z.string()).optional(),
          durationSeconds: z.number().optional(),
        }).passthrough()),
      }))
      .mutation(async ({ ctx, input }) => {
        let count = 0;
        for (const s of input.sessions) {
          await dataSync.upsertFormCoachSession(ctx.user.openId, s);
          count++;
        }
        return { count };
      }),

    upsertNutritionDay: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        day: z.object({
          date: z.string(),
          isTrainingDay: z.boolean(),
          targetCalories: z.number().optional(),
          targetProtein: z.number().optional(),
          targetCarbs: z.number().optional(),
          targetFat: z.number().optional(),
          supplements: z.array(z.object({
            name: z.string(),
            dose: z.string(),
            timing: z.string(),
            taken: z.boolean(),
          })).optional(),
          meals: z.array(z.object({
            id: z.string(),
            mealNumber: z.number(),
            foodName: z.string(),
            protein: z.number(),
            carbs: z.number(),
            fat: z.number(),
            calories: z.number(),
            servingGrams: z.number().optional(),
            timestamp: z.string().optional(),
          })),
        }).passthrough(),
      }))
      .mutation(async ({ ctx, input }) => {
        await dataSync.upsertNutritionDay(ctx.user.openId, input.day);
        return { success: true };
      }),

    getNutritionDays: protectedProcedure
      .input(deviceIdInput.extend({ days: z.number().min(1).max(365).default(30).optional() }))
      .query(async ({ ctx, input }) => {
        return dataSync.getNutritionDays(ctx.user.openId, input.days ?? 30);
      }),

    bulkUpsertNutrition: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        days: z.array(z.object({
          date: z.string(),
          isTrainingDay: z.boolean(),
          targetCalories: z.number().optional(),
          targetProtein: z.number().optional(),
          targetCarbs: z.number().optional(),
          targetFat: z.number().optional(),
          supplements: z.array(z.object({
            name: z.string(),
            dose: z.string(),
            timing: z.string(),
            taken: z.boolean(),
          })).optional(),
          meals: z.array(z.object({
            id: z.string(),
            mealNumber: z.number(),
            foodName: z.string(),
            protein: z.number(),
            carbs: z.number(),
            fat: z.number(),
            calories: z.number(),
            servingGrams: z.number().optional(),
            timestamp: z.string().optional(),
          })),
        }).passthrough()),
      }))
      .mutation(async ({ ctx, input }) => {
        let count = 0;
        for (const d of input.days) {
          await dataSync.upsertNutritionDay(ctx.user.openId, d);
          count++;
        }
        return { count };
      }),

    upsertBodyWeight: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        entry: z.object({
          id: z.string(),
          date: z.string(),
          weightKg: z.number().optional(),
          bodyFatPercent: z.number().optional(),
          chestCm: z.number().optional(),
          waistCm: z.number().optional(),
          hipsCm: z.number().optional(),
          armsCm: z.number().optional(),
          thighsCm: z.number().optional(),
          notes: z.string().optional(),
        }).passthrough(),
      }))
      .mutation(async ({ ctx, input }) => {
        await dataSync.upsertBodyWeightEntry(ctx.user.openId, input.entry);
        return { success: true };
      }),

    getBodyWeightEntries: protectedProcedure
      .input(deviceIdInput.extend({ limit: z.number().min(1).max(365).default(90).optional() }))
      .query(async ({ ctx, input }) => {
        return dataSync.getBodyWeightEntries(ctx.user.openId, input.limit ?? 90);
      }),

    bulkUpsertBodyWeight: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        entries: z.array(z.object({
          id: z.string(),
          date: z.string(),
          weightKg: z.number().optional(),
          bodyFatPercent: z.number().optional(),
          chestCm: z.number().optional(),
          waistCm: z.number().optional(),
          hipsCm: z.number().optional(),
          armsCm: z.number().optional(),
          thighsCm: z.number().optional(),
          notes: z.string().optional(),
        }).passthrough()),
      }))
      .mutation(async ({ ctx, input }) => {
        let count = 0;
        for (const e of input.entries) {
          await dataSync.upsertBodyWeightEntry(ctx.user.openId, e);
          count++;
        }
        return { count };
      }),

    upsertSleep: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        entry: z.object({
          id: z.string(),
          date: z.string(),
          bedtime: z.string().optional(),
          wakeTime: z.string().optional(),
          durationHours: z.number().optional(),
          qualityRating: z.number().optional(),
          notes: z.string().optional(),
        }).passthrough(),
      }))
      .mutation(async ({ ctx, input }) => {
        await dataSync.upsertSleepEntry(ctx.user.openId, input.entry);
        return { success: true };
      }),

    getSleepEntries: protectedProcedure
      .input(deviceIdInput.extend({ limit: z.number().min(1).max(90).default(30).optional() }))
      .query(async ({ ctx, input }) => {
        return dataSync.getSleepEntries(ctx.user.openId, input.limit ?? 30);
      }),

    bulkUpsertSleep: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        entries: z.array(z.object({
          id: z.string(),
          date: z.string(),
          bedtime: z.string().optional(),
          wakeTime: z.string().optional(),
          durationHours: z.number().optional(),
          qualityRating: z.number().optional(),
          notes: z.string().optional(),
        }).passthrough()),
      }))
      .mutation(async ({ ctx, input }) => {
        let count = 0;
        for (const e of input.entries) {
          await dataSync.upsertSleepEntry(ctx.user.openId, e);
          count++;
        }
        return { count };
      }),

    upsertStreak: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        streak: z.object({
          currentStreak: z.number(),
          bestStreak: z.number(),
          lastWorkoutDate: z.string().nullable(),
          workoutDates: z.array(z.string()),
        }).passthrough(),
      }))
      .mutation(async ({ ctx, input }) => {
        await dataSync.upsertStreak(ctx.user.openId, input.streak);
        return { success: true };
      }),

    getStreak: protectedProcedure
      .input(deviceIdInput)
      .query(async ({ ctx, input }) => {
        return dataSync.getStreak(ctx.user.openId);
      }),

    upsertPersonalRecord: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        pr: z.object({
          exerciseName: z.string(),
          weightKg: z.number(),
          reps: z.number(),
          estimated1rm: z.number().optional(),
          sessionType: z.string().optional(),
          date: z.string(),
          sessionId: z.string().optional(),
        }).passthrough(),
      }))
      .mutation(async ({ ctx, input }) => {
        await dataSync.upsertPersonalRecord(ctx.user.openId, input.pr);
        return { success: true };
      }),

    getPersonalRecords: protectedProcedure
      .input(deviceIdInput)
      .query(async ({ ctx, input }) => {
        return dataSync.getPersonalRecords(ctx.user.openId);
      }),

    upsertScheduleOverride: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        override: z.object({
          scheduleJson: z.record(z.string(), z.string()),
          description: z.string().optional(),
          appliedByZaki: z.boolean().optional(),
          weightAdjustments: z.string().optional(),
          appliedAt: z.string(),
        }).passthrough(),
      }))
      .mutation(async ({ ctx, input }) => {
        await dataSync.upsertScheduleOverride(ctx.user.openId, input.override as dataSync.SyncScheduleOverride);
        return { success: true };
      }),

    getScheduleOverride: protectedProcedure
      .input(deviceIdInput)
      .query(async ({ ctx, input }) => {
        return dataSync.getLatestScheduleOverride(ctx.user.openId);
      }),
  }),

  // ── AI Coaching ───────────────────────────────────────────
  zaki: router({
    dailyCoaching: protectedProcedure
      .input(z.object({
        recoveryScore: z.number().optional(),
        hrv: z.number().optional(),
        sleepHours: z.number().optional(),
        sleepQuality: z.number().optional(),
        todaySession: z.string().optional(),
        lastWorkout: z.object({ name: z.string(), volume: z.number(), date: z.string() }).optional(),
        recentWorkouts: z.array(z.object({ name: z.string(), volume: z.number(), date: z.string(), notes: z.string().optional() })).optional(),
        todayCalories: z.number().optional(),
        todayProtein: z.number().optional(),
        calorieTarget: z.number().optional(),
        proteinTarget: z.number().optional(),
        mesocycleWeek: z.number().optional(),
        totalWeeks: z.number().optional(),
        isDeloadWeek: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const response = await zaki.getZakiDailyCoaching(input);
        return { response };
      }),

    workoutModification: protectedProcedure
      .input(z.object({
        sessionName: z.string(),
        recoveryScore: z.number(),
        sleepHours: z.number().optional(),
        exercises: z.array(z.object({
          name: z.string(),
          sets: z.number(),
          reps: z.string(),
          weight: z.number().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const response = await zaki.getZakiWorkoutModification(input);
        return { response };
      }),

    // Chat with session continuity — pass zakiSessionId to maintain conversation context
    ask: protectedProcedure
      .input(z.object({
        message: z.string(),
        zakiSessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await zaki.askZaki(input.message, input.zakiSessionId);
        return { response: result.response, zakiSessionId: result.zakiSessionId };
      }),

    sessionDebrief: protectedProcedure
      .input(z.object({
        sessionNotesContext: z.string(),
        userContext: z.string(),
      }))
      .mutation(async ({ input }) => {
        const prompt = [
          '**SESSION DEBRIEF REQUEST — GYM TRACKER**',
          '',
          'Analyze the following workout session notes and identify patterns across sessions.',
          '',
          '--- SESSION NOTES ---',
          input.sessionNotesContext,
          '',
          '--- TRAINING CONTEXT ---',
          input.userContext,
          '',
          'Provide a structured debrief with:',
          '1. PATTERN SUMMARY (2-3 sentences synthesizing what you observe)',
          '2. PHYSICAL PATTERNS (bullet list of recurring physical sensations, pain, tightness, energy)',
          '3. MENTAL PATTERNS (bullet list of mental/motivation/focus patterns)',
          '4. COACH RECOMMENDATION (one concrete, specific action to take)',
          '5. WATCH OUT (one thing to monitor going forward)',
        ].join('\n');
        const result = await zaki.askZaki(prompt);
        return { response: result.response };
      }),

    weeklyDigest: protectedProcedure
      .input(z.object({ userContext: z.string() }))
      .mutation(async ({ input }) => {
        const prompt = [
          '**WEEKLY TRAINING DIGEST REQUEST**',
          '',
          input.userContext,
          '',
          'Give me a comprehensive weekly performance review. Include:',
          '- Overall grade (A/B/C/D/F) with brief justification',
          '- Week summary (2-3 sentences)',
          '- Top 3 strength highlights',
          '- Top 3 areas to improve',
          '- Specific plan for next week',
          '',
          'Be direct, data-driven, and actionable.',
        ].join('\n');
        const result = await zaki.askZaki(prompt);
        return { response: result.response };
      }),

    // Manually trigger the daily digest (for testing or on-demand)
    triggerDailyDigest: protectedProcedure
      .mutation(async () => {
        const result = await zakiDigest.triggerDailyDigestNow();
        return result;
      }),
    triggerStagnationCheck: protectedProcedure
      .mutation(async () => {
        const result = await checkAndNotifyStagnation();
        return result;
      }),
    // Generate a fully custom AI training program
    generateProgram: protectedProcedure
      .input(z.object({
        goal: z.string(),
        experience: z.string(),
        equipment: z.string(),
        daysPerWeek: z.number().min(2).max(6),
        weakPoints: z.string().default(''),
        injuryHistory: z.string().default(''),
        preferredExercises: z.string().default(''),
        avoidedExercises: z.string().default(''),
        recentPRs: z.string().default(''),
        bodyWeightKg: z.number().default(80),
        heightCm: z.number().default(175),
        age: z.number().default(30),
        recentWorkoutHistory: z.string().default(''),
        // Refinement loop
        refinementFeedback: z.string().optional(),
        previousProgramJson: z.string().optional(),
        refinementRound: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const program = await zakiProgram.generateZakiProgram(input);
        return { program };
      }),

    // Propose a new training schedule based on user's request and full context
    proposeSchedule: protectedProcedure
      .input(z.object({
        userRequest: z.string(),
        currentContext: z.string(),
        zakiSessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const ALL_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const SESSION_TYPES = ['upper-a','lower-a','upper-b','lower-b','rest'];

        // Build exercise weight history for the last 5 sets per exercise
        let weightHistoryContext = '';
        try {
          const ownerOpenId = ENV.ownerOpenId;
          if (ownerOpenId) {
            const sessions = await dataSync.getWorkoutSessions(ownerOpenId, 20);
            const exerciseMap: Record<string, { weight: number; reps: number }[]> = {};
            for (const session of sessions) {
              const exercises: any[] = (session as any).exercises ?? [];
              for (const ex of exercises) {
                const name: string = ex.exerciseName ?? ex.name ?? 'Unknown';
                const sets: any[] = ex.sets ?? [];
                for (const set of sets) {
                  if (!exerciseMap[name]) exerciseMap[name] = [];
                  if (exerciseMap[name].length < 5) {
                    exerciseMap[name].push({ weight: Number(set.weight ?? 0), reps: Number(set.reps ?? 0) });
                  }
                }
              }
            }
            const lines = Object.entries(exerciseMap)
              .filter(([, sets]) => sets.length > 0)
              .map(([name, sets]) => {
                const latest = sets[0];
                const avg = Math.round(sets.reduce((s, x) => s + x.weight, 0) / sets.length);
                return `  ${name}: last=${latest.weight}kg×${latest.reps}reps, avg5=${avg}kg`;
              });
            if (lines.length > 0) {
              weightHistoryContext = '\n=== EXERCISE WEIGHT HISTORY (last 5 sets each) ===\n' + lines.join('\n');
            }
          }
        } catch {}

        const prompt = [
          '=== SCHEDULE MODIFICATION REQUEST ===',
          '',
          input.currentContext,
          weightHistoryContext,
          '',
          '=== USER REQUEST ===',
          input.userRequest,
          '',
          '=== YOUR TASK ===',
          "Based on the user's full training history, WHOOP recovery data, nutrition program, and their request above,",
          'propose a new 7-day training schedule. You MUST respond with a JSON object in this EXACT format:',
          '',
          '{',
          '  "description": "<one-sentence description of the schedule>",',
          '  "rationale": "<2-3 sentences explaining why this schedule suits the user based on their data>",',
          '  "schedule": {',
          '    "Sunday": "<session_type>",',
          '    "Monday": "<session_type>",',
          '    "Tuesday": "<session_type>",',
          '    "Wednesday": "<session_type>",',
          '    "Thursday": "<session_type>",',
          '    "Friday": "<session_type>",',
          '    "Saturday": "<session_type>"',
          '  },',
          '  "weightAdjustments": "<required: for each training session in the new schedule, list 2-3 key exercises with specific starting weight suggestions based on the weight history above. Format: Session A: Bench Press 80kg×8, Squat 100kg×6. Be specific.>"',
          '}',
          '',
          `Valid session types: ${SESSION_TYPES.join(', ')}`,
          'upper-a = Upper Body A, lower-a = Lower Body A, upper-b = Upper Body B, lower-b = Lower Body B, rest = Rest Day',
          'The schedule MUST include exactly 4 training days (one each of upper-a, lower-a, upper-b, lower-b) and 3 rest days.',
          'Respond ONLY with the JSON object, no other text.',
        ].join('\n');
        const result = await zaki.askZaki(prompt, input.zakiSessionId);
        try {
          const jsonMatch = result.response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON found in response');
          const parsed = JSON.parse(jsonMatch[0]);
          const schedule: Record<string, string> = {};
          for (const day of ALL_DAYS) {
            const session = parsed.schedule?.[day];
            schedule[day] = SESSION_TYPES.includes(session) ? session : 'rest';
          }
          return {
            success: true,
            description: (parsed.description ?? 'Custom schedule') as string,
            rationale: (parsed.rationale ?? '') as string,
            schedule,
            weightAdjustments: (parsed.weightAdjustments ?? '') as string,
            zakiSessionId: result.zakiSessionId,
          };
        } catch {
          return {
            success: false,
            description: '',
            rationale: result.response,
            schedule: {} as Record<string, string>,
            weightAdjustments: '',
            zakiSessionId: result.zakiSessionId,
          };
        }
      }),

    // Mid-workout check-in: MY Assistant evaluates current progress and advises on remaining sets
    midWorkoutCheckIn: protectedProcedure
      .input(z.object({
        sessionName: z.string(),
        elapsedMinutes: z.number(),
        recoveryScore: z.number().optional(),
        completedExercises: z.array(z.object({
          name: z.string(),
          setsCompleted: z.number(),
          setsTarget: z.number(),
          avgWeight: z.number().optional(),
          avgReps: z.number().optional(),
          avgRpe: z.number().optional(),
          skipped: z.boolean().optional(),
        })),
        remainingExercises: z.array(z.string()),
        zakiSessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const completedSummary = input.completedExercises.map(ex => {
          const parts = [`${ex.name}: ${ex.setsCompleted}/${ex.setsTarget} sets`];
          if (ex.avgWeight) parts.push(`avg ${ex.avgWeight.toFixed(1)}kg`);
          if (ex.avgReps) parts.push(`avg ${ex.avgReps.toFixed(1)} reps`);
          if (ex.avgRpe) parts.push(`avg RPE ${ex.avgRpe.toFixed(1)}`);
          if (ex.skipped) parts.push('(SKIPPED)');
          return parts.join(' · ');
        }).join('\n');

        const prompt = [
          `**MID-WORKOUT CHECK-IN — ${input.sessionName.toUpperCase()}**`,
          ``,
          `Elapsed: ${input.elapsedMinutes} minutes`,
          input.recoveryScore !== undefined ? `Recovery score: ${input.recoveryScore}%` : '',
          ``,
          `**Completed so far:**`,
          completedSummary || '(none yet)',
          ``,
          `**Remaining exercises:**`,
          input.remainingExercises.length > 0 ? input.remainingExercises.join(', ') : '(all done)',
          ``,
          `Based on what I\'ve done so far, should I push harder, maintain pace, or back off for the remaining exercises?`,
          `Give me a direct, specific 3-4 sentence answer. No fluff.`,
        ].filter(Boolean).join('\n');

        const result = await zaki.askZaki(prompt, input.zakiSessionId);
        return { response: result.response, zakiSessionId: result.zakiSessionId };
      }),

    // Personalised daily digest with real workout data from client
    personalizedDigest: protectedProcedure
      .input(z.object({
        yesterdayWorkout: z.object({
          sessionName: z.string(),
          durationMinutes: z.number().optional(),
          totalVolume: z.number().optional(),
          exerciseCount: z.number().optional(),
          topExercise: z.string().optional(),
          topWeight: z.number().optional(),
        }).optional(),
        recoveryScore: z.number().optional(),
        sleepScore: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await zakiDigest.triggerPersonalizedDigestNow(input);
        return result;
      }),

    // Server-side MY Assistant session ID persistence (survives app restarts)
    getSession: protectedProcedure
      .input(z.object({ deviceId: z.string() }))
      .query(async ({ input }) => {
        const sessionId = await db.getZakiSession(input.deviceId);
        return { zakiSessionId: sessionId };
      }),

    saveSession: protectedProcedure
      .input(z.object({ deviceId: z.string(), zakiSessionId: z.string() }))
      .mutation(async ({ input }) => {
        await db.upsertZakiSession(input.deviceId, input.zakiSessionId);
        return { success: true };
      }),

    // Upload a base64-encoded progress photo to S3 and return a public URL
    uploadProgressPhoto: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        base64: z.string(),
        mimeType: z.string().default('image/jpeg'),
        category: z.enum(['front', 'back', 'side', 'other']).default('front'),
        date: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import('./storage');
        const buffer = Buffer.from(input.base64, 'base64');
        const ext = input.mimeType === 'image/png' ? 'png' : 'jpg';
        const key = `progress-photos/${input.deviceId}/${input.date}-${input.category}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, key };
      }),

    // Analyze body composition from progress photos using MY Assistant
    analyzeBodyComposition: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        photoUrls: z.array(z.object({
          url: z.string(),
          category: z.string(),
          date: z.string(),
        })),
        userContext: z.string().optional(),
        zakiSessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const photoDesc = input.photoUrls
          .map(p => `${p.category} view (${p.date}): ${p.url}`)
          .join('\n');
        const prompt = `You are reviewing ${input.photoUrls.length} progress photo(s) for Yehia:\n${photoDesc}\n\n${input.userContext || ''}\n\nAnalyze visible body composition changes, muscle development, and provide specific, actionable coaching feedback. Be direct and precise.`;
        const result = await zaki.askZaki(prompt, input.zakiSessionId);
        return { analysis: result.response, zakiSessionId: result.zakiSessionId };
      }),

    // ── Historical Performance Analysis (queries PostgreSQL workout history) ──
    performanceAnalysis: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        weeksBack: z.number().min(1).max(12).default(4).optional(),
        zakiSessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const sessions = await dataSync.getWorkoutSessions(input.deviceId, (input.weeksBack ?? 4) * 7);
        if (!sessions || sessions.length === 0) {
          return {
            analysis: "No workout history found in the cloud yet. Complete a few workouts and make sure cloud sync is enabled to get a performance analysis.",
            zakiSessionId: input.zakiSessionId,
          };
        }
        // Build exercise progression map with per-week volume tracking for stagnation detection
        const exerciseMap: Record<string, { dates: string[]; maxWeight: number; maxReps: number; totalSets: number; totalVolume: number; weeklyVolume: Record<string, number> }> = {};
        for (const session of sessions) {
          const s = session as Record<string, unknown>;
          const exercises = Array.isArray(s.exercises) ? s.exercises : [];
          const sessionDate = typeof s.date === 'string' ? s.date : undefined;
          for (const ex of exercises) {
            const name: string = ex.exerciseName || ex.name || 'Unknown';
            if (!exerciseMap[name]) exerciseMap[name] = { dates: [], maxWeight: 0, maxReps: 0, totalSets: 0, totalVolume: 0, weeklyVolume: {} };
            let sessionVolume = 0;
            const sets = Array.isArray(ex.sets) ? ex.sets : [];
            for (const set of sets) {
              const w = parseFloat(set.weightKg ?? set.weight ?? '0');
              const r = parseInt(set.reps ?? '0', 10);
              if (isNaN(w) || isNaN(r)) continue;
              if (w > exerciseMap[name].maxWeight) exerciseMap[name].maxWeight = w;
              if (r > exerciseMap[name].maxReps) exerciseMap[name].maxReps = r;
              exerciseMap[name].totalSets++;
              exerciseMap[name].totalVolume += w * r;
              sessionVolume += w * r;
            }
            if (sessionDate) {
              if (!exerciseMap[name].dates.includes(sessionDate)) exerciseMap[name].dates.push(sessionDate);
              // Track weekly volume using ISO 8601 week number
              const d = new Date(sessionDate);
              const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
              tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
              const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
              const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
              const weekKey = `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
              exerciseMap[name].weeklyVolume[weekKey] = (exerciseMap[name].weeklyVolume[weekKey] ?? 0) + sessionVolume;
            }
          }
        }
        const exerciseSummary = Object.entries(exerciseMap)
          .sort((a, b) => b[1].totalVolume - a[1].totalVolume)
          .slice(0, 20)
          .map(([name, data]) =>
            `${name}: ${data.dates.length} sessions, max ${data.maxWeight}kg × ${data.maxReps} reps, total volume ${Math.round(data.totalVolume)}kg`
          ).join('\n');
        const sessionSummary = sessions.slice(0, 20).map((s: Record<string, unknown>) => {
          const exCount = Array.isArray(s.exercises) ? s.exercises.length : 0;
          return `${s.date}: ${s.sessionName || 'Workout'} — ${exCount} exercises`;
        }).join('\n');
        const prompt = [
          `**HISTORICAL PERFORMANCE ANALYSIS — Last ${input.weeksBack ?? 4} Weeks**`,
          `Total sessions analyzed: ${sessions.length}`,
          '',
          '**Recent Sessions:**',
          sessionSummary,
          '',
          '**Top Exercises by Volume:**',
          exerciseSummary,
          '',
          'As MY Assistant, provide a structured performance review with:',
          '1. **Overall Progress Grade** (A–F) with 2-sentence justification',
          '2. **Top 3 Strength Wins** — specific exercises where load or volume increased',
          '3. **Top 3 Weak Points** — exercises with stagnation or insufficient volume',
          '4. **Load Progression Plan** — specific weight/rep targets for next 2 weeks for the top 5 exercises',
          '5. **Recovery Recommendation** — based on training frequency and volume trend',
          '',
          'Reference actual numbers from the data. Be direct and actionable.',
        ].join('\n');
        // Detect stagnation: exercises where weekly volume hasn't grown >2% across 3+ consecutive weeks
        const stagnantExercises: string[] = [];
        for (const [name, data] of Object.entries(exerciseMap)) {
          const weeks = Object.keys(data.weeklyVolume).sort();
          if (weeks.length >= 3) {
            const volumes = weeks.map(w => data.weeklyVolume[w]);
            let stagnant = true;
            for (let i = 1; i < volumes.length; i++) {
              if (volumes[i] > volumes[i - 1] * 1.02) { stagnant = false; break; }
            }
            if (stagnant) stagnantExercises.push(name);
          }
        }
        const stagnationDetected = stagnantExercises.length >= 3;
        const result = await zaki.askZaki(prompt, input.zakiSessionId);
        return {
          analysis: result.response,
          zakiSessionId: result.zakiSessionId,
          stagnationDetected,
          stagnantExercises: stagnantExercises.slice(0, 5),
        };
      }),

    // ── Body Analysis from Progress Photos ────────────────────
    // Accepts up to 3 base64-encoded images (front/back/side) and returns
    // a structured analysis covering posture, muscle balance, and weak points.
    bodyAnalysis: protectedProcedure
      .input(z.object({
        // Each photo is { label: 'front'|'back'|'side'|'other', base64: string, mimeType: string }
        photos: z.array(z.object({
          label: z.enum(['front', 'back', 'side', 'other']),
          base64: z.string(),
          mimeType: z.string().default('image/jpeg'),
        })).min(1).max(3),
        // Optional context to personalise the analysis
        userContext: z.object({
          weightKg: z.number().optional(),
          heightCm: z.number().optional(),
          trainingAge: z.string().optional(), // e.g. '2 years'
          currentProgram: z.string().optional(),
          goals: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        // 1. Inline each photo as a base64 data URL — works with any
        //    OpenAI-compatible vision API and needs no storage proxy.
        const uploadedPhotos: { label: string; url: string }[] = input.photos.map((photo) => ({
          label: photo.label,
          url: `data:${photo.mimeType};base64,${photo.base64}`,
        }));

        // 2. Build multimodal LLM prompt
        const ctx = input.userContext;
        const contextLines: string[] = [];
        if (ctx) {
          if (ctx.weightKg) contextLines.push(`Weight: ${ctx.weightKg}kg`);
          if (ctx.heightCm) contextLines.push(`Height: ${ctx.heightCm}cm`);
          if (ctx.trainingAge) contextLines.push(`Training age: ${ctx.trainingAge}`);
          if (ctx.currentProgram) contextLines.push(`Current program: ${ctx.currentProgram}`);
          if (ctx.goals) contextLines.push(`Goals: ${ctx.goals}`);
        }

        const systemPrompt = [
          'You are MY Assistant — an elite strength & conditioning coach with expertise in biomechanics, physique assessment, and corrective exercise.',
          'You are analyzing progress photos to provide actionable, evidence-based feedback.',
          'Be specific, data-driven, and constructive. Avoid generic advice.',
          'If no human physique is clearly visible in the photos, state that in overallAssessment and return empty arrays — never fabricate findings.',
          'Return your analysis as a JSON object with the exact schema specified.',
        ].join(' ');

        const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
          {
            type: 'text',
            text: [
              '**BODY COMPOSITION ANALYSIS REQUEST**',
              '',
              contextLines.length > 0 ? `**Athlete context:**\n${contextLines.join('\n')}` : '',
              '',
              `**Photos provided:** ${uploadedPhotos.map(p => p.label).join(', ')}`,
              '',
              'Analyze these progress photos and return a JSON object with this exact structure:',
              '{',
              '  "overallAssessment": "2-3 sentence summary of physique and training status",',
              '  "postureFindings": ["finding 1", "finding 2"],',
              '  "muscleImbalances": [{ "area": "string", "finding": "string", "severity": "mild|moderate|significant" }],',
              '  "weakPoints": [{ "muscle": "string", "recommendation": "string" }],',
              '  "strengths": ["strength 1", "strength 2"],',
              '  "priorityActions": ["action 1", "action 2", "action 3"],',
              '  "estimatedBodyFatRange": "e.g. 15-18%" or null if cannot assess',
              '}',
            ].filter(Boolean).join('\n'),
          },
          ...uploadedPhotos.map(p => ({
            type: 'image_url',
            image_url: { url: p.url, detail: 'high' },
          })),
        ];

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent as any },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });

        const raw = typeof result.choices[0].message.content === 'string'
          ? result.choices[0].message.content
          : JSON.stringify(result.choices[0].message.content);

        let analysis: Record<string, unknown>;
        try {
          analysis = JSON.parse(raw);
        } catch {
          // Fallback: return raw text if JSON parse fails
          analysis = { overallAssessment: raw, postureFindings: [], muscleImbalances: [], weakPoints: [], strengths: [], priorityActions: [] };
        }

        return { analysis, analyzedAt: new Date().toISOString() };
      }),

    // ── Exercise how-to lookup (bundled free-exercise-db, no external API) ──
    exerciseHowto: protectedProcedure
      .input(z.object({ name: z.string().min(2).max(120) }))
      .query(({ input }) => lookupHowto(input.name)),

    // ── MY Assistant Warm-Up Plan Generator ──
    warmupPlan: protectedProcedure
      .input(z.object({
        sessionType: z.string(),
        sessionName: z.string(),
        exercises: z.array(z.string()),
        recoveryScore: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const prompt = [
          '**WARM-UP PLAN — GYM TRACKER**',
          '',
          `Session: ${input.sessionName} (${input.sessionType})`,
          `Main exercises today: ${input.exercises.slice(0, 6).join(', ')}`,
          input.recoveryScore != null ? `WHOOP Recovery: ${Math.round(input.recoveryScore)}%` : '',
          '',
          'Generate a targeted warm-up routine (4–6 items) that:',
          '- Activates the primary muscle groups for this specific session',
          '- Includes mobility, activation, and light movement drills',
          '- Takes 8–12 minutes total',
          '- Scales intensity if recovery is low (<50%)',
          '',
          'Respond ONLY with a raw JSON array (no markdown, no explanation):',
          '[{"name":"...","sets":2,"reps":"10","note":"...","youtubeId":"VIDEO_ID_HERE"}]',
          '',
          'For youtubeId: provide a real 11-character YouTube video ID of a short form-demonstration video for that specific warm-up exercise. Use well-known fitness channels (AthleanX, Jeff Nippard, Alan Thrall, Renaissance Periodization). If you cannot find a reliable ID, use an empty string "".',
        ].filter(Boolean).join('\n');

        const result = await zaki.askZaki(prompt);
        let items: { name: string; sets: number; reps: string; note: string; youtubeId?: string }[] = [];
        try {
          const raw = result.response.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
          items = JSON.parse(raw);
        } catch {
          const match = result.response.match(/\[\s*\{[\s\S]*?\}\s*\]/);
          if (match) { try { items = JSON.parse(match[0]); } catch { /* ignore */ } }
        }
        return { items, zakiSessionId: result.zakiSessionId };
      }),

    logNutrition: protectedProcedure
      .input(z.object({
        description: z.string(),
        imageBase64: z.string().optional(),
        mealNumber: z.number().min(1).max(5),
        date: z.string(),
        zakiSessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const hasImage = !!input.imageBase64;
        const hasText = !!input.description.trim();
        const prompt = [
          '**NUTRITION LOG — GYM TRACKER**',
          '',
          hasImage ? 'Analyze the food photo provided and identify all visible food items.' : '',
          hasText ? `User description: "${input.description}"` : '',
          '',
          'Estimate the macronutrients for this meal. Be realistic and specific.',
          'Respond ONLY with raw JSON (no markdown, no explanation):',
          '{"foodName":"...","protein":25,"carbs":40,"fat":12,"calories":370}',
          '',
          'Rules:',
          '- foodName: concise meal name (max 40 chars)',
          '- protein/carbs/fat: grams as integers',
          '- calories: integer (use 4*protein + 4*carbs + 9*fat if unsure)',
          '- If multiple items, sum them all into one entry',
        ].filter(Boolean).join('\n');
        let response: string;
        if (hasImage) {
          response = (await zaki.callVisionModel(prompt, input.imageBase64)).response;
        } else {
          const result = await zaki.askZaki(prompt, input.zakiSessionId);
          response = result.response;
        }
        let entry: { foodName: string; protein: number; carbs: number; fat: number; calories: number } | null = null;
        try {
          const raw = response.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
          entry = JSON.parse(raw);
        } catch {
          const match = response.match(/\{[\s\S]*?\}/);
          if (match) { try { entry = JSON.parse(match[0]); } catch { /* ignore */ } }
        }
        if (!entry) return { success: false, error: 'Could not parse nutrition data', entry: null };
        entry.protein = Math.max(0, Math.round(entry.protein));
        entry.carbs = Math.max(0, Math.round(entry.carbs));
        entry.fat = Math.max(0, Math.round(entry.fat));
        entry.calories = Math.max(0, Math.round(entry.calories));
        return { success: true, entry: { ...entry, mealNumber: input.mealNumber as 1|2|3|4|5, date: input.date }, error: null };
      }),

    formReview: protectedProcedure
      .input(z.object({
        exerciseName: z.string(),
        imageBase64: z.string().optional(),
        videoBase64: z.string().optional(),
        mimeType: z.string().default('image/jpeg'),
        setInfo: z.string().optional(),
        zakiSessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const prompt = [
          `**FORM REVIEW — ${input.exerciseName.toUpperCase()}**`,
          '',
          input.setInfo ? `Set context: ${input.setInfo}` : '',
          '',
          'Analyze the form shown in this media. Provide:',
          '1. OVERALL ASSESSMENT (1 sentence)',
          '2. WHAT IS GOOD (1-2 bullet points)',
          '3. WHAT TO FIX (1-2 specific corrections with cues)',
          '4. SAFETY CONCERNS (if any)',
          '',
          'Be concise, specific, and coach-like. Reference body parts and angles.',
        ].filter(Boolean).join('\n');
        const media = input.imageBase64 || input.videoBase64;
        let response: string;
        if (media) {
          response = (await zaki.callVisionModel(prompt, media, input.mimeType)).response;
        } else {
          const result = await zaki.askZaki(`Form review requested for ${input.exerciseName}. No media provided — please give general form cues for this exercise.`, input.zakiSessionId);
          response = result.response;
        }
        return { feedback: response };
      }),

    equipmentVerify: protectedProcedure
      .input(z.object({
        targetExercise: z.string(),
        imageBase64: z.string(),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ input }) => {
        const prompt = [
          `**EQUIPMENT VERIFICATION — GYM TRACKER**`,
          '',
          `The user wants to do: **${input.targetExercise}**`,
          'They have taken a photo of the available equipment/machine.',
          '',
          'Analyze the equipment in the photo and answer:',
          '1. VERDICT: Can this equipment be used for the target exercise? (Yes / Partial / No)',
          '2. EQUIPMENT IDENTIFIED: What machine/equipment is shown?',
          '3. RECOMMENDATION: If yes, confirm setup. If partial, explain modification. If no, suggest the closest alternative exercise for this equipment.',
          '',
          'Be direct. 3-4 sentences max.',
        ].join('\n');
         const response = (await zaki.callVisionModel(prompt, input.imageBase64, input.mimeType)).response;
        const verdict = response.toLowerCase().includes('yes') ? 'yes' : response.toLowerCase().includes('partial') ? 'partial' : 'no';
        return { verdict, feedback: response };
      }),
    nutritionGoalAdjust: protectedProcedure
      .input(z.object({
        last7DaysContext: z.string(),
        currentTargets: z.object({
          calories: z.number(),
          protein: z.number(),
          carbs: z.number(),
          fat: z.number(),
        }),
        userContext: z.string(),
      }))
      .mutation(async ({ input }) => {
        const prompt = [
          '**NUTRITION GOAL ADJUSTMENT REQUEST**',
          '',
          `Current targets: ${input.currentTargets.calories} kcal | ${input.currentTargets.protein}g protein | ${input.currentTargets.carbs}g carbs | ${input.currentTargets.fat}g fat`,
          '',
          'Last 7 days nutrition log:',
          input.last7DaysContext,
          '',
          'User context:',
          input.userContext,
          '',
          'Analyze if there is a consistent caloric surplus (avg > target by 10%+) or deficit (avg < target by 10%+).',
          'Respond with JSON: { "trend": "surplus"|"deficit"|"balanced", "avgDailyCalories": number, "currentTarget": number, "suggestedCalories": number, "suggestedProtein": number, "suggestedCarbs": number, "suggestedFat": number, "reasoning": "string", "confidence": "high"|"medium"|"low" }',
        ].filter(Boolean).join('\n');
        const result = await zaki.askZaki(prompt);
        try {
          const jsonMatch = result.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch { /* ignore */ }
        return {
          trend: 'balanced',
          avgDailyCalories: input.currentTargets.calories,
          currentTarget: input.currentTargets.calories,
          suggestedCalories: input.currentTargets.calories,
          suggestedProtein: input.currentTargets.protein,
          suggestedCarbs: input.currentTargets.carbs,
          suggestedFat: input.currentTargets.fat,
          reasoning: 'Not enough data to suggest adjustments.',
          confidence: 'low',
        };
      }),
  }),
  aiCoaching: router({
    dailyCoaching: protectedProcedure
      .input(z.object({ userContext: z.string() }))
      .mutation(async ({ input }) => {
        return aiCoach.generateDailyCoaching(input.userContext);
      }),

    weeklyDigest: protectedProcedure
      .input(z.object({ userContext: z.string() }))
      .mutation(async ({ input }) => {
        return aiCoach.generateWeeklyDigest(input.userContext);
      }),

    substituteExercise: protectedProcedure
      .input(z.object({
        exerciseName: z.string(),
        reason: z.string(),
        userContext: z.string(),
      }))
      .mutation(async ({ input }) => {
        return aiCoach.generateExerciseSubstitution(
          input.exerciseName,
          input.reason,
          input.userContext,
        );
      }),

    postWorkoutAnalysis: protectedProcedure
      .input(z.object({
        workoutSummary: z.string(),
        userContext: z.string(),
      }))
      .mutation(async ({ input }) => {
        return aiCoach.generatePostWorkoutAnalysis(
          input.workoutSummary,
          input.userContext,
        );
      }),

    sessionDebrief: protectedProcedure
      .input(z.object({
        sessionNotesContext: z.string(),
        userContext: z.string(),
      }))
      .mutation(async ({ input }) => {
        return aiCoach.generateSessionDebrief(
          input.sessionNotesContext,
          input.userContext,
        );
      }),
  }),

  // ── Voice Transcription (Whisper) ──────────────────────────
  voice: router({
    // Accept base64 audio, upload to S3, then transcribe via Whisper
    transcribeBase64: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
        base64: z.string(),
        mimeType: z.string().default('audio/m4a'),
        language: z.string().optional(),
        prompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Upload audio to S3 first
        const buffer = Buffer.from(input.base64, 'base64');
        const ext = input.mimeType.includes('webm') ? 'webm' : input.mimeType.includes('wav') ? 'wav' : 'm4a';
        const key = `voice-recordings/${input.deviceId}/${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        // Transcribe via Whisper
        const result = await transcribeAudio({
          audioUrl: url,
          language: input.language,
          prompt: input.prompt ?? 'Transcribe this gym coaching instruction or workout modification request',
        });
        if ('error' in result) {
          throw new Error(result.error);
        }
        return { text: result.text, language: result.language, duration: result.duration };
      }),
  }),

  // ── PIN Identity (Cross-Device Sync) ─────────────────────
  pin: router({
    // Set up a new PIN or log in with an existing one
    setupOrLogin: publicProcedure
      .input(z.object({
        deviceId: z.string().min(1),
        pin: z.string().length(6).regex(/^\d{6}$/),
        displayName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return pinIdentity.setupOrLoginPin(input.deviceId, input.pin, input.displayName);
      }),
    // Resolve a deviceId to its linked userOpenId
    resolve: publicProcedure
      .input(deviceIdInput)
      .query(async ({ input }) => {
        const userOpenId = await pinIdentity.resolveUserOpenId(input.deviceId);
        return { userOpenId, linked: userOpenId !== null };
      }),
    // Unlink this device from its PIN identity
    unlink: publicProcedure
      .input(deviceIdInput)
      .mutation(async ({ input }) => {
        await pinIdentity.unlinkDevice(input.deviceId);
        return { success: true };
      }),
    // Check if a PIN is already taken
    check: publicProcedure
      .input(z.object({ pin: z.string().length(6).regex(/^\d{6}$/) }))
      .query(async ({ input }) => {
        const taken = await pinIdentity.isPinTaken(input.pin);
        return { taken };
      }),
  }),
});

export type AppRouter = typeof appRouter;
