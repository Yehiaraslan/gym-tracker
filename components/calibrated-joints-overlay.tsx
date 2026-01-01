import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Line, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Pose, KEYPOINTS } from '@/lib/pose-detection';

// Animated SVG components
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface CalibratedJointsOverlayProps {
  pose: Pose | null;
  width: number;
  height: number;
  isCalibrated: boolean;
  showCelebration?: boolean;
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

// Joint names for display
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

export function CalibratedJointsOverlay({
  pose,
  width,
  height,
  isCalibrated,
  showCelebration = false,
}: CalibratedJointsOverlayProps) {
  // Animation values for pulsing effect
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  // Start pulsing animation when calibrated
  useEffect(() => {
    if (isCalibrated) {
      // Fade in the overlay
      Animated.timing(fadeInAnim, {
        toValue: 1,
        duration: 500,
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
  }, [isCalibrated, pulseAnim, glowAnim, fadeInAnim]);

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

  // Calculate scale factors
  const scaleX = width / 400; // Assuming base width of 400
  const scaleY = height / 600; // Assuming base height of 600

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
          {/* Radial gradient for glow effect */}
          <RadialGradient id="jointGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#22C55E" stopOpacity="0.8" />
            <Stop offset="50%" stopColor="#22C55E" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </RadialGradient>
          
          {/* Gradient for skeleton lines */}
          <RadialGradient id="lineGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#4ADE80" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#22C55E" stopOpacity="0.5" />
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

            return (
              <G key={`connection-${index}`}>
                {/* Glow line (wider, more transparent) */}
                <Line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#22C55E"
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
                  stroke="#4ADE80"
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

          return (
            <G key={`joint-${jointIdx}`}>
              {/* Outer glow ring */}
              <Circle
                cx={keypoint.x}
                cy={keypoint.y}
                r={20}
                fill="url(#jointGlow)"
                opacity={0.6}
              />
              
              {/* Middle ring */}
              <Circle
                cx={keypoint.x}
                cy={keypoint.y}
                r={12}
                fill="none"
                stroke="#22C55E"
                strokeWidth={2}
                opacity={0.7}
              />
              
              {/* Inner solid circle */}
              <Circle
                cx={keypoint.x}
                cy={keypoint.y}
                r={6}
                fill="#22C55E"
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
      </Svg>

      {/* Animated pulsing rings overlay */}
      {MAIN_JOINTS.map((jointIdx) => {
        const keypoint = keypoints[jointIdx];
        
        if (!keypoint || keypoint.score < 0.3) {
          return null;
        }

        return (
          <Animated.View
            key={`pulse-${jointIdx}`}
            style={[
              styles.pulseRing,
              {
                left: keypoint.x - 15,
                top: keypoint.y - 15,
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
