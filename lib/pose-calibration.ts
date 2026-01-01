/**
 * Pose Calibration Service
 * 
 * Handles the initialization phase where the user stands still
 * while the system maps and calibrates body joints.
 */

import { Pose, Keypoint, KEYPOINTS, ExerciseType } from './pose-detection';

// Calibration state
export type CalibrationStatus = 
  | 'waiting'      // Waiting for user to enter frame
  | 'detecting'    // Detecting joints
  | 'stabilizing'  // Joints detected, waiting for stability
  | 'calibrated'   // Calibration complete
  | 'failed';      // Calibration failed

export interface JointCalibration {
  keypoint: number;
  name: string;
  detected: boolean;
  stable: boolean;
  confidence: number;
  position: { x: number; y: number } | null;
  history: { x: number; y: number; timestamp: number }[];
}

export interface CalibrationState {
  status: CalibrationStatus;
  progress: number; // 0-100
  message: string;
  subMessage: string;
  joints: JointCalibration[];
  referencepose: Pose | null;
  calibrationTime: number;
}

// Required joints for each exercise type
const REQUIRED_JOINTS: Record<ExerciseType, number[]> = {
  pushup: [
    KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW,
    KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST,
    KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
    KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE,
    KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE,
  ],
  pullup: [
    KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW,
    KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST,
    KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
  ],
  squat: [
    KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
    KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE,
    KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE,
  ],
  rdl: [
    KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
    KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE,
    KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE,
  ],
};

// Joint names for display
const JOINT_NAMES: Record<number, string> = {
  [KEYPOINTS.NOSE]: 'Nose',
  [KEYPOINTS.LEFT_EYE]: 'Left Eye',
  [KEYPOINTS.RIGHT_EYE]: 'Right Eye',
  [KEYPOINTS.LEFT_EAR]: 'Left Ear',
  [KEYPOINTS.RIGHT_EAR]: 'Right Ear',
  [KEYPOINTS.LEFT_SHOULDER]: 'Left Shoulder',
  [KEYPOINTS.RIGHT_SHOULDER]: 'Right Shoulder',
  [KEYPOINTS.LEFT_ELBOW]: 'Left Elbow',
  [KEYPOINTS.RIGHT_ELBOW]: 'Right Elbow',
  [KEYPOINTS.LEFT_WRIST]: 'Left Wrist',
  [KEYPOINTS.RIGHT_WRIST]: 'Right Wrist',
  [KEYPOINTS.LEFT_HIP]: 'Left Hip',
  [KEYPOINTS.RIGHT_HIP]: 'Right Hip',
  [KEYPOINTS.LEFT_KNEE]: 'Left Knee',
  [KEYPOINTS.RIGHT_KNEE]: 'Right Knee',
  [KEYPOINTS.LEFT_ANKLE]: 'Left Ankle',
  [KEYPOINTS.RIGHT_ANKLE]: 'Right Ankle',
};

// Configuration
const CONFIG = {
  MIN_CONFIDENCE: 0.5,           // Minimum keypoint confidence
  STABILITY_THRESHOLD: 15,       // Max pixel movement for stability
  STABILITY_FRAMES: 15,          // Frames needed for stability (about 1.5 sec at 10fps)
  HISTORY_SIZE: 20,              // Number of frames to keep in history
  CALIBRATION_TIMEOUT: 30000,    // 30 seconds timeout
};

export class PoseCalibrator {
  private exerciseType: ExerciseType;
  private state: CalibrationState;
  private startTime: number = 0;
  private stableFrameCount: number = 0;

  constructor(exerciseType: ExerciseType) {
    this.exerciseType = exerciseType;
    this.state = this.createInitialState();
  }

  private createInitialState(): CalibrationState {
    const requiredJoints = REQUIRED_JOINTS[this.exerciseType];
    const joints: JointCalibration[] = requiredJoints.map(keypoint => ({
      keypoint,
      name: JOINT_NAMES[keypoint] || `Joint ${keypoint}`,
      detected: false,
      stable: false,
      confidence: 0,
      position: null,
      history: [],
    }));

    return {
      status: 'waiting',
      progress: 0,
      message: 'Step into the camera view',
      subMessage: 'Make sure your full body is visible',
      joints,
      referencepose: null,
      calibrationTime: 0,
    };
  }

  reset(): void {
    this.state = this.createInitialState();
    this.startTime = 0;
    this.stableFrameCount = 0;
  }

  getState(): CalibrationState {
    return { ...this.state };
  }

  isCalibrated(): boolean {
    return this.state.status === 'calibrated';
  }

  getReferencePose(): Pose | null {
    return this.state.referencepose;
  }

  /**
   * Process a pose frame during calibration
   */
  processFrame(pose: Pose | null): CalibrationState {
    const now = Date.now();

    // Start timer on first frame
    if (this.startTime === 0) {
      this.startTime = now;
    }

    // Check timeout
    if (now - this.startTime > CONFIG.CALIBRATION_TIMEOUT) {
      this.state.status = 'failed';
      this.state.message = 'Calibration timed out';
      this.state.subMessage = 'Please try again with better lighting';
      return this.getState();
    }

    // No pose detected
    if (!pose || !pose.keypoints || pose.keypoints.length === 0) {
      this.state.status = 'waiting';
      this.state.message = 'Step into the camera view';
      this.state.subMessage = 'Make sure your full body is visible';
      this.state.progress = 0;
      this.stableFrameCount = 0;
      return this.getState();
    }

    // Update joint detection status
    let detectedCount = 0;
    let stableCount = 0;

    for (const joint of this.state.joints) {
      const keypoint = pose.keypoints[joint.keypoint];
      
      if (keypoint && keypoint.score >= CONFIG.MIN_CONFIDENCE) {
        joint.detected = true;
        joint.confidence = keypoint.score;
        
        // Add to history
        joint.history.push({
          x: keypoint.x,
          y: keypoint.y,
          timestamp: now,
        });

        // Keep history size limited
        if (joint.history.length > CONFIG.HISTORY_SIZE) {
          joint.history.shift();
        }

        // Check stability
        if (joint.history.length >= CONFIG.STABILITY_FRAMES) {
          const isStable = this.checkJointStability(joint);
          joint.stable = isStable;
          if (isStable) {
            joint.position = { x: keypoint.x, y: keypoint.y };
            stableCount++;
          }
        }

        detectedCount++;
      } else {
        joint.detected = false;
        joint.stable = false;
        joint.confidence = 0;
        joint.history = [];
      }
    }

    const totalJoints = this.state.joints.length;
    const detectionProgress = (detectedCount / totalJoints) * 50;
    const stabilityProgress = (stableCount / totalJoints) * 50;
    this.state.progress = Math.round(detectionProgress + stabilityProgress);

    // Update status based on detection
    if (detectedCount === 0) {
      this.state.status = 'waiting';
      this.state.message = 'Step into the camera view';
      this.state.subMessage = 'Make sure your full body is visible';
      this.stableFrameCount = 0;
    } else if (detectedCount < totalJoints) {
      this.state.status = 'detecting';
      const missingJoints = this.state.joints
        .filter(j => !j.detected)
        .map(j => j.name)
        .slice(0, 3);
      this.state.message = 'Detecting joints...';
      this.state.subMessage = `Missing: ${missingJoints.join(', ')}`;
      this.stableFrameCount = 0;
    } else if (stableCount < totalJoints) {
      this.state.status = 'stabilizing';
      this.state.message = 'Hold still...';
      this.state.subMessage = `Stabilizing ${stableCount}/${totalJoints} joints`;
      
      // Check if all joints are detected but not yet stable
      if (detectedCount === totalJoints) {
        this.stableFrameCount++;
      }
    } else {
      // All joints detected and stable
      this.stableFrameCount++;
      
      if (this.stableFrameCount >= CONFIG.STABILITY_FRAMES) {
        this.state.status = 'calibrated';
        this.state.message = 'Calibration complete!';
        this.state.subMessage = 'Ready to start tracking';
        this.state.progress = 100;
        this.state.calibrationTime = now - this.startTime;
        
        // Store reference pose
        this.state.referencepose = this.createReferencePose(pose);
      } else {
        this.state.status = 'stabilizing';
        this.state.message = 'Almost there...';
        this.state.subMessage = `Hold still for ${Math.ceil((CONFIG.STABILITY_FRAMES - this.stableFrameCount) / 10)} more seconds`;
      }
    }

    return this.getState();
  }

  /**
   * Check if a joint position is stable over recent history
   */
  private checkJointStability(joint: JointCalibration): boolean {
    if (joint.history.length < CONFIG.STABILITY_FRAMES) {
      return false;
    }

    const recentHistory = joint.history.slice(-CONFIG.STABILITY_FRAMES);
    
    // Calculate average position
    const avgX = recentHistory.reduce((sum, p) => sum + p.x, 0) / recentHistory.length;
    const avgY = recentHistory.reduce((sum, p) => sum + p.y, 0) / recentHistory.length;

    // Check if all recent positions are within threshold of average
    for (const pos of recentHistory) {
      const distance = Math.sqrt(Math.pow(pos.x - avgX, 2) + Math.pow(pos.y - avgY, 2));
      if (distance > CONFIG.STABILITY_THRESHOLD) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create a reference pose from the current stable positions
   */
  private createReferencePose(currentPose: Pose): Pose {
    const keypoints: Keypoint[] = currentPose.keypoints.map((kp, index) => {
      const joint = this.state.joints.find(j => j.keypoint === index);
      if (joint && joint.position) {
        return {
          x: joint.position.x,
          y: joint.position.y,
          score: joint.confidence,
          name: kp.name,
        };
      }
      return { ...kp };
    });

    return {
      keypoints,
      score: currentPose.score,
    };
  }

  /**
   * Get joints that need attention (not detected or not stable)
   */
  getProblematicJoints(): string[] {
    return this.state.joints
      .filter(j => !j.detected || !j.stable)
      .map(j => j.name);
  }

  /**
   * Get detection status for UI display
   */
  getJointStatus(): { name: string; detected: boolean; stable: boolean; confidence: number }[] {
    return this.state.joints.map(j => ({
      name: j.name,
      detected: j.detected,
      stable: j.stable,
      confidence: j.confidence,
    }));
  }
}

/**
 * Calculate the difference between current pose and reference pose
 * Returns a score from 0-100 indicating how close the poses match
 */
export function comparePoses(current: Pose, reference: Pose): number {
  if (!current || !reference) return 0;

  let totalScore = 0;
  let validJoints = 0;

  for (let i = 0; i < Math.min(current.keypoints.length, reference.keypoints.length); i++) {
    const currKp = current.keypoints[i];
    const refKp = reference.keypoints[i];

    if (currKp && refKp && currKp.score > 0.5 && refKp.score > 0.5) {
      const distance = Math.sqrt(
        Math.pow(currKp.x - refKp.x, 2) + 
        Math.pow(currKp.y - refKp.y, 2)
      );
      
      // Convert distance to score (closer = higher score)
      // Assuming max acceptable distance is 100 pixels
      const jointScore = Math.max(0, 100 - distance);
      totalScore += jointScore;
      validJoints++;
    }
  }

  return validJoints > 0 ? Math.round(totalScore / validJoints) : 0;
}
