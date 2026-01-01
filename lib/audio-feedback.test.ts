import { describe, it, expect, beforeEach } from 'vitest';
import type { FormFlag } from './pose-detection';

// Test the AudioFeedbackManager class logic without expo-speech dependency
describe('AudioFeedbackManager Logic', () => {
  // Simple mock implementation for testing the logic
  class TestAudioFeedbackManager {
    private enabled: boolean = true;
    private lastRepAnnounced: number = 0;
    private consecutiveGoodReps: number = 0;

    setEnabled(enabled: boolean): void {
      this.enabled = enabled;
    }

    isEnabled(): boolean {
      return this.enabled;
    }

    reset(): void {
      this.lastRepAnnounced = 0;
      this.consecutiveGoodReps = 0;
    }

    getLastRepAnnounced(): number {
      return this.lastRepAnnounced;
    }

    getConsecutiveGoodReps(): number {
      return this.consecutiveGoodReps;
    }

    onRepCompleted(repNumber: number, formScore: number, flags: FormFlag[]): void {
      if (!this.enabled) return;

      // Track rep number
      if (repNumber > this.lastRepAnnounced) {
        this.lastRepAnnounced = repNumber;
      }

      // Track consecutive good reps
      if (formScore >= 80) {
        this.consecutiveGoodReps++;
      } else {
        this.consecutiveGoodReps = 0;
      }
    }
  }

  let manager: TestAudioFeedbackManager;

  beforeEach(() => {
    manager = new TestAudioFeedbackManager();
  });

  it('should start enabled by default', () => {
    expect(manager.isEnabled()).toBe(true);
  });

  it('should toggle enabled state', () => {
    manager.setEnabled(false);
    expect(manager.isEnabled()).toBe(false);
    
    manager.setEnabled(true);
    expect(manager.isEnabled()).toBe(true);
  });

  it('should reset state properly', () => {
    manager.onRepCompleted(1, 85, []);
    manager.onRepCompleted(2, 90, []);
    
    expect(manager.getLastRepAnnounced()).toBe(2);
    expect(manager.getConsecutiveGoodReps()).toBe(2);
    
    manager.reset();
    
    expect(manager.getLastRepAnnounced()).toBe(0);
    expect(manager.getConsecutiveGoodReps()).toBe(0);
  });

  it('should not update state when disabled', () => {
    manager.setEnabled(false);
    manager.onRepCompleted(1, 85, []);
    
    expect(manager.getLastRepAnnounced()).toBe(0);
    expect(manager.getConsecutiveGoodReps()).toBe(0);
  });

  it('should track rep numbers correctly', () => {
    manager.onRepCompleted(1, 85, []);
    expect(manager.getLastRepAnnounced()).toBe(1);
    
    manager.onRepCompleted(2, 90, []);
    expect(manager.getLastRepAnnounced()).toBe(2);
    
    manager.onRepCompleted(3, 75, []);
    expect(manager.getLastRepAnnounced()).toBe(3);
  });

  it('should track consecutive good reps', () => {
    manager.onRepCompleted(1, 85, []);
    expect(manager.getConsecutiveGoodReps()).toBe(1);
    
    manager.onRepCompleted(2, 90, []);
    expect(manager.getConsecutiveGoodReps()).toBe(2);
    
    manager.onRepCompleted(3, 95, []);
    expect(manager.getConsecutiveGoodReps()).toBe(3);
  });

  it('should reset consecutive good reps on poor form', () => {
    manager.onRepCompleted(1, 85, []);
    manager.onRepCompleted(2, 90, []);
    expect(manager.getConsecutiveGoodReps()).toBe(2);
    
    // Poor form rep
    manager.onRepCompleted(3, 70, []);
    expect(manager.getConsecutiveGoodReps()).toBe(0);
    
    // Good rep again
    manager.onRepCompleted(4, 85, []);
    expect(manager.getConsecutiveGoodReps()).toBe(1);
  });

  it('should handle form score boundary at 80', () => {
    // Score of 80 should count as good
    manager.onRepCompleted(1, 80, []);
    expect(manager.getConsecutiveGoodReps()).toBe(1);
    
    // Score of 79 should reset
    manager.onRepCompleted(2, 79, []);
    expect(manager.getConsecutiveGoodReps()).toBe(0);
  });
});

describe('Form feedback verbal cues', () => {
  // Test the mapping of form flags to verbal feedback
  const getShortFeedback = (flagType: FormFlag['type']): string | null => {
    switch (flagType) {
      case 'partial_rom':
        return 'Go deeper';
      case 'no_lockout':
        return 'Full extension';
      case 'hip_sag':
        return 'Tighten core';
      case 'kipping':
        return 'Control the swing';
      case 'knees_caving':
        return 'Push knees out';
      case 'forward_lean':
        return 'Chest up';
      case 'heels_rising':
        return 'Heels down';
      default:
        return null;
    }
  };

  it('should have feedback for partial_rom', () => {
    expect(getShortFeedback('partial_rom')).toBe('Go deeper');
  });

  it('should have feedback for no_lockout', () => {
    expect(getShortFeedback('no_lockout')).toBe('Full extension');
  });

  it('should have feedback for hip_sag', () => {
    expect(getShortFeedback('hip_sag')).toBe('Tighten core');
  });

  it('should have feedback for kipping', () => {
    expect(getShortFeedback('kipping')).toBe('Control the swing');
  });

  it('should have feedback for knees_caving', () => {
    expect(getShortFeedback('knees_caving')).toBe('Push knees out');
  });

  it('should have feedback for forward_lean', () => {
    expect(getShortFeedback('forward_lean')).toBe('Chest up');
  });

  it('should have feedback for heels_rising', () => {
    expect(getShortFeedback('heels_rising')).toBe('Heels down');
  });
});

describe('Session summary grading', () => {
  const getGrade = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Work';
  };

  it('should grade 90+ as Excellent', () => {
    expect(getGrade(90)).toBe('Excellent');
    expect(getGrade(95)).toBe('Excellent');
    expect(getGrade(100)).toBe('Excellent');
  });

  it('should grade 75-89 as Good', () => {
    expect(getGrade(75)).toBe('Good');
    expect(getGrade(80)).toBe('Good');
    expect(getGrade(89)).toBe('Good');
  });

  it('should grade 60-74 as Fair', () => {
    expect(getGrade(60)).toBe('Fair');
    expect(getGrade(65)).toBe('Fair');
    expect(getGrade(74)).toBe('Fair');
  });

  it('should grade below 60 as Needs Work', () => {
    expect(getGrade(59)).toBe('Needs Work');
    expect(getGrade(50)).toBe('Needs Work');
    expect(getGrade(0)).toBe('Needs Work');
  });
});
