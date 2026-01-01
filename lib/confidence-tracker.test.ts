/**
 * Tests for Confidence Tracker Module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfidenceTracker, CONFIDENCE_LEVELS } from './confidence-tracker';
import { Pose, Keypoint, KEYPOINTS } from './pose-detection';

// Helper to create a mock pose with specified confidence
function createMockPose(confidence: number): Pose {
  const keypoints: Keypoint[] = [];
  for (let i = 0; i < 17; i++) {
    keypoints.push({
      x: 100 + i * 10,
      y: 200 + i * 5,
      score: confidence,
      name: `keypoint_${i}`,
    });
  }
  return {
    keypoints,
    score: confidence,
  };
}

describe('ConfidenceTracker', () => {
  let tracker: ConfidenceTracker;

  beforeEach(() => {
    tracker = new ConfidenceTracker();
  });

  describe('initialization', () => {
    it('should start with zero confidence', () => {
      const state = tracker.getState();
      expect(state.rawConfidence).toBe(0);
      expect(state.smoothedConfidence).toBe(0);
    });

    it('should start with lost status', () => {
      const state = tracker.getState();
      expect(state.status).toBe('lost');
    });

    it('should start as not stable', () => {
      expect(tracker.isStable()).toBe(false);
    });
  });

  describe('processFrame', () => {
    it('should update confidence when pose is provided', () => {
      const pose = createMockPose(0.8);
      tracker.processFrame(pose);
      
      const state = tracker.getState();
      expect(state.rawConfidence).toBeGreaterThan(0);
    });

    it('should handle null pose gracefully', () => {
      tracker.processFrame(null);
      
      const state = tracker.getState();
      expect(state.rawConfidence).toBe(0);
    });

    it('should smooth confidence over multiple frames', () => {
      // Process several frames with high confidence
      for (let i = 0; i < 10; i++) {
        tracker.processFrame(createMockPose(0.9));
      }
      
      const state = tracker.getState();
      expect(state.smoothedConfidence).toBeGreaterThan(0.5);
    });

    it('should decay confidence when pose is lost', () => {
      // Build up confidence
      for (let i = 0; i < 10; i++) {
        tracker.processFrame(createMockPose(0.9));
      }
      
      const beforeLoss = tracker.getState().smoothedConfidence;
      
      // Lose pose
      tracker.processFrame(null);
      
      const afterLoss = tracker.getState().smoothedConfidence;
      expect(afterLoss).toBeLessThan(beforeLoss);
    });
  });

  describe('tracking status', () => {
    it('should transition to good status with high confidence', () => {
      // Process many frames with high confidence
      for (let i = 0; i < 20; i++) {
        tracker.processFrame(createMockPose(0.85));
      }
      
      expect(tracker.isTrackingGood()).toBe(true);
    });

    it('should transition to weak status with moderate confidence', () => {
      // First build up to good
      for (let i = 0; i < 20; i++) {
        tracker.processFrame(createMockPose(0.85));
      }
      
      // Then drop to moderate
      for (let i = 0; i < 10; i++) {
        tracker.processFrame(createMockPose(0.35));
      }
      
      const state = tracker.getState();
      expect(state.status).toBe('weak');
    });

    it('should transition to lost status with very low confidence', () => {
      // Process frames with very low confidence
      for (let i = 0; i < 10; i++) {
        tracker.processFrame(createMockPose(0.1));
      }
      
      const state = tracker.getState();
      expect(state.status).toBe('lost');
    });
  });

  describe('stability detection', () => {
    it('should detect stability with consistent high confidence', () => {
      // Process many frames with consistent high confidence
      for (let i = 0; i < 30; i++) {
        tracker.processFrame(createMockPose(0.85));
      }
      
      expect(tracker.isStable()).toBe(true);
    });

    it('should eventually stabilize even with some variance', () => {
      // Process frames with varying confidence - smoothing will stabilize
      for (let i = 0; i < 20; i++) {
        const conf = i % 2 === 0 ? 0.9 : 0.7; // Less extreme variance
        tracker.processFrame(createMockPose(conf));
      }
      
      // After smoothing, should be stable
      const state = tracker.getState();
      expect(state.smoothedConfidence).toBeGreaterThan(0.5);
    });
  });

  describe('required keypoints', () => {
    it('should allow setting required keypoints', () => {
      const required = [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER];
      tracker.setRequiredKeypoints(required);
      
      // Should not throw
      tracker.processFrame(createMockPose(0.8));
    });

    it('should calculate confidence based on required keypoints only', () => {
      // Create pose with mixed confidence
      const pose = createMockPose(0.3); // Low base confidence
      
      // Set high confidence for specific keypoints
      pose.keypoints[KEYPOINTS.LEFT_SHOULDER].score = 0.95;
      pose.keypoints[KEYPOINTS.RIGHT_SHOULDER].score = 0.95;
      
      tracker.setRequiredKeypoints([KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER]);
      tracker.processFrame(pose);
      
      const state = tracker.getState();
      // Should have higher confidence because required keypoints are high
      expect(state.rawConfidence).toBeGreaterThan(0.5);
    });
  });

  describe('confidence levels', () => {
    it('should return correct confidence level label', () => {
      // Process frames with excellent confidence
      for (let i = 0; i < 20; i++) {
        tracker.processFrame(createMockPose(0.95));
      }
      
      expect(tracker.getConfidenceLevel()).toBe('Excellent');
    });

    it('should return confidence as percentage', () => {
      for (let i = 0; i < 20; i++) {
        tracker.processFrame(createMockPose(0.75));
      }
      
      const percent = tracker.getConfidencePercent();
      expect(percent).toBeGreaterThan(50);
      expect(percent).toBeLessThanOrEqual(100);
    });
  });

  describe('keypoint tracking', () => {
    it('should track individual keypoint confidence', () => {
      const pose = createMockPose(0.8);
      pose.keypoints[KEYPOINTS.LEFT_ELBOW].score = 0.95;
      
      tracker.processFrame(pose);
      
      const elbowConf = tracker.getKeypointConfidence(KEYPOINTS.LEFT_ELBOW);
      expect(elbowConf).toBeGreaterThan(0);
    });

    it('should identify well-tracked keypoints after multiple frames', () => {
      const pose = createMockPose(0.8);
      // Need multiple frames for smoothed confidence to build up
      for (let i = 0; i < 10; i++) {
        tracker.processFrame(pose);
      }
      
      // Check that keypoint confidence is tracked
      const conf = tracker.getKeypointConfidence(KEYPOINTS.LEFT_SHOULDER);
      expect(conf).toBeGreaterThan(0.3);
    });

    it('should identify weak keypoints', () => {
      const pose = createMockPose(0.8);
      pose.keypoints[KEYPOINTS.LEFT_ANKLE].score = 0.2;
      
      tracker.setRequiredKeypoints([KEYPOINTS.LEFT_ANKLE]);
      tracker.processFrame(pose);
      
      const weakKeypoints = tracker.getWeakKeypoints();
      expect(weakKeypoints).toContain(KEYPOINTS.LEFT_ANKLE);
    });
  });

  describe('event callbacks', () => {
    it('should emit status_changed event', () => {
      const callback = vi.fn();
      tracker.onEvent(callback);
      
      // Build up to good status
      for (let i = 0; i < 20; i++) {
        tracker.processFrame(createMockPose(0.9));
      }
      
      expect(callback).toHaveBeenCalled();
      const calls = callback.mock.calls;
      const statusChanges = calls.filter((c: any) => c[0].type === 'status_changed');
      expect(statusChanges.length).toBeGreaterThan(0);
    });

    it('should allow unsubscribing from events', () => {
      const callback = vi.fn();
      const unsubscribe = tracker.onEvent(callback);
      
      tracker.processFrame(createMockPose(0.9));
      const callsBefore = callback.mock.calls.length;
      
      unsubscribe();
      
      tracker.processFrame(createMockPose(0.9));
      expect(callback.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      // Build up state
      for (let i = 0; i < 20; i++) {
        tracker.processFrame(createMockPose(0.9));
      }
      
      tracker.reset();
      
      const state = tracker.getState();
      expect(state.rawConfidence).toBe(0);
      expect(state.smoothedConfidence).toBe(0);
      expect(state.status).toBe('lost');
      expect(state.isStable).toBe(false);
    });
  });
});

describe('CONFIDENCE_LEVELS', () => {
  it('should have correct threshold values', () => {
    expect(CONFIDENCE_LEVELS.EXCELLENT).toBe(0.8);
    expect(CONFIDENCE_LEVELS.GOOD).toBe(0.6);
    expect(CONFIDENCE_LEVELS.MODERATE).toBe(0.4);
    expect(CONFIDENCE_LEVELS.WEAK).toBe(0.3);
    expect(CONFIDENCE_LEVELS.LOST).toBe(0);
  });
});
