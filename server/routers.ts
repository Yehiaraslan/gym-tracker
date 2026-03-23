import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as whoopService from "./whoopService";
import * as whoopStateDb from "./whoopStateDb";
import * as whoopDb from "./whoopDb";
import * as aiCoach from "./ai-coaching-service";
import * as zaki from "./zakiService";
import * as zakiDigest from "./zakiDailyDigest";
import * as dataSync from "./data-sync-service";
import * as db from "./db";
import * as pinIdentity from "./pin-identity-service";

// All WHOOP and sync procedures use a device-level identifier (deviceId) instead of
// requiring user authentication. The app generates a persistent UUID on first launch
// and passes it with every request. This allows the app to work fully offline-first
// without requiring user accounts.

const deviceIdInput = z.object({ deviceId: z.string().min(1) });

export const appRouter = router({
  system: systemRouter,
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
    status: publicProcedure
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
    authUrl: publicProcedure
      .input(deviceIdInput)
      .query(async ({ input }) => {
        const state = await whoopStateDb.createState(input.deviceId);
        const url = whoopService.buildAuthUrl(state);
        return { url };
      }),

    // Exchange OAuth code for tokens
    callback: publicProcedure
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
    disconnect: publicProcedure
      .input(deviceIdInput)
      .mutation(async ({ input }) => {
        await whoopService.disconnect(input.deviceId);
        return { success: true };
      }),

    // Get recovery data (latest + history)
    recovery: publicProcedure
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
    sleep: publicProcedure
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
    cycles: publicProcedure
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
    workouts: publicProcedure
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
    bodyMeasurement: publicProcedure
      .input(deviceIdInput)
      .query(async ({ input }) => {
        return whoopService.getBodyMeasurement(input.deviceId);
      }),

    // Get recovery history from DB
    recoveryHistory: publicProcedure
      .input(deviceIdInput.extend({ days: z.number().min(1).max(90).default(7).optional() }))
      .query(async ({ input }) => {
        const days = input.days ?? 7;
        return whoopDb.getRecoveryHistory(input.deviceId, days);
      }),
  }),

  // ── Data Sync (Cloud Persistence) ────────────────────────
  sync: router({
    upsertWorkout: publicProcedure
      .input(z.object({ deviceId: z.string(), session: z.any() }))
      .mutation(async ({ input }) => {
        await dataSync.upsertWorkoutSession(input.deviceId, input.session);
        return { success: true };
      }),

    getWorkouts: publicProcedure
      .input(deviceIdInput.extend({ limit: z.number().min(1).max(200).default(50).optional() }))
      .query(async ({ input }) => {
        return dataSync.getWorkoutSessions(input.deviceId, input.limit ?? 50);
      }),

    bulkUpsertWorkouts: publicProcedure
      .input(z.object({ deviceId: z.string(), sessions: z.array(z.any()) }))
      .mutation(async ({ input }) => {
        const count = await dataSync.bulkUpsertWorkoutSessions(input.deviceId, input.sessions);
        return { count };
      }),

    upsertFormCoach: publicProcedure
      .input(z.object({ deviceId: z.string(), session: z.any() }))
      .mutation(async ({ input }) => {
        await dataSync.upsertFormCoachSession(input.deviceId, input.session);
        return { success: true };
      }),

    getFormCoachSessions: publicProcedure
      .input(deviceIdInput.extend({ limit: z.number().min(1).max(100).default(50).optional() }))
      .query(async ({ input }) => {
        return dataSync.getFormCoachSessions(input.deviceId, input.limit ?? 50);
      }),

    bulkUpsertFormCoach: publicProcedure
      .input(z.object({ deviceId: z.string(), sessions: z.array(z.any()) }))
      .mutation(async ({ input }) => {
        let count = 0;
        for (const s of input.sessions) {
          await dataSync.upsertFormCoachSession(input.deviceId, s);
          count++;
        }
        return { count };
      }),

    upsertNutritionDay: publicProcedure
      .input(z.object({ deviceId: z.string(), day: z.any() }))
      .mutation(async ({ input }) => {
        await dataSync.upsertNutritionDay(input.deviceId, input.day);
        return { success: true };
      }),

    getNutritionDays: publicProcedure
      .input(deviceIdInput.extend({ days: z.number().min(1).max(365).default(30).optional() }))
      .query(async ({ input }) => {
        return dataSync.getNutritionDays(input.deviceId, input.days ?? 30);
      }),

    bulkUpsertNutrition: publicProcedure
      .input(z.object({ deviceId: z.string(), days: z.array(z.any()) }))
      .mutation(async ({ input }) => {
        let count = 0;
        for (const d of input.days) {
          await dataSync.upsertNutritionDay(input.deviceId, d);
          count++;
        }
        return { count };
      }),

    upsertBodyWeight: publicProcedure
      .input(z.object({ deviceId: z.string(), entry: z.any() }))
      .mutation(async ({ input }) => {
        await dataSync.upsertBodyWeightEntry(input.deviceId, input.entry);
        return { success: true };
      }),

    getBodyWeightEntries: publicProcedure
      .input(deviceIdInput.extend({ limit: z.number().min(1).max(365).default(90).optional() }))
      .query(async ({ input }) => {
        return dataSync.getBodyWeightEntries(input.deviceId, input.limit ?? 90);
      }),

    bulkUpsertBodyWeight: publicProcedure
      .input(z.object({ deviceId: z.string(), entries: z.array(z.any()) }))
      .mutation(async ({ input }) => {
        let count = 0;
        for (const e of input.entries) {
          await dataSync.upsertBodyWeightEntry(input.deviceId, e);
          count++;
        }
        return { count };
      }),

    upsertSleep: publicProcedure
      .input(z.object({ deviceId: z.string(), entry: z.any() }))
      .mutation(async ({ input }) => {
        await dataSync.upsertSleepEntry(input.deviceId, input.entry);
        return { success: true };
      }),

    getSleepEntries: publicProcedure
      .input(deviceIdInput.extend({ limit: z.number().min(1).max(90).default(30).optional() }))
      .query(async ({ input }) => {
        return dataSync.getSleepEntries(input.deviceId, input.limit ?? 30);
      }),

    bulkUpsertSleep: publicProcedure
      .input(z.object({ deviceId: z.string(), entries: z.array(z.any()) }))
      .mutation(async ({ input }) => {
        let count = 0;
        for (const e of input.entries) {
          await dataSync.upsertSleepEntry(input.deviceId, e);
          count++;
        }
        return { count };
      }),

    upsertStreak: publicProcedure
      .input(z.object({ deviceId: z.string(), streak: z.any() }))
      .mutation(async ({ input }) => {
        await dataSync.upsertStreak(input.deviceId, input.streak);
        return { success: true };
      }),

    getStreak: publicProcedure
      .input(deviceIdInput)
      .query(async ({ input }) => {
        return dataSync.getStreak(input.deviceId);
      }),

    upsertPersonalRecord: publicProcedure
      .input(z.object({ deviceId: z.string(), pr: z.any() }))
      .mutation(async ({ input }) => {
        await dataSync.upsertPersonalRecord(input.deviceId, input.pr);
        return { success: true };
      }),

    getPersonalRecords: publicProcedure
      .input(deviceIdInput)
      .query(async ({ input }) => {
        return dataSync.getPersonalRecords(input.deviceId);
      }),
  }),

  // ── AI Coaching ───────────────────────────────────────────
  zaki: router({
    dailyCoaching: publicProcedure
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

    workoutModification: publicProcedure
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
    ask: publicProcedure
      .input(z.object({
        message: z.string(),
        zakiSessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await zaki.askZaki(input.message, input.zakiSessionId);
        return { response: result.response, zakiSessionId: result.zakiSessionId };
      }),

    sessionDebrief: publicProcedure
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

    weeklyDigest: publicProcedure
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
    triggerDailyDigest: publicProcedure
      .mutation(async () => {
        const result = await zakiDigest.triggerDailyDigestNow();
        return result;
      }),

    // Mid-workout check-in: Zaki evaluates current progress and advises on remaining sets
    midWorkoutCheckIn: publicProcedure
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
    personalizedDigest: publicProcedure
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

    // Server-side Zaki session ID persistence (survives app restarts)
    getSession: publicProcedure
      .input(z.object({ deviceId: z.string() }))
      .query(async ({ input }) => {
        const sessionId = await db.getZakiSession(input.deviceId);
        return { zakiSessionId: sessionId };
      }),

    saveSession: publicProcedure
      .input(z.object({ deviceId: z.string(), zakiSessionId: z.string() }))
      .mutation(async ({ input }) => {
        await db.upsertZakiSession(input.deviceId, input.zakiSessionId);
        return { success: true };
      }),

    // Upload a base64-encoded progress photo to S3 and return a public URL
    uploadProgressPhoto: publicProcedure
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

    // Analyze body composition from progress photos using Zaki
    analyzeBodyComposition: publicProcedure
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
  }),

  aiCoaching: router({
    dailyCoaching: publicProcedure
      .input(z.object({ userContext: z.string() }))
      .mutation(async ({ input }) => {
        return aiCoach.generateDailyCoaching(input.userContext);
      }),

    weeklyDigest: publicProcedure
      .input(z.object({ userContext: z.string() }))
      .mutation(async ({ input }) => {
        return aiCoach.generateWeeklyDigest(input.userContext);
      }),

    substituteExercise: publicProcedure
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

    postWorkoutAnalysis: publicProcedure
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

    sessionDebrief: publicProcedure
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
