/**
 * Rest Day Recommendation Engine
 * 
 * Analyzes WHOOP recovery and strain data to recommend rest days.
 */

import { getTodayRecovery, getRecoveryRange, shouldRecommendRest } from './whoop-api';

export interface RestRecommendation {
  recommended: boolean;
  recoveryScore: number;
  reason: string;
  intensity: 'rest' | 'light' | 'moderate' | 'intense';
  nextGoodTrainingDay?: string;
}

export interface WeeklyRecommendation {
  date: string;
  recoveryScore: number;
  recommended: boolean;
  intensity: 'rest' | 'light' | 'moderate' | 'intense';
}

/**
 * Get rest recommendation for today
 */
export async function getTodayRecommendation(): Promise<RestRecommendation | null> {
  try {
    const recovery = await getTodayRecovery();
    if (!recovery?.score) {
      return {
        recommended: false,
        recoveryScore: 0,
        reason: 'Unable to fetch recovery data',
        intensity: 'moderate',
      };
    }

    const score = recovery.score.recoveryScore;
    const shouldRest = shouldRecommendRest(score);

    if (shouldRest) {
      return {
        recommended: true,
        recoveryScore: score,
        reason: 'Your recovery is low. Rest today to optimize performance.',
        intensity: 'rest',
      };
    }

    if (score < 50) {
      return {
        recommended: false,
        recoveryScore: score,
        reason: 'Recovery is fair. Light training recommended.',
        intensity: 'light',
      };
    }

    if (score < 67) {
      return {
        recommended: false,
        recoveryScore: score,
        reason: 'Recovery is good. Moderate training is fine.',
        intensity: 'moderate',
      };
    }

    return {
      recommended: false,
      recoveryScore: score,
      reason: 'Excellent recovery! You can train intensely today.',
      intensity: 'intense',
    };
  } catch (error) {
    console.error('Error getting today recommendation:', error);
    return null;
  }
}

/**
 * Get weekly recommendations
 */
export async function getWeeklyRecommendations(): Promise<WeeklyRecommendation[]> {
  try {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];

    const recoveries = await getRecoveryRange(startStr, endStr);

    return recoveries.map(recovery => {
      const score = recovery.score?.recoveryScore || 0;
      const shouldRest = score < 33;
      let intensity: 'rest' | 'light' | 'moderate' | 'intense' = 'moderate';

      if (shouldRest) {
        intensity = 'rest';
      } else if (score < 50) {
        intensity = 'light';
      } else if (score >= 67) {
        intensity = 'intense';
      }

      return {
        date: recovery.dayStart,
        recoveryScore: score,
        recommended: shouldRest,
        intensity,
      };
    });
  } catch (error) {
    console.error('Error getting weekly recommendations:', error);
    return [];
  }
}

/**
 * Find next good training day
 */
export async function findNextGoodTrainingDay(): Promise<string | null> {
  try {
    const recommendations = await getWeeklyRecommendations();
    
    // Find first day with good recovery (score >= 50)
    for (const rec of recommendations) {
      if (rec.recoveryScore >= 50) {
        return rec.date;
      }
    }

    // If no good day found in the week, check next week
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      
      // Assume recovery improves over time
      if (i >= 2) {
        return checkDate.toISOString().split('T')[0];
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding next good training day:', error);
    return null;
  }
}

/**
 * Get recovery trend (improving or declining)
 */
export async function getRecoveryTrend(): Promise<'improving' | 'declining' | 'stable'> {
  try {
    const recommendations = await getWeeklyRecommendations();
    if (recommendations.length < 2) return 'stable';

    const recent = recommendations.slice(-3);
    const scores = recent.map(r => r.recoveryScore);

    const firstScore = scores[0];
    const lastScore = scores[scores.length - 1];
    const diff = lastScore - firstScore;

    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  } catch (error) {
    console.error('Error getting recovery trend:', error);
    return 'stable';
  }
}

/**
 * Get motivational message based on recovery
 */
export function getRecoveryMessage(score: number, trend: 'improving' | 'declining' | 'stable'): string {
  if (score >= 67) {
    if (trend === 'improving') {
      return '🚀 Your recovery is excellent and improving! Push hard today!';
    }
    return '💪 Excellent recovery! You\'re ready for an intense session!';
  }

  if (score >= 50) {
    if (trend === 'improving') {
      return '📈 Recovery is improving! Good day for training.';
    }
    if (trend === 'declining') {
      return '⚠️ Recovery is declining. Consider lighter training.';
    }
    return '✅ Recovery is stable. Good day for training.';
  }

  if (score >= 33) {
    return '🟡 Recovery is fair. Light training recommended.';
  }

  return '🛑 Recovery is low. Rest day recommended to bounce back stronger!';
}
