/**
 * TensorCamera Component
 * 
 * Wraps expo-camera with TensorFlow.js to capture frames as tensors
 * for real-time pose detection using MoveNet.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Platform, Text, Image } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import * as posedetection from '@tensorflow-models/pose-detection';

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

interface TensorCameraProps {
  facing: CameraType;
  style?: any;
  onPoseDetected: (pose: DetectedPose | null) => void;
  onReady?: () => void;
  onError?: (error: string) => void;
  isActive: boolean;
  throttleMs?: number;
  width: number;
  height: number;
}

// Configuration
const MIN_KEYPOINT_SCORE = 0.3;

export function TensorCameraView({
  facing,
  style,
  onPoseDetected,
  onReady,
  onError,
  isActive,
  throttleMs = 150,
  width,
  height,
}: TensorCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [tfReady, setTfReady] = useState(false);
  const [model, setModel] = useState<posedetection.PoseDetector | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  const cameraRef = useRef<any>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastInferenceTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const modelRef = useRef<posedetection.PoseDetector | null>(null);

  // Request permission on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Initialize TensorFlow.js and load model
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        setIsInitializing(true);
        setInitError(null);

        // Initialize TensorFlow.js
        await tf.ready();
        if (!isMounted) return;
        
        console.log('[TensorCamera] TF.js ready, backend:', tf.getBackend());
        setTfReady(true);

        // Load MoveNet model
        const detector = await posedetection.createDetector(
          posedetection.SupportedModels.MoveNet,
          {
            modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true,
          }
        );

        if (!isMounted) {
          detector.dispose();
          return;
        }

        console.log('[TensorCamera] MoveNet model loaded');
        setModel(detector);
        modelRef.current = detector;
        setIsInitializing(false);
        onReady?.();

      } catch (error) {
        console.error('[TensorCamera] Initialization error:', error);
        if (isMounted) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to initialize';
          setInitError(errorMsg);
          setIsInitializing(false);
          onError?.(errorMsg);
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (modelRef.current) {
        modelRef.current.dispose();
        modelRef.current = null;
      }
    };
  }, []);

  // Process camera frames for pose detection
  const processFrame = useCallback(async () => {
    if (!isActive || !modelRef.current || !cameraRef.current || isProcessingRef.current || !cameraReady) {
      if (isActive) {
        rafIdRef.current = requestAnimationFrame(processFrame);
      }
      return;
    }

    const now = Date.now();
    if (now - lastInferenceTimeRef.current < throttleMs) {
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    isProcessingRef.current = true;
    lastInferenceTimeRef.current = now;

    try {
      // Take a picture from camera
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.3,
        skipProcessing: true,
        exif: false,
      });

      if (photo && photo.base64 && modelRef.current) {
        // Decode image to tensor
        const { decodeJpeg } = await import('@tensorflow/tfjs-react-native');
        const imageData = tf.util.encodeString(photo.base64, 'base64');
        const imageTensor = decodeJpeg(new Uint8Array(imageData.buffer));
        
        // Run pose detection
        const poses = await modelRef.current.estimatePoses(imageTensor as tf.Tensor3D);
        
        tf.dispose(imageTensor);

        if (poses.length > 0) {
          const pose = poses[0];
          const photoWidth = photo.width || width;
          const photoHeight = photo.height || height;
          
          // Transform keypoints to screen coordinates
          const detectedPose: DetectedPose = {
            keypoints: pose.keypoints.map((kp, idx) => {
              // Flip X for front camera
              let x = kp.x;
              if (facing === 'front') {
                x = photoWidth - x;
              }
              
              return {
                x: (x / photoWidth) * width,
                y: (kp.y / photoHeight) * height,
                score: kp.score || 0,
                name: kp.name || `keypoint_${idx}`,
              };
            }),
            score: pose.score || calculatePoseScore(pose.keypoints),
          };
          onPoseDetected(detectedPose);
        } else {
          onPoseDetected(null);
        }
      }
    } catch (error) {
      // Silently handle frame processing errors to avoid spam
      // console.error('[TensorCamera] Frame processing error:', error);
    } finally {
      isProcessingRef.current = false;
    }

    if (isActive) {
      rafIdRef.current = requestAnimationFrame(processFrame);
    }
  }, [isActive, throttleMs, onPoseDetected, cameraReady, width, height, facing]);

  // Start/stop frame processing
  useEffect(() => {
    if (isActive && model && !isInitializing && cameraReady) {
      console.log('[TensorCamera] Starting frame processing');
      rafIdRef.current = requestAnimationFrame(processFrame);
    } else if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isActive, model, isInitializing, cameraReady, processFrame]);

  // Calculate pose score from keypoints
  function calculatePoseScore(keypoints: posedetection.Keypoint[]): number {
    const validKeypoints = keypoints.filter(kp => (kp.score || 0) >= MIN_KEYPOINT_SCORE);
    if (validKeypoints.length === 0) return 0;
    const avgScore = validKeypoints.reduce((sum, kp) => sum + (kp.score || 0), 0) / validKeypoints.length;
    return avgScore * (validKeypoints.length / keypoints.length);
  }

  const handleCameraReady = () => {
    console.log('[TensorCamera] Camera ready');
    setCameraReady(true);
  };

  // Render loading state
  if (isInitializing) {
    return (
      <View style={[style, styles.container, styles.centered]}>
        <Text style={styles.statusText}>Initializing AI Model...</Text>
        <Text style={styles.subText}>Loading MoveNet pose detection</Text>
      </View>
    );
  }

  // Render permission request
  if (!permission?.granted) {
    return (
      <View style={[style, styles.container, styles.centered]}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <Text style={styles.subText}>Please grant camera access to use AI Form Coach</Text>
      </View>
    );
  }

  // Render error state
  if (initError) {
    return (
      <View style={[style, styles.container, styles.centered]}>
        <Text style={styles.errorText}>{initError}</Text>
      </View>
    );
  }

  // Render camera
  return (
    <View style={[style, styles.container]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={handleCameraReady}
      />
      {!tfReady && (
        <View style={[StyleSheet.absoluteFill, styles.centered, styles.overlay]}>
          <Text style={styles.statusText}>Loading TensorFlow...</Text>
        </View>
      )}
      {tfReady && !cameraReady && (
        <View style={[StyleSheet.absoluteFill, styles.centered, styles.overlay]}>
          <Text style={styles.statusText}>Starting camera...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '600',
  },
});

export default TensorCameraView;
