import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateAngle,
  isKeypointValid,
  getAveragePoint,
  calculatePoseConfidence,
  PushupTracker,
  PullupTracker,
  SquatTracker,
  createExerciseSession,
  addRepToSession,
  finalizeSession,
  getFormSummary,
  KEYPOINTS,
  Keypoint,
  Pose,
  RepData,
} from './pose-detection';

// Helper to create a keypoint
function createKeypoint(x: number, y: number, score: number): Keypoint {
  return { x, y, score };
}

// Helper to create a full pose with all keypoints
function createPose(overrides: Record<number, Keypoint> = {}): Pose {
  const defaultKeypoints: Keypoint[] = Array.from({ length: 17 }, (_, i) => ({
    x: 100 + i * 10,
    y: 100 + i * 10,
    score: 0.8,
  }));
  
  for (const [index, keypoint] of Object.entries(overrides)) {
    defaultKeypoints[parseInt(index)] = keypoint;
  }
  
  return { keypoints: defaultKeypoints, score: 0.8 };
}

describe('calculateAngle', () => {
  it('should calculate 90 degree angle correctly', () => {
    const pointA = createKeypoint(0, 0, 1);
    const pointB = createKeypoint(0, 100, 1); // vertex
    const pointC = createKeypoint(100, 100, 1);
    
    const angle = calculateAngle(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(90, 0);
  });

  it('should calculate 180 degree angle (straight line)', () => {
    const pointA = createKeypoint(0, 0, 1);
    const pointB = createKeypoint(50, 0, 1); // vertex
    const pointC = createKeypoint(100, 0, 1);
    
    const angle = calculateAngle(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(180, 0);
  });

  it('should calculate 45 degree angle', () => {
    const pointA = createKeypoint(0, 0, 1);
    const pointB = createKeypoint(0, 100, 1); // vertex
    const pointC = createKeypoint(100, 0, 1);
    
    const angle = calculateAngle(pointA, pointB, pointC);
    expect(angle).toBeCloseTo(45, 0);
  });
});

describe('isKeypointValid', () => {
  it('should return true for keypoint with score >= 0.3', () => {
    expect(isKeypointValid(createKeypoint(0, 0, 0.3))).toBe(true);
    expect(isKeypointValid(createKeypoint(0, 0, 0.5))).toBe(true);
    expect(isKeypointValid(createKeypoint(0, 0, 1.0))).toBe(true);
  });

  it('should return false for keypoint with score < 0.3', () => {
    expect(isKeypointValid(createKeypoint(0, 0, 0.29))).toBe(false);
    expect(isKeypointValid(createKeypoint(0, 0, 0.1))).toBe(false);
    expect(isKeypointValid(createKeypoint(0, 0, 0))).toBe(false);
  });

  it('should return false for undefined keypoint', () => {
    expect(isKeypointValid(undefined)).toBe(false);
  });
});

describe('getAveragePoint', () => {
  it('should calculate average position correctly', () => {
    const kp1 = createKeypoint(0, 0, 0.8);
    const kp2 = createKeypoint(100, 200, 0.6);
    
    const avg = getAveragePoint(kp1, kp2);
    
    expect(avg.x).toBe(50);
    expect(avg.y).toBe(100);
    expect(avg.score).toBe(0.6); // minimum of the two scores
  });
});

describe('calculatePoseConfidence', () => {
  it('should return high confidence for pose with all valid keypoints', () => {
    const pose = createPose();
    const confidence = calculatePoseConfidence(pose, 'pushup');
    
    expect(confidence).toBeGreaterThan(50);
  });

  it('should return lower confidence for pose with low-score keypoints', () => {
    const pose = createPose({
      [KEYPOINTS.LEFT_SHOULDER]: createKeypoint(100, 100, 0.2),
      [KEYPOINTS.RIGHT_SHOULDER]: createKeypoint(120, 100, 0.2),
      [KEYPOINTS.LEFT_ELBOW]: createKeypoint(100, 150, 0.2),
      [KEYPOINTS.RIGHT_ELBOW]: createKeypoint(120, 150, 0.2),
    });
    
    const confidence = calculatePoseConfidence(pose, 'pushup');
    expect(confidence).toBeLessThan(50);
  });
});

describe('PushupTracker', () => {
  let tracker: PushupTracker;

  beforeEach(() => {
    tracker = new PushupTracker();
  });

  it('should start with 0 reps', () => {
    expect(tracker.getRepCount()).toBe(0);
  });

  it('should start in up state', () => {
    expect(tracker.getCurrentState()).toBe('up');
  });

  it('should detect transition to down state when elbow angle decreases', () => {
    // Simulate down position - elbow angle < 100 degrees
    const pose = createPose({
      [KEYPOINTS.LEFT_SHOULDER]: createKeypoint(0, 0, 0.9),
      [KEYPOINTS.LEFT_ELBOW]: createKeypoint(50, 50, 0.9),
      [KEYPOINTS.LEFT_WRIST]: createKeypoint(0, 100, 0.9), // Creates ~90 degree angle
    });
    
    const result = tracker.processFrame(pose);
    expect(result.currentState).toBe('down');
    expect(result.repCompleted).toBe(false);
  });

  it('should count rep when transitioning from down to up', () => {
    // First, go to down position
    const downPose = createPose({
      [KEYPOINTS.LEFT_SHOULDER]: createKeypoint(0, 0, 0.9),
      [KEYPOINTS.LEFT_ELBOW]: createKeypoint(50, 50, 0.9),
      [KEYPOINTS.LEFT_WRIST]: createKeypoint(0, 100, 0.9),
    });
    tracker.processFrame(downPose);
    
    // Then go to up position - elbow angle > 150 degrees
    const upPose = createPose({
      [KEYPOINTS.LEFT_SHOULDER]: createKeypoint(0, 0, 0.9),
      [KEYPOINTS.LEFT_ELBOW]: createKeypoint(50, 0, 0.9),
      [KEYPOINTS.LEFT_WRIST]: createKeypoint(100, 0, 0.9), // Creates ~180 degree angle
    });
    
    const result = tracker.processFrame(upPose);
    expect(result.repCompleted).toBe(true);
    expect(result.repData?.repNumber).toBe(1);
    expect(tracker.getRepCount()).toBe(1);
  });

  it('should reset properly', () => {
    // Do a rep first
    const downPose = createPose({
      [KEYPOINTS.LEFT_SHOULDER]: createKeypoint(0, 0, 0.9),
      [KEYPOINTS.LEFT_ELBOW]: createKeypoint(50, 50, 0.9),
      [KEYPOINTS.LEFT_WRIST]: createKeypoint(0, 100, 0.9),
    });
    tracker.processFrame(downPose);
    
    const upPose = createPose({
      [KEYPOINTS.LEFT_SHOULDER]: createKeypoint(0, 0, 0.9),
      [KEYPOINTS.LEFT_ELBOW]: createKeypoint(50, 0, 0.9),
      [KEYPOINTS.LEFT_WRIST]: createKeypoint(100, 0, 0.9),
    });
    tracker.processFrame(upPose);
    
    expect(tracker.getRepCount()).toBe(1);
    
    // Reset
    tracker.reset();
    
    expect(tracker.getRepCount()).toBe(0);
    expect(tracker.getCurrentState()).toBe('up');
  });
});

describe('PullupTracker', () => {
  let tracker: PullupTracker;

  beforeEach(() => {
    tracker = new PullupTracker();
  });

  it('should start with 0 reps', () => {
    expect(tracker.getRepCount()).toBe(0);
  });

  it('should start in down state', () => {
    expect(tracker.getCurrentState()).toBe('down');
  });

  it('should reset properly', () => {
    tracker.reset();
    expect(tracker.getRepCount()).toBe(0);
    expect(tracker.getCurrentState()).toBe('down');
  });
});

describe('ExerciseSession', () => {
  it('should create a new session with correct initial values', () => {
    const session = createExerciseSession('pushup');
    
    expect(session.exerciseType).toBe('pushup');
    expect(session.reps).toHaveLength(0);
    expect(session.totalReps).toBe(0);
    expect(session.averageFormScore).toBe(0);
    expect(session.startTime).toBeGreaterThan(0);
    expect(session.endTime).toBeNull();
  });

  it('should add rep to session and update stats', () => {
    let session = createExerciseSession('pushup');
    
    const repData: RepData = {
      repNumber: 1,
      formScore: 80,
      flags: [],
      timestamp: Date.now(),
    };
    
    session = addRepToSession(session, repData);
    
    expect(session.reps).toHaveLength(1);
    expect(session.totalReps).toBe(1);
    expect(session.averageFormScore).toBe(80);
  });

  it('should calculate average form score correctly', () => {
    let session = createExerciseSession('pushup');
    
    session = addRepToSession(session, {
      repNumber: 1,
      formScore: 100,
      flags: [],
      timestamp: Date.now(),
    });
    
    session = addRepToSession(session, {
      repNumber: 2,
      formScore: 60,
      flags: [],
      timestamp: Date.now(),
    });
    
    expect(session.averageFormScore).toBe(80); // (100 + 60) / 2
  });

  it('should finalize session with end time', () => {
    let session = createExerciseSession('pushup');
    session = finalizeSession(session);
    
    expect(session.endTime).not.toBeNull();
    expect(session.endTime).toBeGreaterThanOrEqual(session.startTime);
  });
});

describe('getFormSummary', () => {
  it('should return Excellent grade for score >= 90', () => {
    let session = createExerciseSession('pushup');
    session = addRepToSession(session, {
      repNumber: 1,
      formScore: 95,
      flags: [],
      timestamp: Date.now(),
    });
    
    const summary = getFormSummary(session);
    
    expect(summary.score).toBe(95);
    expect(summary.grade).toBe('Excellent');
    expect(summary.feedback).toHaveLength(0);
  });

  it('should return Good grade for score >= 75', () => {
    let session = createExerciseSession('pushup');
    session = addRepToSession(session, {
      repNumber: 1,
      formScore: 80,
      flags: [],
      timestamp: Date.now(),
    });
    
    const summary = getFormSummary(session);
    expect(summary.grade).toBe('Good');
  });

  it('should return Fair grade for score >= 60', () => {
    let session = createExerciseSession('pushup');
    session = addRepToSession(session, {
      repNumber: 1,
      formScore: 65,
      flags: [],
      timestamp: Date.now(),
    });
    
    const summary = getFormSummary(session);
    expect(summary.grade).toBe('Fair');
  });

  it('should return Needs Work grade for score < 60', () => {
    let session = createExerciseSession('pushup');
    session = addRepToSession(session, {
      repNumber: 1,
      formScore: 50,
      flags: [],
      timestamp: Date.now(),
    });
    
    const summary = getFormSummary(session);
    expect(summary.grade).toBe('Needs Work');
  });

  it('should collect unique feedback from all reps', () => {
    let session = createExerciseSession('pushup');
    
    session = addRepToSession(session, {
      repNumber: 1,
      formScore: 70,
      flags: [{ type: 'partial_rom', message: 'Go deeper', deduction: 20 }],
      timestamp: Date.now(),
    });
    
    session = addRepToSession(session, {
      repNumber: 2,
      formScore: 70,
      flags: [
        { type: 'partial_rom', message: 'Go deeper', deduction: 20 },
        { type: 'no_lockout', message: 'Extend arms', deduction: 15 },
      ],
      timestamp: Date.now(),
    });
    
    const summary = getFormSummary(session);
    
    // Should have unique feedback messages
    expect(summary.feedback).toContain('Go deeper');
    expect(summary.feedback).toContain('Extend arms');
    expect(summary.feedback).toHaveLength(2);
  });
});

describe('SquatTracker', () => {
  let tracker: SquatTracker;

  beforeEach(() => {
    tracker = new SquatTracker();
  });

  it('should start with 0 reps', () => {
    expect(tracker.getRepCount()).toBe(0);
  });

  it('should start in standing state', () => {
    expect(tracker.getCurrentState()).toBe('standing');
  });

  it('should reset properly', () => {
    tracker.reset();
    expect(tracker.getRepCount()).toBe(0);
    expect(tracker.getCurrentState()).toBe('standing');
  });

  it('should count a rep when going from standing to down and back up', () => {
    // Go to down position - knee angle < 100 degrees
    // Hip at top, knee in middle bent forward, ankle below and back
    const downPose = createPose({
      [KEYPOINTS.LEFT_HIP]: createKeypoint(100, 50, 0.9),
      [KEYPOINTS.LEFT_KNEE]: createKeypoint(150, 100, 0.9), // Knee forward
      [KEYPOINTS.LEFT_ANKLE]: createKeypoint(100, 150, 0.9), // Ankle below hip
    });
    tracker.processFrame(downPose);
    expect(tracker.getCurrentState()).toBe('down');
    
    // Go back to standing - knee angle > 160 degrees (nearly straight leg)
    const standingPose = createPose({
      [KEYPOINTS.LEFT_HIP]: createKeypoint(100, 50, 0.9),
      [KEYPOINTS.LEFT_KNEE]: createKeypoint(100, 100, 0.9), // Knee directly below hip
      [KEYPOINTS.LEFT_ANKLE]: createKeypoint(100, 150, 0.9), // Ankle directly below knee
    });
    
    const result = tracker.processFrame(standingPose);
    expect(result.repCompleted).toBe(true);
    expect(result.repData?.repNumber).toBe(1);
    expect(tracker.getRepCount()).toBe(1);
  });

  it('should not count rep without valid keypoints', () => {
    const invalidPose = createPose({
      [KEYPOINTS.LEFT_HIP]: createKeypoint(100, 50, 0.1), // Low confidence
      [KEYPOINTS.LEFT_KNEE]: createKeypoint(100, 100, 0.1),
      [KEYPOINTS.LEFT_ANKLE]: createKeypoint(100, 150, 0.1),
    });
    
    const result = tracker.processFrame(invalidPose);
    expect(result.repCompleted).toBe(false);
    expect(tracker.getRepCount()).toBe(0);
  });
});
