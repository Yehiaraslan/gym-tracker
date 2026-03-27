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
import * as zakiProgram from "./zakiProgramService";
import * as zakiDigest from "./zakiDailyDigest";
import { checkAndNotifyStagnation } from "./stagnationScheduler";
import { ENV } from './_core/env';
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

    upsertScheduleOverride: publicProcedure
      .input(z.object({ deviceId: z.string(), override: z.any() }))
      .mutation(async ({ input }) => {
        await dataSync.upsertScheduleOverride(input.deviceId, input.override);
        return { success: true };
      }),

    getScheduleOverride: publicProcedure
      .input(deviceIdInput)
      .query(async ({ input }) => {
        return dataSync.getLatestScheduleOverride(input.deviceId);
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
    triggerStagnationCheck: publicProcedure
      .mutation(async () => {
        const result = await checkAndNotifyStagnation();
        return result;
      }),
    // Generate a fully custom AI training program
    generateProgram: publicProcedure
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
    proposeSchedule: publicProcedure
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

    // ── Historical Performance Analysis (queries PostgreSQL workout history) ──
    performanceAnalysis: publicProcedure
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
          for (const ex of (session as any).exercises ?? []) {
            const name: string = ex.exerciseName || ex.name || 'Unknown';
            if (!exerciseMap[name]) exerciseMap[name] = { dates: [], maxWeight: 0, maxReps: 0, totalSets: 0, totalVolume: 0, weeklyVolume: {} };
            const sessionDate = (session as any).date;
            let sessionVolume = 0;
            for (const set of (ex as any).sets ?? []) {
              const w = parseFloat(set.weightKg ?? set.weight ?? '0');
              const r = parseInt(set.reps ?? '0', 10);
              if (w > exerciseMap[name].maxWeight) exerciseMap[name].maxWeight = w;
              if (r > exerciseMap[name].maxReps) exerciseMap[name].maxReps = r;
              exerciseMap[name].totalSets++;
              exerciseMap[name].totalVolume += w * r;
              sessionVolume += w * r;
            }
            if (sessionDate) {
              if (!exerciseMap[name].dates.includes(sessionDate)) exerciseMap[name].dates.push(sessionDate);
              // Track weekly volume: week key = ISO week (year-Wnn)
              const d = new Date(sessionDate);
              const startOfYear = new Date(d.getFullYear(), 0, 1);
              const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
              const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
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
        const sessionSummary = sessions.slice(0, 20).map((s: any) => {
          const exCount = (s.exercises ?? []).length;
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
          'As Zaki, provide a structured performance review with:',
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
