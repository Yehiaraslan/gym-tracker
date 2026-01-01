/**
 * Real-Time Pose Detection Service
 * 
 * This module handles pose detection from camera frames.
 * 
 * IMPORTANT: Real pose detection requires:
 * 1. A custom Expo development build (not Expo Go)
 * 2. TensorFlow.js with react-native bindings
 * 3. expo-gl for GPU acceleration
 * 4. Actual camera frame capture using GLView
 * 
 * Without these, the detector will return null (no pose detected).
 * This is intentional - we do NOT generate fake poses.
 */

import { Pose, Keypoint, KEYPOINTS } from './pose-detection';
import { Platform } from 'react-native';

// Detection configuration
const CONFIG = {
  // Frame processing
  PROCESS_INTERVAL: 100,  // Process every 100ms (~10 FPS)
  
  // Detection thresholds - STRICT to avoid false positives
  MIN_KEYPOINT_CONFIDENCE: 0.3,  // Minimum confidence for a single keypoint
  MIN_POSE_CONFIDENCE: 0.4,      // Minimum overall pose confidence
  MIN_KEYPOINTS_DETECTED: 8,     // Minimum keypoints needed to consider pose valid
  
  // Smoothing
  SMOOTHING_FACTOR: 0.6,  // Higher = more smoothing
  
  // Required keypoints for a valid pose (at least these must be detected)
  REQUIRED_KEYPOINTS: [
    KEYPOINTS.LEFT_SHOULDER,
    KEYPOINTS.RIGHT_SHOULDER,
    KEYPOINTS.LEFT_HIP,
    KEYPOINTS.RIGHT_HIP,
  ],
};

// Detection mode
export type DetectionMode = 'real' | 'demo';

// Pose estimation state
interface PoseState {
  lastPose: Pose | null;
  frameCount: number;
  lastProcessTime: number;
  isProcessing: boolean;
  consecutiveEmptyFrames: number;
  mode: DetectionMode;
  demoActive: boolean;
}

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

  /**
   * Set detection mode
   * - 'real': Only detect from actual camera frames (returns null without real data)
   * - 'demo': Allow demo mode for testing UI without real camera
   */
  setMode(mode: DetectionMode): void {
    this.poseState.mode = mode;
    if (mode === 'real') {
      this.poseState.demoActive = false;
    }
  }

  /**
   * Get current detection mode
   */
  getMode(): DetectionMode {
    return this.poseState.mode;
  }

  /**
   * Start demo detection (only works in demo mode)
   * This simulates a person stepping into frame
   */
  startDemoDetection(): void {
    if (this.poseState.mode === 'demo') {
      this.poseState.demoActive = true;
      this.poseState.consecutiveEmptyFrames = 0;
    }
  }

  /**
   * Stop demo detection
   */
  stopDemoDetection(): void {
    this.poseState.demoActive = false;
    this.poseState.lastPose = null;
    this.smoothedKeypoints.clear();
  }

  /**
   * Check if demo is currently active
   */
  isDemoActive(): boolean {
    return this.poseState.demoActive;
  }

  /**
   * Process a camera frame and return detected pose
   * Returns null if:
   * - No real camera data is provided (in real mode)
   * - Demo mode is not active (in demo mode)
   * - Confidence is too low
   */
  async processFrame(
    frameData: { 
      width: number; 
      height: number; 
      timestamp: number;
      imageData?: ImageData | null;
      tensor?: any;
    },
    previousPose?: Pose | null
  ): Promise<Pose | null> {
    const now = Date.now();
    
    // Throttle processing
    if (now - this.poseState.lastProcessTime < CONFIG.PROCESS_INTERVAL) {
      return this.poseState.lastPose;
    }

    if (this.poseState.isProcessing) {
      return this.poseState.lastPose;
    }

    this.poseState.isProcessing = true;
    this.poseState.lastProcessTime = now;
    this.poseState.frameCount++;

    try {
      let pose: Pose | null = null;

      // Check if we have real camera data
      const hasRealData = frameData.imageData || frameData.tensor;

      if (hasRealData) {
        // Real camera data available - attempt actual detection
        // Note: This requires TensorFlow.js to be properly set up
        pose = await this.detectFromRealData(frameData);
      } else if (this.poseState.mode === 'demo' && this.poseState.demoActive) {
        // Demo mode - generate simulated pose for UI testing
        pose = this.generateDemoPose(frameData, previousPose);
      } else {
        // No real data and not in demo mode - return null
        pose = null;
      }

      // Validate the pose
      if (pose && !this.isValidPose(pose)) {
        pose = null;
      }

      // Track consecutive empty frames
      if (!pose) {
        this.poseState.consecutiveEmptyFrames++;
        
        // After several empty frames, clear smoothing to reset state
        if (this.poseState.consecutiveEmptyFrames > 10) {
          this.smoothedKeypoints.clear();
        }
      } else {
        this.poseState.consecutiveEmptyFrames = 0;
        
        // Apply smoothing only to valid poses
        pose = this.smoothPose(pose);
      }

      this.poseState.lastPose = pose;
      return pose;
    } catch (error) {
      console.warn('[PoseDetector] Frame processing error:', error);
      return null;
    } finally {
      this.poseState.isProcessing = false;
    }
  }

  /**
   * Detect pose from real camera data
   * This is a placeholder - actual implementation requires TensorFlow.js setup
   */
  private async detectFromRealData(frameData: {
    width: number;
    height: number;
    imageData?: ImageData | null;
    tensor?: any;
  }): Promise<Pose | null> {
    // TODO: Implement actual TensorFlow.js MoveNet detection
    // This requires:
    // 1. Custom Expo dev build with @tensorflow/tfjs-react-native
    // 2. expo-gl for GPU acceleration
    // 3. Proper tensor creation from camera frames
    
    // For now, return null since we don't have real ML inference
    console.log('[PoseDetector] Real detection not yet implemented - need custom dev build');
    return null;
  }

  /**
   * Generate a demo pose for UI testing
   * This is clearly marked as demo/simulated
   */
  private generateDemoPose(
    frame: { width: number; height: number },
    previousPose?: Pose | null
  ): Pose {
    const { width, height } = frame;
    
    // Estimate body center and size based on frame
    const centerX = width / 2;
    const centerY = height / 2;
    const bodyHeight = height * 0.7;
    
    // Calculate joint positions based on anatomical proportions
    const keypoints: Keypoint[] = [];
    
    // Add some natural variation
    const variation = Math.sin(Date.now() / 1000) * 5;
    
    // Head
    const headY = centerY - bodyHeight * 0.35;
    keypoints[KEYPOINTS.NOSE] = this.createKeypoint(centerX + variation, headY, 0.9, 'nose');
    keypoints[KEYPOINTS.LEFT_EYE] = this.createKeypoint(centerX - 15 + variation, headY - 10, 0.85, 'left_eye');
    keypoints[KEYPOINTS.RIGHT_EYE] = this.createKeypoint(centerX + 15 + variation, headY - 10, 0.85, 'right_eye');
    keypoints[KEYPOINTS.LEFT_EAR] = this.createKeypoint(centerX - 25 + variation, headY, 0.8, 'left_ear');
    keypoints[KEYPOINTS.RIGHT_EAR] = this.createKeypoint(centerX + 25 + variation, headY, 0.8, 'right_ear');
    
    // Shoulders
    const shoulderY = headY + bodyHeight * 0.12;
    const shoulderWidth = bodyHeight * 0.22;
    keypoints[KEYPOINTS.LEFT_SHOULDER] = this.createKeypoint(centerX - shoulderWidth + variation, shoulderY, 0.9, 'left_shoulder');
    keypoints[KEYPOINTS.RIGHT_SHOULDER] = this.createKeypoint(centerX + shoulderWidth + variation, shoulderY, 0.9, 'right_shoulder');
    
    // Elbows
    const elbowY = shoulderY + bodyHeight * 0.13;
    keypoints[KEYPOINTS.LEFT_ELBOW] = this.createKeypoint(centerX - shoulderWidth * 1.1 + variation, elbowY, 0.85, 'left_elbow');
    keypoints[KEYPOINTS.RIGHT_ELBOW] = this.createKeypoint(centerX + shoulderWidth * 1.1 + variation, elbowY, 0.85, 'right_elbow');
    
    // Wrists
    const wristY = elbowY + bodyHeight * 0.13;
    keypoints[KEYPOINTS.LEFT_WRIST] = this.createKeypoint(centerX - shoulderWidth * 1.2 + variation, wristY, 0.8, 'left_wrist');
    keypoints[KEYPOINTS.RIGHT_WRIST] = this.createKeypoint(centerX + shoulderWidth * 1.2 + variation, wristY, 0.8, 'right_wrist');
    
    // Hips
    const hipY = shoulderY + bodyHeight * 0.22;
    const hipWidth = bodyHeight * 0.12;
    keypoints[KEYPOINTS.LEFT_HIP] = this.createKeypoint(centerX - hipWidth + variation, hipY, 0.9, 'left_hip');
    keypoints[KEYPOINTS.RIGHT_HIP] = this.createKeypoint(centerX + hipWidth + variation, hipY, 0.9, 'right_hip');
    
    // Knees
    const kneeY = hipY + bodyHeight * 0.2;
    keypoints[KEYPOINTS.LEFT_KNEE] = this.createKeypoint(centerX - hipWidth + variation, kneeY, 0.85, 'left_knee');
    keypoints[KEYPOINTS.RIGHT_KNEE] = this.createKeypoint(centerX + hipWidth + variation, kneeY, 0.85, 'right_knee');
    
    // Ankles
    const ankleY = kneeY + bodyHeight * 0.2;
    keypoints[KEYPOINTS.LEFT_ANKLE] = this.createKeypoint(centerX - hipWidth + variation, ankleY, 0.8, 'left_ankle');
    keypoints[KEYPOINTS.RIGHT_ANKLE] = this.createKeypoint(centerX + hipWidth + variation, ankleY, 0.8, 'right_ankle');

    return {
      keypoints,
      score: 0.85,
    };
  }

  /**
   * Create a keypoint with position and confidence
   */
  private createKeypoint(x: number, y: number, score: number, name: string): Keypoint {
    return { x, y, score, name };
  }

  /**
   * Validate that a pose has enough high-confidence keypoints
   */
  private isValidPose(pose: Pose): boolean {
    // Check overall pose score
    if ((pose.score ?? 0) < CONFIG.MIN_POSE_CONFIDENCE) {
      return false;
    }

    // Count keypoints with sufficient confidence
    let validCount = 0;
    for (const kp of pose.keypoints) {
      if (kp && kp.score >= CONFIG.MIN_KEYPOINT_CONFIDENCE) {
        validCount++;
      }
    }

    // Need minimum number of keypoints
    if (validCount < CONFIG.MIN_KEYPOINTS_DETECTED) {
      return false;
    }

    // Check that required keypoints are present
    for (const requiredIdx of CONFIG.REQUIRED_KEYPOINTS) {
      const kp = pose.keypoints[requiredIdx];
      if (!kp || kp.score < CONFIG.MIN_KEYPOINT_CONFIDENCE) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply temporal smoothing to reduce jitter
   */
  private smoothPose(pose: Pose): Pose {
    const smoothedKeypoints: Keypoint[] = pose.keypoints.map((kp, index) => {
      if (!kp || kp.score < CONFIG.MIN_KEYPOINT_CONFIDENCE) {
        this.smoothedKeypoints.delete(index);
        return kp;
      }

      const prev = this.smoothedKeypoints.get(index);
      
      if (prev && prev.score >= CONFIG.MIN_KEYPOINT_CONFIDENCE) {
        const smoothedX = prev.x * CONFIG.SMOOTHING_FACTOR + kp.x * (1 - CONFIG.SMOOTHING_FACTOR);
        const smoothedY = prev.y * CONFIG.SMOOTHING_FACTOR + kp.y * (1 - CONFIG.SMOOTHING_FACTOR);
        const smoothedScore = prev.score * CONFIG.SMOOTHING_FACTOR + kp.score * (1 - CONFIG.SMOOTHING_FACTOR);
        
        this.smoothedKeypoints.set(index, { x: smoothedX, y: smoothedY, score: smoothedScore });
        
        return {
          ...kp,
          x: smoothedX,
          y: smoothedY,
          score: smoothedScore,
        };
      } else {
        this.smoothedKeypoints.set(index, { x: kp.x, y: kp.y, score: kp.score });
        return kp;
      }
    });

    return {
      keypoints: smoothedKeypoints,
      score: pose.score,
    };
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.poseState = {
      lastPose: null,
      frameCount: 0,
      lastProcessTime: 0,
      isProcessing: false,
      consecutiveEmptyFrames: 0,
      mode: this.poseState.mode, // Preserve mode
      demoActive: false,
    };
    this.smoothedKeypoints.clear();
  }

  /**
   * Get frame count
   */
  getFrameCount(): number {
    return this.poseState.frameCount;
  }

  /**
   * Get consecutive empty frames count
   */
  getEmptyFrameCount(): number {
    return this.poseState.consecutiveEmptyFrames;
  }
}

// Singleton instance
let detectorInstance: RealPoseDetector | null = null;

export function getRealPoseDetector(): RealPoseDetector {
  if (!detectorInstance) {
    detectorInstance = new RealPoseDetector();
  }
  return detectorInstance;
}

export function resetRealPoseDetector(): void {
  if (detectorInstance) {
    detectorInstance.reset();
  }
}

/**
 * Set detection mode
 */
export function setDetectionMode(mode: DetectionMode): void {
  const detector = getRealPoseDetector();
  detector.setMode(mode);
}

/**
 * Get current detection mode
 */
export function getDetectionMode(): DetectionMode {
  const detector = getRealPoseDetector();
  return detector.getMode();
}

/**
 * Start demo detection (only in demo mode)
 */
export function startDemoDetection(): void {
  const detector = getRealPoseDetector();
  detector.startDemoDetection();
}

/**
 * Stop demo detection
 */
export function stopDemoDetection(): void {
  const detector = getRealPoseDetector();
  detector.stopDemoDetection();
}

/**
 * Check if demo is active
 */
export function isDemoActive(): boolean {
  const detector = getRealPoseDetector();
  return detector.isDemoActive();
}

/**
 * Process a camera frame and return pose
 * Returns null if no person is detected
 */
export async function detectPoseFromFrame(
  frameInfo: { 
    width: number; 
    height: number; 
    timestamp?: number;
    imageData?: ImageData | null;
    tensor?: any;
  },
  previousPose?: Pose | null
): Promise<Pose | null> {
  const detector = getRealPoseDetector();
  return detector.processFrame(
    { ...frameInfo, timestamp: frameInfo.timestamp || Date.now() },
    previousPose
  );
}
