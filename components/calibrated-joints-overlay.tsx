import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform, Text as RNText } from 'react-native';
import Svg, { Circle, Line, G, Defs, RadialGradient, Stop, Text, TSpan } from 'react-native-svg';
import { Pose, KEYPOINTS } from '@/lib/pose-detection';
import * as Haptics from 'expo-haptics';

interface CalibratedJointsOverlayProps {
  pose: Pose | null;
  width: number;
  height: number;
  isCalibrated: boolean;
  showCelebration?: boolean;
  showLabels?: boolean;
  confidenceMode?: boolean; // When true, colors change based on confidence
}

// Skeleton connections for drawing lines between joints
const SKELETON_CONNECTIONS: [number, number][] = [
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

// Joint names for display - short labels
const JOINT_LABELS: Record<number, string> = {
  [KEYPOINTS.LEFT_SHOULDER]: 'L.Shoulder',
  [KEYPOINTS.RIGHT_SHOULDER]: 'R.Shoulder',
  [KEYPOINTS.LEFT_ELBOW]: 'L.Elbow',
  [KEYPOINTS.RIGHT_ELBOW]: 'R.Elbow',
  [KEYPOINTS.LEFT_WRIST]: 'L.Wrist',
  [KEYPOINTS.RIGHT_WRIST]: 'R.Wrist',
  [KEYPOINTS.LEFT_HIP]: 'L.Hip',
  [KEYPOINTS.RIGHT_HIP]: 'R.Hip',
  [KEYPOINTS.LEFT_KNEE]: 'L.Knee',
  [KEYPOINTS.RIGHT_KNEE]: 'R.Knee',
  [KEYPOINTS.LEFT_ANKLE]: 'L.Ankle',
  [KEYPOINTS.RIGHT_ANKLE]: 'R.Ankle',
};

// Label positions relative to joint (to avoid overlapping)
const LABEL_OFFSETS: Record<number, { x: number; y: number; anchor: string }> = {
  [KEYPOINTS.LEFT_SHOULDER]: { x: -50, y: -10, anchor: 'end' },
  [KEYPOINTS.RIGHT_SHOULDER]: { x: 50, y: -10, anchor: 'start' },
  [KEYPOINTS.LEFT_ELBOW]: { x: -40, y: 0, anchor: 'end' },
  [KEYPOINTS.RIGHT_ELBOW]: { x: 40, y: 0, anchor: 'start' },
  [KEYPOINTS.LEFT_WRIST]: { x: -35, y: 0, anchor: 'end' },
  [KEYPOINTS.RIGHT_WRIST]: { x: 35, y: 0, anchor: 'start' },
  [KEYPOINTS.LEFT_HIP]: { x: -40, y: 5, anchor: 'end' },
  [KEYPOINTS.RIGHT_HIP]: { x: 40, y: 5, anchor: 'start' },
  [KEYPOINTS.LEFT_KNEE]: { x: -35, y: 5, anchor: 'end' },
  [KEYPOINTS.RIGHT_KNEE]: { x: 35, y: 5, anchor: 'start' },
  [KEYPOINTS.LEFT_ANKLE]: { x: -30, y: 10, anchor: 'end' },
  [KEYPOINTS.RIGHT_ANKLE]: { x: 30, y: 10, anchor: 'start' },
};

// Main joints to highlight (excluding face keypoints)
const MAIN_JOINTS = [
  KEYPOINTS.LEFT_SHOULDER,
  KEYPOINTS.RIGHT_SHOULDER,
  KEYPOINTS.LEFT_ELBOW,
  KEYPOINTS.RIGHT_ELBOW,
  KEYPOINTS.LEFT_WRIST,
  KEYPOINTS.RIGHT_WRIST,
  KEYPOINTS.LEFT_HIP,
  KEYPOINTS.RIGHT_HIP,
  KEYPOINTS.LEFT_KNEE,
  KEYPOINTS.RIGHT_KNEE,
  KEYPOINTS.LEFT_ANKLE,
  KEYPOINTS.RIGHT_ANKLE,
];

// Get color based on confidence score
function getConfidenceColor(score: number): { main: string; glow: string; text: string } {
  if (score >= 0.7) {
    return { main: '#22C55E', glow: '#4ADE80', text: '#22C55E' }; // Green - strong
  } else if (score >= 0.5) {
    return { main: '#F59E0B', glow: '#FBBF24', text: '#F59E0B' }; // Yellow/Amber - moderate
  } else if (score >= 0.3) {
    return { main: '#EF4444', glow: '#F87171', text: '#EF4444' }; // Red - weak
  }
  return { main: '#6B7280', glow: '#9CA3AF', text: '#6B7280' }; // Gray - very weak
}

export function CalibratedJointsOverlay({
  pose,
  width,
  height,
  isCalibrated,
  showCelebration = false,
  showLabels = true,
  confidenceMode = false,
}: CalibratedJointsOverlayProps) {
  // Animation values for pulsing effect
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const labelFadeAnim = useRef(new Animated.Value(0)).current;

  // Start pulsing animation when calibrated
  useEffect(() => {
    if (isCalibrated) {
      // Fade in the overlay
      Animated.timing(fadeInAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Fade in labels with delay
      Animated.timing(labelFadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }).start();

      // Pulsing animation for joints
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isCalibrated, pulseAnim, glowAnim, fadeInAnim, labelFadeAnim]);

  // Celebration animation when showCelebration is true
  useEffect(() => {
    if (showCelebration) {
      Animated.sequence([
        Animated.timing(celebrationAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.timing(celebrationAnim, {
          toValue: 0,
          duration: 2000,
          delay: 500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showCelebration, celebrationAnim]);

  if (!pose || !isCalibrated) {
    return null;
  }

  const keypoints = pose.keypoints;

  // Default color for calibrated mode (green)
  const defaultColor = { main: '#22C55E', glow: '#4ADE80', text: '#22C55E' };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { opacity: fadeInAnim }
      ]} 
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          {/* Radial gradient for glow effect - green */}
          <RadialGradient id="jointGlowGreen" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#22C55E" stopOpacity="0.8" />
            <Stop offset="50%" stopColor="#22C55E" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </RadialGradient>
          
          {/* Radial gradient for glow effect - yellow */}
          <RadialGradient id="jointGlowYellow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
            <Stop offset="50%" stopColor="#F59E0B" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </RadialGradient>
          
          {/* Radial gradient for glow effect - red */}
          <RadialGradient id="jointGlowRed" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
            <Stop offset="50%" stopColor="#EF4444" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Draw skeleton connections with glow */}
        <G opacity={0.8}>
          {SKELETON_CONNECTIONS.map(([startIdx, endIdx], index) => {
            const start = keypoints[startIdx];
            const end = keypoints[endIdx];
            
            if (!start || !end || start.score < 0.3 || end.score < 0.3) {
              return null;
            }

            // Get color based on average confidence of both joints
            const avgScore = (start.score + end.score) / 2;
            const color = confidenceMode ? getConfidenceColor(avgScore) : defaultColor;

            return (
              <G key={`connection-${index}`}>
                {/* Glow line (wider, more transparent) */}
                <Line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={color.main}
                  strokeWidth={8}
                  strokeOpacity={0.3}
                  strokeLinecap="round"
                />
                {/* Main line */}
                <Line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={color.glow}
                  strokeWidth={3}
                  strokeOpacity={0.9}
                  strokeLinecap="round"
                />
              </G>
            );
          })}
        </G>

        {/* Draw joints with pulsing glow effect */}
        {MAIN_JOINTS.map((jointIdx) => {
          const keypoint = keypoints[jointIdx];
          
          if (!keypoint || keypoint.score < 0.3) {
            return null;
          }

          // Get color based on confidence
          const color = confidenceMode ? getConfidenceColor(keypoint.score) : defaultColor;
          const glowId = keypoint.score >= 0.7 ? 'jointGlowGreen' : 
                         keypoint.score >= 0.5 ? 'jointGlowYellow' : 'jointGlowRed';

          return (
            <G key={`joint-${jointIdx}`}>
              {/* Outer glow ring */}
              <Circle
                cx={keypoint.x}
                cy={keypoint.y}
                r={20}
                fill={confidenceMode ? `url(#${glowId})` : 'url(#jointGlowGreen)'}
                opacity={0.6}
              />
              
              {/* Middle ring */}
              <Circle
                cx={keypoint.x}
                cy={keypoint.y}
                r={12}
                fill="none"
                stroke={color.main}
                strokeWidth={2}
                opacity={0.7}
              />
              
              {/* Inner solid circle */}
              <Circle
                cx={keypoint.x}
                cy={keypoint.y}
                r={6}
                fill={color.main}
                opacity={0.95}
              />
              
              {/* Center highlight */}
              <Circle
                cx={keypoint.x}
                cy={keypoint.y}
                r={3}
                fill="#ffffff"
                opacity={0.9}
              />
            </G>
          );
        })}

        {/* Draw joint labels */}
        {showLabels && MAIN_JOINTS.map((jointIdx) => {
          const keypoint = keypoints[jointIdx];
          
          if (!keypoint || keypoint.score < 0.3) {
            return null;
          }

          const label = JOINT_LABELS[jointIdx];
          const offset = LABEL_OFFSETS[jointIdx];
          const color = confidenceMode ? getConfidenceColor(keypoint.score) : defaultColor;

          return (
            <G key={`label-${jointIdx}`}>
              {/* Label background for better readability */}
              <Text
                x={keypoint.x + offset.x}
                y={keypoint.y + offset.y}
                fill="rgba(0,0,0,0.6)"
                fontSize={10}
                fontWeight="600"
                textAnchor={offset.anchor as 'start' | 'middle' | 'end'}
                dx={1}
                dy={1}
              >
                {label}
              </Text>
              {/* Label text */}
              <Text
                x={keypoint.x + offset.x}
                y={keypoint.y + offset.y}
                fill={color.text}
                fontSize={10}
                fontWeight="600"
                textAnchor={offset.anchor as 'start' | 'middle' | 'end'}
              >
                {label}
              </Text>
            </G>
          );
        })}
      </Svg>

      {/* Animated pulsing rings overlay */}
      {MAIN_JOINTS.map((jointIdx) => {
        const keypoint = keypoints[jointIdx];
        
        if (!keypoint || keypoint.score < 0.3) {
          return null;
        }

        const color = confidenceMode ? getConfidenceColor(keypoint.score) : defaultColor;

        return (
          <Animated.View
            key={`pulse-${jointIdx}`}
            style={[
              styles.pulseRing,
              {
                left: keypoint.x - 15,
                top: keypoint.y - 15,
                borderColor: color.main,
                transform: [{ scale: pulseAnim }],
                opacity: glowAnim,
              },
            ]}
          />
        );
      })}

      {/* Celebration burst effect */}
      {showCelebration && (
        <Animated.View
          style={[
            styles.celebrationContainer,
            {
              opacity: celebrationAnim,
              transform: [
                {
                  scale: celebrationAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1.2],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.celebrationBurst}>
            {[...Array(8)].map((_, i) => (
              <View
                key={`burst-${i}`}
                style={[
                  styles.burstRay,
                  {
                    transform: [{ rotate: `${i * 45}deg` }],
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// Utility function to trigger haptic feedback for joint detection
export async function triggerJointDetectedHaptic(): Promise<void> {
  if (Platform.OS !== 'web') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

// Utility function to trigger haptic feedback for all joints calibrated
export async function triggerCalibrationCompleteHaptic(): Promise<void> {
  if (Platform.OS !== 'web') {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  pulseRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#22C55E',
    backgroundColor: 'transparent',
  },
  celebrationContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationBurst: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  burstRay: {
    position: 'absolute',
    width: 4,
    height: 100,
    backgroundColor: '#22C55E',
    opacity: 0.6,
    borderRadius: 2,
  },
});

export default CalibratedJointsOverlay;
