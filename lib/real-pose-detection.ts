/**
 * Real-Time Pose Detection Service — MediaPipe Edition
 *
 * Uses react-native-vision-camera + MediaPipe Pose Landmarker for on-device,
 * native-thread pose estimation at 15-30 FPS.
 *
 * The module exposes the SAME public API as the previous TF.js placeholder so
 * nothing outside this file needs to change.
 */

import { Pose, Keypoint, KEYPOINTS } from './pose-detection';

// ── Configuration ───────────────────────────────────────────
const CONFIG = {
  PROCESS_INTERVAL: 50,             // ~20 FPS target
  MIN_KEYPOINT_CONFIDENCE: 0.3,
  MIN_POSE_CONFIDENCE: 0.4,
  MIN_KEYPOINTS_DETECTED: 8,
  SMOOTHING_FACTOR: 0.6,
  REQUIRED_KEYPOINTS: [
    KEYPOINTS.LEFT_SHOULDER,
    KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_HIP,
    KEYPOINTS.RIGHT_HIP,
  ],
};

// ── MediaPipe → MoveNet keypoint index mapping ─────────────
// MediaPipe Pose returns 33 landmarks; we map the first 17 to MoveNet order.
const MEDIAPIPE_TO_MOVENET: Record<number, number> = {
  0: KEYPOINTS.NOSE,
  2: KEYPOINTS.LEFT_EYE,
  5: KEYPOINTS.RIGHT_EYE,
  7: KEYPOINTS.LEFT_EAR,
  8: KEYPOINTS.RIGHT_EAR,
  11: KEYPOINTS.LEFT_SHOULDER,
  12: KEYPOINTS.RIGHT_SHOULDER,
  13: KEYPOINTS.LEFT_ELBOW,
  14: KEYPOINTS.RIGHT_ELBOW,
  15: KEYPOINTS.LEFT_WRIST,
  16: KEYPOINTS.RIGHT_WRIST,
  23: KEYPOINTS.LEFT_HIP,
  24: KEYPOINTS.RIGHT_HIP,
  25: KEYPOINTS.LEFT_KNEE,
  26: KEYPOINTS.RIGHT_KNEE,
  27: KEYPOINTS.LEFT_ANKLE,
  28: KEYPOINTS.RIGHT_ANKLE,
};

const MOVENET_NAMES: Record<number, string> = {
  [KEYPOINTS.NOSE]: 'nose',
  [KEYPOINTS.LEFT_EYE]: 'left_eye',
  [KEYPOINTS.RIGHT_EYE]: 'right_eye',
  [KEYPOINTS.LEFT_EAR]: 'left_ear',
  [KEYPOINTS.RIGHT_EAR]: 'right_ear',
  [KEYPOINTS.LEFT_SHOULDER]: 'left_shoulder',
  [KEYPOINTS.RIGHT_SHOULDER]: 'right_shoulder',
  [KEYPOINTS.LEFT_ELBOW]: 'left_elbow',
  [KEYPOINTS.RIGHT_ELBOW]: 'right_elbow',
  [KEYPOINTS.LEFT_WRIST]: 'left_wrist',
  [KEYPOINTS.RIGHT_WRIST]: 'right_wrist',
  [KEYPOINTS.LEFT_HIP]: 'left_hip',
  [KEYPOINTS.RIGHT_HIP]: 'right_hip',
  [KEYPOINTS.LEFT_KNEE]: 'left_knee',
  [KEYPOINTS.RIGHT_KNEE]: 'right_knee',
  [KEYPOINTS.LEFT_ANKLE]: 'left_ankle',
  [KEYPOINTS.RIGHT_ANKLE]: 'right_ankle',
};

// ── Types ───────────────────────────────────────────────────
export type DetectionMode = 'real' | 'demo';

/** Normalised landmark coming from MediaPipe (0-1 range) */
export interface MediaPipeLandmark {
  x: number;       // 0-1 normalised
  y: number;       // 0-1 normalised
  z: number;       // depth (negative = closer to camera)
  visibility: number; // 0-1 confidence
}

interface PoseState {
  lastPose: Pose | null;
  frameCount: number;
  lastProcessTime: number;
  isProcessing: boolean;
  consecutiveEmptyFrames: number;
  mode: DetectionMode;
  demoActive: boolean;
}

// ── Core detector ───────────────────────────────────────────
class RealPoseDetector {
  private poseState: PoseState = {
    lastPose: null,
    frameCount: 0,
    lastProcessTime: 0,
    isProcessing: false,
    consecutiveEmptyFrames: 0,
    mode: 'real',
    demoActive: false,
  };

  private smoothedKeypoints: Map<number, { x: number; y: number; score: number }> = new Map();

  // ── Mode management (unchanged API) ─────────────────────
  setMode(mode: DetectionMode): void {
    this.poseState.mode = mode;
    if (mode === 'real') this.poseState.demoActive = false;
  }
  getMode(): DetectionMode { return this.poseState.mode; }
  startDemoDetection(): void {
    if (this.poseState.mode === 'demo') {
      this.poseState.demoActive = true;
      this.poseState.consecutiveEmptyFrames = 0;
    }
  }
  stopDemoDetection(): void {
    this.poseState.demoActive = false;
    this.poseState.lastPose = null;
    this.smoothedKeypoints.clear();
  }
  isDemoActive(): boolean { return this.poseState.demoActive; }

  // ── NEW: receive MediaPipe landmarks directly ───────────
  /**
   * Called from the VisionCamera frame processor worklet callback.
   * `landmarks` is the array of 33 normalised landmarks from MediaPipe.
   * `frameWidth` / `frameHeight` are the camera frame pixel dimensions.
   */
  onMediaPipePose(landmarks: MediaPipeLandmark[], frameWidth: number, frameHeight: number): void {
    const pose = this.convertMediaPipeToPose(landmarks, frameWidth, frameHeight);
    if (pose && this.isValidPose(pose)) {
      const smoothed = this.smoothPose(pose);
      this.poseState.lastPose = smoothed;
      this.poseState.consecutiveEmptyFrames = 0;
    } else {
      this.poseState.consecutiveEmptyFrames++;
      if (this.poseState.consecutiveEmptyFrames > 10) {
        this.smoothedKeypoints.clear();
      }
    }
    this.poseState.frameCount++;
    this.poseState.lastProcessTime = Date.now();
  }

  // ── Legacy processFrame (kept for compatibility) ────────
  async processFrame(
    frameData: {
      width: number;
      height: number;
      timestamp: number;
      imageData?: ImageData | null;
      tensor?: any;
    },
    previousPose?: Pose | null,
  ): Promise<Pose | null> {
    const now = Date.now();
    if (now - this.poseState.lastProcessTime < CONFIG.PROCESS_INTERVAL) {
      return this.poseState.lastPose;
    }
    if (this.poseState.isProcessing) return this.poseState.lastPose;
    this.poseState.isProcessing = true;
    this.poseState.lastProcessTime = now;
    this.poseState.frameCount++;

    try {
      let pose: Pose | null = null;

      // If we already have a pose from onMediaPipePose, use it
      if (this.poseState.lastPose && this.poseState.consecutiveEmptyFrames === 0) {
        return this.poseState.lastPose;
      }

      // Demo fallback
      if (this.poseState.mode === 'demo' && this.poseState.demoActive) {
        pose = this.generateDemoPose(frameData, previousPose);
      }

      if (pose && !this.isValidPose(pose)) pose = null;
      if (!pose) {
        this.poseState.consecutiveEmptyFrames++;
        if (this.poseState.consecutiveEmptyFrames > 10) this.smoothedKeypoints.clear();
      } else {
        this.poseState.consecutiveEmptyFrames = 0;
        pose = this.smoothPose(pose);
      }

      this.poseState.lastPose = pose;
      return pose;
    } finally {
      this.poseState.isProcessing = false;
    }
  }

  // ── MediaPipe → internal Pose conversion ────────────────
  private convertMediaPipeToPose(
    landmarks: MediaPipeLandmark[],
    frameWidth: number,
    frameHeight: number,
  ): Pose | null {
    if (!landmarks || landmarks.length < 33) return null;

    const keypoints: Keypoint[] = new Array(17);
    let totalVisibility = 0;
    let mapped = 0;

    for (const [mpIdx, mnIdx] of Object.entries(MEDIAPIPE_TO_MOVENET)) {
      const lm = landmarks[Number(mpIdx)];
      if (!lm) continue;
      keypoints[mnIdx] = {
        x: lm.x * frameWidth,
        y: lm.y * frameHeight,
        score: lm.visibility,
        name: MOVENET_NAMES[mnIdx],
      };
      totalVisibility += lm.visibility;
      mapped++;
    }

    // Fill any unmapped slots with zero-confidence placeholders
    for (let i = 0; i < 17; i++) {
      if (!keypoints[i]) {
        keypoints[i] = { x: 0, y: 0, score: 0, name: MOVENET_NAMES[i] ?? `joint_${i}` };
      }
    }

    return {
      keypoints,
      score: mapped > 0 ? totalVisibility / mapped : 0,
    };
  }

  // ── Validation (unchanged) ──────────────────────────────
  private isValidPose(pose: Pose): boolean {
    if ((pose.score ?? 0) < CONFIG.MIN_POSE_CONFIDENCE) return false;
    let validCount = 0;
    for (const kp of pose.keypoints) {
      if (kp && kp.score >= CONFIG.MIN_KEYPOINT_CONFIDENCE) validCount++;
    }
    if (validCount < CONFIG.MIN_KEYPOINTS_DETECTED) return false;
    for (const idx of CONFIG.REQUIRED_KEYPOINTS) {
      const kp = pose.keypoints[idx];
      if (!kp || kp.score < CONFIG.MIN_KEYPOINT_CONFIDENCE) return false;
    }
    return true;
  }

  // ── Smoothing (unchanged) ───────────────────────────────
  private smoothPose(pose: Pose): Pose {
    const smoothedKps: Keypoint[] = pose.keypoints.map((kp, i) => {
      if (!kp || kp.score < CONFIG.MIN_KEYPOINT_CONFIDENCE) {
        this.smoothedKeypoints.delete(i);
        return kp;
      }
      const prev = this.smoothedKeypoints.get(i);
      if (prev && prev.score >= CONFIG.MIN_KEYPOINT_CONFIDENCE) {
        const sx = prev.x * CONFIG.SMOOTHING_FACTOR + kp.x * (1 - CONFIG.SMOOTHING_FACTOR);
        const sy = prev.y * CONFIG.SMOOTHING_FACTOR + kp.y * (1 - CONFIG.SMOOTHING_FACTOR);
        const ss = prev.score * CONFIG.SMOOTHING_FACTOR + kp.score * (1 - CONFIG.SMOOTHING_FACTOR);
        this.smoothedKeypoints.set(i, { x: sx, y: sy, score: ss });
        return { ...kp, x: sx, y: sy, score: ss };
      }
      this.smoothedKeypoints.set(i, { x: kp.x, y: kp.y, score: kp.score });
      return kp;
    });
    return { keypoints: smoothedKps, score: pose.score };
  }

  // ── Demo pose generator (unchanged) ─────────────────────
  private generateDemoPose(
    frame: { width: number; height: number },
    _prev?: Pose | null,
  ): Pose {
    const { width, height } = frame;
    const cx = width / 2;
    const cy = height / 2;
    const bh = height * 0.7;
    const v = Math.sin(Date.now() / 1000) * 5;
    const mk = (x: number, y: number, s: number, n: string): Keypoint => ({ x, y, score: s, name: n });

    const headY = cy - bh * 0.35;
    const shY = headY + bh * 0.12;
    const sw = bh * 0.22;
    const elY = shY + bh * 0.13;
    const wrY = elY + bh * 0.13;
    const hipY = shY + bh * 0.22;
    const hw = bh * 0.12;
    const knY = hipY + bh * 0.2;
    const anY = knY + bh * 0.2;

    const kps: Keypoint[] = [];
    kps[KEYPOINTS.NOSE] = mk(cx + v, headY, 0.9, 'nose');
    kps[KEYPOINTS.LEFT_EYE] = mk(cx - 15 + v, headY - 10, 0.85, 'left_eye');
    kps[KEYPOINTS.RIGHT_EYE] = mk(cx + 15 + v, headY - 10, 0.85, 'right_eye');
    kps[KEYPOINTS.LEFT_EAR] = mk(cx - 25 + v, headY, 0.8, 'left_ear');
    kps[KEYPOINTS.RIGHT_EAR] = mk(cx + 25 + v, headY, 0.8, 'right_ear');
    kps[KEYPOINTS.LEFT_SHOULDER] = mk(cx - sw + v, shY, 0.9, 'left_shoulder');
    kps[KEYPOINTS.RIGHT_SHOULDER] = mk(cx + sw + v, shY, 0.9, 'right_shoulder');
    kps[KEYPOINTS.LEFT_ELBOW] = mk(cx - sw * 1.1 + v, elY, 0.85, 'left_elbow');
    kps[KEYPOINTS.RIGHT_ELBOW] = mk(cx + sw * 1.1 + v, elY, 0.85, 'right_elbow');
    kps[KEYPOINTS.LEFT_WRIST] = mk(cx - sw * 1.2 + v, wrY, 0.8, 'left_wrist');
    kps[KEYPOINTS.RIGHT_WRIST] = mk(cx + sw * 1.2 + v, wrY, 0.8, 'right_wrist');
    kps[KEYPOINTS.LEFT_HIP] = mk(cx - hw + v, hipY, 0.9, 'left_hip');
    kps[KEYPOINTS.RIGHT_HIP] = mk(cx + hw + v, hipY, 0.9, 'right_hip');
    kps[KEYPOINTS.LEFT_KNEE] = mk(cx - hw + v, knY, 0.85, 'left_knee');
    kps[KEYPOINTS.RIGHT_KNEE] = mk(cx + hw + v, knY, 0.85, 'right_knee');
    kps[KEYPOINTS.LEFT_ANKLE] = mk(cx - hw + v, anY, 0.8, 'left_ankle');
    kps[KEYPOINTS.RIGHT_ANKLE] = mk(cx + hw + v, anY, 0.8, 'right_ankle');
    return { keypoints: kps, score: 0.85 };
  }

  // ── Lifecycle ───────────────────────────────────────────
  reset(): void {
    this.poseState = {
      lastPose: null,
      frameCount: 0,
      lastProcessTime: 0,
      isProcessing: false,
      consecutiveEmptyFrames: 0,
      mode: this.poseState.mode,
      demoActive: false,
    };
    this.smoothedKeypoints.clear();
  }

  getFrameCount(): number { return this.poseState.frameCount; }
  getEmptyFrameCount(): number { return this.poseState.consecutiveEmptyFrames; }
}

// ── Singleton + public API (unchanged signatures) ──────────
let detectorInstance: RealPoseDetector | null = null;

export function getRealPoseDetector(): RealPoseDetector {
  if (!detectorInstance) detectorInstance = new RealPoseDetector();
  return detectorInstance;
}

export function resetRealPoseDetector(): void {
  if (detectorInstance) detectorInstance.reset();
}

export function setDetectionMode(mode: DetectionMode): void {
  getRealPoseDetector().setMode(mode);
}

export function getDetectionMode(): DetectionMode {
  return getRealPoseDetector().getMode();
}

export function startDemoDetection(): void {
  getRealPoseDetector().startDemoDetection();
}

export function stopDemoDetection(): void {
  getRealPoseDetector().stopDemoDetection();
}

export function isDemoActive(): boolean {
  return getRealPoseDetector().isDemoActive();
}

export async function detectPoseFromFrame(
  frameInfo: {
    width: number;
    height: number;
    timestamp?: number;
    imageData?: ImageData | null;
    tensor?: any;
  },
  previousPose?: Pose | null,
): Promise<Pose | null> {
  return getRealPoseDetector().processFrame(
    { ...frameInfo, timestamp: frameInfo.timestamp || Date.now() },
    previousPose,
  );
}
