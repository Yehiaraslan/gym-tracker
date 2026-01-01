/**
 * Confidence Tracking Module
 * 
 * Tracks pose detection confidence over time with smoothing,
 * stability detection, and threshold-based status management.
 */

import { Pose, Keypoint, KEYPOINTS } from './pose-detection';
import { POSE_CONFIG, TrackingStatus } from './pose-service';

// Confidence level thresholds
export const CONFIDENCE_LEVELS = {
  EXCELLENT: 0.8,
  GOOD: 0.6,
  MODERATE: 0.4,
  WEAK: 0.3,
  LOST: 0,
};

// Confidence state
export interface ConfidenceState {
  // Current values
  rawConfidence: number;
  smoothedConfidence: number;
  status: TrackingStatus;
  
  // Per-keypoint confidence
  keypointConfidences: Map<number, number>;
  
  // Stability tracking
  isStable: boolean;
  stableFrameCount: number;
  varianceHistory: number[];
  
  // Frame counters
  goodFrameCount: number;
  weakFrameCount: number;
  lostFrameCount: number;
  
  // History for analysis
  confidenceHistory: number[];
  statusHistory: TrackingStatus[];
}

// Confidence event types
export type ConfidenceEvent = 
  | { type: 'status_changed'; from: TrackingStatus; to: TrackingStatus }
  | { type: 'stability_changed'; isStable: boolean }
  | { type: 'confidence_dropped'; from: number; to: number }
  | { type: 'confidence_recovered'; from: number; to: number };

// Event callback type
export type ConfidenceEventCallback = (event: ConfidenceEvent) => void;

/**
 * Confidence Tracker
 * 
 * Monitors pose detection confidence and provides:
 * - Smoothed confidence scores
 * - Tracking status (good/weak/lost)
 * - Stability detection for calibration
 * - Event notifications for status changes
 */
export class ConfidenceTracker {
  private state: ConfidenceState;
  private eventCallbacks: ConfidenceEventCallback[] = [];
  private requiredKeypoints: number[] = [];
  
  // Configuration
  private readonly historyLength = 30;
  private readonly varianceHistoryLength = 10;
  private readonly stabilityThreshold = 0.05; // Max variance for stability
  private readonly stabilityFramesRequired = 10;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): ConfidenceState {
    return {
      rawConfidence: 0,
      smoothedConfidence: 0,
      status: 'lost',
      keypointConfidences: new Map(),
      isStable: false,
      stableFrameCount: 0,
      varianceHistory: [],
      goodFrameCount: 0,
      weakFrameCount: 0,
      lostFrameCount: 0,
      confidenceHistory: [],
      statusHistory: [],
    };
  }

  /**
   * Set required keypoints for confidence calculation
   */
  setRequiredKeypoints(keypoints: number[]): void {
    this.requiredKeypoints = keypoints;
  }

  /**
   * Process a pose and update confidence tracking
   */
  processFrame(pose: Pose | null): ConfidenceState {
    if (!pose) {
      this.handleNoPose();
      return this.getState();
    }

    // Calculate raw confidence
    const rawConfidence = this.calculateRawConfidence(pose);
    
    // Update per-keypoint confidences
    this.updateKeypointConfidences(pose);
    
    // Apply smoothing
    const previousSmoothed = this.state.smoothedConfidence;
    const smoothedConfidence = this.applySmoothing(rawConfidence, previousSmoothed);
    
    // Update state
    this.state.rawConfidence = rawConfidence;
    this.state.smoothedConfidence = smoothedConfidence;
    
    // Update history
    this.updateHistory(smoothedConfidence);
    
    // Update stability
    this.updateStability();
    
    // Update tracking status
    const previousStatus = this.state.status;
    this.updateTrackingStatus(smoothedConfidence);
    
    // Emit events if status changed
    if (previousStatus !== this.state.status) {
      this.emitEvent({
        type: 'status_changed',
        from: previousStatus,
        to: this.state.status,
      });
    }

    return this.getState();
  }

  /**
   * Calculate raw confidence from pose keypoints
   */
  private calculateRawConfidence(pose: Pose): number {
    const keypoints = pose.keypoints;
    
    // If we have required keypoints, only consider those
    if (this.requiredKeypoints.length > 0) {
      let sum = 0;
      let count = 0;
      
      for (const idx of this.requiredKeypoints) {
        if (keypoints[idx] && keypoints[idx].score >= POSE_CONFIG.KEYPOINT_CONFIDENCE_THRESHOLD) {
          sum += keypoints[idx].score;
          count++;
        }
      }
      
      // Penalize for missing required keypoints
      const detectionRatio = count / this.requiredKeypoints.length;
      const avgConfidence = count > 0 ? sum / count : 0;
      
      return avgConfidence * detectionRatio;
    }
    
    // Otherwise, use all keypoints
    const validKeypoints = keypoints.filter(
      kp => kp.score >= POSE_CONFIG.KEYPOINT_CONFIDENCE_THRESHOLD
    );
    
    if (validKeypoints.length === 0) return 0;
    
    const sum = validKeypoints.reduce((acc, kp) => acc + kp.score, 0);
    return sum / validKeypoints.length;
  }

  /**
   * Update per-keypoint confidence tracking
   */
  private updateKeypointConfidences(pose: Pose): void {
    for (let i = 0; i < pose.keypoints.length; i++) {
      const kp = pose.keypoints[i];
      const prevConf = this.state.keypointConfidences.get(i) || 0;
      
      // Smooth individual keypoint confidence
      const smoothed = POSE_CONFIG.CONFIDENCE_SMOOTHING_FACTOR * prevConf +
                       (1 - POSE_CONFIG.CONFIDENCE_SMOOTHING_FACTOR) * kp.score;
      
      this.state.keypointConfidences.set(i, smoothed);
    }
  }

  /**
   * Apply exponential moving average smoothing
   */
  private applySmoothing(raw: number, previous: number): number {
    return POSE_CONFIG.CONFIDENCE_SMOOTHING_FACTOR * previous +
           (1 - POSE_CONFIG.CONFIDENCE_SMOOTHING_FACTOR) * raw;
  }

  /**
   * Update confidence history
   */
  private updateHistory(confidence: number): void {
    this.state.confidenceHistory.push(confidence);
    if (this.state.confidenceHistory.length > this.historyLength) {
      this.state.confidenceHistory.shift();
    }
    
    this.state.statusHistory.push(this.state.status);
    if (this.state.statusHistory.length > this.historyLength) {
      this.state.statusHistory.shift();
    }
  }

  /**
   * Update stability tracking
   */
  private updateStability(): void {
    const history = this.state.confidenceHistory;
    if (history.length < 5) {
      this.state.isStable = false;
      this.state.stableFrameCount = 0;
      return;
    }

    // Calculate variance of recent confidence values
    const recent = history.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recent.length;
    
    // Track variance history
    this.state.varianceHistory.push(variance);
    if (this.state.varianceHistory.length > this.varianceHistoryLength) {
      this.state.varianceHistory.shift();
    }

    // Check if stable
    const wasStable = this.state.isStable;
    
    if (variance < this.stabilityThreshold && 
        this.state.smoothedConfidence >= POSE_CONFIG.CALIBRATION_MIN_CONFIDENCE) {
      this.state.stableFrameCount++;
      
      if (this.state.stableFrameCount >= this.stabilityFramesRequired) {
        this.state.isStable = true;
      }
    } else {
      this.state.stableFrameCount = 0;
      this.state.isStable = false;
    }

    // Emit stability change event
    if (wasStable !== this.state.isStable) {
      this.emitEvent({
        type: 'stability_changed',
        isStable: this.state.isStable,
      });
    }
  }

  /**
   * Update tracking status based on smoothed confidence
   */
  private updateTrackingStatus(confidence: number): void {
    if (confidence >= POSE_CONFIG.GOOD_CONFIDENCE_THRESHOLD) {
      this.state.goodFrameCount++;
      this.state.weakFrameCount = 0;
      this.state.lostFrameCount = 0;
      
      if (this.state.goodFrameCount >= POSE_CONFIG.TRACKING_RESUME_FRAMES) {
        this.state.status = 'good';
      }
    } else if (confidence >= POSE_CONFIG.WEAK_CONFIDENCE_THRESHOLD) {
      this.state.weakFrameCount++;
      this.state.goodFrameCount = 0;
      this.state.lostFrameCount = 0;
      
      if (this.state.weakFrameCount >= POSE_CONFIG.TRACKING_PAUSE_FRAMES) {
        this.state.status = 'weak';
      }
    } else {
      this.state.lostFrameCount++;
      this.state.goodFrameCount = 0;
      this.state.weakFrameCount = 0;
      this.state.status = 'lost';
    }
  }

  /**
   * Handle case when no pose is detected
   */
  private handleNoPose(): void {
    const previousStatus = this.state.status;
    
    this.state.rawConfidence = 0;
    this.state.smoothedConfidence *= 0.9; // Decay smoothed confidence
    this.state.lostFrameCount++;
    this.state.goodFrameCount = 0;
    this.state.weakFrameCount = 0;
    this.state.isStable = false;
    this.state.stableFrameCount = 0;
    
    if (this.state.smoothedConfidence < POSE_CONFIG.WEAK_CONFIDENCE_THRESHOLD) {
      this.state.status = 'lost';
    }

    this.updateHistory(this.state.smoothedConfidence);

    if (previousStatus !== this.state.status) {
      this.emitEvent({
        type: 'status_changed',
        from: previousStatus,
        to: this.state.status,
      });
    }
  }

  /**
   * Get confidence level label
   */
  getConfidenceLevel(): string {
    const conf = this.state.smoothedConfidence;
    
    if (conf >= CONFIDENCE_LEVELS.EXCELLENT) return 'Excellent';
    if (conf >= CONFIDENCE_LEVELS.GOOD) return 'Good';
    if (conf >= CONFIDENCE_LEVELS.MODERATE) return 'Moderate';
    if (conf >= CONFIDENCE_LEVELS.WEAK) return 'Weak';
    return 'Lost';
  }

  /**
   * Get confidence as percentage
   */
  getConfidencePercent(): number {
    return Math.round(this.state.smoothedConfidence * 100);
  }

  /**
   * Check if tracking is good enough for rep counting
   */
  isTrackingGood(): boolean {
    return this.state.status === 'good';
  }

  /**
   * Check if confidence is stable (for calibration)
   */
  isStable(): boolean {
    return this.state.isStable;
  }

  /**
   * Get keypoint confidence
   */
  getKeypointConfidence(keypointIndex: number): number {
    return this.state.keypointConfidences.get(keypointIndex) || 0;
  }

  /**
   * Check if specific keypoint is well-tracked
   */
  isKeypointTracked(keypointIndex: number): boolean {
    const conf = this.state.keypointConfidences.get(keypointIndex) || 0;
    return conf >= POSE_CONFIG.KEYPOINT_CONFIDENCE_THRESHOLD;
  }

  /**
   * Get list of poorly tracked keypoints
   */
  getWeakKeypoints(): number[] {
    const weak: number[] = [];
    
    for (const idx of this.requiredKeypoints) {
      const conf = this.state.keypointConfidences.get(idx) || 0;
      if (conf < POSE_CONFIG.GOOD_CONFIDENCE_THRESHOLD) {
        weak.push(idx);
      }
    }
    
    return weak;
  }

  /**
   * Register event callback
   */
  onEvent(callback: ConfidenceEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const idx = this.eventCallbacks.indexOf(callback);
      if (idx >= 0) {
        this.eventCallbacks.splice(idx, 1);
      }
    };
  }

  /**
   * Emit event to all callbacks
   */
  private emitEvent(event: ConfidenceEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[ConfidenceTracker] Event callback error:', error);
      }
    }
  }

  /**
   * Get current state
   */
  getState(): ConfidenceState {
    return {
      ...this.state,
      keypointConfidences: new Map(this.state.keypointConfidences),
      varianceHistory: [...this.state.varianceHistory],
      confidenceHistory: [...this.state.confidenceHistory],
      statusHistory: [...this.state.statusHistory],
    };
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.state = this.createInitialState();
  }
}

// Singleton instance
let confidenceTrackerInstance: ConfidenceTracker | null = null;

export function getConfidenceTracker(): ConfidenceTracker {
  if (!confidenceTrackerInstance) {
    confidenceTrackerInstance = new ConfidenceTracker();
  }
  return confidenceTrackerInstance;
}

export function resetConfidenceTracker(): void {
  if (confidenceTrackerInstance) {
    confidenceTrackerInstance.reset();
    confidenceTrackerInstance = null;
  }
}

export default ConfidenceTracker;
