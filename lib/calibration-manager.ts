/**
 * Calibration Manager
 * 
 * Manages the calibration phase for pose detection.
 * Requires strict confidence and stability requirements before allowing tracking.
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Pose, Keypoint, KEYPOINTS } from './pose-detection';
import { POSE_CONFIG, KEYPOINT_NAMES, EXERCISE_REQUIRED_KEYPOINTS } from './pose-service';
import { audioFeedback } from './audio-feedback';

// Calibration phases
export type CalibrationPhase = 
  | 'waiting'      // Waiting to start
  | 'detecting'    // Detecting joints
  | 'stabilizing'  // Waiting for stable pose
  | 'confirming'   // Final confirmation
  | 'complete'     // Calibration successful
  | 'failed';      // Calibration failed

// Calibration failure reasons
export type CalibrationFailureReason =
  | 'missing_keypoints'
  | 'low_confidence'
  | 'unstable_pose'
  | 'timeout'
  | 'user_cancelled';

// Calibration state
export interface CalibrationState {
  phase: CalibrationPhase;
  progress: number;                    // 0-100
  
  // Joint detection
  detectedKeypoints: Set<number>;
  requiredKeypoints: number[];
  missingKeypoints: string[];
  
  // Confidence tracking
  currentConfidence: number;
  averageConfidence: number;
  confidenceHistory: number[];
  
  // Stability tracking
  isStable: boolean;
  stableFrameCount: number;
  positionVariance: number;
  
  // Reference pose (locked after calibration)
  referencePose: Pose | null;
  
  // Timing
  startTime: number;
  elapsedTime: number;
  
  // Failure info
  failureReason: CalibrationFailureReason | null;
  failureMessage: string;
  
  // Instructions
  currentInstruction: string;
}

// Calibration result
export interface CalibrationResult {
  success: boolean;
  referencePose: Pose | null;
  averageConfidence: number;
  calibrationTime: number;
  failureReason?: CalibrationFailureReason;
  failureMessage?: string;
}

// Calibration event types
export type CalibrationEvent =
  | { type: 'phase_changed'; from: CalibrationPhase; to: CalibrationPhase }
  | { type: 'keypoint_detected'; keypoint: number; name: string }
  | { type: 'stability_achieved' }
  | { type: 'calibration_complete'; result: CalibrationResult }
  | { type: 'calibration_failed'; reason: CalibrationFailureReason; message: string };

// Event callback type
export type CalibrationEventCallback = (event: CalibrationEvent) => void;

// Configuration
const CALIBRATION_CONFIG = {
  // Timing
  TIMEOUT_MS: 30000,                   // 30 second timeout
  MIN_CALIBRATION_TIME_MS: 2000,       // Minimum 2 seconds
  
  // Detection requirements
  MIN_KEYPOINT_CONFIDENCE: 0.4,        // Minimum per-keypoint confidence
  MIN_AVERAGE_CONFIDENCE: 0.5,         // Minimum average confidence
  
  // Stability requirements
  STABLE_FRAMES_REQUIRED: 15,          // Frames of stability needed
  MAX_POSITION_VARIANCE: 8,            // Max pixel movement for "still"
  CONFIDENCE_VARIANCE_THRESHOLD: 0.1,  // Max confidence variance
  
  // Confirmation
  CONFIRMATION_FRAMES: 10,             // Final confirmation frames
};

/**
 * Calibration Manager
 * 
 * Handles the calibration process for pose detection:
 * 1. Detect all required keypoints
 * 2. Achieve minimum confidence threshold
 * 3. Maintain stability for required duration
 * 4. Lock reference pose
 */
export class CalibrationManager {
  private state: CalibrationState;
  private eventCallbacks: CalibrationEventCallback[] = [];
  private previousPose: Pose | null = null;
  private positionHistory: Array<{ x: number; y: number }[]> = [];
  private audioEnabled: boolean = true;
  private hapticEnabled: boolean = true;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): CalibrationState {
    return {
      phase: 'waiting',
      progress: 0,
      detectedKeypoints: new Set(),
      requiredKeypoints: [],
      missingKeypoints: [],
      currentConfidence: 0,
      averageConfidence: 0,
      confidenceHistory: [],
      isStable: false,
      stableFrameCount: 0,
      positionVariance: 0,
      referencePose: null,
      startTime: 0,
      elapsedTime: 0,
      failureReason: null,
      failureMessage: '',
      currentInstruction: 'Stand in frame to begin calibration',
    };
  }

  /**
   * Start calibration for an exercise type
   */
  start(exerciseType: string): void {
    const required = EXERCISE_REQUIRED_KEYPOINTS[exerciseType] || 
                     EXERCISE_REQUIRED_KEYPOINTS.squat;
    
    this.state = this.createInitialState();
    this.state.requiredKeypoints = required;
    this.state.startTime = Date.now();
    this.state.phase = 'detecting';
    this.state.currentInstruction = 'Stand in frame - detecting joints...';
    
    this.previousPose = null;
    this.positionHistory = [];
    
    this.emitEvent({
      type: 'phase_changed',
      from: 'waiting',
      to: 'detecting',
    });

    if (this.audioEnabled) {
      audioFeedback.speak('Stand in frame for calibration');
    }
  }

  /**
   * Process a frame during calibration
   */
  processFrame(pose: Pose | null): CalibrationState {
    if (this.state.phase === 'waiting' || 
        this.state.phase === 'complete' || 
        this.state.phase === 'failed') {
      return this.getState();
    }

    // Update elapsed time
    this.state.elapsedTime = Date.now() - this.state.startTime;

    // Check timeout
    if (this.state.elapsedTime > CALIBRATION_CONFIG.TIMEOUT_MS) {
      this.fail('timeout', 'Calibration timed out. Please try again.');
      return this.getState();
    }

    if (!pose) {
      this.handleNoPose();
      return this.getState();
    }

    // Update confidence
    this.updateConfidence(pose);

    // Process based on current phase
    switch (this.state.phase) {
      case 'detecting':
        this.processDetectingPhase(pose);
        break;
      case 'stabilizing':
        this.processStabilizingPhase(pose);
        break;
      case 'confirming':
        this.processConfirmingPhase(pose);
        break;
    }

    // Store previous pose
    this.previousPose = pose;

    // Update progress
    this.updateProgress();

    return this.getState();
  }

  /**
   * Process detecting phase - find all required keypoints
   */
  private processDetectingPhase(pose: Pose): void {
    const previousDetected = this.state.detectedKeypoints.size;
    
    // Check each required keypoint
    for (const idx of this.state.requiredKeypoints) {
      const kp = pose.keypoints[idx];
      
      if (kp && kp.score >= CALIBRATION_CONFIG.MIN_KEYPOINT_CONFIDENCE) {
        if (!this.state.detectedKeypoints.has(idx)) {
          this.state.detectedKeypoints.add(idx);
          
          // Emit detection event
          this.emitEvent({
            type: 'keypoint_detected',
            keypoint: idx,
            name: KEYPOINT_NAMES[idx] || `Joint ${idx}`,
          });

          // Haptic feedback
          if (this.hapticEnabled && Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      }
    }

    // Update missing keypoints list
    this.state.missingKeypoints = this.state.requiredKeypoints
      .filter(idx => !this.state.detectedKeypoints.has(idx))
      .map(idx => KEYPOINT_NAMES[idx] || `Joint ${idx}`);

    // Check if all keypoints detected
    if (this.state.detectedKeypoints.size === this.state.requiredKeypoints.length) {
      // Check confidence threshold
      if (this.state.averageConfidence >= CALIBRATION_CONFIG.MIN_AVERAGE_CONFIDENCE) {
        this.transitionTo('stabilizing');
        this.state.currentInstruction = 'Hold still...';
        
        if (this.audioEnabled) {
          audioFeedback.speak('Hold still');
        }
      } else {
        this.state.currentInstruction = 'Improve lighting or move closer';
      }
    } else {
      // Update instruction based on missing keypoints
      if (this.state.missingKeypoints.length <= 2) {
        this.state.currentInstruction = `Detecting: ${this.state.missingKeypoints.join(', ')}`;
      } else {
        this.state.currentInstruction = `Detecting joints... (${this.state.detectedKeypoints.size}/${this.state.requiredKeypoints.length})`;
      }
    }
  }

  /**
   * Process stabilizing phase - wait for stable pose
   */
  private processStabilizingPhase(pose: Pose): void {
    // Calculate position variance
    const variance = this.calculatePositionVariance(pose);
    this.state.positionVariance = variance;

    // Check confidence stability
    const confVariance = this.calculateConfidenceVariance();

    // Check if stable
    if (variance < CALIBRATION_CONFIG.MAX_POSITION_VARIANCE &&
        confVariance < CALIBRATION_CONFIG.CONFIDENCE_VARIANCE_THRESHOLD &&
        this.state.averageConfidence >= CALIBRATION_CONFIG.MIN_AVERAGE_CONFIDENCE) {
      
      this.state.stableFrameCount++;
      this.state.isStable = true;

      if (this.state.stableFrameCount >= CALIBRATION_CONFIG.STABLE_FRAMES_REQUIRED) {
        this.transitionTo('confirming');
        this.state.currentInstruction = 'Confirming...';
        
        this.emitEvent({ type: 'stability_achieved' });
        
        if (this.hapticEnabled && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } else {
        const remaining = CALIBRATION_CONFIG.STABLE_FRAMES_REQUIRED - this.state.stableFrameCount;
        this.state.currentInstruction = `Hold still... (${Math.ceil(remaining / 10)}s)`;
      }
    } else {
      // Reset stability counter
      this.state.stableFrameCount = Math.max(0, this.state.stableFrameCount - 2);
      this.state.isStable = false;
      
      if (variance >= CALIBRATION_CONFIG.MAX_POSITION_VARIANCE) {
        this.state.currentInstruction = 'Hold still - too much movement';
      } else if (this.state.averageConfidence < CALIBRATION_CONFIG.MIN_AVERAGE_CONFIDENCE) {
        this.state.currentInstruction = 'Improve lighting or adjust position';
      }
    }
  }

  /**
   * Process confirming phase - final verification
   */
  private processConfirmingPhase(pose: Pose): void {
    // Verify pose is still good
    const variance = this.calculatePositionVariance(pose);
    
    if (variance < CALIBRATION_CONFIG.MAX_POSITION_VARIANCE &&
        this.state.averageConfidence >= CALIBRATION_CONFIG.MIN_AVERAGE_CONFIDENCE) {
      
      this.state.stableFrameCount++;
      
      if (this.state.stableFrameCount >= 
          CALIBRATION_CONFIG.STABLE_FRAMES_REQUIRED + CALIBRATION_CONFIG.CONFIRMATION_FRAMES) {
        // Calibration complete!
        this.complete(pose);
      }
    } else {
      // Lost stability, go back to stabilizing
      this.transitionTo('stabilizing');
      this.state.stableFrameCount = Math.max(0, this.state.stableFrameCount - 5);
      this.state.currentInstruction = 'Hold still...';
    }
  }

  /**
   * Calculate position variance from previous frames
   */
  private calculatePositionVariance(pose: Pose): number {
    if (!this.previousPose) return 0;

    let totalVariance = 0;
    let count = 0;

    for (const idx of this.state.requiredKeypoints) {
      const current = pose.keypoints[idx];
      const previous = this.previousPose.keypoints[idx];

      if (current.score >= CALIBRATION_CONFIG.MIN_KEYPOINT_CONFIDENCE &&
          previous.score >= CALIBRATION_CONFIG.MIN_KEYPOINT_CONFIDENCE) {
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        totalVariance += Math.sqrt(dx * dx + dy * dy);
        count++;
      }
    }

    return count > 0 ? totalVariance / count : 0;
  }

  /**
   * Calculate confidence variance
   */
  private calculateConfidenceVariance(): number {
    const history = this.state.confidenceHistory;
    if (history.length < 5) return 1;

    const recent = history.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recent.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Update confidence tracking
   */
  private updateConfidence(pose: Pose): void {
    // Calculate current confidence from required keypoints
    let sum = 0;
    let count = 0;

    for (const idx of this.state.requiredKeypoints) {
      const kp = pose.keypoints[idx];
      if (kp && kp.score >= CALIBRATION_CONFIG.MIN_KEYPOINT_CONFIDENCE) {
        sum += kp.score;
        count++;
      }
    }

    this.state.currentConfidence = count > 0 ? sum / count : 0;

    // Update history
    this.state.confidenceHistory.push(this.state.currentConfidence);
    if (this.state.confidenceHistory.length > 30) {
      this.state.confidenceHistory.shift();
    }

    // Calculate average
    this.state.averageConfidence = 
      this.state.confidenceHistory.reduce((a, b) => a + b, 0) / 
      this.state.confidenceHistory.length;
  }

  /**
   * Handle case when no pose detected
   */
  private handleNoPose(): void {
    this.state.currentConfidence = 0;
    this.state.stableFrameCount = Math.max(0, this.state.stableFrameCount - 3);
    this.state.isStable = false;
    
    if (this.state.phase === 'stabilizing' || this.state.phase === 'confirming') {
      this.transitionTo('detecting');
    }
    
    this.state.currentInstruction = 'Step into frame';
  }

  /**
   * Update progress percentage
   */
  private updateProgress(): void {
    let progress = 0;

    switch (this.state.phase) {
      case 'detecting':
        // 0-40%: Joint detection
        const detectionProgress = this.state.detectedKeypoints.size / 
                                  this.state.requiredKeypoints.length;
        progress = detectionProgress * 40;
        break;
        
      case 'stabilizing':
        // 40-80%: Stability
        const stabilityProgress = this.state.stableFrameCount / 
                                  CALIBRATION_CONFIG.STABLE_FRAMES_REQUIRED;
        progress = 40 + Math.min(stabilityProgress, 1) * 40;
        break;
        
      case 'confirming':
        // 80-100%: Confirmation
        const confirmProgress = (this.state.stableFrameCount - CALIBRATION_CONFIG.STABLE_FRAMES_REQUIRED) /
                               CALIBRATION_CONFIG.CONFIRMATION_FRAMES;
        progress = 80 + Math.min(confirmProgress, 1) * 20;
        break;
        
      case 'complete':
        progress = 100;
        break;
    }

    this.state.progress = Math.round(progress);
  }

  /**
   * Transition to a new phase
   */
  private transitionTo(newPhase: CalibrationPhase): void {
    const oldPhase = this.state.phase;
    this.state.phase = newPhase;
    
    this.emitEvent({
      type: 'phase_changed',
      from: oldPhase,
      to: newPhase,
    });
  }

  /**
   * Complete calibration successfully
   */
  private complete(pose: Pose): void {
    this.state.phase = 'complete';
    this.state.progress = 100;
    this.state.referencePose = pose;
    this.state.currentInstruction = 'Calibration complete!';

    const result: CalibrationResult = {
      success: true,
      referencePose: pose,
      averageConfidence: this.state.averageConfidence,
      calibrationTime: this.state.elapsedTime,
    };

    this.emitEvent({
      type: 'calibration_complete',
      result,
    });

    if (this.audioEnabled) {
      audioFeedback.speak('Calibration complete. Ready to start.');
    }

    if (this.hapticEnabled && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  /**
   * Fail calibration
   */
  private fail(reason: CalibrationFailureReason, message: string): void {
    this.state.phase = 'failed';
    this.state.failureReason = reason;
    this.state.failureMessage = message;
    this.state.currentInstruction = message;

    this.emitEvent({
      type: 'calibration_failed',
      reason,
      message,
    });

    if (this.audioEnabled) {
      audioFeedback.speak(message);
    }

    if (this.hapticEnabled && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  /**
   * Cancel calibration
   */
  cancel(): void {
    if (this.state.phase !== 'complete' && this.state.phase !== 'failed') {
      this.fail('user_cancelled', 'Calibration cancelled');
    }
  }

  /**
   * Get calibration result
   */
  getResult(): CalibrationResult | null {
    if (this.state.phase !== 'complete') return null;

    return {
      success: true,
      referencePose: this.state.referencePose,
      averageConfidence: this.state.averageConfidence,
      calibrationTime: this.state.elapsedTime,
    };
  }

  /**
   * Check if calibration is complete
   */
  isComplete(): boolean {
    return this.state.phase === 'complete';
  }

  /**
   * Check if calibration failed
   */
  isFailed(): boolean {
    return this.state.phase === 'failed';
  }

  /**
   * Check if calibration is in progress
   */
  isInProgress(): boolean {
    return this.state.phase === 'detecting' || 
           this.state.phase === 'stabilizing' || 
           this.state.phase === 'confirming';
  }

  /**
   * Set audio enabled
   */
  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
  }

  /**
   * Set haptic enabled
   */
  setHapticEnabled(enabled: boolean): void {
    this.hapticEnabled = enabled;
  }

  /**
   * Register event callback
   */
  onEvent(callback: CalibrationEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const idx = this.eventCallbacks.indexOf(callback);
      if (idx >= 0) {
        this.eventCallbacks.splice(idx, 1);
      }
    };
  }

  /**
   * Emit event
   */
  private emitEvent(event: CalibrationEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[CalibrationManager] Event callback error:', error);
      }
    }
  }

  /**
   * Get current state
   */
  getState(): CalibrationState {
    return {
      ...this.state,
      detectedKeypoints: new Set(this.state.detectedKeypoints),
      confidenceHistory: [...this.state.confidenceHistory],
    };
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.state = this.createInitialState();
    this.previousPose = null;
    this.positionHistory = [];
  }
}

// Singleton instance
let calibrationManagerInstance: CalibrationManager | null = null;

export function getCalibrationManager(): CalibrationManager {
  if (!calibrationManagerInstance) {
    calibrationManagerInstance = new CalibrationManager();
  }
  return calibrationManagerInstance;
}

export function resetCalibrationManager(): void {
  if (calibrationManagerInstance) {
    calibrationManagerInstance.reset();
    calibrationManagerInstance = null;
  }
}

export default CalibrationManager;
