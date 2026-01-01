/**
 * Audio Feedback Service for AI Form Coach
 * 
 * Provides voice announcements for rep counting and form feedback
 * using expo-speech for text-to-speech functionality.
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { FormFlag } from './pose-detection';

// Speech configuration
const SPEECH_OPTIONS = {
  language: 'en-US',
  pitch: 1.0,
  rate: Platform.OS === 'ios' ? 0.5 : 0.9, // iOS speaks faster, so slow it down
};

// Cooldown to prevent overlapping speech
let lastSpeechTime = 0;
const SPEECH_COOLDOWN = 1500; // ms between speeches
let isSpeaking = false;

/**
 * Check if speech is available on the device
 */
export async function isSpeechAvailable(): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.length > 0;
  } catch {
    return false;
  }
}

/**
 * Speak text with cooldown to prevent overlapping
 */
async function speak(text: string, priority: 'high' | 'normal' = 'normal'): Promise<void> {
  const now = Date.now();
  
  // Skip if we're in cooldown period (unless high priority)
  if (priority !== 'high' && (isSpeaking || now - lastSpeechTime < SPEECH_COOLDOWN)) {
    return;
  }

  // Stop any current speech for high priority messages
  if (priority === 'high' && isSpeaking) {
    await Speech.stop();
  }

  try {
    isSpeaking = true;
    lastSpeechTime = now;
    
    await Speech.speak(text, {
      ...SPEECH_OPTIONS,
      onDone: () => {
        isSpeaking = false;
      },
      onError: () => {
        isSpeaking = false;
      },
    });
  } catch (error) {
    isSpeaking = false;
    console.log('Speech error:', error);
  }
}

/**
 * Announce rep count
 */
export function announceRep(repNumber: number): void {
  speak(repNumber.toString(), 'high');
}

/**
 * Announce form feedback based on detected flags
 */
export function announceFormFeedback(flags: FormFlag[]): void {
  if (flags.length === 0) return;
  
  // Get the most important flag (highest deduction)
  const sortedFlags = [...flags].sort((a, b) => b.deduction - a.deduction);
  const primaryFlag = sortedFlags[0];
  
  // Convert flag to short verbal cue
  const feedback = getShortFeedback(primaryFlag.type);
  if (feedback) {
    speak(feedback, 'normal');
  }
}

/**
 * Get short verbal feedback for a form flag type
 */
function getShortFeedback(flagType: FormFlag['type']): string | null {
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
}

/**
 * Announce session start
 */
export function announceSessionStart(exerciseName: string): void {
  speak(`Starting ${exerciseName} tracking. Get ready.`, 'high');
}

/**
 * Announce session end with summary
 */
export function announceSessionEnd(totalReps: number, averageScore: number): void {
  let message = `Session complete. ${totalReps} reps.`;
  
  if (averageScore >= 90) {
    message += ' Excellent form!';
  } else if (averageScore >= 75) {
    message += ' Good job!';
  } else if (averageScore >= 60) {
    message += ' Keep working on your form.';
  } else {
    message += ' Focus on form next time.';
  }
  
  speak(message, 'high');
}

/**
 * Announce encouragement for good form
 */
export function announceGoodForm(): void {
  const encouragements = [
    'Nice!',
    'Good form!',
    'Perfect!',
    'Great rep!',
    'Keep it up!',
  ];
  const random = encouragements[Math.floor(Math.random() * encouragements.length)];
  speak(random, 'normal');
}

/**
 * Announce countdown (3, 2, 1, Go!)
 */
export async function announceCountdown(): Promise<void> {
  const delays = [
    { text: '3', delay: 0 },
    { text: '2', delay: 1000 },
    { text: '1', delay: 2000 },
    { text: 'Go!', delay: 3000 },
  ];

  for (const item of delays) {
    await new Promise(resolve => setTimeout(resolve, item.delay === 0 ? 0 : 1000));
    await Speech.speak(item.text, { ...SPEECH_OPTIONS, rate: 1.0 });
  }
}

/**
 * Stop all speech
 */
export function stopSpeech(): void {
  Speech.stop();
  isSpeaking = false;
}

/**
 * Audio feedback manager class for more control
 */
export class AudioFeedbackManager {
  private enabled: boolean = true;
  private lastRepAnnounced: number = 0;
  private consecutiveGoodReps: number = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      stopSpeech();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  reset(): void {
    this.lastRepAnnounced = 0;
    this.consecutiveGoodReps = 0;
    stopSpeech();
  }

  onRepCompleted(repNumber: number, formScore: number, flags: FormFlag[]): void {
    if (!this.enabled) return;

    // Announce rep number
    if (repNumber > this.lastRepAnnounced) {
      this.lastRepAnnounced = repNumber;
      announceRep(repNumber);
    }

    // Track consecutive good reps
    if (formScore >= 80) {
      this.consecutiveGoodReps++;
      // Announce encouragement every 3 good reps
      if (this.consecutiveGoodReps % 3 === 0) {
        setTimeout(() => {
          if (this.enabled) announceGoodForm();
        }, 800);
      }
    } else {
      this.consecutiveGoodReps = 0;
      // Announce form feedback for poor reps
      if (flags.length > 0) {
        setTimeout(() => {
          if (this.enabled) announceFormFeedback(flags);
        }, 800);
      }
    }
  }

  onSessionStart(exerciseName: string): void {
    if (!this.enabled) return;
    announceSessionStart(exerciseName);
  }

  onSessionEnd(totalReps: number, averageScore: number): void {
    if (!this.enabled) return;
    announceSessionEnd(totalReps, averageScore);
  }

  /**
   * Speak arbitrary text with the audio feedback system
   */
  speak(text: string, priority: 'high' | 'normal' = 'normal'): void {
    if (!this.enabled) return;
    speak(text, priority);
  }
}

// Export singleton instance
export const audioFeedback = new AudioFeedbackManager();
