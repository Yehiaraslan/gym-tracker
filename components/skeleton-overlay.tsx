import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';
import { Pose, Keypoint, KEYPOINTS, ExerciseType } from '@/lib/pose-detection';

interface SkeletonOverlayProps {
  pose: Pose | null;
  exerciseType: ExerciseType;
  width: number;
  height: number;
  formIssues?: string[]; // List of keypoint names with issues
  showLabels?: boolean;
}

// Skeleton connections (pairs of keypoint indices)
const SKELETON_CONNECTIONS: [number, number][] = [
  // Face
  [KEYPOINTS.LEFT_EAR, KEYPOINTS.LEFT_EYE],
  [KEYPOINTS.LEFT_EYE, KEYPOINTS.NOSE],
  [KEYPOINTS.NOSE, KEYPOINTS.RIGHT_EYE],
  [KEYPOINTS.RIGHT_EYE, KEYPOINTS.RIGHT_EAR],
  // Torso
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_HIP],
  [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_HIP],
  [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
  // Left arm
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_ELBOW],
  [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_WRIST],
  // Right arm
  [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_ELBOW],
  [KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_WRIST],
  // Left leg
  [KEYPOINTS.LEFT_HIP, KEYPOINTS.LEFT_KNEE],
  [KEYPOINTS.LEFT_KNEE, KEYPOINTS.LEFT_ANKLE],
  // Right leg
  [KEYPOINTS.RIGHT_HIP, KEYPOINTS.RIGHT_KNEE],
  [KEYPOINTS.RIGHT_KNEE, KEYPOINTS.RIGHT_ANKLE],
];

// Keypoints to highlight for each exercise
const EXERCISE_FOCUS_KEYPOINTS: Record<ExerciseType, number[]> = {
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
    KEYPOINTS.NOSE,
  ],
  squat: [
    KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP,
    KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE,
    KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE,
    KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER,
  ],
};

// Colors
const COLORS = {
  good: '#22C55E', // Green
  warning: '#F59E0B', // Yellow/Orange
  error: '#EF4444', // Red
  neutral: '#3B82F6', // Blue
  connection: 'rgba(34, 197, 94, 0.8)', // Semi-transparent green
  connectionWarning: 'rgba(239, 68, 68, 0.8)', // Semi-transparent red
};

const MIN_CONFIDENCE = 0.3;

export function SkeletonOverlay({
  pose,
  exerciseType,
  width,
  height,
  formIssues = [],
  showLabels = false,
}: SkeletonOverlayProps) {
  if (!pose || !pose.keypoints || pose.keypoints.length === 0) {
    return null;
  }

  const focusKeypoints = EXERCISE_FOCUS_KEYPOINTS[exerciseType] || [];

  // Check if a keypoint has a form issue
  const hasIssue = (keypointIndex: number): boolean => {
    const keypointName = getKeypointName(keypointIndex);
    return formIssues.some(issue => 
      issue.toLowerCase().includes(keypointName.toLowerCase())
    );
  };

  // Get keypoint color based on confidence and issues
  const getKeypointColor = (keypoint: Keypoint, index: number): string => {
    if (keypoint.score < MIN_CONFIDENCE) return 'rgba(255,255,255,0.3)';
    if (hasIssue(index)) return COLORS.error;
    if (focusKeypoints.includes(index)) {
      return keypoint.score > 0.7 ? COLORS.good : COLORS.warning;
    }
    return COLORS.neutral;
  };

  // Get connection color
  const getConnectionColor = (kp1: Keypoint, kp2: Keypoint, idx1: number, idx2: number): string => {
    if (kp1.score < MIN_CONFIDENCE || kp2.score < MIN_CONFIDENCE) {
      return 'rgba(255,255,255,0.2)';
    }
    if (hasIssue(idx1) || hasIssue(idx2)) {
      return COLORS.connectionWarning;
    }
    return COLORS.connection;
  };

  // Get keypoint size based on importance
  const getKeypointSize = (index: number): number => {
    if (focusKeypoints.includes(index)) return 12;
    return 8;
  };

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height}>
        {/* Draw connections first (behind keypoints) */}
        <G>
          {SKELETON_CONNECTIONS.map(([idx1, idx2], i) => {
            const kp1 = pose.keypoints[idx1];
            const kp2 = pose.keypoints[idx2];
            
            if (!kp1 || !kp2) return null;
            if (kp1.score < MIN_CONFIDENCE && kp2.score < MIN_CONFIDENCE) return null;

            const color = getConnectionColor(kp1, kp2, idx1, idx2);
            const strokeWidth = focusKeypoints.includes(idx1) || focusKeypoints.includes(idx2) ? 4 : 2;

            return (
              <Line
                key={`connection-${i}`}
                x1={kp1.x}
                y1={kp1.y}
                x2={kp2.x}
                y2={kp2.y}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            );
          })}
        </G>

        {/* Draw keypoints */}
        <G>
          {pose.keypoints.map((keypoint, index) => {
            if (keypoint.score < MIN_CONFIDENCE) return null;

            const color = getKeypointColor(keypoint, index);
            const size = getKeypointSize(index);
            const isFocus = focusKeypoints.includes(index);

            return (
              <G key={`keypoint-${index}`}>
                {/* Outer glow for focus keypoints */}
                {isFocus && (
                  <Circle
                    cx={keypoint.x}
                    cy={keypoint.y}
                    r={size + 4}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={0.5}
                  />
                )}
                {/* Main keypoint circle */}
                <Circle
                  cx={keypoint.x}
                  cy={keypoint.y}
                  r={size}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                {/* Inner highlight */}
                <Circle
                  cx={keypoint.x - size * 0.25}
                  cy={keypoint.y - size * 0.25}
                  r={size * 0.3}
                  fill="rgba(255,255,255,0.5)"
                />
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

// Helper to get keypoint name from index
function getKeypointName(index: number): string {
  const names = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
  ];
  return names[index] || 'unknown';
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default SkeletonOverlay;
