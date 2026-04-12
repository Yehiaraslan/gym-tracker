import AsyncStorage from '@react-native-async-storage/async-storage';

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  rarity: BadgeRarity;
  unlockedAt?: string;
}

export const BADGE_COLORS: Record<BadgeRarity, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

export const ALL_ACHIEVEMENTS: Omit<Achievement, 'unlockedAt'>[] = [
  // Workout milestones
  { id: 'first_workout', name: 'First Rep', description: 'Complete your first workout', emoji: '🎯', rarity: 'common' },
  { id: 'ten_workouts', name: 'Dedicated', description: 'Complete 10 workouts', emoji: '💪', rarity: 'common' },
  { id: '50_workouts', name: 'Iron Regular', description: 'Complete 50 workouts', emoji: '🏋️', rarity: 'rare' },
  { id: '100_workouts', name: 'Centurion', description: 'Complete 100 workouts', emoji: '🏆', rarity: 'epic' },
  { id: '365_workouts', name: 'Year of Iron', description: 'Complete 365 workouts', emoji: '👑', rarity: 'legendary' },
  // Streak badges
  { id: 'streak_7', name: 'Week Warrior', description: '7-day workout streak', emoji: '🔥', rarity: 'common' },
  { id: 'streak_30', name: 'Monthly Machine', description: '30-day workout streak', emoji: '⚡', rarity: 'rare' },
  { id: 'streak_100', name: 'Unstoppable', description: '100-day workout streak', emoji: '🌟', rarity: 'legendary' },
  // PR badges
  { id: 'first_pr', name: 'Record Breaker', description: 'Hit your first PR', emoji: '📈', rarity: 'common' },
  { id: 'ten_prs', name: 'PR Machine', description: 'Hit 10 personal records', emoji: '🎖️', rarity: 'rare' },
  { id: 'bench_100', name: '100kg Bench', description: 'Bench press 100kg', emoji: '🏅', rarity: 'epic' },
  { id: 'squat_140', name: '140kg Squat', description: 'Squat 140kg', emoji: '🦵', rarity: 'epic' },
  { id: 'deadlift_180', name: '180kg Deadlift', description: 'Deadlift 180kg', emoji: '💀', rarity: 'epic' },
  // Volume badges
  { id: 'volume_10k', name: '10 Tonne Club', description: 'Lift 10,000kg in one session', emoji: '🏗️', rarity: 'rare' },
  { id: 'volume_50k', name: 'Volume King', description: 'Lift 50,000kg total', emoji: '⚙️', rarity: 'epic' },
  // Nutrition
  { id: 'protein_7', name: 'Protein Week', description: 'Hit protein target 7 days in a row', emoji: '🥩', rarity: 'rare' },
  // Special
  { id: 'early_bird', name: 'Dawn Lifter', description: 'Work out before 6am', emoji: '🌅', rarity: 'rare' },
  { id: 'night_owl', name: 'Night Owl', description: 'Work out after 10pm', emoji: '🦉', rarity: 'rare' },
  { id: 'perfect_week', name: 'Perfect Week', description: 'Complete all planned workouts in a week', emoji: '✨', rarity: 'epic' },
];

const STORAGE_KEY = '@gym_achievements';

export async function getUnlockedAchievements(): Promise<Achievement[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function unlockAchievement(id: string): Promise<Achievement | null> {
  const unlocked = await getUnlockedAchievements();
  if (unlocked.find(a => a.id === id)) return null; // Already unlocked
  const def = ALL_ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return null;
  const achievement: Achievement = { ...def, unlockedAt: new Date().toISOString() };
  unlocked.push(achievement);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
  return achievement;
}

export async function checkAndUnlockAchievements(stats: {
  totalWorkouts: number;
  currentStreak: number;
  totalPRs: number;
  maxBench?: number;
  maxSquat?: number;
  maxDeadlift?: number;
  sessionVolume?: number;
  totalVolume?: number;
  proteinStreak?: number;
  workoutHour?: number;
  weekWorkouts?: number;
  plannedWeekWorkouts?: number;
}): Promise<Achievement[]> {
  const newBadges: Achievement[] = [];
  const checks: [string, boolean][] = [
    ['first_workout', stats.totalWorkouts >= 1],
    ['ten_workouts', stats.totalWorkouts >= 10],
    ['50_workouts', stats.totalWorkouts >= 50],
    ['100_workouts', stats.totalWorkouts >= 100],
    ['365_workouts', stats.totalWorkouts >= 365],
    ['streak_7', stats.currentStreak >= 7],
    ['streak_30', stats.currentStreak >= 30],
    ['streak_100', stats.currentStreak >= 100],
    ['first_pr', stats.totalPRs >= 1],
    ['ten_prs', stats.totalPRs >= 10],
    ['bench_100', (stats.maxBench ?? 0) >= 100],
    ['squat_140', (stats.maxSquat ?? 0) >= 140],
    ['deadlift_180', (stats.maxDeadlift ?? 0) >= 180],
    ['volume_10k', (stats.sessionVolume ?? 0) >= 10000],
    ['volume_50k', (stats.totalVolume ?? 0) >= 50000],
    ['protein_7', (stats.proteinStreak ?? 0) >= 7],
    ['early_bird', stats.workoutHour !== undefined && stats.workoutHour < 6],
    ['night_owl', stats.workoutHour !== undefined && stats.workoutHour >= 22],
    ['perfect_week', stats.weekWorkouts !== undefined && stats.plannedWeekWorkouts !== undefined && stats.weekWorkouts >= stats.plannedWeekWorkouts],
  ];
  for (const [id, condition] of checks) {
    if (condition) {
      const badge = await unlockAchievement(id);
      if (badge) newBadges.push(badge);
    }
  }
  return newBadges;
}
