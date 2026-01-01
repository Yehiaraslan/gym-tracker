/**
 * Joint Loss Alert System
 * 
 * Monitors joint tracking and triggers alerts when joints lose tracking.
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Pose, KEYPOINTS } from './pose-detection';
import { audioFeedback } from './audio-feedback';

// Joint names for audio alerts
const JOINT_NAMES: Record<number, string> = {
  [KEYPOINTS.LEFT_SHOULDER]: 'left shoulder',
  [KEYPOINTS.RIGHT_SHOULDER]: 'right shoulder',
  [KEYPOINTS.LEFT_ELBOW]: 'left elbow',
  [KEYPOINTS.RIGHT_ELBOW]: 'right elbow',
  [KEYPOINTS.LEFT_WRIST]: 'left wrist',
  [KEYPOINTS.RIGHT_WRIST]: 'right wrist',
  [KEYPOINTS.LEFT_HIP]: 'left hip',
  [KEYPOINTS.RIGHT_HIP]: 'right hip',
  [KEYPOINTS.LEFT_KNEE]: 'left knee',
  [KEYPOINTS.RIGHT_KNEE]: 'right knee',
  [KEYPOINTS.LEFT_ANKLE]: 'left ankle',
  [KEYPOINTS.RIGHT_ANKLE]: 'right ankle',
};

// Main joints to monitor (excluding face keypoints)
const MONITORED_JOINTS = [
  KEYPOINTS.LEFT_SHOULDER,
  KEYPOINTS.RIGHT_SHOULDER,
  KEYPOINTS.LEFT_ELBOW,
  KEYPOINTS.RIGHT_ELBOW,
  KEYPOINTS.LEFT_WRIST,
  KEYPOINTS.RIGHT_WRIST,
  KEYPOINTS.LEFT_HIP,
  KEYPOINTS.RIGHT_HIP,
  KEYPOINTS.LEFT_KNEE,
  KEYPOINTS.RIGHT_KNEE,
  KEYPOINTS.LEFT_ANKLE,
  KEYPOINTS.RIGHT_ANKLE,
];

// Configuration
const CONFIG = {
  MIN_CONFIDENCE: 0.3,           // Minimum confidence to consider joint tracked
  LOSS_THRESHOLD_FRAMES: 3,      // Frames before triggering loss alert
  RECOVERY_THRESHOLD_FRAMES: 2,  // Frames before considering joint recovered
  ALERT_COOLDOWN_MS: 3000,       // Minimum time between alerts for same joint
  BATCH_ALERT_DELAY_MS: 500,     // Delay to batch multiple joint losses
};

export interface JointTrackingStatus {
  jointIndex: number;
  jointName: string;
  isTracked: boolean;
  confidence: number;
  lostFrameCount: number;
  recoveredFrameCount: number;
  lastAlertTime: number;
}

export interface JointLossEvent {
  jointIndex: number;
  jointName: string;
  timestamp: number;
}

export interface JointAlertState {
  lostJoints: string[];
  recoveredJoints: string[];
  hasActiveAlerts: boolean;
}

export class JointLossAlertManager {
  private jointStatus: Map<number, JointTrackingStatus> = new Map();
  private pendingLossAlerts: JointLossEvent[] = [];
  private batchAlertTimeout: number | null = null;
  private audioEnabled: boolean = true;
  private hapticEnabled: boolean = true;
  private isActive: boolean = false;

  constructor() {
    this.initializeJointStatus();
  }

  private initializeJointStatus(): void {
    for (const jointIndex of MONITORED_JOINTS) {
      this.jointStatus.set(jointIndex, {
        jointIndex,
        jointName: JOINT_NAMES[jointIndex] || `Joint ${jointIndex}`,
        isTracked: false,
        confidence: 0,
        lostFrameCount: 0,
        recoveredFrameCount: 0,
        lastAlertTime: 0,
      });
    }
  }

  /**
   * Start monitoring joint tracking
   */
  start(): void {
    this.isActive = true;
    this.reset();
  }

  /**
   * Stop monitoring joint tracking
   */
  stop(): void {
    this.isActive = false;
    if (this.batchAlertTimeout) {
      clearTimeout(this.batchAlertTimeout);
      this.batchAlertTimeout = null;
    }
  }

  /**
   * Reset all tracking status
   */
  reset(): void {
    this.initializeJointStatus();
    this.pendingLossAlerts = [];
    if (this.batchAlertTimeout) {
      clearTimeout(this.batchAlertTimeout);
      this.batchAlertTimeout = null;
    }
  }

  /**
   * Enable/disable audio alerts
   */
  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
  }

  /**
   * Enable/disable haptic alerts
   */
  setHapticEnabled(enabled: boolean): void {
    this.hapticEnabled = enabled;
  }

  /**
   * Process a pose frame and check for joint losses
   */
  processFrame(pose: Pose | null): JointAlertState {
    const result: JointAlertState = {
      lostJoints: [],
      recoveredJoints: [],
      hasActiveAlerts: false,
    };

    if (!this.isActive) {
      return result;
    }

    const now = Date.now();

    for (const jointIndex of MONITORED_JOINTS) {
      const status = this.jointStatus.get(jointIndex);
      if (!status) continue;

      const keypoint = pose?.keypoints?.[jointIndex];
      const currentlyTracked = keypoint && keypoint.score >= CONFIG.MIN_CONFIDENCE;
      const wasTracked = status.isTracked;

      // Update confidence
      status.confidence = keypoint?.score ?? 0;

      if (currentlyTracked) {
        // Joint is currently tracked
        status.lostFrameCount = 0;
        status.recoveredFrameCount++;

        if (!wasTracked && status.recoveredFrameCount >= CONFIG.RECOVERY_THRESHOLD_FRAMES) {
          // Joint recovered
          status.isTracked = true;
          result.recoveredJoints.push(status.jointName);
        } else if (wasTracked) {
          status.isTracked = true;
        }
      } else {
        // Joint is not tracked
        status.recoveredFrameCount = 0;
        status.lostFrameCount++;

        if (wasTracked && status.lostFrameCount >= CONFIG.LOSS_THRESHOLD_FRAMES) {
          // Joint lost - check cooldown
          if (now - status.lastAlertTime >= CONFIG.ALERT_COOLDOWN_MS) {
            status.isTracked = false;
            result.lostJoints.push(status.jointName);
            
            // Queue alert
            this.queueLossAlert({
              jointIndex,
              jointName: status.jointName,
              timestamp: now,
            });
            
            status.lastAlertTime = now;
          }
        }
      }
    }

    // Check if there are any currently lost joints
    result.hasActiveAlerts = Array.from(this.jointStatus.values()).some(
      s => !s.isTracked && s.lostFrameCount > 0
    );

    return result;
  }

  /**
   * Queue a loss alert for batching
   */
  private queueLossAlert(event: JointLossEvent): void {
    this.pendingLossAlerts.push(event);

    // Clear existing timeout
    if (this.batchAlertTimeout) {
      clearTimeout(this.batchAlertTimeout);
    }

    // Set new timeout to batch alerts
    this.batchAlertTimeout = setTimeout(() => {
      this.triggerBatchedAlerts();
    }, CONFIG.BATCH_ALERT_DELAY_MS);
  }

  /**
   * Trigger batched alerts
   */
  private async triggerBatchedAlerts(): Promise<void> {
    if (this.pendingLossAlerts.length === 0) {
      return;
    }

    const alerts = [...this.pendingLossAlerts];
    this.pendingLossAlerts = [];

    // Trigger haptic feedback
    if (this.hapticEnabled && Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    // Trigger audio alert
    if (this.audioEnabled) {
      const jointNames = alerts.map(a => a.jointName);
      const message = this.createAlertMessage(jointNames);
      audioFeedback.speak(message);
    }
  }

  /**
   * Create a human-readable alert message
   */
  private createAlertMessage(jointNames: string[]): string {
    if (jointNames.length === 0) {
      return '';
    }

    if (jointNames.length === 1) {
      return `${jointNames[0]} lost`;
    }

    if (jointNames.length === 2) {
      return `${jointNames[0]} and ${jointNames[1]} lost`;
    }

    // Group by body part
    const leftJoints = jointNames.filter(n => n.startsWith('left'));
    const rightJoints = jointNames.filter(n => n.startsWith('right'));

    if (leftJoints.length > 2 && rightJoints.length === 0) {
      return 'Left side joints lost';
    }
    if (rightJoints.length > 2 && leftJoints.length === 0) {
      return 'Right side joints lost';
    }
    if (jointNames.length > 4) {
      return 'Multiple joints lost. Adjust position.';
    }

    return `${jointNames.slice(0, 3).join(', ')} lost`;
  }

  /**
   * Get current status of all joints
   */
  getJointStatuses(): JointTrackingStatus[] {
    return Array.from(this.jointStatus.values());
  }

  /**
   * Get list of currently lost joints
   */
  getLostJoints(): string[] {
    return Array.from(this.jointStatus.values())
      .filter(s => !s.isTracked && s.lostFrameCount > 0)
      .map(s => s.jointName);
  }

  /**
   * Check if a specific joint is currently tracked
   */
  isJointTracked(jointIndex: number): boolean {
    return this.jointStatus.get(jointIndex)?.isTracked ?? false;
  }

  /**
   * Initialize joint tracking state from a calibrated pose
   */
  initializeFromPose(pose: Pose): void {
    for (const jointIndex of MONITORED_JOINTS) {
      const status = this.jointStatus.get(jointIndex);
      if (!status) continue;

      const keypoint = pose.keypoints[jointIndex];
      if (keypoint && keypoint.score >= CONFIG.MIN_CONFIDENCE) {
        status.isTracked = true;
        status.confidence = keypoint.score;
        status.lostFrameCount = 0;
        status.recoveredFrameCount = CONFIG.RECOVERY_THRESHOLD_FRAMES;
      }
    }
  }
}

// Singleton instance
export const jointLossAlertManager = new JointLossAlertManager();

export default JointLossAlertManager;
