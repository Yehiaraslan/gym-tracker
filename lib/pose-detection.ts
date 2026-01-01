/**
 * Pose Detection Utilities for AI Form Coach
 * 
 * Uses TensorFlow.js MoveNet for on-device pose estimation
 * Implements rep counting and form analysis for push-ups, pull-ups, and squats
 */

// Keypoint indices for MoveNet model
export const KEYPOINTS = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
} as const;

export type ExerciseType = 'pushup' | 'pullup' | 'squat';

export interface Keypoint {
  x: number;
  y: number;
  score: number;
  name?: string;
}

export interface Pose {
  keypoints: Keypoint[];
  score?: number;
}

export interface FormFlag {
  type: 'partial_rom' | 'no_lockout' | 'hip_sag' | 'kipping' | 'knees_caving' | 'forward_lean' | 'heels_rising';
  message: string;
  deduction: number;
}

export interface RepData {
  repNumber: number;
  formScore: number;
  flags: FormFlag[];
  timestamp: number;
}

export interface ExerciseSession {
  exerciseType: ExerciseType;
  reps: RepData[];
  totalReps: number;
  averageFormScore: number;
  startTime: number;
  endTime: number | null;
}

// Minimum confidence threshold for keypoint detection
const MIN_KEYPOINT_SCORE = 0.3;
const MIN_POSE_SCORE = 0.25;

/**
 * Calculate angle between three points (in degrees)
 */
export function calculateAngle(
  pointA: Keypoint,
  pointB: Keypoint, // vertex
  pointC: Keypoint
): number {
  const radians = Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x) -
                  Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x);
  let angle = Math.abs(radians * 180 / Math.PI);
  if (angle > 180) {
    angle = 360 - angle;
  }
  return angle;
}

/**
 * Check if a keypoint is valid (has sufficient confidence)
 */
export function isKeypointValid(keypoint: Keypoint | undefined): boolean {
  return keypoint !== undefined && keypoint.score >= MIN_KEYPOINT_SCORE;
}

/**
 * Get the average position of two keypoints
 */
export function getAveragePoint(kp1: Keypoint, kp2: Keypoint): Keypoint {
  return {
    x: (kp1.x + kp2.x) / 2,
    y: (kp1.y + kp2.y) / 2,
    score: Math.min(kp1.score, kp2.score),
  };
}

/**
 * Calculate the overall confidence of pose detection
 */
export function calculatePoseConfidence(pose: Pose, exerciseType: ExerciseType): number {
  let relevantKeypoints: number[];
  
  if (exerciseType === 'pushup') {
    relevantKeypoints = [
      KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER, 
      KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW,
      KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST,
      KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP
    ];
  } else if (exerciseType === 'pullup') {
    relevantKeypoints = [
      KEYPOINTS.NOSE, KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
      KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW,
      KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST
    ];
  } else {
    // squat
    relevantKeypoints = [
      KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
      KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE,
      KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE,
      KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER
    ];
  }

  let totalScore = 0;
  let validCount = 0;

  for (const idx of relevantKeypoints) {
    const kp = pose.keypoints[idx];
    if (kp) {
      totalScore += kp.score;
      if (kp.score >= MIN_KEYPOINT_SCORE) {
        validCount++;
      }
    }
  }

  const avgScore = totalScore / relevantKeypoints.length;
  const validRatio = validCount / relevantKeypoints.length;
  
  return Math.round(avgScore * validRatio * 100);
}

/**
 * Push-up state machine
 */
export class PushupTracker {
  private state: 'up' | 'down' | 'transitioning' = 'up';
  private repCount = 0;
  private currentRepFlags: FormFlag[] = [];
  private lastElbowAngle = 180;
  private lowestElbowAngle = 180;
  private highestElbowAngle = 0;
  private repStartTime = 0;
  
  // Thresholds
  private readonly DOWN_ANGLE_THRESHOLD = 100; // Elbow angle to consider "down"
  private readonly UP_ANGLE_THRESHOLD = 150; // Elbow angle to consider "up"
  private readonly PARTIAL_ROM_THRESHOLD = 110; // If lowest angle > this, partial ROM
  private readonly NO_LOCKOUT_THRESHOLD = 145; // If highest angle < this, no lockout

  reset(): void {
    this.state = 'up';
    this.repCount = 0;
    this.currentRepFlags = [];
    this.lastElbowAngle = 180;
    this.lowestElbowAngle = 180;
    this.highestElbowAngle = 0;
    this.repStartTime = Date.now();
  }

  processFrame(pose: Pose): { repCompleted: boolean; repData: RepData | null; currentState: string } {
    const leftShoulder = pose.keypoints[KEYPOINTS.LEFT_SHOULDER];
    const rightShoulder = pose.keypoints[KEYPOINTS.RIGHT_SHOULDER];
    const leftElbow = pose.keypoints[KEYPOINTS.LEFT_ELBOW];
    const rightElbow = pose.keypoints[KEYPOINTS.RIGHT_ELBOW];
    const leftWrist = pose.keypoints[KEYPOINTS.LEFT_WRIST];
    const rightWrist = pose.keypoints[KEYPOINTS.RIGHT_WRIST];
    const leftHip = pose.keypoints[KEYPOINTS.LEFT_HIP];
    const rightHip = pose.keypoints[KEYPOINTS.RIGHT_HIP];

    // Check if we have valid keypoints
    const hasValidKeypoints = 
      (isKeypointValid(leftShoulder) || isKeypointValid(rightShoulder)) &&
      (isKeypointValid(leftElbow) || isKeypointValid(rightElbow)) &&
      (isKeypointValid(leftWrist) || isKeypointValid(rightWrist));

    if (!hasValidKeypoints) {
      return { repCompleted: false, repData: null, currentState: this.state };
    }

    // Calculate elbow angle (use the side with better detection)
    let elbowAngle = 180;
    
    if (isKeypointValid(leftShoulder) && isKeypointValid(leftElbow) && isKeypointValid(leftWrist)) {
      elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    } else if (isKeypointValid(rightShoulder) && isKeypointValid(rightElbow) && isKeypointValid(rightWrist)) {
      elbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    }

    // Track angle extremes during rep
    if (elbowAngle < this.lowestElbowAngle) {
      this.lowestElbowAngle = elbowAngle;
    }
    if (elbowAngle > this.highestElbowAngle) {
      this.highestElbowAngle = elbowAngle;
    }

    // Check for hip sag (simplified check)
    if (isKeypointValid(leftShoulder) && isKeypointValid(leftHip) && isKeypointValid(rightShoulder) && isKeypointValid(rightHip)) {
      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const hipY = (leftHip.y + rightHip.y) / 2;
      
      // In push-up, if hip drops significantly below shoulder line, it's hip sag
      // Note: Y increases downward in image coordinates
      if (hipY > shoulderY + 50 && this.state === 'down') {
        const hasHipSagFlag = this.currentRepFlags.some(f => f.type === 'hip_sag');
        if (!hasHipSagFlag) {
          this.currentRepFlags.push({
            type: 'hip_sag',
            message: 'Keep your core tight - hips are sagging',
            deduction: 10,
          });
        }
      }
    }

    let repCompleted = false;
    let repData: RepData | null = null;

    // State machine
    if (this.state === 'up' && elbowAngle < this.DOWN_ANGLE_THRESHOLD) {
      this.state = 'down';
      this.repStartTime = Date.now();
    } else if (this.state === 'down' && elbowAngle > this.UP_ANGLE_THRESHOLD) {
      // Rep completed
      this.state = 'up';
      this.repCount++;
      
      // Check for form issues
      if (this.lowestElbowAngle > this.PARTIAL_ROM_THRESHOLD) {
        this.currentRepFlags.push({
          type: 'partial_rom',
          message: 'Go deeper - partial range of motion',
          deduction: 20,
        });
      }
      
      if (this.highestElbowAngle < this.NO_LOCKOUT_THRESHOLD) {
        this.currentRepFlags.push({
          type: 'no_lockout',
          message: 'Fully extend arms at the top',
          deduction: 15,
        });
      }

      // Calculate form score
      let formScore = 100;
      for (const flag of this.currentRepFlags) {
        formScore -= flag.deduction;
      }
      formScore = Math.max(0, formScore);

      repData = {
        repNumber: this.repCount,
        formScore,
        flags: [...this.currentRepFlags],
        timestamp: Date.now(),
      };

      // Reset for next rep
      this.currentRepFlags = [];
      this.lowestElbowAngle = 180;
      this.highestElbowAngle = 0;
      repCompleted = true;
    }

    this.lastElbowAngle = elbowAngle;
    
    return { repCompleted, repData, currentState: this.state };
  }

  getRepCount(): number {
    return this.repCount;
  }

  getCurrentState(): string {
    return this.state;
  }
}

/**
 * Pull-up state machine
 */
export class PullupTracker {
  private state: 'down' | 'up' | 'transitioning' = 'down';
  private repCount = 0;
  private currentRepFlags: FormFlag[] = [];
  private lastChinPosition = 0;
  private lowestChinPosition = 0;
  private highestChinPosition = Infinity;
  private lastHipX = 0;
  private hipMovement = 0;
  
  // Thresholds (in relative coordinates)
  private readonly CHIN_ABOVE_HANDS_THRESHOLD = 20; // Pixels chin should be above wrists
  private readonly FULL_EXTENSION_THRESHOLD = 160; // Elbow angle for full extension

  reset(): void {
    this.state = 'down';
    this.repCount = 0;
    this.currentRepFlags = [];
    this.lastChinPosition = 0;
    this.lowestChinPosition = 0;
    this.highestChinPosition = Infinity;
    this.lastHipX = 0;
    this.hipMovement = 0;
  }

  processFrame(pose: Pose): { repCompleted: boolean; repData: RepData | null; currentState: string } {
    const nose = pose.keypoints[KEYPOINTS.NOSE];
    const leftShoulder = pose.keypoints[KEYPOINTS.LEFT_SHOULDER];
    const rightShoulder = pose.keypoints[KEYPOINTS.RIGHT_SHOULDER];
    const leftElbow = pose.keypoints[KEYPOINTS.LEFT_ELBOW];
    const rightElbow = pose.keypoints[KEYPOINTS.RIGHT_ELBOW];
    const leftWrist = pose.keypoints[KEYPOINTS.LEFT_WRIST];
    const rightWrist = pose.keypoints[KEYPOINTS.RIGHT_WRIST];
    const leftHip = pose.keypoints[KEYPOINTS.LEFT_HIP];
    const rightHip = pose.keypoints[KEYPOINTS.RIGHT_HIP];

    // Check if we have valid keypoints
    const hasValidKeypoints = 
      isKeypointValid(nose) &&
      (isKeypointValid(leftWrist) || isKeypointValid(rightWrist)) &&
      (isKeypointValid(leftElbow) || isKeypointValid(rightElbow));

    if (!hasValidKeypoints) {
      return { repCompleted: false, repData: null, currentState: this.state };
    }

    // Get wrist position (bar level)
    let wristY = 0;
    if (isKeypointValid(leftWrist) && isKeypointValid(rightWrist)) {
      wristY = (leftWrist.y + rightWrist.y) / 2;
    } else if (isKeypointValid(leftWrist)) {
      wristY = leftWrist.y;
    } else if (isKeypointValid(rightWrist)) {
      wristY = rightWrist.y;
    }

    const chinY = nose.y;
    
    // Track chin position extremes
    if (chinY < this.highestChinPosition) {
      this.highestChinPosition = chinY;
    }
    if (chinY > this.lowestChinPosition) {
      this.lowestChinPosition = chinY;
    }

    // Calculate elbow angle for extension check
    let elbowAngle = 180;
    if (isKeypointValid(leftShoulder) && isKeypointValid(leftElbow) && isKeypointValid(leftWrist)) {
      elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    } else if (isKeypointValid(rightShoulder) && isKeypointValid(rightElbow) && isKeypointValid(rightWrist)) {
      elbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    }

    // Check for kipping (excessive hip movement)
    if (isKeypointValid(leftHip) || isKeypointValid(rightHip)) {
      const currentHipX = isKeypointValid(leftHip) && isKeypointValid(rightHip)
        ? (leftHip.x + rightHip.x) / 2
        : isKeypointValid(leftHip) ? leftHip.x : rightHip.x;
      
      if (this.lastHipX !== 0) {
        this.hipMovement += Math.abs(currentHipX - this.lastHipX);
      }
      this.lastHipX = currentHipX;
    }

    let repCompleted = false;
    let repData: RepData | null = null;

    // State machine - Note: Y increases downward, so smaller Y = higher position
    const chinAboveBar = chinY < wristY - this.CHIN_ABOVE_HANDS_THRESHOLD;
    const armsExtended = elbowAngle > this.FULL_EXTENSION_THRESHOLD;

    if (this.state === 'down' && chinAboveBar) {
      this.state = 'up';
    } else if (this.state === 'up' && !chinAboveBar && armsExtended) {
      // Rep completed
      this.state = 'down';
      this.repCount++;
      
      // Check for form issues
      if (this.highestChinPosition > wristY - this.CHIN_ABOVE_HANDS_THRESHOLD / 2) {
        this.currentRepFlags.push({
          type: 'partial_rom',
          message: 'Pull higher - chin should clear the bar',
          deduction: 20,
        });
      }
      
      if (elbowAngle < this.FULL_EXTENSION_THRESHOLD - 10) {
        this.currentRepFlags.push({
          type: 'no_lockout',
          message: 'Fully extend arms at the bottom',
          deduction: 15,
        });
      }

      // Check for excessive kipping
      if (this.hipMovement > 100) {
        this.currentRepFlags.push({
          type: 'kipping',
          message: 'Minimize hip swing for strict pull-up',
          deduction: 10,
        });
      }

      // Calculate form score
      let formScore = 100;
      for (const flag of this.currentRepFlags) {
        formScore -= flag.deduction;
      }
      formScore = Math.max(0, formScore);

      repData = {
        repNumber: this.repCount,
        formScore,
        flags: [...this.currentRepFlags],
        timestamp: Date.now(),
      };

      // Reset for next rep
      this.currentRepFlags = [];
      this.highestChinPosition = Infinity;
      this.lowestChinPosition = 0;
      this.hipMovement = 0;
      repCompleted = true;
    }

    this.lastChinPosition = chinY;
    
    return { repCompleted, repData, currentState: this.state };
  }

  getRepCount(): number {
    return this.repCount;
  }

  getCurrentState(): string {
    return this.state;
  }
}

/**
 * Squat state machine
 */
export class SquatTracker {
  private state: 'standing' | 'down' | 'transitioning' = 'standing';
  private repCount = 0;
  private currentRepFlags: FormFlag[] = [];
  private lastKneeAngle = 180;
  private lowestKneeAngle = 180;
  private highestKneeAngle = 0;
  private initialKneeX = 0;
  private initialAnkleX = 0;
  private repStartTime = 0;
  
  // Thresholds
  private readonly DOWN_ANGLE_THRESHOLD = 100; // Knee angle to consider "down" (parallel or below)
  private readonly UP_ANGLE_THRESHOLD = 160; // Knee angle to consider "standing"
  private readonly PARTIAL_ROM_THRESHOLD = 110; // If lowest angle > this, partial ROM
  private readonly KNEE_CAVE_THRESHOLD = 30; // Pixels knees can move inward

  reset(): void {
    this.state = 'standing';
    this.repCount = 0;
    this.currentRepFlags = [];
    this.lastKneeAngle = 180;
    this.lowestKneeAngle = 180;
    this.highestKneeAngle = 0;
    this.initialKneeX = 0;
    this.initialAnkleX = 0;
    this.repStartTime = Date.now();
  }

  processFrame(pose: Pose): { repCompleted: boolean; repData: RepData | null; currentState: string } {
    const leftHip = pose.keypoints[KEYPOINTS.LEFT_HIP];
    const rightHip = pose.keypoints[KEYPOINTS.RIGHT_HIP];
    const leftKnee = pose.keypoints[KEYPOINTS.LEFT_KNEE];
    const rightKnee = pose.keypoints[KEYPOINTS.RIGHT_KNEE];
    const leftAnkle = pose.keypoints[KEYPOINTS.LEFT_ANKLE];
    const rightAnkle = pose.keypoints[KEYPOINTS.RIGHT_ANKLE];
    const leftShoulder = pose.keypoints[KEYPOINTS.LEFT_SHOULDER];
    const rightShoulder = pose.keypoints[KEYPOINTS.RIGHT_SHOULDER];

    // Check if we have valid keypoints
    const hasValidKeypoints = 
      (isKeypointValid(leftHip) || isKeypointValid(rightHip)) &&
      (isKeypointValid(leftKnee) || isKeypointValid(rightKnee)) &&
      (isKeypointValid(leftAnkle) || isKeypointValid(rightAnkle));

    if (!hasValidKeypoints) {
      return { repCompleted: false, repData: null, currentState: this.state };
    }

    // Calculate knee angle (use the side with better detection)
    let kneeAngle = 180;
    
    if (isKeypointValid(leftHip) && isKeypointValid(leftKnee) && isKeypointValid(leftAnkle)) {
      kneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    } else if (isKeypointValid(rightHip) && isKeypointValid(rightKnee) && isKeypointValid(rightAnkle)) {
      kneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    }

    // Track angle extremes during rep
    if (kneeAngle < this.lowestKneeAngle) {
      this.lowestKneeAngle = kneeAngle;
    }
    if (kneeAngle > this.highestKneeAngle) {
      this.highestKneeAngle = kneeAngle;
    }

    // Set initial knee/ankle position at start of rep
    if (this.state === 'standing' && this.initialKneeX === 0) {
      if (isKeypointValid(leftKnee) && isKeypointValid(rightKnee)) {
        this.initialKneeX = Math.abs(leftKnee.x - rightKnee.x);
      }
      if (isKeypointValid(leftAnkle) && isKeypointValid(rightAnkle)) {
        this.initialAnkleX = Math.abs(leftAnkle.x - rightAnkle.x);
      }
    }

    // Check for knee cave (knees moving inward during squat)
    if (this.state === 'down' && isKeypointValid(leftKnee) && isKeypointValid(rightKnee)) {
      const currentKneeWidth = Math.abs(leftKnee.x - rightKnee.x);
      if (this.initialKneeX > 0 && currentKneeWidth < this.initialKneeX - this.KNEE_CAVE_THRESHOLD) {
        const hasKneeCaveFlag = this.currentRepFlags.some(f => f.type === 'knees_caving');
        if (!hasKneeCaveFlag) {
          this.currentRepFlags.push({
            type: 'knees_caving',
            message: 'Push knees out - they are caving inward',
            deduction: 15,
          });
        }
      }
    }

    // Check for excessive forward lean
    if (isKeypointValid(leftShoulder) && isKeypointValid(leftHip) && isKeypointValid(rightShoulder) && isKeypointValid(rightHip)) {
      const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
      const hipX = (leftHip.x + rightHip.x) / 2;
      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const hipY = (leftHip.y + rightHip.y) / 2;
      
      // Calculate torso angle from vertical
      const torsoAngle = Math.abs(Math.atan2(shoulderX - hipX, hipY - shoulderY) * 180 / Math.PI);
      
      if (torsoAngle > 45 && this.state === 'down') {
        const hasForwardLeanFlag = this.currentRepFlags.some(f => f.type === 'forward_lean');
        if (!hasForwardLeanFlag) {
          this.currentRepFlags.push({
            type: 'forward_lean',
            message: 'Keep chest up - excessive forward lean',
            deduction: 10,
          });
        }
      }
    }

    let repCompleted = false;
    let repData: RepData | null = null;

    // State machine
    if (this.state === 'standing' && kneeAngle < this.DOWN_ANGLE_THRESHOLD) {
      this.state = 'down';
      this.repStartTime = Date.now();
    } else if (this.state === 'down' && kneeAngle > this.UP_ANGLE_THRESHOLD) {
      // Rep completed
      this.state = 'standing';
      this.repCount++;
      
      // Check for form issues
      if (this.lowestKneeAngle > this.PARTIAL_ROM_THRESHOLD) {
        this.currentRepFlags.push({
          type: 'partial_rom',
          message: 'Go deeper - aim for parallel or below',
          deduction: 20,
        });
      }
      
      if (this.highestKneeAngle < this.UP_ANGLE_THRESHOLD - 10) {
        this.currentRepFlags.push({
          type: 'no_lockout',
          message: 'Fully stand up at the top',
          deduction: 15,
        });
      }

      // Calculate form score
      let formScore = 100;
      for (const flag of this.currentRepFlags) {
        formScore -= flag.deduction;
      }
      formScore = Math.max(0, formScore);

      repData = {
        repNumber: this.repCount,
        formScore,
        flags: [...this.currentRepFlags],
        timestamp: Date.now(),
      };

      // Reset for next rep
      this.currentRepFlags = [];
      this.lowestKneeAngle = 180;
      this.highestKneeAngle = 0;
      this.initialKneeX = 0;
      repCompleted = true;
    }

    this.lastKneeAngle = kneeAngle;
    
    return { repCompleted, repData, currentState: this.state };
  }

  getRepCount(): number {
    return this.repCount;
  }

  getCurrentState(): string {
    return this.state;
  }
}

/**
 * Create a new exercise session
 */
export function createExerciseSession(exerciseType: ExerciseType): ExerciseSession {
  return {
    exerciseType,
    reps: [],
    totalReps: 0,
    averageFormScore: 0,
    startTime: Date.now(),
    endTime: null,
  };
}

/**
 * Add a rep to the session and update stats
 */
export function addRepToSession(session: ExerciseSession, repData: RepData): ExerciseSession {
  const updatedReps = [...session.reps, repData];
  const totalScore = updatedReps.reduce((sum, rep) => sum + rep.formScore, 0);
  
  return {
    ...session,
    reps: updatedReps,
    totalReps: updatedReps.length,
    averageFormScore: Math.round(totalScore / updatedReps.length),
  };
}

/**
 * Finalize the session
 */
export function finalizeSession(session: ExerciseSession): ExerciseSession {
  return {
    ...session,
    endTime: Date.now(),
  };
}

/**
 * Get form feedback summary
 */
export function getFormSummary(session: ExerciseSession): { 
  score: number; 
  grade: string; 
  feedback: string[];
} {
  const score = session.averageFormScore;
  
  let grade: string;
  if (score >= 90) grade = 'Excellent';
  else if (score >= 75) grade = 'Good';
  else if (score >= 60) grade = 'Fair';
  else grade = 'Needs Work';

  // Collect unique feedback from all reps
  const feedbackSet = new Set<string>();
  for (const rep of session.reps) {
    for (const flag of rep.flags) {
      feedbackSet.add(flag.message);
    }
  }

  return {
    score,
    grade,
    feedback: Array.from(feedbackSet),
  };
}
