import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as whoopService from "./whoopService";
import * as whoopStateDb from "./whoopStateDb";
import * as whoopDb from "./whoopDb";

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
    status: protectedProcedure.query(async ({ ctx }) => {
      const connected = await whoopService.isConnected(ctx.user.openId);
      let profile = null;
      if (connected) {
        try {
          profile = await whoopService.getProfile(ctx.user.openId);
        } catch {
          // Profile fetch may fail, still connected
        }
      }
      return { connected, profile };
    }),

    // Start OAuth flow - returns auth URL
    authUrl: protectedProcedure.query(async ({ ctx }) => {
      const state = await whoopStateDb.createState(ctx.user.openId);
      const url = whoopService.buildAuthUrl(state);
      return { url };
    }),

    // Exchange OAuth code for tokens
    callback: publicProcedure
      .input(z.object({ code: z.string(), state: z.string() }))
      .mutation(async ({ input }) => {
        // Validate state (CSRF protection)
        const stateResult = await whoopStateDb.validateAndConsumeState(input.state);
        if (!stateResult.valid || !stateResult.userOpenId) {
          throw new Error("Invalid or expired OAuth state");
        }
        // Exchange code for tokens
        const result = await whoopService.exchangeCodeForTokens(
          input.code,
          stateResult.userOpenId
        );
        return result;
      }),

    // Disconnect WHOOP
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await whoopService.disconnect(ctx.user.openId);
      return { success: true };
    }),

    // Get recovery data (latest + history)
    recovery: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(30).default(7) }).optional())
      .query(async ({ ctx, input }) => {
        const days = input?.days ?? 7;
        try {
          const data = await whoopService.getRecoveryCollection(ctx.user.openId, days);
          // Cache the data
          await whoopDb.saveWhoopCache(ctx.user.openId, {
            recoveryJson: JSON.stringify(data),
          });
          // Save individual recovery entries to history
          if (data?.records) {
            for (const record of data.records) {
              if (record.score) {
                const date = record.created_at?.split("T")[0] || new Date().toISOString().split("T")[0];
                await whoopDb.upsertRecoveryHistory({
                  userOpenId: ctx.user.openId,
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
          // Try to return cached data
          const cached = await whoopDb.getWhoopCache(ctx.user.openId);
          if (cached?.recoveryJson) {
            return { ...JSON.parse(cached.recoveryJson), cached: true };
          }
          throw error;
        }
      }),

    // Get sleep data
    sleep: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(30).default(7) }).optional())
      .query(async ({ ctx, input }) => {
        const days = input?.days ?? 7;
        try {
          const data = await whoopService.getSleepCollection(ctx.user.openId, days);
          await whoopDb.saveWhoopCache(ctx.user.openId, {
            sleepJson: JSON.stringify(data),
          });
          return data;
        } catch (error) {
          const cached = await whoopDb.getWhoopCache(ctx.user.openId);
          if (cached?.sleepJson) {
            return { ...JSON.parse(cached.sleepJson), cached: true };
          }
          throw error;
        }
      }),

    // Get strain/cycle data
    cycles: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(30).default(7) }).optional())
      .query(async ({ ctx, input }) => {
        const days = input?.days ?? 7;
        try {
          const data = await whoopService.getCycleCollection(ctx.user.openId, days);
          await whoopDb.saveWhoopCache(ctx.user.openId, {
            cycleJson: JSON.stringify(data),
          });
          return data;
        } catch (error) {
          const cached = await whoopDb.getWhoopCache(ctx.user.openId);
          if (cached?.cycleJson) {
            return { ...JSON.parse(cached.cycleJson), cached: true };
          }
          throw error;
        }
      }),

    // Get workout data
    workouts: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
      .query(async ({ ctx, input }) => {
        const limit = input?.limit ?? 10;
        try {
          const data = await whoopService.getWorkoutCollection(ctx.user.openId, limit);
          await whoopDb.saveWhoopCache(ctx.user.openId, {
            workoutJson: JSON.stringify(data),
          });
          return data;
        } catch (error) {
          const cached = await whoopDb.getWhoopCache(ctx.user.openId);
          if (cached?.workoutJson) {
            return { ...JSON.parse(cached.workoutJson), cached: true };
          }
          throw error;
        }
      }),

    // Get body measurement
    bodyMeasurement: protectedProcedure.query(async ({ ctx }) => {
      return whoopService.getBodyMeasurement(ctx.user.openId);
    }),

    // Get recovery history from DB
    recoveryHistory: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(90).default(7) }).optional())
      .query(async ({ ctx, input }) => {
        const days = input?.days ?? 7;
        return whoopDb.getRecoveryHistory(ctx.user.openId, days);
      }),
  }),
});

export type AppRouter = typeof appRouter;
