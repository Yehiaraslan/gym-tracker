// ============================================================
// ONBOARDING SCREEN — 3-step setup for new users
// Step 1: Fitness Goal
// Step 2: Experience Level
// Step 3: Available Equipment
// Saves to profile-store and feeds into Zaki's context
// ============================================================
import { useState, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import {
  saveUserProfile,
  loadUserProfile,
  type UserProfile,
  type ExperienceLevel,
  type EquipmentAccess,
} from '@/lib/profile-store';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Step Data ────────────────────────────────────────────────

type GoalKey = 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance';

const GOALS: { key: GoalKey; label: string; emoji: string; desc: string }[] = [
  { key: 'muscle_gain', label: 'Build Muscle', emoji: '💪', desc: 'Gain size and definition with hypertrophy-focused training' },
  { key: 'fat_loss', label: 'Lose Fat', emoji: '🔥', desc: 'Burn fat while preserving muscle with metabolic training' },
  { key: 'strength', label: 'Get Stronger', emoji: '🏋️', desc: 'Increase your 1RM with progressive overload programming' },
  { key: 'endurance', label: 'Build Endurance', emoji: '🏃', desc: 'Improve stamina and cardiovascular fitness' },
];

const EXPERIENCE: { key: ExperienceLevel; label: string; emoji: string; desc: string }[] = [
  { key: 'beginner', label: 'Beginner', emoji: '🌱', desc: 'New to lifting or less than 6 months of consistent training' },
  { key: 'intermediate', label: 'Intermediate', emoji: '⚡', desc: '6 months to 2 years of consistent training experience' },
  { key: 'advanced', label: 'Advanced', emoji: '🔥', desc: '2+ years of structured training with solid technique' },
];

const EQUIPMENT: { key: EquipmentAccess; label: string; emoji: string; desc: string }[] = [
  { key: 'full_gym', label: 'Full Gym', emoji: '🏢', desc: 'Access to barbells, machines, cables, and dumbbells' },
  { key: 'home_dumbbells', label: 'Home Gym', emoji: '🏠', desc: 'Dumbbells, resistance bands, maybe a bench' },
  { key: 'bodyweight', label: 'Bodyweight Only', emoji: '🤸', desc: 'No equipment — just your body and determination' },
];

const STEPS = ['Goal', 'Experience', 'Equipment'] as const;

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalKey | ''>('');
  const [experience, setExperience] = useState<ExperienceLevel>('');
  const [equipment, setEquipment] = useState<EquipmentAccess>('');
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fg = colors.foreground;
  const mt = colors.muted;
  const pr = colors.primary;
  const bg = colors.background;
  const surf = colors.surface;
  const bord = colors.border;
  const succ = colors.success;

  // ── Animations ──────────────────────────────────────────────

  const animateTransition = (direction: 'forward' | 'back', cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  // ── Navigation ──────────────────────────────────────────────

  const handleNext = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 2) {
      animateTransition('forward', () => setStep(s => s + 1));
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      animateTransition('back', () => setStep(s => s - 1));
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const existing = await loadUserProfile();
      const updated: UserProfile = {
        ...existing,
        name: existing.name || user?.name || '',
        fitnessGoal: goal || existing.fitnessGoal,
        experienceLevel: experience || existing.experienceLevel,
        equipment: equipment || existing.equipment,
        onboardingCompleted: true,
      };
      await saveUserProfile(updated);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/program-setup');
    } catch (e) {
      console.error('[Onboarding] Save error:', e);
    }
    setSaving(false);
  };

  // ── Can proceed? ────────────────────────────────────────────

  const canProceed = step === 0 ? !!goal : step === 1 ? !!experience : !!equipment;

  // ── Render Option Card ──────────────────────────────────────

  const renderOption = (
    item: { key: string; label: string; emoji: string; desc: string },
    selected: boolean,
    onSelect: () => void,
  ) => (
    <TouchableOpacity
      key={item.key}
      style={[
        s.optionCard,
        {
          backgroundColor: selected ? pr + '12' : surf,
          borderColor: selected ? pr : bord,
          borderWidth: selected ? 2 : 1,
        },
      ]}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
      activeOpacity={0.7}
    >
      <Text style={s.optionEmoji}>{item.emoji}</Text>
      <View style={s.optionTextWrap}>
        <Text style={[s.optionLabel, { color: fg }]}>{item.label}</Text>
        <Text style={[s.optionDesc, { color: mt }]}>{item.desc}</Text>
      </View>
      {selected && (
        <View style={[s.checkCircle, { backgroundColor: pr }]}>
          <Text style={s.checkMark}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // ── Step Content ────────────────────────────────────────────

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <View style={s.stepContent}>
            <Text style={[s.stepTitle, { color: fg }]}>What's your goal?</Text>
            <Text style={[s.stepSubtitle, { color: mt }]}>
              Zaki will tailor your program, nutrition targets, and coaching to match
            </Text>
            <View style={s.optionsWrap}>
              {GOALS.map(g => renderOption(g, goal === g.key, () => setGoal(g.key)))}
            </View>
          </View>
        );
      case 1:
        return (
          <View style={s.stepContent}>
            <Text style={[s.stepTitle, { color: fg }]}>Your experience level?</Text>
            <Text style={[s.stepSubtitle, { color: mt }]}>
              This helps Zaki set the right volume, intensity, and exercise complexity
            </Text>
            <View style={s.optionsWrap}>
              {EXPERIENCE.map(e => renderOption(e, experience === e.key, () => setExperience(e.key)))}
            </View>
          </View>
        );
      case 2:
        return (
          <View style={s.stepContent}>
            <Text style={[s.stepTitle, { color: fg }]}>What equipment do you have?</Text>
            <Text style={[s.stepSubtitle, { color: mt }]}>
              Zaki will only suggest exercises you can actually do
            </Text>
            <View style={s.optionsWrap}>
              {EQUIPMENT.map(eq => renderOption(eq, equipment === eq.key, () => setEquipment(eq.key)))}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  // ── Main Render ─────────────────────────────────────────────

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.container}>
        {/* Progress bar */}
        <View style={s.progressWrap}>
          <View style={s.progressRow}>
            {STEPS.map((label, i) => (
              <View key={label} style={s.progressItem}>
                <View
                  style={[
                    s.progressDot,
                    {
                      backgroundColor: i <= step ? pr : bord,
                    },
                  ]}
                >
                  {i < step && <Text style={s.progressCheck}>✓</Text>}
                  {i === step && <Text style={[s.progressNum, { color: '#fff' }]}>{i + 1}</Text>}
                  {i > step && <Text style={[s.progressNum, { color: mt }]}>{i + 1}</Text>}
                </View>
                <Text style={[s.progressLabel, { color: i <= step ? fg : mt }]}>{label}</Text>
              </View>
            ))}
          </View>
          {/* Connecting lines */}
          <View style={s.progressLineWrap}>
            <View style={[s.progressLine, { backgroundColor: step >= 1 ? pr : bord }]} />
            <View style={[s.progressLine, { backgroundColor: step >= 2 ? pr : bord }]} />
          </View>
        </View>

        {/* Step content with fade animation */}
        <Animated.View style={[s.animatedWrap, { opacity: fadeAnim }]}>
          {renderStepContent()}
        </Animated.View>

        {/* Bottom navigation */}
        <View style={s.bottomNav}>
          {step > 0 ? (
            <TouchableOpacity
              style={[s.backBtn, { borderColor: bord }]}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Text style={[s.backBtnText, { color: fg }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.backBtnPlaceholder} />
          )}

          <TouchableOpacity
            style={[
              s.nextBtn,
              {
                backgroundColor: canProceed ? pr : bord,
                opacity: canProceed ? 1 : 0.5,
              },
            ]}
            onPress={handleNext}
            disabled={!canProceed || saving}
            activeOpacity={0.8}
          >
            <Text style={s.nextBtnText}>
              {saving ? 'Setting up...' : step === 2 ? "Let's Go" : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Progress bar
  progressWrap: {
    paddingTop: 16,
    paddingBottom: 24,
    position: 'relative',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  progressItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  progressDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  progressNum: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressLineWrap: {
    position: 'absolute',
    top: 34,
    left: '20%',
    right: '20%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
    gap: 40,
  },
  progressLine: {
    height: 3,
    flex: 1,
    borderRadius: 2,
  },
  // Step content
  animatedWrap: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    paddingTop: 8,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  optionsWrap: {
    gap: 12,
  },
  // Option cards
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  optionEmoji: {
    fontSize: 32,
    width: 44,
    textAlign: 'center',
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Bottom navigation
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 32,
    paddingTop: 16,
  },
  backBtn: {
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backBtnPlaceholder: {
    width: 0,
  },
  nextBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
