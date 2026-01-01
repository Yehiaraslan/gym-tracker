/**
 * Tests for Progressive Calibration Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressiveCalibrationManager, JOINT_DETECTION_ORDER } from './progressive-calibration';
import { Pose, Keypoint, KEYPOINTS } from './pose-detection';

// Helper to create a mock pose with specified confidence for specific keypoints
function createMockPose(keypointConfidences: Record<number, number> = {}): Pose {
  const keypoints: Keypoint[] = [];
  for (let i = 0; i < 17; i++) {
    keypoints.push({
      x: 0.3 + (i * 0.02),
      y: 0.2 + (i * 0.03),
      score: keypointConfidences[i] ?? 0.1, // Default low confidence
      name: `keypoint_${i}`,
    });
  }
  return {
    keypoints,
    score: 0.5,
  };
}

// Helper to create pose with all joints at high confidence
function createFullyVisiblePose(): Pose {
  const allKeypoints: Record<number, number> = {};
  for (let i = 0; i < 17; i++) {
    allKeypoints[i] = 0.85;
  }
  return createMockPose(allKeypoints);
}

// Helper to create pose with specific joint groups visible
function createPoseWithGroups(groupIndices: number[]): Pose {
  const keypointConfidences: Record<number, number> = {};
  
  for (const groupIdx of groupIndices) {
    const group = JOINT_DETECTION_ORDER[groupIdx];
    for (const kpIdx of group.keypoints) {
      keypointConfidences[kpIdx] = 0.85;
    }
  }
  
  return createMockPose(keypointConfidences);
}

describe('ProgressiveCalibrationManager', () => {
  let manager: ProgressiveCalibrationManager;

  beforeEach(() => {
    manager = new ProgressiveCalibrationManager();
  });

  describe('initialization', () => {
    it('should start with no joints detected', () => {
      const state = manager.getState();
      expect(state.allDetected).toBe(false);
      expect(state.confirmed).toBe(false);
      expect(state.currentGroupIndex).toBe(0);
    });

    it('should have all joint groups as not detected initially', () => {
      const joints = manager.getDetectedJoints();
      expect(joints.length).toBe(JOINT_DETECTION_ORDER.length);
      expect(joints.every(j => !j.detected)).toBe(true);
      expect(joints.every(j => !j.stable)).toBe(true);
    });

    it('should start searching for first group (shoulders)', () => {
      expect(manager.getCurrentSearchingGroup()).toBe(0);
    });
  });

  describe('processFrame', () => {
    it('should handle null pose gracefully', () => {
      const state = manager.processFrame(null);
      expect(state.allDetected).toBe(false);
    });

    it('should detect first joint group when visible', () => {
      // Create pose with only shoulders visible
      const pose = createPoseWithGroups([0]);
      
      manager.processFrame(pose);
      
      const joints = manager.getDetectedJoints();
      expect(joints[0].detected).toBe(true);
    });

    it('should not detect joints with low confidence', () => {
      const pose = createMockPose({
        [KEYPOINTS.LEFT_SHOULDER]: 0.3,
        [KEYPOINTS.RIGHT_SHOULDER]: 0.3,
      });
      
      manager.processFrame(pose);
      
      const joints = manager.getDetectedJoints();
      expect(joints[0].detected).toBe(false);
    });

    it('should progress to next group after current is stable', () => {
      // Process many frames with shoulders visible to achieve stability
      const pose = createPoseWithGroups([0]);
      
      for (let i = 0; i < 15; i++) {
        manager.processFrame(pose);
      }
      
      // Should have moved to searching for elbows
      expect(manager.getCurrentSearchingGroup()).toBeGreaterThan(0);
    });
  });

  describe('progressive detection', () => {
    it('should detect joints in order', () => {
      // Simulate progressive detection
      for (let groupIdx = 0; groupIdx < JOINT_DETECTION_ORDER.length; groupIdx++) {
        const pose = createPoseWithGroups(
          Array.from({ length: groupIdx + 1 }, (_, i) => i)
        );
        
        // Process enough frames for stability
        for (let i = 0; i < 15; i++) {
          manager.processFrame(pose);
        }
      }
      
      // All groups should be detected
      const joints = manager.getDetectedJoints();
      expect(joints.every(j => j.detected)).toBe(true);
    });

    it('should set allDetected when all groups are stable', () => {
      const pose = createFullyVisiblePose();
      
      // Process many frames
      for (let i = 0; i < 50; i++) {
        manager.processFrame(pose);
      }
      
      expect(manager.isAllDetected()).toBe(true);
    });
  });

  describe('callbacks', () => {
    it('should call onJointDetected when a group is first detected', () => {
      const callback = vi.fn();
      manager.setOnJointDetected(callback);
      
      const pose = createPoseWithGroups([0]);
      manager.processFrame(pose);
      
      expect(callback).toHaveBeenCalledWith(0, 'Shoulders');
    });

    it('should call onAllDetected when all joints are stable', () => {
      const callback = vi.fn();
      manager.setOnAllDetected(callback);
      
      const pose = createFullyVisiblePose();
      
      // Process many frames
      for (let i = 0; i < 50; i++) {
        manager.processFrame(pose);
      }
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('confirmation', () => {
    it('should not confirm if not all joints detected', () => {
      const pose = createPoseWithGroups([0, 1]);
      manager.processFrame(pose);
      
      const result = manager.confirm();
      expect(result).toBeNull();
      expect(manager.isConfirmed()).toBe(false);
    });

    it('should confirm and return calibrated pose when all detected', () => {
      const pose = createFullyVisiblePose();
      
      // Process many frames
      for (let i = 0; i < 50; i++) {
        manager.processFrame(pose);
      }
      
      const result = manager.confirm();
      expect(result).not.toBeNull();
      expect(manager.isConfirmed()).toBe(true);
    });

    it('should store calibrated pose after confirmation', () => {
      const pose = createFullyVisiblePose();
      
      for (let i = 0; i < 50; i++) {
        manager.processFrame(pose);
      }
      
      manager.confirm();
      
      expect(manager.getCalibratedPose()).not.toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const pose = createFullyVisiblePose();
      
      // Build up state
      for (let i = 0; i < 50; i++) {
        manager.processFrame(pose);
      }
      manager.confirm();
      
      // Reset
      manager.reset();
      
      const state = manager.getState();
      expect(state.allDetected).toBe(false);
      expect(state.confirmed).toBe(false);
      expect(state.currentGroupIndex).toBe(0);
      expect(manager.getCalibratedPose()).toBeNull();
    });
  });

  describe('stability requirements', () => {
    it('should require multiple stable frames before marking stable', () => {
      const pose = createPoseWithGroups([0]);
      
      // Process just a few frames
      for (let i = 0; i < 3; i++) {
        manager.processFrame(pose);
      }
      
      const joints = manager.getDetectedJoints();
      // Should be detected but not yet stable
      expect(joints[0].detected).toBe(true);
      expect(joints[0].stable).toBe(false);
    });

    it('should mark stable after enough consistent frames', () => {
      const pose = createPoseWithGroups([0]);
      
      // Process many frames
      for (let i = 0; i < 15; i++) {
        manager.processFrame(pose);
      }
      
      const joints = manager.getDetectedJoints();
      expect(joints[0].stable).toBe(true);
    });
  });
});
