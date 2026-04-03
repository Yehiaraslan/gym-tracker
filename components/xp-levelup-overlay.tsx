import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { PlayerLevel } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LEVEL_COLORS: Record<PlayerLevel, { primary: string; secondary: string; glow: string }> = {
  Beginner:     { primary: '#22C55E', secondary: '#16A34A', glow: 'rgba(34,197,94,0.25)' },
  Novice:       { primary: '#3B82F6', secondary: '#2563EB', glow: 'rgba(59,130,246,0.25)' },
  Intermediate: { primary: '#8B5CF6', secondary: '#7C3AED', glow: 'rgba(139,92,246,0.25)' },
  Advanced:     { primary: '#F59E0B', secondary: '#D97706', glow: 'rgba(245,158,11,0.25)' },
  Elite:        { primary: '#EF4444', secondary: '#DC2626', glow: 'rgba(239,68,68,0.25)'  },
  Legend:       { primary: '#F97316', secondary: '#EA580C', glow: 'rgba(249,115,22,0.25)' },
};

const LEVEL_ICONS: Record<PlayerLevel, string> = {
  Beginner:     '🌱',
  Novice:       '🏋️',
  Intermediate: '💪',
  Advanced:     '🔥',
  Elite:        '⚡',
  Legend:       '👑',
};

const CONFETTI_COLORS = [
  '#F59E0B', '#10B981', '#3B82F6', '#EF4444',
  '#8B5CF6', '#EC4899', '#F97316', '#06B6D4',
];
const CONFETTI_COUNT = 40;

interface XPLevelUpOverlayProps {
  visible: boolean;
  newLevel: PlayerLevel;
  xpGained: number;
  onDismiss: () => void;
}

export function XPLevelUpOverlay({ visible, newLevel, xpGained, onDismiss }: XPLevelUpOverlayProps) {
  const theme = LEVEL_COLORS[newLevel] ?? LEVEL_COLORS.Novice;
  const icon = LEVEL_ICONS[newLevel] ?? '🏆';

  // Overlay fade
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  // Card animations
  const cardScale = useRef(new Animated.Value(0.5)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(80)).current;
  // Glow pulse
  const glowScale = useRef(new Animated.Value(0.8)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  // XP badge slide
  const xpBadgeX = useRef(new Animated.Value(-60)).current;
  const xpBadgeOpacity = useRef(new Animated.Value(0)).current;

  // Confetti
  const confettiX = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => new Animated.Value(0))
  ).current;
  const confettiY = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => new Animated.Value(0))
  ).current;
  const confettiOpacity = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => new Animated.Value(0))
  ).current;
  const confettiRotate = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (!visible) {
      // Reset all
      overlayOpacity.setValue(0);
      cardScale.setValue(0.5);
      cardOpacity.setValue(0);
      cardY.setValue(80);
      glowScale.setValue(0.8);
      glowOpacity.setValue(0);
      xpBadgeX.setValue(-60);
      xpBadgeOpacity.setValue(0);
      confettiX.forEach((v, i) => v.setValue((Math.random() - 0.5) * SCREEN_WIDTH * 0.9));
      confettiY.forEach(v => v.setValue(-60));
      confettiOpacity.forEach(v => v.setValue(0));
      confettiRotate.forEach(v => v.setValue(0));
      return;
    }

    // Haptic
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 300);
    }

    // Seed confetti start positions
    confettiX.forEach((v, i) => v.setValue((Math.random() - 0.5) * SCREEN_WIDTH * 0.9));
    confettiY.forEach(v => v.setValue(-60));
    confettiOpacity.forEach(v => v.setValue(0));
    confettiRotate.forEach(v => v.setValue(0));

    // Overlay in
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    // Card entrance
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 80,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(cardY, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.3, duration: 900, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 0.8, duration: 900, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.3, duration: 450, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // XP badge slide in after 400ms
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(xpBadgeX, { toValue: 0, tension: 100, friction: 8, useNativeDriver: true }),
        Animated.timing(xpBadgeOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 400);

    // Confetti burst
    const confettiAnims = confettiX.map((_, i) =>
      Animated.parallel([
        Animated.timing(confettiY[i], {
          toValue: 500 + Math.random() * 300,
          duration: 1800 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(confettiOpacity[i], { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(confettiOpacity[i], { toValue: 0, duration: 600, delay: 1000, useNativeDriver: true }),
        ]),
        Animated.timing(confettiRotate[i], {
          toValue: (Math.random() > 0.5 ? 6 : -6),
          duration: 1800 + Math.random() * 1000,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(25, confettiAnims).start();

    // Auto-dismiss after 3.5s
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayOpacity }]}
      pointerEvents="box-none"
    >
      {/* Confetti */}
      {confettiX.map((xVal, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            width: 7 + (i % 5) * 2,
            height: 7 + (i % 5) * 2,
            borderRadius: i % 3 === 0 ? 4 : 1,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            opacity: confettiOpacity[i],
            transform: [
              { translateX: xVal },
              { translateY: confettiY[i] },
              {
                rotate: confettiRotate[i].interpolate({
                  inputRange: [-6, 6],
                  outputRange: ['-2160deg', '2160deg'],
                }),
              },
            ],
          }}
        />
      ))}

      {/* Glow ring */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            backgroundColor: theme.glow,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          {
            borderColor: theme.primary,
            opacity: cardOpacity,
            transform: [{ scale: cardScale }, { translateY: cardY }],
          },
        ]}
      >
        {/* Level icon */}
        <Text style={styles.levelIcon}>{icon}</Text>

        {/* LEVEL UP label */}
        <Text style={[styles.levelUpLabel, { color: theme.primary }]}>LEVEL UP</Text>

        {/* New level name */}
        <Text style={[styles.levelName, { color: theme.primary }]}>{newLevel}</Text>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.primary }]} />

        {/* XP gained badge */}
        <Animated.View
          style={[
            styles.xpBadge,
            { backgroundColor: theme.glow, opacity: xpBadgeOpacity, transform: [{ translateX: xpBadgeX }] },
          ]}
        >
          <Text style={[styles.xpBadgeText, { color: theme.primary }]}>+{xpGained} XP</Text>
        </Animated.View>

        <Text style={styles.tapHint}>Tap to continue</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  glowRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  card: {
    width: 280,
    backgroundColor: '#0F1117',
    borderRadius: 24,
    borderWidth: 2,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  levelIcon: {
    fontSize: 64,
    marginBottom: 4,
  },
  levelUpLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  levelName: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  divider: {
    width: 60,
    height: 2,
    borderRadius: 1,
    marginVertical: 4,
  },
  xpBadge: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  xpBadgeText: {
    fontSize: 20,
    fontWeight: '800',
  },
  tapHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
});
