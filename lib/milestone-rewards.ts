/**
 * Milestone Rewards System
 * Manages unlockable features and rewards based on milestone achievements
 */

export interface UnlockableReward {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'theme' | 'exercise_pack' | 'feature' | 'badge';
  streakRequired: number;
  isUnlocked: boolean;
  unlockedAt?: number;
}

export interface ThemeReward {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  description: string;
}

export interface ExercisePackReward {
  id: string;
  name: string;
  description: string;
  exerciseCount: number;
  category: string;
}

// Define all available rewards
const AVAILABLE_REWARDS: UnlockableReward[] = [
  {
    id: 'theme_fire',
    name: 'Fire Theme',
    description: 'Unlock the fiery red theme at 7-day streak',
    icon: '🔥',
    type: 'theme',
    streakRequired: 7,
    isUnlocked: false,
  },
  {
    id: 'theme_ocean',
    name: 'Ocean Theme',
    description: 'Unlock the cool blue theme at 30-day streak',
    icon: '🌊',
    type: 'theme',
    streakRequired: 30,
    isUnlocked: false,
  },
  {
    id: 'theme_forest',
    name: 'Forest Theme',
    description: 'Unlock the green forest theme at 60-day streak',
    icon: '🌲',
    type: 'theme',
    streakRequired: 60,
    isUnlocked: false,
  },
  {
    id: 'exercise_pack_advanced',
    name: 'Advanced Exercises',
    description: 'Unlock 20+ advanced exercises at 14-day streak',
    icon: '💪',
    type: 'exercise_pack',
    streakRequired: 14,
    isUnlocked: false,
  },
  {
    id: 'exercise_pack_sports',
    name: 'Sports Training',
    description: 'Unlock sport-specific training at 45-day streak',
    icon: '⚽',
    type: 'exercise_pack',
    streakRequired: 45,
    isUnlocked: false,
  },
  {
    id: 'feature_ai_coach',
    name: 'Premium AI Coach',
    description: 'Unlock advanced form analysis at 21-day streak',
    icon: '🤖',
    type: 'feature',
    streakRequired: 21,
    isUnlocked: false,
  },
  {
    id: 'feature_custom_programs',
    name: 'Custom Programs',
    description: 'Create unlimited custom workout programs at 100-day streak',
    icon: '📋',
    type: 'feature',
    streakRequired: 100,
    isUnlocked: false,
  },
  {
    id: 'badge_consistency',
    name: 'Consistency Master',
    description: 'Achieve 365-day streak',
    icon: '🏆',
    type: 'badge',
    streakRequired: 365,
    isUnlocked: false,
  },
];

/**
 * Get all available rewards
 */
export function getAllRewards(): UnlockableReward[] {
  return AVAILABLE_REWARDS;
}

/**
 * Get rewards unlocked at a specific streak
 */
export function getRewardsAtStreak(streak: number): UnlockableReward[] {
  return AVAILABLE_REWARDS.filter(reward => reward.streakRequired === streak);
}

/**
 * Get all unlocked rewards for a given streak
 */
export function getUnlockedRewards(currentStreak: number): UnlockableReward[] {
  return AVAILABLE_REWARDS.map(reward => ({
    ...reward,
    isUnlocked: currentStreak >= reward.streakRequired,
  })).filter(reward => reward.isUnlocked);
}

/**
 * Get next upcoming reward
 */
export function getNextReward(currentStreak: number): UnlockableReward | null {
  const upcoming = AVAILABLE_REWARDS.filter(reward => reward.streakRequired > currentStreak)
    .sort((a, b) => a.streakRequired - b.streakRequired);
  
  return upcoming.length > 0 ? upcoming[0] : null;
}

/**
 * Get reward progress (days until next reward)
 */
export function getRewardProgress(currentStreak: number): {
  nextReward: UnlockableReward | null;
  daysUntil: number;
  progressPercentage: number;
} {
  const nextReward = getNextReward(currentStreak);
  
  if (!nextReward) {
    return {
      nextReward: null,
      daysUntil: 0,
      progressPercentage: 100,
    };
  }

  const daysUntil = nextReward.streakRequired - currentStreak;
  const previousReward = AVAILABLE_REWARDS
    .filter(r => r.streakRequired < nextReward.streakRequired)
    .sort((a, b) => b.streakRequired - a.streakRequired)[0];
  
  const previousStreak = previousReward?.streakRequired || 0;
  const totalDays = nextReward.streakRequired - previousStreak;
  const daysPassed = currentStreak - previousStreak;
  const progressPercentage = Math.round((daysPassed / totalDays) * 100);

  return {
    nextReward,
    daysUntil,
    progressPercentage: Math.min(progressPercentage, 100),
  };
}

/**
 * Get theme reward by ID
 */
export function getThemeReward(rewardId: string): ThemeReward | null {
  const themes: Record<string, ThemeReward> = {
    theme_fire: {
      id: 'theme_fire',
      name: 'Fire Theme',
      primaryColor: '#FF6B35',
      secondaryColor: '#FF8C42',
      accentColor: '#FFB703',
      description: 'Energetic and bold',
    },
    theme_ocean: {
      id: 'theme_ocean',
      name: 'Ocean Theme',
      primaryColor: '#0A7EA4',
      secondaryColor: '#0D9488',
      accentColor: '#06B6D4',
      description: 'Cool and calming',
    },
    theme_forest: {
      id: 'theme_forest',
      name: 'Forest Theme',
      primaryColor: '#16A34A',
      secondaryColor: '#059669',
      accentColor: '#10B981',
      description: 'Natural and fresh',
    },
  };

  return themes[rewardId] || null;
}

/**
 * Get exercise pack reward by ID
 */
export function getExercisePackReward(rewardId: string): ExercisePackReward | null {
  const packs: Record<string, ExercisePackReward> = {
    exercise_pack_advanced: {
      id: 'exercise_pack_advanced',
      name: 'Advanced Exercises',
      description: 'Complex compound movements and advanced techniques',
      exerciseCount: 25,
      category: 'advanced',
    },
    exercise_pack_sports: {
      id: 'exercise_pack_sports',
      name: 'Sports Training',
      description: 'Sport-specific conditioning and performance training',
      exerciseCount: 30,
      category: 'sports',
    },
  };

  return packs[rewardId] || null;
}

/**
 * Check if reward is newly unlocked
 */
export function isRewardNewlyUnlocked(
  previousStreak: number,
  currentStreak: number,
  rewardStreakRequired: number
): boolean {
  return previousStreak < rewardStreakRequired && currentStreak >= rewardStreakRequired;
}

/**
 * Get reward unlock message
 */
export function getRewardUnlockMessage(reward: UnlockableReward): string {
  return `🎉 You've unlocked "${reward.name}"! ${reward.description}`;
}
