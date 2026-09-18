// ============================================================
// PUSH REGISTRATION + COACH EVENT FALLBACK
//
// 1. Native only: obtain the Expo push token for this device and bind it to
//    the signed-in account on the server (push.register). The server sends
//    a push when the coach assigns a plan or writes a message.
// 2. Fallback that works even before FCM credentials exist on the EAS
//    project: whenever the app comes to the foreground we compare "what the
//    coach set / wrote" against what this device has already seen and raise
//    a LOCAL notification for anything new.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const TOKEN_KEY = '@push_token_v1';
const SEEN_KEY = '@coach_events_seen_v1';

type Seen = { workoutPlanId: string | null; mealPlanId: string | null; unread: number };

function projectId(): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as { eas?: { projectId?: string } };
  return extra.eas?.projectId ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

/** Returns the token that was registered, or null when unavailable. */
export async function registerCurrentDevice(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const id = projectId();
    const { data: token } = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
    if (!token) return null;
    const { trpcClient } = await import('./trpc');
    await trpcClient.push.register.mutate({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (error) {
    // Typical cause on Android: no FCM credentials on the EAS project yet.
    console.warn('[push] register skipped:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function unregisterCurrentDevice(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const { trpcClient } = await import('./trpc');
    await trpcClient.push.unregister.mutate({ token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // best-effort
  }
  await AsyncStorage.removeItem(SEEN_KEY);
}

/** Where a tapped notification should take the user. */
export function routeForNotificationData(data: Record<string, unknown> | undefined, isCoach: boolean): string | null {
  const kind = data?.kind;
  if (kind === 'message') {
    const peerId = data?.peerId;
    return isCoach && peerId ? `/chat/${String(peerId)}` : '/coach';
  }
  if (kind === 'workout_plan' || kind === 'meal_plan') return '/coach';
  return null;
}

/**
 * Foreground fallback for trainees: raise local notifications for a new plan
 * or unread coach messages this device has not announced yet.
 */
export async function checkCoachEventsAndNotify(opts: { isCoach: boolean; lang: 'en' | 'ar' }): Promise<void> {
  if (Platform.OS === 'web' || opts.isCoach) return;
  try {
    const { trpcClient } = await import('./trpc');
    const [plans, unread] = await Promise.all([
      trpcClient.coach.myPlans.query(),
      trpcClient.coach.unreadCount.query(),
    ]);
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const seen: Seen | null = raw ? JSON.parse(raw) : null;
    const next: Seen = {
      workoutPlanId: plans.workoutPlan?.id ?? null,
      mealPlanId: plans.mealPlan?.id ?? null,
      unread,
    };
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next));
    // First run on this device: record, don't announce history.
    if (!seen) return;
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;
    const ar = opts.lang === 'ar';
    const notify = (title: string, body: string, data: Record<string, unknown>) =>
      Notifications.scheduleNotificationAsync({ content: { title, body, data, sound: 'default' }, trigger: null });

    if (next.workoutPlanId && next.workoutPlanId !== seen.workoutPlanId && plans.workoutPlan) {
      await notify(
        ar ? `المدرب ${plans.workoutPlan.coachName} حدّد خطة تمرينك` : `Coach ${plans.workoutPlan.coachName} set your workout plan`,
        plans.workoutPlan.name,
        { kind: 'workout_plan' },
      );
    }
    if (next.mealPlanId && next.mealPlanId !== seen.mealPlanId && plans.mealPlan) {
      await notify(
        ar ? `المدرب ${plans.mealPlan.coachName} حدّد خطة وجباتك` : `Coach ${plans.mealPlan.coachName} set your meal plan`,
        plans.mealPlan.name,
        { kind: 'meal_plan' },
      );
    }
    if (next.unread > seen.unread) {
      const n = next.unread - seen.unread;
      await notify(
        ar ? 'رسالة جديدة من مدربك' : 'New message from your coach',
        ar ? `${n} رسالة غير مقروءة` : `${n} unread message${n === 1 ? '' : 's'}`,
        { kind: 'message' },
      );
    }
  } catch {
    // offline → nothing to announce
  }
}
