/**
 * Tests for Tracking Reliability System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ConfidenceGating,
  CONFIDENCE_THRESHOLDS,
  TrackingState,
  TrackingMetrics,
  getSetupGuidance,
} from './tracking-reliability';
import { Keypoint, Pose, ExerciseType } from './pose-detection';

// Helper to create a mock keypoint
function createKeypoint(x: number, y: number, score: number): Keypoint {
  return { x, y, score };
}

// Helper to create a pose with all keypoints at specified confidence
function createPoseWithConfidence(confidence: number): Pose {
  const keypoints: Keypoint[] = new Array(17).fill(null).map((_, i) => 
    createKeypoint(100 + i * 10, 100 + i * 10, confidence)
  );
  return { keypoints };
}

// Helper to create a pose with specific keypoints having high confidence
function createPoseWithKeypoints(highConfidenceIndices: number[]): Pose {
  const keypoints: Keypoint[] = new Array(17).fill(null).map((_, i) => 
    createKeypoint(100 + i * 10, 100 + i * 10, highConfidenceIndices.includes(i) ? 0.9 : 0.1)
  );
  return { keypoints };
}

describe('ConfidenceGating', () => {
  let gating: ConfidenceGating;

  beforeEach(() => {
    gating = new ConfidenceGating('pushup');
  });

  describe('processFrame', () => {
    it('should start in paused state', () => {
      const state = gating.getState();
      expect(state.isPaused).toBe(true);
      expect(state.quality).toBe('lost');
    });

    it('should update confidence for high-score pose', () => {
      const pose = createPoseWithConfidence(0.9);
      const state = gating.processFrame(pose);
      
      expect(state.confidence).toBeGreaterThan(0.5);
    });

    it('should return low confidence for low-score pose', () => {
      const pose = createPoseWithConfidence(0.1);
      const state = gating.processFrame(pose);
      
      expect(state.confidence).toBeLessThan(0.3);
    });

    it('should handle null pose gracefully', () => {
      const state = gating.processFrame(null);
      
      expect(state.confidence).toBe(0);
      expect(state.quality).toBe('lost');
    });

    it('should transition to good quality after consecutive good frames', () => {
      // Process multiple high confidence frames
      for (let i = 0; i < 10; i++) {
        gating.processFrame(createPoseWithConfidence(0.9));
      }
      
      const state = gating.getState();
      expect(state.quality).toBe('good');
      expect(state.isPaused).toBe(false);
    });

    it('should pause tracking after consecutive low confidence frames', () => {
      // First get into good state
      for (let i = 0; i < 10; i++) {
        gating.processFrame(createPoseWithConfidence(0.9));
      }
      
      // Then process low confidence frames
      for (let i = 0; i < 10; i++) {
        gating.processFrame(createPoseWithConfidence(0.1));
      }
      
      const state = gating.getState();
      expect(state.isPaused).toBe(true);
    });
  });

  describe('smoothed confidence', () => {
    it('should smooth confidence over multiple frames', () => {
      // First frame with high confidence
      gating.processFrame(createPoseWithConfidence(0.9));
      
      // Second frame with low confidence (spike)
      const state = gating.processFrame(createPoseWithConfidence(0.1));
      
      // Smoothed confidence should be higher than raw due to history
      expect(state.smoothedConfidence).toBeGreaterThan(state.confidence);
    });
  });

  describe('shouldCountReps', () => {
    it('should not allow rep counting when paused', () => {
      const pose = createPoseWithConfidence(0.1);
      gating.processFrame(pose);
      
      expect(gating.shouldCountReps()).toBe(false);
    });

    it('should allow rep counting when tracking is good', () => {
      // Get into good tracking state
      for (let i = 0; i < 10; i++) {
        gating.processFrame(createPoseWithConfidence(0.9));
      }
      
      expect(gating.shouldCountReps()).toBe(true);
    });
  });

  describe('shouldShowFormFeedback', () => {
    it('should not show form feedback when tracking is weak', () => {
      const pose = createPoseWithConfidence(0.2);
      gating.processFrame(pose);
      
      expect(gating.shouldShowFormFeedback()).toBe(false);
    });

    it('should show form feedback when tracking is good', () => {
      // Get into good tracking state
      for (let i = 0; i < 10; i++) {
        gating.processFrame(createPoseWithConfidence(0.9));
      }
      
      expect(gating.shouldShowFormFeedback()).toBe(true);
    });
  });

  describe('getStatusMessage', () => {
    it('should return error status for lost tracking', () => {
      const pose = createPoseWithConfidence(0.1);
      gating.processFrame(pose);
      
      const status = gating.getStatusMessage();
      expect(status.type).toBe('error');
    });

    it('should return success status for good tracking', () => {
      // Get into good tracking state
      for (let i = 0; i < 10; i++) {
        gating.processFrame(createPoseWithConfidence(0.9));
      }
      
      const status = gating.getStatusMessage();
      expect(status.type).toBe('success');
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics for a pose', () => {
      const pose = createPoseWithConfidence(0.8);
      const metrics = gating.calculateMetrics(pose);
      
      expect(metrics.overallConfidence).toBeGreaterThan(0);
      expect(metrics.visibleKeypoints).toBeGreaterThan(0);
      expect(metrics.bodyInFrame).toBe(true);
    });

    it('should identify missing keypoints', () => {
      // Create pose with only some keypoints visible
      const pose = createPoseWithKeypoints([5, 6]); // Only shoulders
      const metrics = gating.calculateMetrics(pose);
      
      expect(metrics.missingKeypoints.length).toBeGreaterThan(0);
      expect(metrics.bodyInFrame).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all tracking state', () => {
      // Build up some history
      for (let i = 0; i < 5; i++) {
        gating.processFrame(createPoseWithConfidence(0.9));
      }
      
      gating.reset();
      
      // After reset, should be in initial state
      const state = gating.getState();
      expect(state.isPaused).toBe(true);
      expect(state.quality).toBe('lost');
      expect(state.frameCount).toBe(0);
    });
  });

  describe('setExerciseType', () => {
    it('should reset when changing exercise type', () => {
      // Build up some history
      for (let i = 0; i < 5; i++) {
        gating.processFrame(createPoseWithConfidence(0.9));
      }
      
      gating.setExerciseType('squat');
      
      // After changing exercise, should be in initial state
      const state = gating.getState();
      expect(state.isPaused).toBe(true);
      expect(state.frameCount).toBe(0);
    });
  });
});

describe('CONFIDENCE_THRESHOLDS', () => {
  it('should have correct threshold hierarchy', () => {
    expect(CONFIDENCE_THRESHOLDS.TRACKING_GOOD).toBeGreaterThan(CONFIDENCE_THRESHOLDS.TRACKING_MIN);
    expect(CONFIDENCE_THRESHOLDS.TRACKING_MIN).toBeGreaterThan(CONFIDENCE_THRESHOLDS.KEYPOINT_MIN);
  });

  it('should have reasonable frame counts', () => {
    expect(CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE_FRAMES).toBeGreaterThan(0);
    expect(CONFIDENCE_THRESHOLDS.RESUME_FRAMES).toBeGreaterThan(0);
  });
});

describe('getSetupGuidance', () => {
  it('should return guidance for pushup', () => {
    const guidance = getSetupGuidance('pushup');
    
    expect(guidance.cameraAngle).toBeDefined();
    expect(guidance.distance).toBeDefined();
    expect(guidance.positioning).toBeDefined();
    expect(guidance.tips.length).toBeGreaterThan(0);
  });

  it('should return guidance for squat', () => {
    const guidance = getSetupGuidance('squat');
    
    expect(guidance.cameraAngle).toBeDefined();
    expect(guidance.distance).toBeDefined();
  });

  it('should return guidance for pullup', () => {
    const guidance = getSetupGuidance('pullup');
    
    expect(guidance.cameraAngle).toBeDefined();
    expect(guidance.distance).toBeDefined();
  });

  it('should return guidance for rdl', () => {
    const guidance = getSetupGuidance('rdl');
    
    expect(guidance.cameraAngle).toBeDefined();
    expect(guidance.distance).toBeDefined();
  });
});
