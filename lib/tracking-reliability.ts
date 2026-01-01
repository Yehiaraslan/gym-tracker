/**
 * Tracking Reliability System
 * 
 * Implements confidence gating, smoothed tracking, and reliability metrics
 * for the AI Form Coach. Ensures we never show "you're doing it wrong"
 * when tracking quality is poor.
 */

import { Pose, Keypoint, ExerciseType, KEYPOINTS } from './pose-detection';

// Confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  // Minimum keypoint score to consider it "detected"
  KEYPOINT_MIN: 0.3,
  // Minimum overall confidence to allow rep counting
  TRACKING_MIN: 0.5,
  // Confidence level considered "good" tracking
  TRACKING_GOOD: 0.7,
  // Number of consecutive low-confidence frames before pausing
  LOW_CONFIDENCE_FRAMES: 5,
  // Number of consecutive good frames to resume tracking
  RESUME_FRAMES: 3,
} as const;

// Tracking state
export type TrackingQuality = 'good' | 'weak' | 'lost';

export interface TrackingState {
  quality: TrackingQuality;
  confidence: number;
  smoothedConfidence: number;
  isPaused: boolean;
  pauseReason: string | null;
  consecutiveLowFrames: number;
  consecutiveGoodFrames: number;
  frameCount: number;
  lastValidPose: Pose | null;
}

export interface TrackingMetrics {
  overallConfidence: number;
  visibleKeypoints: number;
  totalKeypoints: number;
  missingKeypoints: string[];
  avgKeypointScore: number;
  bodyInFrame: boolean;
  recommendedAction: string | null;
}

// Required keypoints for each exercise
const EXERCISE_REQUIRED_KEYPOINTS: Record<ExerciseType, number[]> = {
  pushup: [
    KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW,
    KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST,
    KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
  ],
  pullup: [
    KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_ELBOW, KEYPOINTS.RIGHT_ELBOW,
    KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST,
    KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
  ],
  squat: [
    KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
    KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE,
    KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE,
    KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
  ],
  rdl: [
    KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
    KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE,
    KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE,
  ],
};

// Keypoint names for user-friendly messages
const KEYPOINT_NAMES: Record<number, string> = {
  [KEYPOINTS.NOSE]: 'head',
  [KEYPOINTS.LEFT_EYE]: 'left eye',
  [KEYPOINTS.RIGHT_EYE]: 'right eye',
  [KEYPOINTS.LEFT_EAR]: 'left ear',
  [KEYPOINTS.RIGHT_EAR]: 'right ear',
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

/**
 * Confidence Gating System
 * 
 * Manages tracking quality and pauses rep counting when confidence is low.
 */
export class ConfidenceGating {
  private state: TrackingState;
  private confidenceHistory: number[] = [];
  private readonly historySize = 10; // Frames for smoothing
  private exerciseType: ExerciseType;

  constructor(exerciseType: ExerciseType) {
    this.exerciseType = exerciseType;
    this.state = this.createInitialState();
  }

  private createInitialState(): TrackingState {
    return {
      quality: 'lost',
      confidence: 0,
      smoothedConfidence: 0,
      isPaused: true,
      pauseReason: 'Initializing tracking...',
      consecutiveLowFrames: 0,
      consecutiveGoodFrames: 0,
      frameCount: 0,
      lastValidPose: null,
    };
  }

  /**
   * Process a new pose frame and update tracking state
   */
  processFrame(pose: Pose | null): TrackingState {
    this.state.frameCount++;

    if (!pose) {
      return this.handleNoPose();
    }

    const metrics = this.calculateMetrics(pose);
    this.updateConfidenceHistory(metrics.overallConfidence);
    
    const smoothedConfidence = this.calculateSmoothedConfidence();
    this.state.confidence = metrics.overallConfidence;
    this.state.smoothedConfidence = smoothedConfidence;

    // Determine tracking quality
    if (smoothedConfidence >= CONFIDENCE_THRESHOLDS.TRACKING_GOOD) {
      this.state.quality = 'good';
      this.state.consecutiveGoodFrames++;
      this.state.consecutiveLowFrames = 0;
    } else if (smoothedConfidence >= CONFIDENCE_THRESHOLDS.TRACKING_MIN) {
      this.state.quality = 'weak';
      this.state.consecutiveGoodFrames = 0;
      this.state.consecutiveLowFrames++;
    } else {
      this.state.quality = 'lost';
      this.state.consecutiveGoodFrames = 0;
      this.state.consecutiveLowFrames++;
    }

    // Update pause state
    this.updatePauseState(metrics);

    // Store valid pose
    if (this.state.quality !== 'lost') {
      this.state.lastValidPose = pose;
    }

    return { ...this.state };
  }

  private handleNoPose(): TrackingState {
    this.state.quality = 'lost';
    this.state.confidence = 0;
    this.state.consecutiveGoodFrames = 0;
    this.state.consecutiveLowFrames++;
    
    if (this.state.consecutiveLowFrames >= CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE_FRAMES) {
      this.state.isPaused = true;
      this.state.pauseReason = 'No body detected. Step into the camera view.';
    }

    this.updateConfidenceHistory(0);
    this.state.smoothedConfidence = this.calculateSmoothedConfidence();

    return { ...this.state };
  }

  private updatePauseState(metrics: TrackingMetrics): void {
    // Pause if too many low confidence frames
    if (this.state.consecutiveLowFrames >= CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE_FRAMES) {
      this.state.isPaused = true;
      this.state.pauseReason = metrics.recommendedAction || 
        'Tracking weak: adjust angle/lighting, keep full body visible.';
    }
    // Resume if enough good frames
    else if (this.state.consecutiveGoodFrames >= CONFIDENCE_THRESHOLDS.RESUME_FRAMES) {
      this.state.isPaused = false;
      this.state.pauseReason = null;
    }
  }

  /**
   * Calculate tracking metrics for a pose
   */
  calculateMetrics(pose: Pose): TrackingMetrics {
    const requiredKeypoints = EXERCISE_REQUIRED_KEYPOINTS[this.exerciseType];
    const missingKeypoints: string[] = [];
    let visibleCount = 0;
    let totalScore = 0;

    // Check required keypoints
    for (const idx of requiredKeypoints) {
      const kp = pose.keypoints[idx];
      if (kp && kp.score >= CONFIDENCE_THRESHOLDS.KEYPOINT_MIN) {
        visibleCount++;
        totalScore += kp.score;
      } else {
        missingKeypoints.push(KEYPOINT_NAMES[idx] || `keypoint_${idx}`);
      }
    }

    const avgScore = visibleCount > 0 ? totalScore / visibleCount : 0;
    const visibilityRatio = visibleCount / requiredKeypoints.length;
    const overallConfidence = avgScore * visibilityRatio;
    const bodyInFrame = visibilityRatio >= 0.7;

    // Generate recommended action
    let recommendedAction: string | null = null;
    if (!bodyInFrame) {
      if (missingKeypoints.length > 0) {
        const missing = missingKeypoints.slice(0, 2).join(' and ');
        recommendedAction = `Can't see your ${missing}. Adjust camera angle or move back.`;
      } else {
        recommendedAction = 'Keep your full body visible in the frame.';
      }
    } else if (avgScore < CONFIDENCE_THRESHOLDS.TRACKING_GOOD) {
      recommendedAction = 'Tracking weak: improve lighting or reduce background clutter.';
    }

    return {
      overallConfidence,
      visibleKeypoints: visibleCount,
      totalKeypoints: requiredKeypoints.length,
      missingKeypoints,
      avgKeypointScore: avgScore,
      bodyInFrame,
      recommendedAction,
    };
  }

  private updateConfidenceHistory(confidence: number): void {
    this.confidenceHistory.push(confidence);
    if (this.confidenceHistory.length > this.historySize) {
      this.confidenceHistory.shift();
    }
  }

  private calculateSmoothedConfidence(): number {
    if (this.confidenceHistory.length === 0) return 0;
    
    // Weighted average - recent frames matter more
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < this.confidenceHistory.length; i++) {
      const weight = i + 1; // Linear weighting
      weightedSum += this.confidenceHistory[i] * weight;
      weightSum += weight;
    }
    
    return weightedSum / weightSum;
  }

  /**
   * Check if rep counting should be active
   */
  shouldCountReps(): boolean {
    return !this.state.isPaused && this.state.quality !== 'lost';
  }

  /**
   * Check if form feedback should be shown
   */
  shouldShowFormFeedback(): boolean {
    return this.state.quality === 'good' && !this.state.isPaused;
  }

  /**
   * Get current tracking state
   */
  getState(): TrackingState {
    return { ...this.state };
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(): { message: string; type: 'success' | 'warning' | 'error' } {
    if (this.state.quality === 'good') {
      return { message: 'Tracking: Good', type: 'success' };
    } else if (this.state.quality === 'weak') {
      return { message: 'Tracking: Weak', type: 'warning' };
    } else {
      return { message: 'Tracking: Lost', type: 'error' };
    }
  }

  /**
   * Reset the gating system
   */
  reset(): void {
    this.state = this.createInitialState();
    this.confidenceHistory = [];
  }

  /**
   * Set exercise type (for switching exercises)
   */
  setExerciseType(exerciseType: ExerciseType): void {
    this.exerciseType = exerciseType;
    this.reset();
  }
}

/**
 * Setup Guidance Generator
 * 
 * Provides exercise-specific setup instructions
 */
export interface SetupGuidance {
  cameraAngle: string;
  distance: string;
  positioning: string;
  lighting: string;
  tips: string[];
}

export function getSetupGuidance(exerciseType: ExerciseType): SetupGuidance {
  const baseGuidance = {
    lighting: 'Ensure even lighting on your body. Avoid backlighting (bright windows behind you).',
    tips: [
      'Wear fitted clothing for better joint detection',
      'Use a plain background if possible',
      'Keep phone stable (use tripod or prop against wall)',
    ],
  };

  switch (exerciseType) {
    case 'pushup':
      return {
        ...baseGuidance,
        cameraAngle: 'Side view (90° angle)',
        distance: '2-3 meters (6-10 feet)',
        positioning: 'Position camera at floor level, perpendicular to your body. Your full body from head to feet should be visible.',
        tips: [
          ...baseGuidance.tips,
          'Camera should capture your profile clearly',
          'Ensure hands and feet are visible at all times',
        ],
      };
    case 'pullup':
      return {
        ...baseGuidance,
        cameraAngle: 'Front view or 45° angle',
        distance: '2-3 meters (6-10 feet)',
        positioning: 'Position camera facing you, capturing from hands on bar down to at least your hips.',
        tips: [
          ...baseGuidance.tips,
          'Ensure the bar and your hands are visible',
          'Full arm extension should be captured',
        ],
      };
    case 'squat':
      return {
        ...baseGuidance,
        cameraAngle: 'Side view (90° angle) or 45° angle',
        distance: '2-3 meters (6-10 feet)',
        positioning: 'Position camera to capture your full body from head to feet. Side view is best for depth tracking.',
        tips: [
          ...baseGuidance.tips,
          'Ensure knees and ankles are clearly visible',
          'Hip crease visibility is important for depth',
        ],
      };
    case 'rdl':
      return {
        ...baseGuidance,
        cameraAngle: 'Side view (90° angle)',
        distance: '2-3 meters (6-10 feet)',
        positioning: 'Position camera perpendicular to your body to track hip hinge movement.',
        tips: [
          ...baseGuidance.tips,
          'Full back visibility is important',
          'Ensure hamstrings and glutes are trackable',
        ],
      };
    default:
      return {
        ...baseGuidance,
        cameraAngle: 'Side view or 45° angle',
        distance: '2-3 meters (6-10 feet)',
        positioning: 'Position camera to capture your full body.',
      };
  }
}

/**
 * Debug Metrics for internal testing
 */
export interface DebugMetrics {
  // Timing
  frameNumber: number;
  inferenceTimeMs: number;
  fps: number;
  
  // Confidence
  rawConfidence: number;
  smoothedConfidence: number;
  trackingQuality: TrackingQuality;
  
  // Keypoints
  visibleKeypoints: number;
  totalKeypoints: number;
  missingKeypoints: string[];
  
  // Joint angles (exercise-specific)
  angles: Record<string, number>;
  
  // State machine
  repState: string;
  repCount: number;
  lastRepTime: number;
  
  // Thresholds
  thresholds: Record<string, number>;
}

export function createDebugMetrics(
  frameNumber: number,
  inferenceTimeMs: number,
  fps: number,
  trackingState: TrackingState,
  metrics: TrackingMetrics,
  angles: Record<string, number>,
  repState: string,
  repCount: number,
  lastRepTime: number,
  thresholds: Record<string, number>
): DebugMetrics {
  return {
    frameNumber,
    inferenceTimeMs,
    fps,
    rawConfidence: trackingState.confidence,
    smoothedConfidence: trackingState.smoothedConfidence,
    trackingQuality: trackingState.quality,
    visibleKeypoints: metrics.visibleKeypoints,
    totalKeypoints: metrics.totalKeypoints,
    missingKeypoints: metrics.missingKeypoints,
    angles,
    repState,
    repCount,
    lastRepTime,
    thresholds,
  };
}
