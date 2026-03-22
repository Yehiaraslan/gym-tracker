/**
 * Fire-and-forget DB sync helper using raw fetch.
 * This avoids the tRPC client type inference issue in non-React store contexts.
 * All calls are best-effort — failures are silently swallowed so they never
 * block the local AsyncStorage save path.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000';

async function trpcMutation(path: string, input: unknown): Promise<void> {
  try {
    const url = `${API_BASE}/trpc/${path}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: input }),
    });
  } catch {
    // Silently ignore — local save already succeeded
  }
}

// ── Workout session sync ─────────────────────────────────────
export function syncWorkoutSession(session: {
  sessionId: string;
  splitDay: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalVolume: number;
  exercises: Array<{
    exerciseName: string;
    muscleGroup: string;
    sets: Array<{
      setNumber: number;
      weightKg: number;
      reps: number;
      rpe?: number;
      notes?: string;
      completedAt: string;
    }>;
  }>;
}): void {
  trpcMutation('sync.upsertWorkoutSession', session);
}

// ── Form coach session sync ──────────────────────────────────
export function syncFormCoachSession(session: {
  sessionId: string;
  exerciseName: string;
  date: string;
  totalReps: number;
  avgFormScore: number;
  peakFormScore: number;
  lowFormScore: number;
  durationSeconds: number;
  repScores: number[];
  feedback: string[];
}): void {
  trpcMutation('sync.upsertFormCoachSession', session);
}

// ── Nutrition day sync ───────────────────────────────────────
export function syncNutritionDay(day: {
  date: string;
  isTrainingDay: boolean;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: Array<{
    mealNumber: number;
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingGrams: number;
    timestamp: string;
  }>;
  supplementsTaken: number;
  supplementsTotal: number;
}): void {
  trpcMutation('sync.upsertNutritionDay', day);
}

// ── Streak sync ──────────────────────────────────────────────
export function syncStreak(data: {
  currentStreak: number;
  bestStreak: number;
  lastWorkoutDate: string;
  totalWorkouts: number;
}): void {
  trpcMutation('sync.upsertStreak', data);
}

// ── Body weight sync ─────────────────────────────────────────
export function syncBodyWeight(entry: {
  date: string;
  weightKg: number;
  notes?: string;
}): void {
  trpcMutation('sync.upsertBodyWeight', entry);
}

// ── Sleep sync ───────────────────────────────────────────────
export function syncSleep(entry: {
  date: string;
  bedtime: string;
  wakeTime: string;
  durationHours: number;
  quality?: number;
  notes?: string;
}): void {
  trpcMutation('sync.upsertSleep', entry);
}
