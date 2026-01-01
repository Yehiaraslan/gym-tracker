import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, G, Rect } from 'react-native-svg';
import { ExerciseType } from '@/lib/pose-detection';

interface FormGuideOverlayProps {
  exerciseType: ExerciseType;
  isTracking: boolean;
  currentState: string;
}

/**
 * Visual overlay showing correct form guides for each exercise
 */
export function FormGuideOverlay({ exerciseType, isTracking, currentState }: FormGuideOverlayProps) {
  if (!isTracking) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {exerciseType === 'pushup' && <PushupGuide currentState={currentState} />}
      {exerciseType === 'pullup' && <PullupGuide currentState={currentState} />}
      {exerciseType === 'squat' && <SquatGuide currentState={currentState} />}
    </View>
  );
}

function PushupGuide({ currentState }: { currentState: string }) {
  const isDown = currentState === 'down';
  const primaryColor = isDown ? '#22C55E' : '#0a7ea4';
  const secondaryColor = 'rgba(255,255,255,0.3)';
  
  // Push-up side view - stick figure
  const headY = isDown ? 85 : 70;
  const handY = isDown ? 100 : 85;
  const hipY = isDown ? 90 : 75;
  const footY = isDown ? 95 : 80;
  
  return (
    <View style={styles.guideContainer}>
      <Svg width="280" height="160" viewBox="0 0 280 160">
        {/* Ground line */}
        <Line x1="20" y1="120" x2="260" y2="120" stroke={secondaryColor} strokeWidth="2" strokeDasharray="5,5" />
        
        {/* Body outline - simplified stick figure */}
        <G opacity={0.7}>
          {/* Head */}
          <Circle cx="60" cy={headY} r="12" fill="none" stroke={primaryColor} strokeWidth="3" />
          
          {/* Torso */}
          <Line x1="60" y1={headY + 12} x2="150" y2={hipY} stroke={primaryColor} strokeWidth="3" />
          
          {/* Arms */}
          <Line x1="80" y1={headY + 20} x2="70" y2={handY + 15} stroke={primaryColor} strokeWidth="3" />
          <Line x1="70" y1={handY + 15} x2="70" y2="115" stroke={primaryColor} strokeWidth="3" />
          
          {/* Legs */}
          <Line x1="150" y1={hipY} x2="220" y2={footY} stroke={primaryColor} strokeWidth="3" />
          <Line x1="220" y1={footY} x2="220" y2="115" stroke={primaryColor} strokeWidth="3" />
        </G>
        
        {/* Form cues */}
        <G>
          {/* Straight back indicator */}
          <Line 
            x1="55" y1={headY + 15} 
            x2="155" y2={hipY + 5} 
            stroke={isDown ? '#22C55E' : '#FBBF24'} 
            strokeWidth="1" 
            strokeDasharray="3,3" 
          />
          
          {/* Elbow angle arc */}
          <Path 
            d={`M 80 ${headY + 25} Q 65 ${handY + 5} 70 ${handY + 15}`}
            fill="none"
            stroke={primaryColor}
            strokeWidth="2"
          />
        </G>
      </Svg>
      
      {/* Text cues */}
      <View style={styles.cueContainer}>
        <Text style={[styles.cueText, { color: primaryColor }]}>
          {isDown ? '✓ Good depth!' : 'Keep body straight'}
        </Text>
        <Text style={styles.tipText}>
          {isDown ? 'Push up with control' : 'Lower chest to ground'}
        </Text>
      </View>
    </View>
  );
}

function PullupGuide({ currentState }: { currentState: string }) {
  const isUp = currentState === 'up';
  const primaryColor = isUp ? '#22C55E' : '#0a7ea4';
  const secondaryColor = 'rgba(255,255,255,0.3)';
  
  // Pull-up front view positions
  const headY = isUp ? 40 : 70;
  const shoulderY = isUp ? 55 : 85;
  const hipY = isUp ? 90 : 120;
  
  return (
    <View style={styles.guideContainer}>
      <Svg width="200" height="180" viewBox="0 0 200 180">
        {/* Bar */}
        <Line x1="40" y1="30" x2="160" y2="30" stroke={secondaryColor} strokeWidth="4" />
        <Rect x="35" y="25" width="10" height="10" fill={secondaryColor} />
        <Rect x="155" y="25" width="10" height="10" fill={secondaryColor} />
        
        {/* Body outline */}
        <G opacity={0.7}>
          {/* Head */}
          <Circle cx="100" cy={headY} r="12" fill="none" stroke={primaryColor} strokeWidth="3" />
          
          {/* Arms */}
          <Line x1="70" y1="30" x2="80" y2={shoulderY} stroke={primaryColor} strokeWidth="3" />
          <Line x1="130" y1="30" x2="120" y2={shoulderY} stroke={primaryColor} strokeWidth="3" />
          
          {/* Torso */}
          <Line x1="80" y1={shoulderY} x2="100" y2={shoulderY} stroke={primaryColor} strokeWidth="3" />
          <Line x1="100" y1={shoulderY} x2="120" y2={shoulderY} stroke={primaryColor} strokeWidth="3" />
          <Line x1="100" y1={shoulderY} x2="100" y2={hipY} stroke={primaryColor} strokeWidth="3" />
          
          {/* Legs */}
          <Line x1="100" y1={hipY} x2="85" y2={hipY + 35} stroke={primaryColor} strokeWidth="3" />
          <Line x1="100" y1={hipY} x2="115" y2={hipY + 35} stroke={primaryColor} strokeWidth="3" />
        </G>
        
        {/* Chin over bar indicator */}
        {isUp && (
          <Line x1="90" y1="30" x2="110" y2="30" stroke="#22C55E" strokeWidth="3" />
        )}
      </Svg>
      
      {/* Text cues */}
      <View style={styles.cueContainer}>
        <Text style={[styles.cueText, { color: primaryColor }]}>
          {isUp ? '✓ Chin over bar!' : 'Pull up smoothly'}
        </Text>
        <Text style={styles.tipText}>
          {isUp ? 'Lower with control' : 'Drive elbows down'}
        </Text>
      </View>
    </View>
  );
}

function SquatGuide({ currentState }: { currentState: string }) {
  const isDown = currentState === 'down';
  const primaryColor = isDown ? '#22C55E' : '#0a7ea4';
  const secondaryColor = 'rgba(255,255,255,0.3)';
  
  // Squat side view positions
  const headY = isDown ? 50 : 30;
  const shoulderY = isDown ? 65 : 45;
  const hipY = isDown ? 100 : 70;
  const kneeY = isDown ? 115 : 100;
  const kneeX = isDown ? 130 : 100;
  
  return (
    <View style={styles.guideContainer}>
      <Svg width="240" height="180" viewBox="0 0 240 180">
        {/* Ground line */}
        <Line x1="20" y1="150" x2="220" y2="150" stroke={secondaryColor} strokeWidth="2" strokeDasharray="5,5" />
        
        {/* Body outline */}
        <G opacity={0.7}>
          {/* Head */}
          <Circle cx="100" cy={headY} r="12" fill="none" stroke={primaryColor} strokeWidth="3" />
          
          {/* Torso */}
          <Line x1="100" y1={headY + 12} x2="100" y2={shoulderY} stroke={primaryColor} strokeWidth="3" />
          <Line x1="100" y1={shoulderY} x2="100" y2={hipY} stroke={primaryColor} strokeWidth="3" />
          
          {/* Arms (holding position) */}
          <Line x1="100" y1={shoulderY + 5} x2="130" y2={shoulderY + 20} stroke={primaryColor} strokeWidth="3" />
          <Line x1="100" y1={shoulderY + 5} x2="70" y2={shoulderY + 20} stroke={primaryColor} strokeWidth="3" />
          
          {/* Legs */}
          <Line x1="100" y1={hipY} x2={kneeX} y2={kneeY} stroke={primaryColor} strokeWidth="3" />
          <Line x1={kneeX} y1={kneeY} x2={kneeX - 10} y2="145" stroke={primaryColor} strokeWidth="3" />
        </G>
        
        {/* Parallel line indicator */}
        {isDown && (
          <Line 
            x1="60" y1={hipY} 
            x2="160" y2={hipY} 
            stroke="#22C55E" 
            strokeWidth="1" 
            strokeDasharray="5,5" 
          />
        )}
        
        {/* Knee tracking line */}
        <Line 
          x1={kneeX} y1={kneeY} 
          x2={kneeX} y2="150" 
          stroke={secondaryColor} 
          strokeWidth="1" 
          strokeDasharray="3,3" 
        />
      </Svg>
      
      {/* Text cues */}
      <View style={styles.cueContainer}>
        <Text style={[styles.cueText, { color: primaryColor }]}>
          {isDown ? '✓ Good depth!' : 'Chest up, core tight'}
        </Text>
        <Text style={styles.tipText}>
          {isDown ? 'Drive through heels' : 'Knees track over toes'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 16,
  },
  cueContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  cueText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  tipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
});
