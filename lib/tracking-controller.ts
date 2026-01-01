/**
 * Tracking Controller
 * 
 * Manages the workout tracking phase with confidence gating.
 * Pauses rep counting when confidence drops and suppresses feedback.
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Pose, KEYPOINTS } from './pose-detection';
import { PoseService, getPoseService, TrackingStatus, POSE_CONFIG } from './pose-service';
import { ConfidenceTracker, getConfidenceTracker } from './confidence-tracker';
import { audioFeedback } from './audio-feedback';

// Tracking state
export type TrackingPhase = 
  | 'idle'           // Not tracking
  | 'active'         // Actively tracking, confidence good
  | 'paused'         // Tracking paused due to low confidence
  | 'recovering'     // Confidence improving, waiting to resume
  | 'finished';      // Tracking complete

// Tracking state interface
export interface TrackingState {
  phase: TrackingPhase;
  isTrackingActive: boolean;
  canCountReps: boolean;
  canShowFeedback: boolean;
  
  // Confidence info
  confidence: number;
  confidenceStatus: TrackingStatus;
  
  // Pause tracking
  pauseCount: number;
  totalPauseTime: number;
  currentPauseStart: number | null;
  
  // Warning message
  warningMessage: string;
  showWarning: boolean;
  
  // Timing
  trackingStartTime: number;
  activeTrackingTime: number;
  
  // Stats
  frameCount: number;
  goodFrameCount: number;
  weakFrameCount: number;
}

// Tracking event types
export type TrackingEvent =
  | { type: 'tracking_started' }
  | { type: 'tracking_paused'; reason: string }
  | { type: 'tracking_resumed' }
  | { type: 'tracking_finished'; stats: TrackingStats }
  | { type: 'confidence_warning'; message: string };

// Tracking statistics
export interface TrackingStats {
  totalTime: number;
  activeTime: number;
  pauseCount: number;
  totalPauseTime: number;
  averageConfidence: number;
  goodFramePercent: number;
}

// Event callback type
export type TrackingEventCallback = (event: TrackingEvent) => void;

// Configuration
const TRACKING_CONFIG = {
  // Pause thresholds
  PAUSE_CONFIDENCE_THRESHOLD: 0.4,     // Pause below this
  RESUME_CONFIDENCE_THRESHOLD: 0.55,   // Resume above this
  
  // Frame counts for state transitions
  FRAMES_TO_PAUSE: 5,                  // Weak frames before pausing
  FRAMES_TO_RESUME: 8,                 // Good frames before resuming
  
  // Warning cooldown
  WARNING_COOLDOWN_MS: 3000,           // Time between repeated warnings
  
  // Feedback suppression
  SUPPRESS_FEEDBACK_BELOW: 0.5,        // Don't show form feedback below this
};

/**
 * Tracking Controller
 * 
 * Manages workout tracking with confidence gating:
 * - Pauses rep counting when confidence drops
 * - Suppresses form feedback when tracking is weak
 * - Provides clear user feedback about tracking status
 */
export class TrackingController {
  private state: TrackingState;
  private eventCallbacks: TrackingEventCallback[] = [];
  private poseService: PoseService;
  private confidenceTracker: ConfidenceTracker;
  
  // Counters for state transitions
  private lowConfidenceFrames: number = 0;
  private highConfidenceFrames: number = 0;
  
  // Warning cooldown
  private lastWarningTime: number = 0;
  
  // Confidence history for stats
  private confidenceHistory: number[] = [];
  
  // Audio/haptic settings
  private audioEnabled: boolean = true;
  private hapticEnabled: boolean = true;

  constructor() {
    this.poseService = getPoseService();
    this.confidenceTracker = getConfidenceTracker();
    this.state = this.createInitialState();
  }

  private createInitialState(): TrackingState {
    return {
      phase: 'idle',
      isTrackingActive: false,
      canCountReps: false,
      canShowFeedback: false,
      confidence: 0,
      confidenceStatus: 'lost',
      pauseCount: 0,
      totalPauseTime: 0,
      currentPauseStart: null,
      warningMessage: '',
      showWarning: false,
      trackingStartTime: 0,
      activeTrackingTime: 0,
      frameCount: 0,
      goodFrameCount: 0,
      weakFrameCount: 0,
    };
  }

  /**
   * Start tracking
   */
  start(requiredKeypoints: number[]): void {
    this.state = this.createInitialState();
    this.state.phase = 'active';
    this.state.isTrackingActive = true;
    this.state.canCountReps = true;
    this.state.canShowFeedback = true;
    this.state.trackingStartTime = Date.now();
    
    this.lowConfidenceFrames = 0;
    this.highConfidenceFrames = 0;
    this.confidenceHistory = [];
    
    // Configure confidence tracker
    this.confidenceTracker.setRequiredKeypoints(requiredKeypoints);
    this.confidenceTracker.reset();
    
    this.emitEvent({ type: 'tracking_started' });
  }

  /**
   * Process a frame during tracking
   */
  processFrame(pose: Pose | null): TrackingState {
    if (this.state.phase === 'idle' || this.state.phase === 'finished') {
      return this.getState();
    }

    this.state.frameCount++;

    // Update confidence tracking
    const confState = this.confidenceTracker.processFrame(pose);
    this.state.confidence = confState.smoothedConfidence;
    this.state.confidenceStatus = confState.status;
    
    // Store confidence for stats
    this.confidenceHistory.push(confState.smoothedConfidence);

    // Process based on current phase
    switch (this.state.phase) {
      case 'active':
        this.processActivePhase(confState.smoothedConfidence);
        break;
      case 'paused':
        this.processPausedPhase(confState.smoothedConfidence);
        break;
      case 'recovering':
        this.processRecoveringPhase(confState.smoothedConfidence);
        break;
    }

    // Update active tracking time
    if (this.state.canCountReps) {
      this.state.activeTrackingTime = Date.now() - this.state.trackingStartTime - this.state.totalPauseTime;
    }

    // Update frame counts
    if (confState.status === 'good') {
      this.state.goodFrameCount++;
    } else {
      this.state.weakFrameCount++;
    }

    return this.getState();
  }

  /**
   * Process active tracking phase
   */
  private processActivePhase(confidence: number): void {
    if (confidence < TRACKING_CONFIG.PAUSE_CONFIDENCE_THRESHOLD) {
      this.lowConfidenceFrames++;
      this.highConfidenceFrames = 0;

      if (this.lowConfidenceFrames >= TRACKING_CONFIG.FRAMES_TO_PAUSE) {
        this.pauseTracking('Low tracking confidence');
      }
    } else {
      this.lowConfidenceFrames = 0;
      
      // Update feedback permission based on confidence
      this.state.canShowFeedback = confidence >= TRACKING_CONFIG.SUPPRESS_FEEDBACK_BELOW;
    }
  }

  /**
   * Process paused phase
   */
  private processPausedPhase(confidence: number): void {
    // Update pause time
    if (this.state.currentPauseStart) {
      this.state.totalPauseTime = Date.now() - this.state.currentPauseStart;
    }

    if (confidence >= TRACKING_CONFIG.RESUME_CONFIDENCE_THRESHOLD) {
      this.highConfidenceFrames++;
      
      if (this.highConfidenceFrames >= 3) {
        // Start recovering
        this.state.phase = 'recovering';
        this.state.warningMessage = 'Recovering tracking...';
      }
    } else {
      this.highConfidenceFrames = 0;
      this.showWarning('Tracking weak: adjust position or lighting');
    }
  }

  /**
   * Process recovering phase
   */
  private processRecoveringPhase(confidence: number): void {
    if (confidence >= TRACKING_CONFIG.RESUME_CONFIDENCE_THRESHOLD) {
      this.highConfidenceFrames++;

      if (this.highConfidenceFrames >= TRACKING_CONFIG.FRAMES_TO_RESUME) {
        this.resumeTracking();
      }
    } else {
      this.highConfidenceFrames = 0;
      
      if (confidence < TRACKING_CONFIG.PAUSE_CONFIDENCE_THRESHOLD) {
        // Go back to paused
        this.state.phase = 'paused';
        this.showWarning('Tracking lost again');
      }
    }
  }

  /**
   * Pause tracking
   */
  private pauseTracking(reason: string): void {
    this.state.phase = 'paused';
    this.state.canCountReps = false;
    this.state.canShowFeedback = false;
    this.state.pauseCount++;
    this.state.currentPauseStart = Date.now();
    
    this.lowConfidenceFrames = 0;
    this.highConfidenceFrames = 0;

    this.showWarning(reason);
    
    this.emitEvent({
      type: 'tracking_paused',
      reason,
    });

    if (this.audioEnabled) {
      audioFeedback.speak('Tracking paused');
    }

    if (this.hapticEnabled && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }

  /**
   * Resume tracking
   */
  private resumeTracking(): void {
    // Calculate pause duration
    if (this.state.currentPauseStart) {
      this.state.totalPauseTime += Date.now() - this.state.currentPauseStart;
      this.state.currentPauseStart = null;
    }

    this.state.phase = 'active';
    this.state.canCountReps = true;
    this.state.canShowFeedback = true;
    this.state.showWarning = false;
    this.state.warningMessage = '';
    
    this.lowConfidenceFrames = 0;
    this.highConfidenceFrames = 0;

    this.emitEvent({ type: 'tracking_resumed' });

    if (this.audioEnabled) {
      audioFeedback.speak('Tracking resumed');
    }

    if (this.hapticEnabled && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  /**
   * Show warning message
   */
  private showWarning(message: string): void {
    const now = Date.now();
    
    // Check cooldown
    if (now - this.lastWarningTime < TRACKING_CONFIG.WARNING_COOLDOWN_MS) {
      return;
    }

    this.state.showWarning = true;
    this.state.warningMessage = message;
    this.lastWarningTime = now;

    this.emitEvent({
      type: 'confidence_warning',
      message,
    });
  }

  /**
   * Finish tracking
   */
  finish(): TrackingStats {
    // Calculate final pause time
    if (this.state.currentPauseStart) {
      this.state.totalPauseTime += Date.now() - this.state.currentPauseStart;
    }

    const totalTime = Date.now() - this.state.trackingStartTime;
    const activeTime = totalTime - this.state.totalPauseTime;
    
    // Calculate average confidence
    const avgConfidence = this.confidenceHistory.length > 0
      ? this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length
      : 0;

    // Calculate good frame percentage
    const goodFramePercent = this.state.frameCount > 0
      ? (this.state.goodFrameCount / this.state.frameCount) * 100
      : 0;

    const stats: TrackingStats = {
      totalTime,
      activeTime,
      pauseCount: this.state.pauseCount,
      totalPauseTime: this.state.totalPauseTime,
      averageConfidence: avgConfidence,
      goodFramePercent,
    };

    this.state.phase = 'finished';
    this.state.isTrackingActive = false;
    this.state.canCountReps = false;
    this.state.canShowFeedback = false;

    this.emitEvent({
      type: 'tracking_finished',
      stats,
    });

    return stats;
  }

  /**
   * Check if rep counting is allowed
   */
  canCountReps(): boolean {
    return this.state.canCountReps;
  }

  /**
   * Check if form feedback should be shown
   */
  canShowFeedback(): boolean {
    return this.state.canShowFeedback;
  }

  /**
   * Check if tracking is paused
   */
  isPaused(): boolean {
    return this.state.phase === 'paused' || this.state.phase === 'recovering';
  }

  /**
   * Check if tracking is active
   */
  isActive(): boolean {
    return this.state.phase === 'active';
  }

  /**
   * Get current confidence
   */
  getConfidence(): number {
    return this.state.confidence;
  }

  /**
   * Get warning message
   */
  getWarningMessage(): string | null {
    return this.state.showWarning ? this.state.warningMessage : null;
  }

  /**
   * Clear warning
   */
  clearWarning(): void {
    this.state.showWarning = false;
    this.state.warningMessage = '';
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
  onEvent(callback: TrackingEventCallback): () => void {
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
  private emitEvent(event: TrackingEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[TrackingController] Event callback error:', error);
      }
    }
  }

  /**
   * Get current state
   */
  getState(): TrackingState {
    return { ...this.state };
  }

  /**
   * Reset controller
   */
  reset(): void {
    this.state = this.createInitialState();
    this.lowConfidenceFrames = 0;
    this.highConfidenceFrames = 0;
    this.confidenceHistory = [];
    this.lastWarningTime = 0;
    this.confidenceTracker.reset();
  }
}

// Singleton instance
let trackingControllerInstance: TrackingController | null = null;

export function getTrackingController(): TrackingController {
  if (!trackingControllerInstance) {
    trackingControllerInstance = new TrackingController();
  }
  return trackingControllerInstance;
}

export function resetTrackingController(): void {
  if (trackingControllerInstance) {
    trackingControllerInstance.reset();
    trackingControllerInstance = null;
  }
}

export default TrackingController;
