/**
 * Streak Milestones & Badges System
 * 
 * Manages achievement milestones and badges for workout streaks.
 */

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  milestone: number;
  unlockedAt?: number;
}

export interface MilestoneProgress {
  currentStreak: number;
  unlockedBadges: Badge[];
  nextMilestone: Badge | null;
  daysUntilNextMilestone: number;
}

const MILESTONES: Badge[] = [
  {
    id: 'week_warrior',
    name: '🔥 Week Warrior',
    description: 'Completed 7 consecutive workouts',
    icon: '🔥',
    milestone: 7,
  },
  {
    id: 'month_master',
    name: '💪 Month Master',
    description: 'Completed 30 consecutive workouts',
    icon: '💪',
    milestone: 30,
  },
  {
    id: 'century_champion',
    name: '🏆 Century Champion',
    description: 'Completed 100 consecutive workouts',
    icon: '🏆',
    milestone: 100,
  },
];

/**
 * Get all available milestones
 */
export function getAllMilestones(): Badge[] {
  return MILESTONES;
}

/**
 * Check which milestones have been unlocked
 */
export function getUnlockedBadges(currentStreak: number): Badge[] {
  return MILESTONES.filter(badge => currentStreak >= badge.milestone);
}

/**
 * Get the next milestone to work towards
 */
export function getNextMilestone(currentStreak: number): Badge | null {
  const nextMilestone = MILESTONES.find(badge => currentStreak < badge.milestone);
  return nextMilestone || null;
}

/**
 * Get milestone progress information
 */
export function getMilestoneProgress(currentStreak: number): MilestoneProgress {
  const unlockedBadges = getUnlockedBadges(currentStreak);
  const nextMilestone = getNextMilestone(currentStreak);
  const daysUntilNextMilestone = nextMilestone 
    ? nextMilestone.milestone - currentStreak 
    : 0;

  return {
    currentStreak,
    unlockedBadges,
    nextMilestone,
    daysUntilNextMilestone,
  };
}

/**
 * Check if a new milestone was just unlocked
 */
export function checkNewMilestoneUnlocked(
  previousStreak: number,
  currentStreak: number
): Badge | null {
  const previousBadges = getUnlockedBadges(previousStreak);
  const currentBadges = getUnlockedBadges(currentStreak);

  // Find newly unlocked badges
  const newBadges = currentBadges.filter(
    badge => !previousBadges.find(b => b.id === badge.id)
  );

  return newBadges.length > 0 ? newBadges[0] : null;
}

/**
 * Get motivational message based on streak
 */
export function getStreakMessage(currentStreak: number): string {
  if (currentStreak === 0) {
    return 'Start your streak today! 🚀';
  }
  if (currentStreak === 1) {
    return 'Great start! Keep it going! 💪';
  }
  if (currentStreak < 7) {
    return `${currentStreak} days strong! Almost to Week Warrior! 🔥`;
  }
  if (currentStreak < 30) {
    return `${currentStreak} days! Month Master is within reach! 💪`;
  }
  if (currentStreak < 100) {
    return `${currentStreak} days! Century Champion awaits! 🏆`;
  }
  return `${currentStreak} days! You're unstoppable! 🌟`;
}
