/**
 * Rep State Machine with Smoothing and Debounce
 * 
 * Implements reliable rep counting with:
 * - Smoothed angle transitions
 * - Debounce to prevent double-counting
 * - Hysteresis for stable state transitions
 * - Exercise-specific state machines
 */

import { Pose, Keypoint, ExerciseType, KEYPOINTS, FormFlag, RepData } from './pose-detection';

// State machine states
export type RepState = 'idle' | 'starting' | 'down' | 'up' | 'completed';

// Configuration for state machine
export interface StateMachineConfig {
  // Angle thresholds
  downAngleThreshold: number;
  upAngleThreshold: number;
  // Hysteresis (prevents oscillation)
  hysteresis: number;
  // Debounce time in ms
  debounceMs: number;
  // Minimum rep duration in ms
  minRepDurationMs: number;
  // Smoothing window size
  smoothingWindow: number;
}

// Default configs for each exercise
const DEFAULT_CONFIGS: Record<ExerciseType, StateMachineConfig> = {
  pushup: {
    downAngleThreshold: 90,    // Elbow angle for "down" position
    upAngleThreshold: 160,     // Elbow angle for "up" position
    hysteresis: 10,            // 10 degree buffer
    debounceMs: 300,           // Minimum 300ms between reps
    minRepDurationMs: 500,     // Minimum 500ms for a complete rep
    smoothingWindow: 5,        // Average over 5 frames
  },
  pullup: {
    downAngleThreshold: 160,   // Elbow angle for "down" (hanging)
    upAngleThreshold: 70,      // Elbow angle for "up" (chin over bar)
    hysteresis: 10,
    debounceMs: 400,
    minRepDurationMs: 800,
    smoothingWindow: 5,
  },
  squat: {
    downAngleThreshold: 90,    // Knee angle for "down" (parallel)
    upAngleThreshold: 160,     // Knee angle for "up" (standing)
    hysteresis: 10,
    debounceMs: 400,
    minRepDurationMs: 800,
    smoothingWindow: 5,
  },
  rdl: {
    downAngleThreshold: 100,   // Hip angle for "down" (hinged)
    upAngleThreshold: 170,     // Hip angle for "up" (standing)
    hysteresis: 10,
    debounceMs: 500,
    minRepDurationMs: 1000,
    smoothingWindow: 5,
  },
};

// Angle history for smoothing
interface AngleHistory {
  values: number[];
  timestamps: number[];
}

/**
 * Calculate angle between three points
 */
export function calculateAngle(p1: Keypoint, p2: Keypoint, p3: Keypoint): number {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - 
                  Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs(radians * 180 / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

/**
 * Get the primary angle for an exercise
 */
function getPrimaryAngle(pose: Pose, exerciseType: ExerciseType): number | null {
  const kp = pose.keypoints;
  
  switch (exerciseType) {
    case 'pushup': {
      // Use average of both elbow angles
      const leftElbow = getElbowAngle(kp, 'left');
      const rightElbow = getElbowAngle(kp, 'right');
      if (leftElbow !== null && rightElbow !== null) {
        return (leftElbow + rightElbow) / 2;
      }
      return leftElbow ?? rightElbow;
    }
    case 'pullup': {
      // Use average of both elbow angles
      const leftElbow = getElbowAngle(kp, 'left');
      const rightElbow = getElbowAngle(kp, 'right');
      if (leftElbow !== null && rightElbow !== null) {
        return (leftElbow + rightElbow) / 2;
      }
      return leftElbow ?? rightElbow;
    }
    case 'squat': {
      // Use average of both knee angles
      const leftKnee = getKneeAngle(kp, 'left');
      const rightKnee = getKneeAngle(kp, 'right');
      if (leftKnee !== null && rightKnee !== null) {
        return (leftKnee + rightKnee) / 2;
      }
      return leftKnee ?? rightKnee;
    }
    case 'rdl': {
      // Use hip angle (torso to thigh)
      return getHipAngle(kp);
    }
    default:
      return null;
  }
}

function getElbowAngle(kp: Keypoint[], side: 'left' | 'right'): number | null {
  const shoulderIdx = side === 'left' ? KEYPOINTS.LEFT_SHOULDER : KEYPOINTS.RIGHT_SHOULDER;
  const elbowIdx = side === 'left' ? KEYPOINTS.LEFT_ELBOW : KEYPOINTS.RIGHT_ELBOW;
  const wristIdx = side === 'left' ? KEYPOINTS.LEFT_WRIST : KEYPOINTS.RIGHT_WRIST;
  
  const shoulder = kp[shoulderIdx];
  const elbow = kp[elbowIdx];
  const wrist = kp[wristIdx];
  
  if (!shoulder || !elbow || !wrist) return null;
  if (shoulder.score < 0.3 || elbow.score < 0.3 || wrist.score < 0.3) return null;
  
  return calculateAngle(shoulder, elbow, wrist);
}

function getKneeAngle(kp: Keypoint[], side: 'left' | 'right'): number | null {
  const hipIdx = side === 'left' ? KEYPOINTS.LEFT_HIP : KEYPOINTS.RIGHT_HIP;
  const kneeIdx = side === 'left' ? KEYPOINTS.LEFT_KNEE : KEYPOINTS.RIGHT_KNEE;
  const ankleIdx = side === 'left' ? KEYPOINTS.LEFT_ANKLE : KEYPOINTS.RIGHT_ANKLE;
  
  const hip = kp[hipIdx];
  const knee = kp[kneeIdx];
  const ankle = kp[ankleIdx];
  
  if (!hip || !knee || !ankle) return null;
  if (hip.score < 0.3 || knee.score < 0.3 || ankle.score < 0.3) return null;
  
  return calculateAngle(hip, knee, ankle);
}

function getHipAngle(kp: Keypoint[]): number | null {
  // Use left side for hip angle (shoulder-hip-knee)
  const shoulder = kp[KEYPOINTS.LEFT_SHOULDER];
  const hip = kp[KEYPOINTS.LEFT_HIP];
  const knee = kp[KEYPOINTS.LEFT_KNEE];
  
  if (!shoulder || !hip || !knee) return null;
  if (shoulder.score < 0.3 || hip.score < 0.3 || knee.score < 0.3) return null;
  
  return calculateAngle(shoulder, hip, knee);
}

/**
 * Improved Rep State Machine
 */
export class ImprovedRepStateMachine {
  private exerciseType: ExerciseType;
  private config: StateMachineConfig;
  private state: RepState = 'idle';
  private repCount: number = 0;
  private lastRepTime: number = 0;
  private repStartTime: number = 0;
  private angleHistory: AngleHistory = { values: [], timestamps: [] };
  private minAngleInRep: number = 180;
  private maxAngleInRep: number = 0;
  private formFlags: FormFlag[] = [];

  constructor(exerciseType: ExerciseType, customConfig?: Partial<StateMachineConfig>) {
    this.exerciseType = exerciseType;
    this.config = { ...DEFAULT_CONFIGS[exerciseType], ...customConfig };
  }

  /**
   * Process a new pose frame
   */
  processFrame(pose: Pose): {
    state: RepState;
    repCompleted: boolean;
    repData: RepData | null;
    currentAngle: number | null;
    smoothedAngle: number | null;
  } {
    const currentAngle = getPrimaryAngle(pose, this.exerciseType);
    
    if (currentAngle === null) {
      return {
        state: this.state,
        repCompleted: false,
        repData: null,
        currentAngle: null,
        smoothedAngle: null,
      };
    }

    // Add to history for smoothing
    const now = Date.now();
    this.angleHistory.values.push(currentAngle);
    this.angleHistory.timestamps.push(now);
    
    // Keep only recent values
    while (this.angleHistory.values.length > this.config.smoothingWindow) {
      this.angleHistory.values.shift();
      this.angleHistory.timestamps.shift();
    }

    // Calculate smoothed angle
    const smoothedAngle = this.getSmoothedAngle();
    
    // Track min/max angles during rep
    if (this.state === 'down' || this.state === 'up') {
      this.minAngleInRep = Math.min(this.minAngleInRep, smoothedAngle);
      this.maxAngleInRep = Math.max(this.maxAngleInRep, smoothedAngle);
    }

    // Process state transition
    const result = this.processStateTransition(smoothedAngle, now, pose);

    return {
      ...result,
      currentAngle,
      smoothedAngle,
    };
  }

  private getSmoothedAngle(): number {
    if (this.angleHistory.values.length === 0) return 0;
    
    // Weighted moving average (recent values weighted more)
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < this.angleHistory.values.length; i++) {
      const weight = i + 1;
      weightedSum += this.angleHistory.values[i] * weight;
      weightSum += weight;
    }
    
    return weightedSum / weightSum;
  }

  private processStateTransition(angle: number, now: number, pose: Pose): {
    state: RepState;
    repCompleted: boolean;
    repData: RepData | null;
  } {
    const { downAngleThreshold, upAngleThreshold, hysteresis, debounceMs, minRepDurationMs } = this.config;
    
    let repCompleted = false;
    let repData: RepData | null = null;

    // State machine logic with hysteresis
    switch (this.state) {
      case 'idle':
        // Wait for starting position (up position)
        if (this.isInUpPosition(angle, upAngleThreshold, hysteresis)) {
          this.state = 'starting';
        }
        break;

      case 'starting':
        // Detect start of descent
        if (this.isInDownPosition(angle, downAngleThreshold, hysteresis)) {
          this.state = 'down';
          this.repStartTime = now;
          this.minAngleInRep = angle;
          this.maxAngleInRep = angle;
          this.formFlags = [];
        }
        break;

      case 'down':
        // Wait for ascent
        if (this.isInUpPosition(angle, upAngleThreshold, hysteresis)) {
          // Check debounce
          if (now - this.lastRepTime >= debounceMs) {
            // Check minimum rep duration
            const repDuration = now - this.repStartTime;
            if (repDuration >= minRepDurationMs) {
              this.state = 'completed';
              
              // Analyze form
              this.analyzeForm(pose);
              
              // Calculate form score
              const formScore = this.calculateFormScore();
              
              // Create rep data
              this.repCount++;
              repData = {
                repNumber: this.repCount,
                timestamp: now,
                duration: repDuration,
                minAngle: this.minAngleInRep,
                maxAngle: this.maxAngleInRep,
                formScore,
                flags: [...this.formFlags],
              };
              
              repCompleted = true;
              this.lastRepTime = now;
            } else {
              // Rep too fast, might be noise - go back to starting
              this.state = 'starting';
            }
          }
        }
        break;

      case 'completed':
        // Immediately transition to starting for next rep
        this.state = 'starting';
        this.minAngleInRep = 180;
        this.maxAngleInRep = 0;
        break;

      case 'up':
        // Alternative state for exercises that start from down position
        if (this.isInDownPosition(angle, downAngleThreshold, hysteresis)) {
          this.state = 'down';
        }
        break;
    }

    return { state: this.state, repCompleted, repData };
  }

  private isInUpPosition(angle: number, threshold: number, hysteresis: number): boolean {
    // For pushup/squat: up = extended = high angle
    // For pullup: up = contracted = low angle
    if (this.exerciseType === 'pullup') {
      return angle <= threshold + hysteresis;
    }
    return angle >= threshold - hysteresis;
  }

  private isInDownPosition(angle: number, threshold: number, hysteresis: number): boolean {
    // For pushup/squat: down = contracted = low angle
    // For pullup: down = extended = high angle
    if (this.exerciseType === 'pullup') {
      return angle >= threshold - hysteresis;
    }
    return angle <= threshold + hysteresis;
  }

  private analyzeForm(pose: Pose): void {
    const kp = pose.keypoints;
    
    switch (this.exerciseType) {
      case 'pushup':
        this.analyzePushupForm(kp);
        break;
      case 'pullup':
        this.analyzePullupForm(kp);
        break;
      case 'squat':
        this.analyzeSquatForm(kp);
        break;
      case 'rdl':
        this.analyzeRdlForm(kp);
        break;
    }
  }

  private analyzePushupForm(kp: Keypoint[]): void {
    // Check for partial ROM
    if (this.minAngleInRep > 100) {
      this.formFlags.push({
        type: 'partial_rom',
        message: 'Go all the way down',
        deduction: 15,
      });
    }
    
    // Check for no lockout
    if (this.maxAngleInRep < 150) {
      this.formFlags.push({
        type: 'no_lockout',
        message: 'Extend arms fully at top',
        deduction: 10,
      });
    }
    
    // Check hip sag (simplified)
    const shoulder = kp[KEYPOINTS.LEFT_SHOULDER];
    const hip = kp[KEYPOINTS.LEFT_HIP];
    const ankle = kp[KEYPOINTS.LEFT_ANKLE];
    
    if (shoulder && hip && ankle) {
      const expectedHipY = shoulder.y + (ankle.y - shoulder.y) * 0.5;
      if (hip.y > expectedHipY + 30) {
        this.formFlags.push({
          type: 'hip_sag',
          message: 'Keep core tight, hips up',
          deduction: 15,
        });
      }
    }
  }

  private analyzePullupForm(kp: Keypoint[]): void {
    // Check for partial ROM (not going all the way down)
    if (this.maxAngleInRep < 150) {
      this.formFlags.push({
        type: 'partial_rom',
        message: 'Extend arms fully at bottom',
        deduction: 15,
      });
    }
    
    // Check for no lockout (chin not over bar)
    if (this.minAngleInRep > 80) {
      this.formFlags.push({
        type: 'no_lockout',
        message: 'Pull chin over the bar',
        deduction: 10,
      });
    }
    
    // Check for kipping (simplified - look for excessive hip movement)
    // This would need velocity tracking for accurate detection
  }

  private analyzeSquatForm(kp: Keypoint[]): void {
    // Check depth
    if (this.minAngleInRep > 100) {
      this.formFlags.push({
        type: 'partial_rom',
        message: 'Go deeper - hip crease below knee',
        deduction: 15,
      });
    }
    
    // Check for no lockout
    if (this.maxAngleInRep < 160) {
      this.formFlags.push({
        type: 'no_lockout',
        message: 'Stand up fully at top',
        deduction: 10,
      });
    }
    
    // Check knees caving
    const leftKnee = kp[KEYPOINTS.LEFT_KNEE];
    const rightKnee = kp[KEYPOINTS.RIGHT_KNEE];
    const leftAnkle = kp[KEYPOINTS.LEFT_ANKLE];
    const rightAnkle = kp[KEYPOINTS.RIGHT_ANKLE];
    
    if (leftKnee && rightKnee && leftAnkle && rightAnkle) {
      const kneeWidth = Math.abs(rightKnee.x - leftKnee.x);
      const ankleWidth = Math.abs(rightAnkle.x - leftAnkle.x);
      
      if (kneeWidth < ankleWidth * 0.8) {
        this.formFlags.push({
          type: 'knees_caving',
          message: 'Push knees out over toes',
          deduction: 15,
        });
      }
    }
  }

  private analyzeRdlForm(kp: Keypoint[]): void {
    // Check hip hinge depth
    if (this.minAngleInRep > 120) {
      this.formFlags.push({
        type: 'partial_rom',
        message: 'Hinge deeper at the hips',
        deduction: 15,
      });
    }
    
    // Check for no lockout
    if (this.maxAngleInRep < 165) {
      this.formFlags.push({
        type: 'no_lockout',
        message: 'Stand up fully, squeeze glutes',
        deduction: 10,
      });
    }
    
    // Check for forward lean (shoulders too far forward)
    const shoulder = kp[KEYPOINTS.LEFT_SHOULDER];
    const hip = kp[KEYPOINTS.LEFT_HIP];
    
    if (shoulder && hip) {
      // In RDL, shoulders should stay roughly over mid-foot
      // If shoulder X is significantly different from hip X, there's forward lean
      if (Math.abs(shoulder.x - hip.x) > 50) {
        this.formFlags.push({
          type: 'forward_lean',
          message: 'Keep weight over mid-foot',
          deduction: 10,
        });
      }
    }
  }

  private calculateFormScore(): number {
    let score = 100;
    
    for (const flag of this.formFlags) {
      score -= flag.deduction;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get current state
   */
  getState(): RepState {
    return this.state;
  }

  /**
   * Get rep count
   */
  getRepCount(): number {
    return this.repCount;
  }

  /**
   * Get current config for debug display
   */
  getConfig(): StateMachineConfig {
    return { ...this.config };
  }

  /**
   * Get thresholds for debug display
   */
  getThresholds(): Record<string, number> {
    return {
      downAngle: this.config.downAngleThreshold,
      upAngle: this.config.upAngleThreshold,
      hysteresis: this.config.hysteresis,
      debounceMs: this.config.debounceMs,
      minRepMs: this.config.minRepDurationMs,
    };
  }

  /**
   * Reset the state machine
   */
  reset(): void {
    this.state = 'idle';
    this.repCount = 0;
    this.lastRepTime = 0;
    this.repStartTime = 0;
    this.angleHistory = { values: [], timestamps: [] };
    this.minAngleInRep = 180;
    this.maxAngleInRep = 0;
    this.formFlags = [];
  }
}
