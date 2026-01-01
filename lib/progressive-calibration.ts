/**
 * Progressive Calibration Manager
 * 
 * Handles progressive joint detection during calibration.
 * Detects joints one group at a time and requires stability before moving on.
 */

import { Pose, KEYPOINTS, Keypoint } from './pose-detection';

// Joint groups to detect in order
export const JOINT_DETECTION_ORDER = [
  { 
    name: 'Shoulders', 
    keypoints: [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
    label: 'shoulders'
  },
  { 
    name: 'Elbows', 
    keypoints: [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW],
    label: 'elbows'
  },
  { 
    name: 'Wrists', 
    keypoints: [KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST],
    label: 'wrists'
  },
  { 
    name: 'Hips', 
    keypoints: [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
    label: 'hips'
  },
  { 
    name: 'Knees', 
    keypoints: [KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE],
    label: 'knees'
  },
  { 
    name: 'Ankles', 
    keypoints: [KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE],
    label: 'ankles'
  },
];

export interface JointDetectionStatus {
  groupIndex: number;
  groupName: string;
  detected: boolean;
  stable: boolean;
  confidence: number;
}

// Confidence threshold for joint detection
const DETECTION_THRESHOLD = 0.5;
// Number of stable frames required before confirming detection
const STABILITY_FRAMES = 8;
// Confidence threshold for stability
const STABILITY_THRESHOLD = 0.6;

export interface ProgressiveCalibrationState {
  currentGroupIndex: number;
  detectedJoints: JointDetectionStatus[];
  allDetected: boolean;
  confirmed: boolean;
  calibratedPose: Pose | null;
}

export class ProgressiveCalibrationManager {
  private state: ProgressiveCalibrationState;
  private stabilityCounters: Map<number, number> = new Map();
  private lastPose: Pose | null = null;
  private onJointDetected?: (groupIndex: number, groupName: string) => void;
  private onAllDetected?: () => void;

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): ProgressiveCalibrationState {
    return {
      currentGroupIndex: 0,
      detectedJoints: JOINT_DETECTION_ORDER.map((group, idx) => ({
        groupIndex: idx,
        groupName: group.name,
        detected: false,
        stable: false,
        confidence: 0,
      })),
      allDetected: false,
      confirmed: false,
      calibratedPose: null,
    };
  }

  /**
   * Set callback for when a joint group is detected
   */
  setOnJointDetected(callback: (groupIndex: number, groupName: string) => void) {
    this.onJointDetected = callback;
  }

  /**
   * Set callback for when all joints are detected
   */
  setOnAllDetected(callback: () => void) {
    this.onAllDetected = callback;
  }

  /**
   * Process a frame and update detection state
   */
  processFrame(pose: Pose | null): ProgressiveCalibrationState {
    if (!pose || this.state.confirmed) {
      return this.state;
    }

    this.lastPose = pose;

    // Check each joint group
    for (let groupIdx = 0; groupIdx <= this.state.currentGroupIndex && groupIdx < JOINT_DETECTION_ORDER.length; groupIdx++) {
      this.checkJointGroup(pose, groupIdx);
    }

    // Check if current group is stable and we can move to next
    const currentStatus = this.state.detectedJoints[this.state.currentGroupIndex];
    if (currentStatus && currentStatus.stable && this.state.currentGroupIndex < JOINT_DETECTION_ORDER.length - 1) {
      // Move to next group
      this.state.currentGroupIndex++;
    }

    // Check if all groups are stable
    const allStable = this.state.detectedJoints.every(j => j.stable);
    if (allStable && !this.state.allDetected) {
      this.state.allDetected = true;
      this.state.calibratedPose = pose;
      if (this.onAllDetected) {
        this.onAllDetected();
      }
    }

    return { ...this.state };
  }

  /**
   * Check if a joint group is detected and stable
   */
  private checkJointGroup(pose: Pose, groupIndex: number) {
    const group = JOINT_DETECTION_ORDER[groupIndex];
    const status = this.state.detectedJoints[groupIndex];

    // Calculate average confidence for this group
    let totalConfidence = 0;
    let validCount = 0;

    for (const kpIndex of group.keypoints) {
      const keypoint = pose.keypoints[kpIndex];
      if (keypoint && keypoint.score > DETECTION_THRESHOLD) {
        totalConfidence += keypoint.score;
        validCount++;
      }
    }

    const avgConfidence = validCount > 0 ? totalConfidence / validCount : 0;
    const allDetected = validCount === group.keypoints.length;

    // Update status
    status.confidence = avgConfidence;

    if (allDetected && avgConfidence >= DETECTION_THRESHOLD) {
      if (!status.detected) {
        // First detection
        status.detected = true;
        if (this.onJointDetected) {
          this.onJointDetected(groupIndex, group.name);
        }
      }

      // Check stability
      if (avgConfidence >= STABILITY_THRESHOLD) {
        const currentCount = this.stabilityCounters.get(groupIndex) || 0;
        this.stabilityCounters.set(groupIndex, currentCount + 1);

        if (currentCount + 1 >= STABILITY_FRAMES && !status.stable) {
          status.stable = true;
        }
      } else {
        // Reset stability counter if confidence drops
        this.stabilityCounters.set(groupIndex, 0);
      }
    } else {
      // Lost detection - reset
      if (status.detected && !status.stable) {
        status.detected = false;
        this.stabilityCounters.set(groupIndex, 0);
      }
    }
  }

  /**
   * Confirm the calibration
   */
  confirm(): Pose | null {
    if (this.state.allDetected && this.lastPose) {
      this.state.confirmed = true;
      this.state.calibratedPose = this.lastPose;
      return this.lastPose;
    }
    return null;
  }

  /**
   * Get current state
   */
  getState(): ProgressiveCalibrationState {
    return { ...this.state };
  }

  /**
   * Check if calibration is complete and confirmed
   */
  isConfirmed(): boolean {
    return this.state.confirmed;
  }

  /**
   * Check if all joints are detected (but not necessarily confirmed)
   */
  isAllDetected(): boolean {
    return this.state.allDetected;
  }

  /**
   * Get the current searching group index
   */
  getCurrentSearchingGroup(): number {
    return this.state.currentGroupIndex;
  }

  /**
   * Get detected joints status
   */
  getDetectedJoints(): JointDetectionStatus[] {
    return [...this.state.detectedJoints];
  }

  /**
   * Get calibrated pose (only available after confirmation)
   */
  getCalibratedPose(): Pose | null {
    return this.state.calibratedPose;
  }

  /**
   * Reset the calibration
   */
  reset() {
    this.state = this.getInitialState();
    this.stabilityCounters.clear();
    this.lastPose = null;
  }
}

export default ProgressiveCalibrationManager;
