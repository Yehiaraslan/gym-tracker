// ============================================================
// AI COACHING NOTIFICATIONS — Intelligent notification triggers
// for post-workout, daily coaching, missed workouts, and recovery
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { notificationService } from './notification-service';
import { getStreakData } from './streak-tracker';
import { getTodaySession, SESSION_NAMES, type SessionType } from './training-program';
import { getTodayRecoveryData } from './whoop-recovery-service';
import { getRecentSplitWorkouts } from './split-workout-store';

const KEYS = {
  lastDailyCoach: '@ai_coach_last_daily',
  lastMissedAlert: '@ai_coach_last_missed',
  lastRecoveryCoach: '@ai_coach_last_recovery',
  coachingEnabled: '@ai_coach_notifications_enabled',
};

// ── Settings ─────────────────────────────────────────────────

export async function isCoachingNotificationsEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.coachingEnabled);
  return val !== 'false'; // enabled by default
}

export async function setCoachingNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.coachingEnabled, String(enabled));
}

// ── Throttle helpers ─────────────────────────────────────────

async function canSend(key: string, cooldownHours: number): Promise<boolean> {
  const last = await AsyncStorage.getItem(key);
  if (!last) return true;
  const elapsed = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
  return elapsed >= cooldownHours;
}

async function markSent(key: string): Promise<void> {
  await AsyncStorage.setItem(key, new Date().toISOString());
}

// ── Notification Triggers ────────────────────────────────────

/**
 * Daily morning coaching notification.
 * Call this from the app's background task or on app open.
 * Sends once per day with today's session focus.
 */
export async function triggerDailyCoachingNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await isCoachingNotificationsEnabled())) return;
  if (!(await canSend(KEYS.lastDailyCoach, 20))) return; // Once per 20 hours

  const todaySession = getTodaySession();
  const sessionName = SESSION_NAMES[todaySession];

  let title = '🧠 Daily Coaching';
  let body = '';

  if (todaySession === 'rest') {
    title = '💤 Rest Day';
    body = 'Recovery is part of the process. Stretch, hydrate, and eat your protein.';
  } else {
    // Check recovery
    try {
      const recovery = await getTodayRecoveryData();
      if (recovery && recovery.recoveryScore < 34) {
        body = `${sessionName} today, but your recovery is low (${recovery.recoveryScore}%). Consider going lighter or taking an extra rest day.`;
      } else if (recovery && recovery.recoveryScore < 67) {
        body = `${sessionName} today. Recovery is moderate (${recovery.recoveryScore}%) — train smart, don't force PRs.`;
      } else if (recovery) {
        body = `${sessionName} today. Recovery is green (${recovery.recoveryScore}%) — push hard! 💪`;
      } else {
        body = `${sessionName} is on the schedule today. Time to get after it!`;
      }
    } catch {
      body = `${sessionName} is on the schedule today. Time to get after it!`;
    }
  }

  await notificationService.sendNotification({
    title,
    body,
    data: { type: 'daily_coaching', session: todaySession },
  }, 1);

  await markSent(KEYS.lastDailyCoach);
}

/**
 * Missed workout follow-up.
 * Call this in the evening or on next app open.
 * Detects if today's session was missed and sends encouragement.
 */
export async function triggerMissedWorkoutNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await isCoachingNotificationsEnabled())) return;
  if (!(await canSend(KEYS.lastMissedAlert, 20))) return;

  const todaySession = getTodaySession();
  if (todaySession === 'rest') return; // No missed workout on rest days

  // Check if today's workout was completed
  const recentWorkouts = await getRecentSplitWorkouts(1);
  const today = new Date().toLocaleDateString('en-CA');
  const todayWorkout = recentWorkouts.find(w => w.date === today && w.completed);

  if (todayWorkout) return; // Workout was done, no need to alert

  // Check time — only send after 8 PM
  const hour = new Date().getHours();
  if (hour < 20) return;

  const streak = await getStreakData();
  const sessionName = SESSION_NAMES[todaySession];

  let body = `You haven't logged ${sessionName} today.`;
  if (streak && streak.currentStreak > 0) {
    body += ` Your ${streak.currentStreak}-day streak is on the line!`;
  } else {
    body += ' Every session counts — even a shorter one.';
  }

  await notificationService.sendNotification({
    title: '⏰ Workout Reminder',
    body,
    data: { type: 'missed_workout', session: todaySession },
  }, 1);

  await markSent(KEYS.lastMissedAlert);
}

/**
 * Recovery-based coaching notification.
 * Sends when WHOOP recovery is critically low.
 */
export async function triggerRecoveryCoachingNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await isCoachingNotificationsEnabled())) return;
  if (!(await canSend(KEYS.lastRecoveryCoach, 12))) return;

  try {
    const recovery = await getTodayRecoveryData();
    if (!recovery) return;

    if (recovery.recoveryScore < 30) {
      await notificationService.sendNotification({
        title: '🔴 Recovery Warning',
        body: `Your recovery is critically low (${recovery.recoveryScore}%). Your AI coach recommends a rest day or very light session. Prioritize sleep and nutrition.`,
        data: { type: 'recovery_coaching', score: recovery.recoveryScore },
      }, 1);
      await markSent(KEYS.lastRecoveryCoach);
    } else if (recovery.recoveryScore >= 80) {
      await notificationService.sendNotification({
        title: '🟢 Peak Recovery',
        body: `Recovery at ${recovery.recoveryScore}%! This is a great day to push for PRs. Your body is ready.`,
        data: { type: 'recovery_coaching', score: recovery.recoveryScore },
      }, 1);
      await markSent(KEYS.lastRecoveryCoach);
    }
  } catch {
    // Silently fail — WHOOP may not be connected
  }
}

/**
 * Post-workout congratulations notification.
 * Call immediately after finishing a workout.
 */
export async function triggerPostWorkoutNotification(
  sessionName: string,
  duration: number,
  totalVolume: number,
  prCount: number,
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await isCoachingNotificationsEnabled())) return;

  let title = '✅ Workout Complete!';
  let body = `${sessionName} done in ${duration}min — ${(totalVolume / 1000).toFixed(1)}t volume.`;

  if (prCount > 0) {
    title = '🏆 New PR!';
    body = `${sessionName} done with ${prCount} personal record${prCount > 1 ? 's' : ''}! ${(totalVolume / 1000).toFixed(1)}t total volume.`;
  }

  body += ' Check your AI Coach for detailed analysis.';

  await notificationService.sendNotification({
    title,
    body,
    data: { type: 'post_workout', sessionName, duration, totalVolume, prCount },
  }, 3); // 3 second delay so it appears after the summary screen
}

/**
 * Run all background coaching checks.
 * Call this on app open or from a background task.
 */
export async function runCoachingChecks(): Promise<void> {
  try {
    await triggerDailyCoachingNotification();
    await triggerRecoveryCoachingNotification();
    await triggerMissedWorkoutNotification();
  } catch (error) {
    console.error('[AI Coach Notifications] Error running checks:', error);
  }
}
