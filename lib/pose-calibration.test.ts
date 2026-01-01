import { describe, it, expect, beforeEach } from 'vitest';
import { PoseCalibrator, comparePoses } from './pose-calibration';
import { Pose, Keypoint, KEYPOINTS } from './pose-detection';

// Helper to create a mock pose with all keypoints
function createMockPose(options: {
  confidence?: number;
  offset?: { x: number; y: number };
} = {}): Pose {
  const { confidence = 0.8, offset = { x: 0, y: 0 } } = options;
  
  const keypoints: Keypoint[] = [];
  
  // Create all 17 keypoints with reasonable positions
  const basePositions = [
    { x: 200, y: 100 },  // nose
    { x: 190, y: 90 },   // left_eye
    { x: 210, y: 90 },   // right_eye
    { x: 180, y: 100 },  // left_ear
    { x: 220, y: 100 },  // right_ear
    { x: 150, y: 180 },  // left_shoulder
    { x: 250, y: 180 },  // right_shoulder
    { x: 120, y: 280 },  // left_elbow
    { x: 280, y: 280 },  // right_elbow
    { x: 100, y: 380 },  // left_wrist
    { x: 300, y: 380 },  // right_wrist
    { x: 160, y: 350 },  // left_hip
    { x: 240, y: 350 },  // right_hip
    { x: 155, y: 480 },  // left_knee
    { x: 245, y: 480 },  // right_knee
    { x: 150, y: 600 },  // left_ankle
    { x: 250, y: 600 },  // right_ankle
  ];
  
  const names = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
  ];
  
  for (let i = 0; i < 17; i++) {
    keypoints[i] = {
      x: basePositions[i].x + offset.x,
      y: basePositions[i].y + offset.y,
      score: confidence,
      name: names[i],
    };
  }
  
  return {
    keypoints,
    score: confidence,
  };
}

// Helper to create a pose with missing keypoints
function createPartialPose(missingIndices: number[]): Pose {
  const pose = createMockPose({ confidence: 0.8 });
  
  for (const idx of missingIndices) {
    pose.keypoints[idx] = {
      x: 0,
      y: 0,
      score: 0.1, // Low confidence = not detected
      name: pose.keypoints[idx].name,
    };
  }
  
  return pose;
}

describe('PoseCalibrator', () => {
  let calibrator: PoseCalibrator;

  beforeEach(() => {
    calibrator = new PoseCalibrator('pushup');
  });

  describe('initialization', () => {
    it('should start in waiting status', () => {
      const state = calibrator.getState();
      expect(state.status).toBe('waiting');
      expect(state.progress).toBe(0);
    });

    it('should have joints array for required keypoints', () => {
      const state = calibrator.getState();
      expect(state.joints).toBeDefined();
      expect(state.joints.length).toBeGreaterThan(0);
    });

    it('should not be calibrated initially', () => {
      expect(calibrator.isCalibrated()).toBe(false);
    });
  });

  describe('processFrame', () => {
    it('should detect joints when pose is provided', () => {
      const pose = createMockPose({ confidence: 0.8 });
      const state = calibrator.processFrame(pose);
      
      expect(state.status).not.toBe('waiting');
      expect(state.joints.some(j => j.detected)).toBe(true);
    });

    it('should return to waiting when no pose detected', () => {
      const state = calibrator.processFrame(null);
      
      expect(state.status).toBe('waiting');
      expect(state.message).toContain('Step into');
    });

    it('should show missing joints message when some keypoints not detected', () => {
      // Create pose missing shoulders
      const pose = createPartialPose([KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER]);
      const state = calibrator.processFrame(pose);
      
      expect(state.status).toBe('detecting');
      expect(state.subMessage).toContain('Missing');
    });

    it('should progress through stabilizing phase with consistent poses', () => {
      const pose = createMockPose({ confidence: 0.9 });
      
      // Process multiple frames with same pose
      let state;
      for (let i = 0; i < 10; i++) {
        state = calibrator.processFrame(pose);
      }
      
      expect(state).toBeDefined();
      expect(state!.progress).toBeGreaterThan(0);
    });

    it('should detect instability when pose moves significantly', () => {
      const calibrator = new PoseCalibrator('squat');
      
      // First few frames at one position
      for (let i = 0; i < 5; i++) {
        calibrator.processFrame(createMockPose({ offset: { x: 0, y: 0 } }));
      }
      
      // Then move significantly
      const state = calibrator.processFrame(createMockPose({ offset: { x: 50, y: 50 } }));
      
      // Should not be fully calibrated due to movement
      expect(state.status).not.toBe('calibrated');
    });
  });

  describe('calibration completion', () => {
    it('should complete calibration after enough stable frames', () => {
      const pose = createMockPose({ confidence: 0.9 });
      
      // Process many frames with stable pose
      let state;
      for (let i = 0; i < 30; i++) {
        state = calibrator.processFrame(pose);
        if (state.status === 'calibrated') break;
      }
      
      expect(calibrator.isCalibrated()).toBe(true);
      expect(state!.status).toBe('calibrated');
      expect(state!.progress).toBe(100);
    });

    it('should store reference pose after calibration', () => {
      const pose = createMockPose({ confidence: 0.9 });
      
      // Process until calibrated
      for (let i = 0; i < 30; i++) {
        calibrator.processFrame(pose);
        if (calibrator.isCalibrated()) break;
      }
      
      const refPose = calibrator.getReferencePose();
      expect(refPose).not.toBeNull();
      expect(refPose!.keypoints.length).toBeGreaterThan(0);
    });
  });

  describe('haptic feedback tracking', () => {
    it('should track newly detected joints', () => {
      const calibrator = new PoseCalibrator('squat');
      
      // First frame with pose - all joints should be newly detected
      const pose = createMockPose({ confidence: 0.8 });
      const state = calibrator.processFrame(pose);
      
      expect(state.newlyDetectedJoints).toBeDefined();
      expect(state.newlyDetectedJoints.length).toBeGreaterThan(0);
    });

    it('should not report already detected joints as new', () => {
      const calibrator = new PoseCalibrator('squat');
      const pose = createMockPose({ confidence: 0.8 });
      
      // First frame - joints are new
      calibrator.processFrame(pose);
      
      // Second frame - same joints, should not be new
      const state = calibrator.processFrame(pose);
      expect(state.newlyDetectedJoints.length).toBe(0);
    });

    it('should track newly stable joints', () => {
      const calibrator = new PoseCalibrator('squat');
      const pose = createMockPose({ confidence: 0.9 });
      
      // Process frames until some joints become stable
      let foundNewlyStable = false;
      for (let i = 0; i < 20; i++) {
        const state = calibrator.processFrame(pose);
        if (state.newlyStableJoints && state.newlyStableJoints.length > 0) {
          foundNewlyStable = true;
          break;
        }
      }
      
      expect(foundNewlyStable).toBe(true);
    });

    it('should have empty arrays in initial state', () => {
      const calibrator = new PoseCalibrator('squat');
      const state = calibrator.getState();
      
      expect(state.newlyDetectedJoints).toEqual([]);
      expect(state.newlyStableJoints).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should reset calibration state', () => {
      const pose = createMockPose({ confidence: 0.9 });
      
      // Process some frames
      for (let i = 0; i < 20; i++) {
        calibrator.processFrame(pose);
      }
      
      // Reset
      calibrator.reset();
      
      const state = calibrator.getState();
      expect(state.status).toBe('waiting');
      expect(state.progress).toBe(0);
      expect(calibrator.isCalibrated()).toBe(false);
    });
  });

  describe('different exercise types', () => {
    it('should work with pushup exercise type', () => {
      const calibrator = new PoseCalibrator('pushup');
      const state = calibrator.getState();
      expect(state.joints.length).toBeGreaterThan(0);
    });

    it('should work with pullup exercise type', () => {
      const calibrator = new PoseCalibrator('pullup');
      const state = calibrator.getState();
      expect(state.joints.length).toBeGreaterThan(0);
    });

    it('should work with squat exercise type', () => {
      const calibrator = new PoseCalibrator('squat');
      const state = calibrator.getState();
      expect(state.joints.length).toBeGreaterThan(0);
    });

    it('should work with rdl exercise type', () => {
      const calibrator = new PoseCalibrator('rdl');
      const state = calibrator.getState();
      expect(state.joints.length).toBeGreaterThan(0);
    });
  });

  describe('getJointStatus', () => {
    it('should return status for all required joints', () => {
      const calibrator = new PoseCalibrator('squat');
      const pose = createMockPose({ confidence: 0.8 });
      calibrator.processFrame(pose);
      
      const jointStatus = calibrator.getJointStatus();
      expect(jointStatus.length).toBeGreaterThan(0);
      
      for (const joint of jointStatus) {
        expect(joint).toHaveProperty('name');
        expect(joint).toHaveProperty('detected');
        expect(joint).toHaveProperty('stable');
        expect(joint).toHaveProperty('confidence');
      }
    });
  });

  describe('getProblematicJoints', () => {
    it('should return empty array when all joints detected and stable', () => {
      const pose = createMockPose({ confidence: 0.9 });
      
      // Process until calibrated
      for (let i = 0; i < 30; i++) {
        calibrator.processFrame(pose);
        if (calibrator.isCalibrated()) break;
      }
      
      const problematic = calibrator.getProblematicJoints();
      expect(problematic.length).toBe(0);
    });

    it('should return missing joints when some not detected', () => {
      const pose = createPartialPose([KEYPOINTS.LEFT_WRIST]);
      calibrator.processFrame(pose);
      
      const problematic = calibrator.getProblematicJoints();
      expect(problematic.length).toBeGreaterThan(0);
    });
  });
});

describe('comparePoses', () => {
  it('should return 100 for identical poses', () => {
    const pose = createMockPose({ confidence: 0.9 });
    const score = comparePoses(pose, pose);
    expect(score).toBe(100);
  });

  it('should return lower score for different poses', () => {
    const pose1 = createMockPose({ offset: { x: 0, y: 0 } });
    const pose2 = createMockPose({ offset: { x: 30, y: 30 } });
    
    const score = comparePoses(pose1, pose2);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(0);
  });

  it('should return 0 for null poses', () => {
    const pose = createMockPose();
    
    expect(comparePoses(null as any, pose)).toBe(0);
    expect(comparePoses(pose, null as any)).toBe(0);
    expect(comparePoses(null as any, null as any)).toBe(0);
  });

  it('should handle poses with low confidence keypoints', () => {
    const pose1 = createMockPose({ confidence: 0.9 });
    const pose2 = createMockPose({ confidence: 0.3 }); // Below threshold
    
    const score = comparePoses(pose1, pose2);
    // Should still work but may have lower score due to confidence filtering
    expect(typeof score).toBe('number');
  });
});
