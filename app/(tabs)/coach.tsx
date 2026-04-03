// ============================================================
// AI FORM COACH TAB — Entry point for pose-based form analysis
// ============================================================
import { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';

interface ExerciseOption {
  type: string;
  name: string;
  description: string;
  icon: string;
  tips: string[];
  color: string;
}

const EXERCISES: ExerciseOption[] = [
  {
    type: 'pushup',
    name: 'Push-up',
    description: 'Auto-count reps and score your form in real-time',
    icon: '💪',
    color: '#3B82F6',
    tips: [
      'Position camera to your side for best tracking',
      'Ensure good lighting — avoid backlighting',
      'Keep your whole body in frame',
    ],
  },
  {
    type: 'pullup',
    name: 'Pull-up',
    description: 'Track pull-up form and count reps automatically',
    icon: '🏋️',
    color: '#8B5CF6',
    tips: [
      'Position camera in front of you',
      'Ensure good lighting',
      'Keep your upper body in frame',
    ],
  },
  {
    type: 'squat',
    name: 'Squat',
    description: 'Track squat depth and knee alignment',
    icon: '🦵',
    color: '#10B981',
    tips: [
      'Position camera to your side for best tracking',
      'Keep your full body in frame',
      'Wear fitted clothing for better detection',
    ],
  },
  {
    type: 'rdl',
    name: 'Romanian Deadlift',
    description: 'Monitor hip hinge and back position',
    icon: '🏋️‍♀️',
    color: '#F59E0B',
    tips: [
      'Position camera to your side',
      'Keep full body in frame',
      'Wear fitted clothing for better detection',
    ],
  },
];

export default function CoachTab() {
  const colors = useColors();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const isNative = Platform.OS !== 'web';

  const handleStart = () => {
    if (!selected) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/form-coach-tracking', params: { exercise: selected } } as any);
  };

  const selectedOption = EXERCISES.find(e => e.type === selected);

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: colors.cardForeground }]}>AI Form Coach</Text>
          <Text style={[s.subtitle, { color: colors.cardMuted }]}>
            {isNative ? 'On-device pose tracking · No upload' : 'Native device required for tracking'}
          </Text>
        </View>
        <View style={[s.badge, { backgroundColor: isNative ? '#10B98120' : colors.surface }]}>
          <Text style={[s.badgeText, { color: isNative ? '#10B981' : colors.cardMuted }]}>
            {isNative ? '● LIVE' : '○ WEB'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Coaching Dashboard Entry */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/ai-coaching-dashboard' as any);
          }}
          style={[s.aiCoachCard, { backgroundColor: '#6366F115', borderColor: '#6366F140' }]}
        >
          <View style={s.aiCoachCardInner}>
            <Text style={{ fontSize: 32 }}>🧠</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.aiCoachTitle, { color: colors.cardForeground }]}>AI Coaching Dashboard</Text>
              <Text style={[s.aiCoachDesc, { color: colors.cardMuted }]}>
                Daily insights, workout adjustments, and nutrition analysis powered by your data
              </Text>
            </View>
            <Text style={{ color: '#6366F1', fontSize: 20 }}>→</Text>
          </View>
        </TouchableOpacity>

        {/* How it works card */}
        <View style={[s.infoCard, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
          <Text style={[s.infoTitle, { color: colors.cardForeground }]}>How it works</Text>
          <Text style={[s.infoBody, { color: colors.cardMuted }]}>
            Your camera feeds live video to MediaPipe Pose — a Google AI model running entirely on your device.
            It maps 33 body landmarks at 15–30 FPS, counts your reps automatically, and scores your form 0–100.
            No video is ever uploaded.
          </Text>
        </View>

        {/* Web notice */}
        {!isNative && (
          <View style={[s.warningCard, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
            <Text style={[s.warningText, { color: '#F59E0B' }]}>
              ⚠️  Form Coach requires the native Android or iOS app. Build the APK via the Publish button and install it on your Pixel to use this feature.
            </Text>
          </View>
        )}

        {/* Exercise selection */}
        <Text style={[s.sectionLabel, { color: colors.cardMuted }]}>SELECT EXERCISE</Text>

        {EXERCISES.map((ex) => (
          <TouchableOpacity
            key={ex.type}
            activeOpacity={0.75}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelected(ex.type);
            }}
            style={[
              s.exerciseCard,
              {
                backgroundColor: colors.surface,
                borderColor: selected === ex.type ? ex.color : colors.cardBorder,
                borderWidth: selected === ex.type ? 2 : 1,
              },
            ]}
          >
            <View style={[s.iconCircle, { backgroundColor: ex.color + '20' }]}>
              <Text style={s.iconText}>{ex.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.exName, { color: colors.cardForeground }]}>{ex.name}</Text>
              <Text style={[s.exDesc, { color: colors.cardMuted }]}>{ex.description}</Text>
            </View>
            {selected === ex.type && (
              <View style={[s.checkCircle, { backgroundColor: ex.color }]}>
                <Text style={s.checkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Tips for selected exercise */}
        {selectedOption && (
          <View style={[s.tipsCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[s.tipsTitle, { color: colors.cardForeground }]}>
              Setup tips for {selectedOption.name}
            </Text>
            {selectedOption.tips.map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <View style={[s.tipNum, { backgroundColor: selectedOption.color + '20' }]}>
                  <Text style={[s.tipNumText, { color: selectedOption.color }]}>{i + 1}</Text>
                </View>
                <Text style={[s.tipText, { color: colors.cardForeground }]}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={[s.disclaimer, { backgroundColor: colors.surface }]}>
          <Text style={[s.disclaimerText, { color: colors.cardMuted }]}>
            ⚠️  AI tracking works best with stable camera position and good lighting. Accuracy may vary based on conditions.
          </Text>
        </View>
      </ScrollView>

      {/* Start button */}
      {selected && isNative && (
        <View style={[s.startWrap, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={handleStart}
            style={[s.startBtn, { backgroundColor: selectedOption?.color ?? colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={s.startBtnText}>▶  Start Tracking — {selectedOption?.name}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  infoBody: { fontSize: 13, lineHeight: 20 },

  warningCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { fontSize: 13, lineHeight: 20 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },

  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { fontSize: 26 },
  exName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  exDesc: { fontSize: 13, lineHeight: 18 },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  tipsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  tipsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  tipNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  tipNumText: { fontSize: 12, fontWeight: '700' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },

  aiCoachCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  aiCoachCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  aiCoachTitle: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  aiCoachDesc: { fontSize: 13, lineHeight: 18 },

  disclaimer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  disclaimerText: { fontSize: 12, lineHeight: 18 },

  startWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
  },
  startBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
