import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  xpReward: number;
  type: 'workout' | 'nutrition' | 'recovery';
  completed: boolean;
}

const CHALLENGE_POOL: Omit<DailyChallenge, 'completed'>[] = [
  { id: 'complete_workout', title: 'Iron Will', description: 'Complete today\'s workout', emoji: '🏋️', xpReward: 50, type: 'workout' },
  { id: 'hit_protein', title: 'Protein King', description: 'Hit 90% of your protein target', emoji: '🥩', xpReward: 30, type: 'nutrition' },
  { id: 'log_all_meals', title: 'Meal Tracker', description: 'Log all 3 main meals', emoji: '🍽️', xpReward: 25, type: 'nutrition' },
  { id: 'rpe_check', title: 'Mind-Muscle', description: 'Log RPE for every working set', emoji: '🧠', xpReward: 20, type: 'workout' },
  { id: 'sleep_7h', title: 'Sleep Champion', description: 'Log 7+ hours of sleep', emoji: '😴', xpReward: 25, type: 'recovery' },
  { id: 'pr_attempt', title: 'PR Hunter', description: 'Hit a new personal record', emoji: '🏆', xpReward: 75, type: 'workout' },
  { id: 'hydration', title: 'Hydration Hero', description: 'Drink 8 glasses of water', emoji: '💧', xpReward: 15, type: 'recovery' },
  { id: 'volume_5k', title: 'Volume Machine', description: 'Accumulate 5,000kg+ total volume', emoji: '💪', xpReward: 40, type: 'workout' },
  { id: 'early_bird', title: 'Early Bird', description: 'Start workout before 8am', emoji: '🌅', xpReward: 30, type: 'workout' },
  { id: 'consistency', title: 'Consistent', description: 'Work out 3 days in a row', emoji: '🔥', xpReward: 50, type: 'workout' },
  { id: 'no_skip', title: 'No Excuses', description: 'Complete all exercises (no skips)', emoji: '✊', xpReward: 35, type: 'workout' },
  { id: 'stretch', title: 'Flexible', description: 'Complete warm-up and cool-down', emoji: '🧘', xpReward: 20, type: 'recovery' },
];

const STORAGE_KEY = '@gym_daily_challenges';

function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function getTodayChallenges(): Promise<DailyChallenge[]> {
  const seed = getDailySeed();
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed.seed === seed) return parsed.challenges;
  }
  // Generate 3 challenges for today (deterministic based on date)
  const shuffled = seededShuffle(CHALLENGE_POOL, seed);
  // Pick one from each type if possible
  const workout = shuffled.find(c => c.type === 'workout')!;
  const nutrition = shuffled.find(c => c.type === 'nutrition')!;
  const recovery = shuffled.find(c => c.type === 'recovery')!;
  const challenges: DailyChallenge[] = [workout, nutrition, recovery].map(c => ({ ...c, completed: false }));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ seed, challenges }));
  return challenges;
}

export async function completeChallenge(id: string): Promise<DailyChallenge[]> {
  const challenges = await getTodayChallenges();
  const updated = challenges.map(c => c.id === id ? { ...c, completed: true } : c);
  const seed = getDailySeed();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ seed, challenges: updated }));
  return updated;
}
