/**
 * AI Coach Service
 * 
 * Provides intelligent coaching with:
 * - Form adjustment phase before workout
 * - Real-time corrective feedback
 * - Motivational phrases
 * - Position guidance
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { Pose, Keypoint, KEYPOINTS, ExerciseType, FormFlag } from './pose-detection';

// Speech configuration
const SPEECH_OPTIONS = {
  language: 'en-US',
  pitch: 1.0,
  rate: Platform.OS === 'ios' ? 0.5 : 0.85,
};

// Coaching state
export type CoachingPhase = 'positioning' | 'ready' | 'tracking' | 'rest' | 'complete';

export interface CoachingState {
  phase: CoachingPhase;
  message: string;
  subMessage?: string;
  isPositionCorrect: boolean;
  positionIssues: string[];
  lastSpokenTime: number;
  consecutiveGoodFrames: number;
  totalGoodFrames: number;
}

// Position requirements for each exercise
interface PositionRequirement {
  checkVisibility: (pose: Pose) => { visible: boolean; missing: string[] };
  checkPosition: (pose: Pose) => { correct: boolean; issues: string[] };
  getStartPosition: () => string;
}

const POSITION_REQUIREMENTS: Record<ExerciseType, PositionRequirement> = {
  pushup: {
    checkVisibility: (pose) => {
      const required = [
        KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
        KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW,
        KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST,
        KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
      ];
      const missing: string[] = [];
      required.forEach(idx => {
        if (!pose.keypoints[idx] || pose.keypoints[idx].score < 0.5) {
          missing.push(getKeypointName(idx));
        }
      });
      return { visible: missing.length === 0, missing };
    },
    checkPosition: (pose) => {
      const issues: string[] = [];
      const kp = pose.keypoints;
      
      // Check if in plank position (shoulders above wrists)
      if (kp[KEYPOINTS.LEFT_SHOULDER] && kp[KEYPOINTS.LEFT_WRIST]) {
        const shoulderY = kp[KEYPOINTS.LEFT_SHOULDER].y;
        const wristY = kp[KEYPOINTS.LEFT_WRIST].y;
        if (shoulderY > wristY + 50) {
          issues.push('Get into plank position with hands on ground');
        }
      }
      
      // Check body alignment (hips not too high or low)
      if (kp[KEYPOINTS.LEFT_SHOULDER] && kp[KEYPOINTS.LEFT_HIP] && kp[KEYPOINTS.LEFT_ANKLE]) {
        const shoulderY = kp[KEYPOINTS.LEFT_SHOULDER].y;
        const hipY = kp[KEYPOINTS.LEFT_HIP].y;
        const ankleY = kp[KEYPOINTS.LEFT_ANKLE].y;
        
        // Calculate expected hip position for straight body
        const expectedHipY = shoulderY + (ankleY - shoulderY) * 0.5;
        if (Math.abs(hipY - expectedHipY) > 60) {
          if (hipY < expectedHipY) {
            issues.push('Lower your hips to form a straight line');
          } else {
            issues.push('Raise your hips to form a straight line');
          }
        }
      }
      
      return { correct: issues.length === 0, issues };
    },
    getStartPosition: () => 'Get into plank position with arms extended',
  },
  
  pullup: {
    checkVisibility: (pose) => {
      const required = [
        KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
        KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW,
        KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST,
        KEYPOINTS.NOSE,
      ];
      const missing: string[] = [];
      required.forEach(idx => {
        if (!pose.keypoints[idx] || pose.keypoints[idx].score < 0.5) {
          missing.push(getKeypointName(idx));
        }
      });
      return { visible: missing.length === 0, missing };
    },
    checkPosition: (pose) => {
      const issues: string[] = [];
      const kp = pose.keypoints;
      
      // Check if arms are extended (hanging position)
      if (kp[KEYPOINTS.LEFT_SHOULDER] && kp[KEYPOINTS.LEFT_ELBOW]) {
        const shoulderY = kp[KEYPOINTS.LEFT_SHOULDER].y;
        const elbowY = kp[KEYPOINTS.LEFT_ELBOW].y;
        
        // Arms should be mostly straight (elbow below shoulder)
        if (elbowY < shoulderY) {
          issues.push('Extend your arms fully to hang from the bar');
        }
      }
      
      // Check if hands are above head
      if (kp[KEYPOINTS.LEFT_WRIST] && kp[KEYPOINTS.NOSE]) {
        const wristY = kp[KEYPOINTS.LEFT_WRIST].y;
        const noseY = kp[KEYPOINTS.NOSE].y;
        
        if (wristY > noseY) {
          issues.push('Grip the bar above your head');
        }
      }
      
      return { correct: issues.length === 0, issues };
    },
    getStartPosition: () => 'Hang from the bar with arms fully extended',
  },
  
  squat: {
    checkVisibility: (pose) => {
      const required = [
        KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
        KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
        KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE,
        KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE,
      ];
      const missing: string[] = [];
      required.forEach(idx => {
        if (!pose.keypoints[idx] || pose.keypoints[idx].score < 0.5) {
          missing.push(getKeypointName(idx));
        }
      });
      return { visible: missing.length === 0, missing };
    },
    checkPosition: (pose) => {
      const issues: string[] = [];
      const kp = pose.keypoints;
      
      // Check if standing upright
      if (kp[KEYPOINTS.LEFT_HIP] && kp[KEYPOINTS.LEFT_KNEE]) {
        const hipY = kp[KEYPOINTS.LEFT_HIP].y;
        const kneeY = kp[KEYPOINTS.LEFT_KNEE].y;
        
        // Hip should be above knee when standing
        if (hipY > kneeY - 30) {
          issues.push('Stand up straight to start');
        }
      }
      
      // Check feet width
      if (kp[KEYPOINTS.LEFT_ANKLE] && kp[KEYPOINTS.RIGHT_ANKLE]) {
        const leftAnkleX = kp[KEYPOINTS.LEFT_ANKLE].x;
        const rightAnkleX = kp[KEYPOINTS.RIGHT_ANKLE].x;
        const feetWidth = Math.abs(rightAnkleX - leftAnkleX);
        
        if (kp[KEYPOINTS.LEFT_SHOULDER] && kp[KEYPOINTS.RIGHT_SHOULDER]) {
          const shoulderWidth = Math.abs(
            kp[KEYPOINTS.RIGHT_SHOULDER].x - kp[KEYPOINTS.LEFT_SHOULDER].x
          );
          
          if (feetWidth < shoulderWidth * 0.7) {
            issues.push('Widen your stance to shoulder width');
          }
        }
      }
      
      return { correct: issues.length === 0, issues };
    },
    getStartPosition: () => 'Stand with feet shoulder-width apart',
  },
  
  rdl: {
    checkVisibility: (pose) => {
      const required = [
        KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
        KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
        KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE,
        KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE,
      ];
      const missing: string[] = [];
      required.forEach(idx => {
        if (!pose.keypoints[idx] || pose.keypoints[idx].score < 0.5) {
          missing.push(getKeypointName(idx));
        }
      });
      return { visible: missing.length === 0, missing };
    },
    checkPosition: (pose) => {
      const issues: string[] = [];
      const kp = pose.keypoints;
      
      // Check if standing upright
      if (kp[KEYPOINTS.LEFT_HIP] && kp[KEYPOINTS.LEFT_KNEE]) {
        const hipY = kp[KEYPOINTS.LEFT_HIP].y;
        const kneeY = kp[KEYPOINTS.LEFT_KNEE].y;
        
        // Hip should be above knee when standing
        if (hipY > kneeY - 30) {
          issues.push('Stand up straight to start');
        }
      }
      
      // Check back is straight (shoulders above hips)
      if (kp[KEYPOINTS.LEFT_SHOULDER] && kp[KEYPOINTS.LEFT_HIP]) {
        const shoulderY = kp[KEYPOINTS.LEFT_SHOULDER].y;
        const hipY = kp[KEYPOINTS.LEFT_HIP].y;
        
        if (shoulderY > hipY) {
          issues.push('Stand tall with shoulders above hips');
        }
      }
      
      return { correct: issues.length === 0, issues };
    },
    getStartPosition: () => 'Stand with feet hip-width apart, slight knee bend',
  },
};

// Motivational phrases
const MOTIVATIONAL_PHRASES = [
  "Great form! Keep it up!",
  "You're doing amazing!",
  "Perfect! Stay focused!",
  "Excellent work!",
  "That's the way!",
  "Strong rep!",
  "Looking good!",
  "Nice and controlled!",
];

// Corrective phrases for specific issues
const CORRECTIVE_PHRASES: Record<string, string[]> = {
  partial_rom: [
    "Go all the way down",
    "Full range of motion",
    "Deeper! You got this!",
  ],
  no_lockout: [
    "Extend fully at the top",
    "Lock out those arms",
    "Complete the movement",
  ],
  hip_sag: [
    "Tighten your core",
    "Keep your body straight",
    "Engage your abs",
  ],
  kipping: [
    "Control the swing",
    "No swinging, stay strict",
    "Use your muscles, not momentum",
  ],
  knees_caving: [
    "Push your knees out",
    "Track knees over toes",
    "Don't let knees cave in",
  ],
  forward_lean: [
    "Chest up!",
    "Keep your torso upright",
    "Don't lean forward",
  ],
  heels_rising: [
    "Keep heels on the ground",
    "Press through your heels",
    "Heels down!",
  ],
};

// AI Coach class
export class AICoach {
  private state: CoachingState;
  private exerciseType: ExerciseType;
  private enabled: boolean = true;
  private lastSpeechTime: number = 0;
  private speechCooldown: number = 2000; // ms between speeches
  private motivationCounter: number = 0;
  private lastCorrectiveType: string = '';

  constructor(exerciseType: ExerciseType) {
    this.exerciseType = exerciseType;
    this.state = {
      phase: 'positioning',
      message: 'Position yourself in frame',
      subMessage: POSITION_REQUIREMENTS[exerciseType].getStartPosition(),
      isPositionCorrect: false,
      positionIssues: [],
      lastSpokenTime: 0,
      consecutiveGoodFrames: 0,
      totalGoodFrames: 0,
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getState(): CoachingState {
    return { ...this.state };
  }

  getPhase(): CoachingPhase {
    return this.state.phase;
  }

  // Process pose during positioning phase
  processPositioning(pose: Pose | null): CoachingState {
    if (!pose) {
      this.state.message = 'Step into the camera view';
      this.state.subMessage = 'Make sure your full body is visible';
      this.state.isPositionCorrect = false;
      this.state.consecutiveGoodFrames = 0;
      this.speak('Step into the camera view');
      return this.getState();
    }

    const requirements = POSITION_REQUIREMENTS[this.exerciseType];
    
    // Check visibility first
    const visibility = requirements.checkVisibility(pose);
    if (!visibility.visible) {
      this.state.message = 'Adjust your position';
      this.state.subMessage = `Can't see: ${visibility.missing.slice(0, 3).join(', ')}`;
      this.state.isPositionCorrect = false;
      this.state.consecutiveGoodFrames = 0;
      this.state.positionIssues = visibility.missing;
      
      if (visibility.missing.length > 0) {
        this.speak(`I need to see your ${visibility.missing[0].replace('_', ' ')}`);
      }
      return this.getState();
    }

    // Check position
    const position = requirements.checkPosition(pose);
    if (!position.correct) {
      this.state.message = 'Adjust your form';
      this.state.subMessage = position.issues[0];
      this.state.isPositionCorrect = false;
      this.state.consecutiveGoodFrames = 0;
      this.state.positionIssues = position.issues;
      
      this.speak(position.issues[0]);
      return this.getState();
    }

    // Position is correct
    this.state.consecutiveGoodFrames++;
    this.state.positionIssues = [];
    
    // Need 10 consecutive good frames to confirm ready
    if (this.state.consecutiveGoodFrames >= 10) {
      this.state.phase = 'ready';
      this.state.message = 'Perfect! Ready to start';
      this.state.subMessage = 'Tap Start when ready';
      this.state.isPositionCorrect = true;
      this.speak('Perfect position! Tap start when you are ready');
    } else {
      this.state.message = 'Hold that position...';
      this.state.subMessage = `${10 - this.state.consecutiveGoodFrames} more seconds`;
      this.state.isPositionCorrect = false;
    }

    return this.getState();
  }

  // Start tracking phase
  startTracking(): void {
    this.state.phase = 'tracking';
    this.state.message = 'Go!';
    this.state.subMessage = '';
    this.motivationCounter = 0;
    this.speak("Let's go! Start your reps!");
  }

  // Process rep completion with coaching
  onRepCompleted(repNumber: number, formScore: number, flags: FormFlag[]): void {
    if (!this.enabled) return;

    // Announce rep number
    this.speak(repNumber.toString(), 'high');

    // Check if we need corrective feedback
    if (flags.length > 0 && formScore < 80) {
      const flag = flags[0];
      const phrases = CORRECTIVE_PHRASES[flag.type];
      if (phrases && flag.type !== this.lastCorrectiveType) {
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        setTimeout(() => this.speak(phrase), 500);
        this.lastCorrectiveType = flag.type;
      }
    } else {
      // Good form - occasional motivation
      this.motivationCounter++;
      if (this.motivationCounter % 3 === 0) {
        const phrase = MOTIVATIONAL_PHRASES[
          Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)
        ];
        setTimeout(() => this.speak(phrase), 500);
      }
      this.lastCorrectiveType = '';
    }
  }

  // Real-time form feedback during movement
  onFormIssueDetected(flags: FormFlag[]): void {
    if (!this.enabled || flags.length === 0) return;
    
    const now = Date.now();
    if (now - this.lastSpeechTime < this.speechCooldown) return;

    // Only speak about the most severe issue
    const sortedFlags = [...flags].sort((a, b) => b.deduction - a.deduction);
    const worstFlag = sortedFlags[0];
    
    const phrases = CORRECTIVE_PHRASES[worstFlag.type];
    if (phrases) {
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      this.speak(phrase);
    }
  }

  // Session complete
  onSessionComplete(totalReps: number, avgScore: number): void {
    this.state.phase = 'complete';
    
    let message: string;
    if (avgScore >= 90) {
      message = `Excellent workout! ${totalReps} reps with outstanding form!`;
    } else if (avgScore >= 75) {
      message = `Great job! ${totalReps} reps completed. Good form overall!`;
    } else if (avgScore >= 60) {
      message = `Nice work! ${totalReps} reps done. Keep practicing your form!`;
    } else {
      message = `${totalReps} reps completed. Focus on form next time!`;
    }
    
    this.speak(message, 'high');
  }

  // Speak with cooldown
  private async speak(text: string, priority: 'high' | 'normal' = 'normal'): Promise<void> {
    if (!this.enabled) return;
    
    const now = Date.now();
    if (priority !== 'high' && now - this.lastSpeechTime < this.speechCooldown) {
      return;
    }

    if (priority === 'high') {
      await Speech.stop();
    }

    this.lastSpeechTime = now;
    
    try {
      await Speech.speak(text, SPEECH_OPTIONS);
    } catch (error) {
      console.warn('Speech error:', error);
    }
  }

  // Reset coach state
  reset(): void {
    this.state = {
      phase: 'positioning',
      message: 'Position yourself in frame',
      subMessage: POSITION_REQUIREMENTS[this.exerciseType].getStartPosition(),
      isPositionCorrect: false,
      positionIssues: [],
      lastSpokenTime: 0,
      consecutiveGoodFrames: 0,
      totalGoodFrames: 0,
    };
    this.motivationCounter = 0;
    this.lastCorrectiveType = '';
  }
}

// Helper function
function getKeypointName(index: number): string {
  const names = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
  ];
  return names[index] || 'unknown';
}

export default AICoach;
