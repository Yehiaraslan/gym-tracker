/**
 * Gated Rep Counter
 * 
 * Wraps the rep state machine with confidence gating.
 * Only counts reps and provides feedback when tracking is reliable.
 */

import { Pose, ExerciseType, RepData, FormFlag } from './pose-detection';
import { ImprovedRepStateMachine, RepState } from './rep-state-machine';
import { TrackingController, getTrackingController } from './tracking-controller';
import { POSE_CONFIG, EXERCISE_REQUIRED_KEYPOINTS } from './pose-service';

// Form score thresholds
const FORM_SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  NEEDS_WORK: 50,
  POOR: 0,
};

// Rep counter state
export interface RepCounterState {
  // Rep tracking
  repCount: number;
  currentState: RepState;
  lastRepData: RepData | null;
  
  // Form tracking
  totalFormScore: number;
  averageFormScore: number;
  formIssues: Map<string, number>;  // Issue type -> count
  
  // Confidence gating
  isGated: boolean;
  gatedReason: string;
  skippedFrames: number;
  
  // Angles
  currentAngle: number | null;
  smoothedAngle: number | null;
  
  // Summary
  repHistory: RepData[];
}

// Rep event types
export type RepEvent =
  | { type: 'rep_completed'; repData: RepData }
  | { type: 'rep_skipped'; reason: string }
  | { type: 'form_issue'; flag: FormFlag }
  | { type: 'gating_changed'; isGated: boolean; reason: string };

// Event callback type
export type RepEventCallback = (event: RepEvent) => void;

/**
 * Gated Rep Counter
 * 
 * Provides reliable rep counting with:
 * - Confidence gating (no counting when tracking is weak)
 * - Conservative form analysis (only major issues)
 * - Accumulated form scoring
 * - Rep history for summary
 */
export class GatedRepCounter {
  private stateMachine: ImprovedRepStateMachine;
  private trackingController: TrackingController;
  private exerciseType: ExerciseType;
  
  private state: RepCounterState;
  private eventCallbacks: RepEventCallback[] = [];
  
  // Gating state
  private wasGated: boolean = false;
  private consecutiveGatedFrames: number = 0;
  
  // Configuration
  private readonly MIN_CONFIDENCE_FOR_COUNTING = 0.5;
  private readonly MAX_GATED_FRAMES_BEFORE_SKIP = 30;

  constructor(exerciseType: ExerciseType) {
    this.exerciseType = exerciseType;
    this.stateMachine = new ImprovedRepStateMachine(exerciseType);
    this.trackingController = getTrackingController();
    this.state = this.createInitialState();
  }

  private createInitialState(): RepCounterState {
    return {
      repCount: 0,
      currentState: 'idle',
      lastRepData: null,
      totalFormScore: 0,
      averageFormScore: 0,
      formIssues: new Map(),
      isGated: false,
      gatedReason: '',
      skippedFrames: 0,
      currentAngle: null,
      smoothedAngle: null,
      repHistory: [],
    };
  }

  /**
   * Start counting
   */
  start(): void {
    const requiredKeypoints = EXERCISE_REQUIRED_KEYPOINTS[this.exerciseType] || 
                              EXERCISE_REQUIRED_KEYPOINTS.squat;
    
    this.state = this.createInitialState();
    this.stateMachine.reset();
    this.trackingController.start(requiredKeypoints);
    
    this.wasGated = false;
    this.consecutiveGatedFrames = 0;
  }

  /**
   * Process a frame
   */
  processFrame(pose: Pose | null): RepCounterState {
    // Update tracking controller
    const trackingState = this.trackingController.processFrame(pose);
    
    // Check if we should gate rep counting
    const shouldGate = !trackingState.canCountReps || 
                       trackingState.confidence < this.MIN_CONFIDENCE_FOR_COUNTING;
    
    // Update gating state
    if (shouldGate !== this.state.isGated) {
      this.state.isGated = shouldGate;
      this.state.gatedReason = shouldGate 
        ? 'Low tracking confidence' 
        : '';
      
      this.emitEvent({
        type: 'gating_changed',
        isGated: shouldGate,
        reason: this.state.gatedReason,
      });
    }

    if (shouldGate) {
      this.consecutiveGatedFrames++;
      this.state.skippedFrames++;
      
      // If gated for too long during a rep, we might miss it
      if (this.consecutiveGatedFrames > this.MAX_GATED_FRAMES_BEFORE_SKIP) {
        // Reset state machine to avoid partial rep issues
        if (this.stateMachine.getState() === 'down') {
          this.emitEvent({
            type: 'rep_skipped',
            reason: 'Tracking lost during rep',
          });
        }
      }
      
      return this.getState();
    }

    // Reset gated frame counter
    this.consecutiveGatedFrames = 0;

    // Process through state machine
    if (pose) {
      const result = this.stateMachine.processFrame(pose);
      
      this.state.currentState = result.state;
      this.state.currentAngle = result.currentAngle;
      this.state.smoothedAngle = result.smoothedAngle;

      // Handle rep completion
      if (result.repCompleted && result.repData) {
        this.handleRepCompleted(result.repData, trackingState.canShowFeedback);
      }
    }

    return this.getState();
  }

  /**
   * Handle completed rep
   */
  private handleRepCompleted(repData: RepData, canShowFeedback: boolean): void {
    this.state.repCount = repData.repNumber;
    this.state.lastRepData = repData;
    this.state.repHistory.push(repData);

    // Update form tracking
    this.state.totalFormScore += repData.formScore;
    this.state.averageFormScore = this.state.totalFormScore / this.state.repCount;

    // Track form issues
    for (const flag of repData.flags) {
      const count = this.state.formIssues.get(flag.type) || 0;
      this.state.formIssues.set(flag.type, count + 1);
    }

    // Emit rep completed event
    this.emitEvent({
      type: 'rep_completed',
      repData,
    });

    // Only emit form issues if feedback is allowed
    if (canShowFeedback) {
      // Only report major issues (high deduction)
      const majorIssues = repData.flags.filter(f => f.deduction >= 15);
      for (const flag of majorIssues) {
        this.emitEvent({
          type: 'form_issue',
          flag,
        });
      }
    }
  }

  /**
   * Finish counting and get summary
   */
  finish(): RepCounterSummary {
    const trackingStats = this.trackingController.finish();
    
    // Calculate top issues
    const topIssues = this.getTopIssues(3);
    
    // Get fix tip for most common issue
    const fixTip = topIssues.length > 0 
      ? this.getFixTip(topIssues[0].type)
      : null;

    // Calculate form grade
    const formGrade = this.getFormGrade(this.state.averageFormScore);

    return {
      // Rep stats
      totalReps: this.state.repCount,
      validReps: this.state.repCount, // All counted reps are valid (gated)
      
      // Form stats
      averageFormScore: Math.round(this.state.averageFormScore),
      formGrade,
      topIssues,
      fixTip,
      
      // Tracking stats
      trackingQuality: Math.round(trackingStats.goodFramePercent),
      pauseCount: trackingStats.pauseCount,
      
      // Rep history
      repHistory: this.state.repHistory,
    };
  }

  /**
   * Get top form issues
   */
  private getTopIssues(count: number): Array<{ type: string; count: number; message: string }> {
    const issues = Array.from(this.state.formIssues.entries())
      .map(([type, count]) => ({
        type,
        count,
        message: this.getIssueMessage(type),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, count);

    return issues;
  }

  /**
   * Get message for issue type
   */
  private getIssueMessage(type: string): string {
    const messages: Record<string, string> = {
      partial_rom: 'Incomplete range of motion',
      no_lockout: 'Not fully extending',
      hip_sag: 'Core not engaged',
      knees_caving: 'Knees caving inward',
      forward_lean: 'Excessive forward lean',
    };
    return messages[type] || type;
  }

  /**
   * Get fix tip for issue type
   */
  private getFixTip(type: string): string {
    const tips: Record<string, string> = {
      partial_rom: 'Focus on going through the full range of motion. Quality over quantity.',
      no_lockout: 'Make sure to fully extend at the top of each rep before starting the next one.',
      hip_sag: 'Engage your core throughout the movement. Think about pulling your belly button to your spine.',
      knees_caving: 'Push your knees out over your toes. Think about spreading the floor with your feet.',
      forward_lean: 'Keep your chest up and weight centered over your mid-foot.',
    };
    return tips[type] || 'Focus on controlled, quality reps.';
  }

  /**
   * Get form grade from score
   */
  private getFormGrade(score: number): string {
    if (score >= FORM_SCORE_THRESHOLDS.EXCELLENT) return 'Excellent';
    if (score >= FORM_SCORE_THRESHOLDS.GOOD) return 'Good';
    if (score >= FORM_SCORE_THRESHOLDS.NEEDS_WORK) return 'Needs Work';
    return 'Poor';
  }

  /**
   * Get current rep count
   */
  getRepCount(): number {
    return this.state.repCount;
  }

  /**
   * Get current state
   */
  getCurrentState(): RepState {
    return this.state.currentState;
  }

  /**
   * Check if gated
   */
  isGated(): boolean {
    return this.state.isGated;
  }

  /**
   * Get gated reason
   */
  getGatedReason(): string {
    return this.state.gatedReason;
  }

  /**
   * Register event callback
   */
  onEvent(callback: RepEventCallback): () => void {
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
  private emitEvent(event: RepEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[GatedRepCounter] Event callback error:', error);
      }
    }
  }

  /**
   * Get current state
   */
  getState(): RepCounterState {
    return {
      ...this.state,
      formIssues: new Map(this.state.formIssues),
      repHistory: [...this.state.repHistory],
    };
  }

  /**
   * Reset counter
   */
  reset(): void {
    this.state = this.createInitialState();
    this.stateMachine.reset();
    this.trackingController.reset();
    this.wasGated = false;
    this.consecutiveGatedFrames = 0;
  }
}

// Rep counter summary
export interface RepCounterSummary {
  totalReps: number;
  validReps: number;
  averageFormScore: number;
  formGrade: string;
  topIssues: Array<{ type: string; count: number; message: string }>;
  fixTip: string | null;
  trackingQuality: number;
  pauseCount: number;
  repHistory: RepData[];
}

// Factory function
export function createGatedRepCounter(exerciseType: ExerciseType): GatedRepCounter {
  return new GatedRepCounter(exerciseType);
}

export default GatedRepCounter;
