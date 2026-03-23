/**
 * Stagnation Notification Scheduler
 *
 * Fires at 06:55 AM Dubai time every day (5 min before the morning brief).
 * Queries the last 4 weeks of workout data for the owner, runs the same
 * stagnation detection algorithm used in the Performance Analysis route,
 * and — if stagnation is detected — sends a push notification via notifyOwner.
 *
 * This ensures Yehia is proactively alerted before he opens the app,
 * rather than waiting for a manual analysis run.
 */
import cron from 'node-cron';
import { notifyOwner } from './_core/notification';
import { ENV } from './_core/env';
import * as dataSync from './data-sync-service';

// ─── Stagnation Detection ─────────────────────────────────────────────────────

interface ExerciseWeeklyData {
  weeklyVolume: Record<string, number>;
}

function detectStagnation(
  exerciseMap: Record<string, ExerciseWeeklyData>,
  minWeeks = 3,
  growthThreshold = 0.02,
): { stagnationDetected: boolean; stagnantExercises: string[] } {
  const stagnantExercises: string[] = [];

  for (const [name, data] of Object.entries(exerciseMap)) {
    const weeks = Object.keys(data.weeklyVolume).sort();
    if (weeks.length >= minWeeks) {
      const volumes = weeks.map(w => data.weeklyVolume[w]);
      let stagnant = true;
      for (let i = 1; i < volumes.length; i++) {
        if (volumes[i] > volumes[i - 1] * (1 + growthThreshold)) {
          stagnant = false;
          break;
        }
      }
      if (stagnant) stagnantExercises.push(name);
    }
  }

  return {
    stagnationDetected: stagnantExercises.length >= 3,
    stagnantExercises: stagnantExercises.slice(0, 5),
  };
}

// ─── Core Check Function ──────────────────────────────────────────────────────

export async function checkAndNotifyStagnation(): Promise<{
  checked: boolean;
  stagnationDetected: boolean;
  stagnantExercises: string[];
  notificationSent: boolean;
}> {
  const ownerOpenId = ENV.ownerOpenId;
  if (!ownerOpenId) {
    console.warn('[Stagnation Scheduler] OWNER_OPEN_ID not set — skipping stagnation check.');
    return { checked: false, stagnationDetected: false, stagnantExercises: [], notificationSent: false };
  }

  // Fetch last 4 weeks of sessions (28 days × ~2 sessions/day max = 56 limit)
  const sessions = await dataSync.getWorkoutSessions(ownerOpenId, 56);
  if (!sessions || sessions.length === 0) {
    console.log('[Stagnation Scheduler] No workout sessions found — skipping.');
    return { checked: true, stagnationDetected: false, stagnantExercises: [], notificationSent: false };
  }

  // Build exercise weekly volume map (same logic as performanceAnalysis route)
  const exerciseMap: Record<string, ExerciseWeeklyData> = {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);

  for (const session of sessions) {
    const sessionDate = (session as any).date as string;
    if (!sessionDate || new Date(sessionDate) < cutoff) continue;

    for (const ex of (session as any).exercises ?? []) {
      const name: string = ex.exerciseName || ex.name || 'Unknown';
      if (!exerciseMap[name]) exerciseMap[name] = { weeklyVolume: {} };

      let sessionVolume = 0;
      for (const set of (ex as any).sets ?? []) {
        const w = parseFloat(set.weightKg ?? set.weight ?? '0');
        const r = parseInt(set.reps ?? '0', 10);
        sessionVolume += w * r;
      }

      // ISO week key
      const d = new Date(sessionDate);
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(
        ((d.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getDay() + 1) / 7,
      );
      const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      exerciseMap[name].weeklyVolume[weekKey] =
        (exerciseMap[name].weeklyVolume[weekKey] ?? 0) + sessionVolume;
    }
  }

  const { stagnationDetected, stagnantExercises } = detectStagnation(exerciseMap);

  if (!stagnationDetected) {
    console.log('[Stagnation Scheduler] No stagnation detected — all good.');
    return { checked: true, stagnationDetected: false, stagnantExercises: [], notificationSent: false };
  }

  // Build notification content
  const exerciseList = stagnantExercises.map(e => `• ${e}`).join('\n');
  const title = `⚠️ Zaki Alert: Plateau Detected — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
  const content = [
    `Zaki has detected stagnation across ${stagnantExercises.length} exercises with no meaningful volume progression over the last 3+ weeks:`,
    '',
    exerciseList,
    '',
    'This is a clear signal that your body has adapted. A deload week is recommended to break the plateau and allow full recovery.',
    '',
    'Open the app → AI Coach → Weekly tab → "Analyze My Progress" to schedule a deload week now.',
  ].join('\n');

  let notificationSent = false;
  try {
    notificationSent = await notifyOwner({ title, content });
    if (notificationSent) {
      console.log(`[Stagnation Scheduler] Stagnation notification sent. Exercises: ${stagnantExercises.join(', ')}`);
    } else {
      console.warn('[Stagnation Scheduler] notifyOwner returned false.');
    }
  } catch (err) {
    console.error('[Stagnation Scheduler] Failed to send notification:', err);
  }

  return { checked: true, stagnationDetected, stagnantExercises, notificationSent };
}

// ─── Scheduler Entry Point ────────────────────────────────────────────────────

export function startStagnationScheduler(): void {
  // Run at 06:55 every day Dubai time (5 min before the morning brief at 07:00)
  cron.schedule('0 55 6 * * *', async () => {
    console.log('[Stagnation Scheduler] Running daily stagnation check...');
    try {
      await checkAndNotifyStagnation();
    } catch (err) {
      console.error('[Stagnation Scheduler] Unexpected error:', err);
    }
  }, {
    timezone: 'Asia/Dubai',
  });

  console.log('[Stagnation Scheduler] Started — will check daily at 06:55 Dubai time.');
}
