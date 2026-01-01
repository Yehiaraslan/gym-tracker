/**
 * TensorFlow.js Real Pose Detection Service
 * 
 * Uses MoveNet model for real-time pose estimation from camera frames.
 * Inspired by Microsoft Kinect's approach but adapted for mobile devices.
 */

import * as tf from '@tensorflow/tfjs';
import * as posedetection from '@tensorflow-models/pose-detection';
import { Platform } from 'react-native';

// Keypoint indices matching MoveNet output
export const KEYPOINT_INDICES = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
} as const;

// Skeleton connections for drawing
export const SKELETON_CONNECTIONS: [number, number][] = [
  // Face
  [KEYPOINT_INDICES.LEFT_EAR, KEYPOINT_INDICES.LEFT_EYE],
  [KEYPOINT_INDICES.LEFT_EYE, KEYPOINT_INDICES.NOSE],
  [KEYPOINT_INDICES.NOSE, KEYPOINT_INDICES.RIGHT_EYE],
  [KEYPOINT_INDICES.RIGHT_EYE, KEYPOINT_INDICES.RIGHT_EAR],
  // Torso
  [KEYPOINT_INDICES.LEFT_SHOULDER, KEYPOINT_INDICES.RIGHT_SHOULDER],
  [KEYPOINT_INDICES.LEFT_SHOULDER, KEYPOINT_INDICES.LEFT_HIP],
  [KEYPOINT_INDICES.RIGHT_SHOULDER, KEYPOINT_INDICES.RIGHT_HIP],
  [KEYPOINT_INDICES.LEFT_HIP, KEYPOINT_INDICES.RIGHT_HIP],
  // Left arm
  [KEYPOINT_INDICES.LEFT_SHOULDER, KEYPOINT_INDICES.LEFT_ELBOW],
  [KEYPOINT_INDICES.LEFT_ELBOW, KEYPOINT_INDICES.LEFT_WRIST],
  // Right arm
  [KEYPOINT_INDICES.RIGHT_SHOULDER, KEYPOINT_INDICES.RIGHT_ELBOW],
  [KEYPOINT_INDICES.RIGHT_ELBOW, KEYPOINT_INDICES.RIGHT_WRIST],
  // Left leg
  [KEYPOINT_INDICES.LEFT_HIP, KEYPOINT_INDICES.LEFT_KNEE],
  [KEYPOINT_INDICES.LEFT_KNEE, KEYPOINT_INDICES.LEFT_ANKLE],
  // Right leg
  [KEYPOINT_INDICES.RIGHT_HIP, KEYPOINT_INDICES.RIGHT_KNEE],
  [KEYPOINT_INDICES.RIGHT_KNEE, KEYPOINT_INDICES.RIGHT_ANKLE],
];

export interface DetectedKeypoint {
  x: number;
  y: number;
  score: number;
  name: string;
}

export interface DetectedPose {
  keypoints: DetectedKeypoint[];
  score: number;
}

// Configuration
const MIN_KEYPOINT_SCORE = 0.3;
const OUTPUT_TENSOR_WIDTH = 192;
const OUTPUT_TENSOR_HEIGHT = Platform.OS === 'ios' ? 256 : 144;

class TFPoseDetectionService {
  private model: posedetection.PoseDetector | null = null;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private lastInferenceTime: number = 0;
  private inferenceThrottleMs: number = 100; // ~10 FPS for performance

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;

    try {
      // Initialize TensorFlow.js
      await tf.ready();
      console.log('[TFPose] TensorFlow.js ready, backend:', tf.getBackend());

      // Create MoveNet detector
      const modelConfig: posedetection.MoveNetModelConfig = {
        modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
        minPoseScore: 0.25,
      };

      this.model = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        modelConfig
      );

      this.isInitialized = true;
      this.isInitializing = false;
      console.log('[TFPose] MoveNet model loaded successfully');
      return true;
    } catch (error) {
      console.error('[TFPose] Failed to initialize:', error);
      this.isInitializing = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.model !== null;
  }

  /**
   * Detect pose from a TensorFlow tensor (from TensorCamera)
   */
  async detectFromTensor(imageTensor: tf.Tensor3D): Promise<DetectedPose | null> {
    if (!this.model) {
      console.warn('[TFPose] Model not initialized');
      return null;
    }

    // Throttle inference for performance
    const now = Date.now();
    if (now - this.lastInferenceTime < this.inferenceThrottleMs) {
      return null;
    }
    this.lastInferenceTime = now;

    try {
      const poses = await this.model.estimatePoses(imageTensor);
      
      if (poses.length === 0) {
        return null;
      }

      const pose = poses[0];
      const keypoints: DetectedKeypoint[] = pose.keypoints.map((kp, index) => ({
        x: kp.x,
        y: kp.y,
        score: kp.score || 0,
        name: kp.name || `keypoint_${index}`,
      }));

      return {
        keypoints,
        score: pose.score || this.calculatePoseScore(keypoints),
      };
    } catch (error) {
      console.error('[TFPose] Detection error:', error);
      return null;
    }
  }

  /**
   * Detect pose from an image element (for web/testing)
   */
  async detectFromImage(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<DetectedPose | null> {
    if (!this.model) {
      console.warn('[TFPose] Model not initialized');
      return null;
    }

    try {
      const poses = await this.model.estimatePoses(imageElement);
      
      if (poses.length === 0) {
        return null;
      }

      const pose = poses[0];
      const keypoints: DetectedKeypoint[] = pose.keypoints.map((kp, index) => ({
        x: kp.x,
        y: kp.y,
        score: kp.score || 0,
        name: kp.name || `keypoint_${index}`,
      }));

      return {
        keypoints,
        score: pose.score || this.calculatePoseScore(keypoints),
      };
    } catch (error) {
      console.error('[TFPose] Detection error:', error);
      return null;
    }
  }

  /**
   * Calculate overall pose score from keypoint scores
   */
  private calculatePoseScore(keypoints: DetectedKeypoint[]): number {
    const validKeypoints = keypoints.filter(kp => kp.score >= MIN_KEYPOINT_SCORE);
    if (validKeypoints.length === 0) return 0;
    
    const avgScore = validKeypoints.reduce((sum, kp) => sum + kp.score, 0) / validKeypoints.length;
    const coverageScore = validKeypoints.length / keypoints.length;
    
    return avgScore * coverageScore;
  }

  /**
   * Check if enough keypoints are visible for exercise tracking
   */
  hasValidPose(pose: DetectedPose | null, requiredKeypoints?: number[]): boolean {
    if (!pose) return false;

    const keysToCheck = requiredKeypoints || [
      KEYPOINT_INDICES.LEFT_SHOULDER,
      KEYPOINT_INDICES.RIGHT_SHOULDER,
      KEYPOINT_INDICES.LEFT_HIP,
      KEYPOINT_INDICES.RIGHT_HIP,
    ];

    return keysToCheck.every(idx => {
      const kp = pose.keypoints[idx];
      return kp && kp.score >= MIN_KEYPOINT_SCORE;
    });
  }

  /**
   * Get visible keypoints above threshold
   */
  getVisibleKeypoints(pose: DetectedPose): DetectedKeypoint[] {
    return pose.keypoints.filter(kp => kp.score >= MIN_KEYPOINT_SCORE);
  }

  /**
   * Transform keypoints to screen coordinates
   */
  transformToScreen(
    pose: DetectedPose,
    tensorWidth: number,
    tensorHeight: number,
    screenWidth: number,
    screenHeight: number,
    flipX: boolean = false
  ): DetectedPose {
    const transformedKeypoints = pose.keypoints.map(kp => {
      let x = kp.x;
      if (flipX) {
        x = tensorWidth - x;
      }
      
      return {
        ...kp,
        x: (x / tensorWidth) * screenWidth,
        y: (kp.y / tensorHeight) * screenHeight,
      };
    });

    return {
      ...pose,
      keypoints: transformedKeypoints,
    };
  }

  /**
   * Set inference throttle rate
   */
  setThrottleMs(ms: number): void {
    this.inferenceThrottleMs = Math.max(50, ms); // Minimum 50ms (~20 FPS max)
  }

  /**
   * Dispose of the model and free resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isInitialized = false;
  }

  /**
   * Get output tensor dimensions
   */
  getOutputDimensions(): { width: number; height: number } {
    return {
      width: OUTPUT_TENSOR_WIDTH,
      height: OUTPUT_TENSOR_HEIGHT,
    };
  }
}

// Export singleton instance
export const tfPoseDetection = new TFPoseDetectionService();
export default tfPoseDetection;
