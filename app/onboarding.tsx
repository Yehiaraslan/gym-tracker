// ============================================================
// ONBOARDING SCREEN — 14-step setup for new users (EN / AR)
// language → gender → goal → activity → experience → height →
// weight → age → muscle focus → frequency → equipment →
// reminders → name → plan summary
// Saves to profile-store and feeds Coach Mohamad Yousry's context + program-setup.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Body from 'react-native-body-highlighter';
import Svg, { Defs, LinearGradient, Path, Stop, Circle, Line } from 'react-native-svg';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { useI18n, localizeDigits, type Language, type StringKey } from '@/lib/i18n';
import {
  saveUserProfile,
  loadUserProfile,
  calculateAge,
  type UserProfile,
  type ExperienceLevel,
  type EquipmentAccess,
  type ActivityLevel,
  type FocusMuscle,
  type ReminderDay,
} from '@/lib/profile-store';
import { notificationService } from '@/lib/notification-service';
import { ProgressHeader } from '@/components/onboarding/progress-header';
import { FigureHero } from '@/components/onboarding/figure-hero';
import { HintBanner } from '@/components/onboarding/hint-banner';
import { OptionCard } from '@/components/onboarding/option-card';
import { RulerPicker } from '@/components/onboarding/ruler-picker';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import { BmiGauge, bmiCategory } from '@/components/onboarding/bmi-gauge';
import { DaySlider } from '@/components/onboarding/day-slider';
import { ALL_FOCUS_MUSCLES, MUSCLE_SPECS, slugsForSide } from '@/components/onboarding/muscles';
import type { FigureKey } from '@/components/onboarding/figures';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Step data ────────────────────────────────────────────────

const STEPS = [
  'language', 'gender', 'goal', 'activity', 'experience', 'height', 'weight', 'age',
  'focus', 'frequency', 'equipment', 'reminders', 'name', 'summary',
] as const;
type StepKey = (typeof STEPS)[number];

type GoalKey = 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance';
const GOALS: { key: GoalKey; emoji: string }[] = [
  { key: 'fat_loss', emoji: '🔥' },
  { key: 'muscle_gain', emoji: '💪' },
  { key: 'strength', emoji: '🏋️' },
  { key: 'endurance', emoji: '🏃' },
];
const ACTIVITY: ActivityLevel[] = [1, 2, 3, 4];
const EXPERIENCE: { key: Exclude<ExperienceLevel, ''>; emoji: string }[] = [
  { key: 'beginner', emoji: '🌱' },
  { key: 'intermediate', emoji: '⚡' },
  { key: 'advanced', emoji: '🔥' },
];
const EQUIPMENT: { key: Exclude<EquipmentAccess, ''>; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'home_dumbbells', icon: 'dumbbell' },
  { key: 'full_gym', icon: 'weight-lifter' },
  { key: 'bodyweight', icon: 'human-handsup' },
];
const DAYS: { iso: ReminderDay; key: StringKey; emoji: string }[] = [
  { iso: 1, key: 'day_mon', emoji: '🌅' },
  { iso: 2, key: 'day_tue', emoji: '🔥' },
  { iso: 3, key: 'day_wed', emoji: '🚀' },
  { iso: 4, key: 'day_thu', emoji: '💥' },
  { iso: 5, key: 'day_fri', emoji: '⚡' },
  { iso: 6, key: 'day_sat', emoji: '🏆' },
  { iso: 7, key: 'day_sun', emoji: '🌿' },
];
const DEFAULT_TIME = '18:00';
const AGES = Array.from({ length: 78 }, (_, i) => 13 + i);
const HOURS = Array.from({ length: 18 }, (_, i) => 5 + i);
const MINUTES = [0, 15, 30, 45];

// figure at the top of each step (mirrors the reference: a different muscle lights up per step)
const STEP_FIGURE: Partial<Record<StepKey, FigureKey>> = {
  gender: 'traps', goal: 'biceps', activity: 'quads', experience: 'lats', height: 'chest',
  weight: 'shoulders', age: 'abs', focus: 'lats', frequency: 'shoulders', equipment: 'abs',
  reminders: 'neck', name: 'neck',
};
const STEP_ICON: Partial<Record<StepKey, keyof typeof MaterialCommunityIcons.glyphMap>> = {
  language: 'translate', gender: 'gender-male-female', goal: 'flag-checkered', activity: 'walk',
  experience: 'chart-line', height: 'human-male-height', weight: 'scale-bathroom',
  age: 'cake-variant-outline', focus: 'target', frequency: 'tune-variant', equipment: 'dumbbell',
  reminders: 'bell-outline', name: 'format-text',
};

// ── Helpers ──────────────────────────────────────────────────

const cmToIn = (cm: number) => Math.round(cm / 2.54);
const inToCm = (inch: number) => Math.round(inch * 2.54);
const kgToLb = (kg: number) => Math.round(kg * 2.20462 * 2) / 2;
const lbToKg = (lb: number) => Math.round((lb / 2.20462) * 10) / 10;
const fmtFtIn = (inch: number) => `${Math.floor(inch / 12)}'${inch % 12}"`;

function dobFromAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

function fmtTime(hhmm: string, t: (k: StringKey) => string, lang: Language) {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const s = `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? t('am') : t('pm')}`;
  return localizeDigits(s, lang);
}

// ── Screen ───────────────────────────────────────────────────

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { t, lang, isRTL, setLang } = useI18n();

  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<UserProfile['gender']>('');
  const [goal, setGoal] = useState<GoalKey | ''>('');
  const [activity, setActivity] = useState<ActivityLevel>(0);
  const [experience, setExperience] = useState<ExperienceLevel>('');
  const [heightCm, setHeightCm] = useState(174);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [weightKg, setWeightKg] = useState(80);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [age, setAge] = useState(30);
  const [focus, setFocus] = useState<FocusMuscle[]>([]);
  const [figureSide, setFigureSide] = useState<'front' | 'back'>('front');
  const [days, setDays] = useState(3);
  const [equipment, setEquipment] = useState<EquipmentAccess>('');
  const [reminderTimes, setReminderTimes] = useState<Partial<Record<ReminderDay, string>>>({ 1: DEFAULT_TIME, 3: DEFAULT_TIME, 5: DEFAULT_TIME });
  const [timeEditDay, setTimeEditDay] = useState<ReminderDay | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fg = colors.cardForeground;
  const mt = colors.cardMuted;
  const pr = colors.primary;
  const surf = colors.surface;
  const surf3 = colors.surface3;
  const bord = colors.cardBorder;
  const onPr = colors.onPrimary;
  const cardColors = { fg, muted: mt, accent: pr, surface: surf, border: bord };
  const figureBase = colors.surface3;

  // Pre-fill from an existing profile (re-running onboarding keeps prior answers)
  useEffect(() => {
    loadUserProfile().then((p) => {
      if (p.gender) setGender(p.gender);
      if (p.fitnessGoal) setGoal(p.fitnessGoal);
      if (p.activityLevel) setActivity(p.activityLevel);
      if (p.experienceLevel) setExperience(p.experienceLevel);
      if (Number(p.heightCm) > 0) setHeightCm(Number(p.heightCm));
      if (Number(p.weightKg) > 0) setWeightKg(Number(p.weightKg));
      if (p.heightUnit) setHeightUnit(p.heightUnit);
      if (p.weightUnit) setWeightUnit(p.weightUnit);
      const a = calculateAge(p.dateOfBirth);
      if (a && a >= 13 && a <= 90) setAge(a);
      if (p.focusMuscles?.length) setFocus(p.focusMuscles);
      if (p.trainingDaysPerWeek) setDays(p.trainingDaysPerWeek);
      if (p.equipment) setEquipment(p.equipment);
      if (p.reminders?.enabled && Object.keys(p.reminders.times).length) setReminderTimes(p.reminders.times);
      setName(p.name || user?.name || '');
    });
  }, [user?.name]);

  const current: StepKey = STEPS[step];
  const tx = { textAlign: isRTL ? ('right' as const) : ('left' as const), writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const) };
  const row = { flexDirection: isRTL ? ('row-reverse' as const) : ('row' as const) };
  const bmi = weightKg / Math.pow(heightCm / 100, 2);

  // ── Navigation ────────────────────────────────────────────

  const animateTransition = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const canProceed = useMemo(() => {
    switch (current) {
      case 'gender': return !!gender;
      case 'goal': return !!goal;
      case 'activity': return activity > 0;
      case 'experience': return !!experience;
      case 'equipment': return !!equipment;
      case 'name': return name.trim().length > 0;
      default: return true;
    }
  }, [current, gender, goal, activity, experience, equipment, name]);

  const handleNext = () => {
    if (!canProceed || saving) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length - 1) animateTransition(() => setStep((s) => s + 1));
    else handleComplete();
  };
  const handleBack = () => {
    if (step > 0) animateTransition(() => setStep((s) => s - 1));
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const existing = await loadUserProfile();
      const remindersOn = Object.keys(reminderTimes).length > 0;
      const updated: UserProfile = {
        ...existing,
        name: name.trim() || existing.name || user?.name || '',
        gender: gender || existing.gender,
        heightCm: String(heightCm),
        weightKg: String(weightKg),
        heightUnit,
        weightUnit,
        dateOfBirth: dobFromAge(age),
        fitnessGoal: goal || existing.fitnessGoal,
        activityLevel: activity || existing.activityLevel,
        experienceLevel: experience || existing.experienceLevel,
        focusMuscles: focus,
        trainingDaysPerWeek: days,
        equipment: equipment || existing.equipment,
        reminders: { enabled: remindersOn, times: reminderTimes },
        onboardingCompleted: true,
      };
      await saveUserProfile(updated);
      if (remindersOn && Platform.OS !== 'web') {
        const ok = await notificationService.requestPermissions();
        if (ok) {
          await notificationService.scheduleWorkoutReminders(reminderTimes, {
            title: lang === 'ar' ? 'وقت التمرين 💪' : 'Workout time 💪',
            body: lang === 'ar' ? 'جلستك اليوم جاهزة. يلا نبدأ.' : "Today's session is ready. Let's go.",
          });
        }
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/program-setup');
    } catch (e) {
      console.error('[Onboarding] Save error:', e);
      Alert.alert(t('saveFailedTitle'), t('saveFailedBody'));
    }
    setSaving(false);
  };

  // ── Shared pieces ─────────────────────────────────────────

  const Question = ({ children }: { children: string }) => (
    <View style={{ alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 14 }}>
      {STEP_ICON[current] ? <MaterialCommunityIcons name={STEP_ICON[current]!} size={40} color={fg} /> : null}
      <Text style={[s.question, { color: fg }]}>{children}</Text>
    </View>
  );

  const Hero = ({ figure, height = 190 }: { figure?: FigureKey; height?: number }) =>
    figure ? <FigureHero figure={figure} gender={gender} height={height} accent="#E5533D" base={figureBase} border={bord} /> : null;

  const UnitToggle = <U extends string>({ units, value, onChange }: { units: U[]; value: U; onChange: (u: U) => void }) => (
    <View style={[row, { alignSelf: 'center', backgroundColor: surf3, borderRadius: 12, padding: 3, marginBottom: 8 }]}>
      {units.map((u) => (
        <TouchableOpacity key={u} onPress={() => onChange(u)} style={{ paddingVertical: 8, paddingHorizontal: 22, borderRadius: 10, backgroundColor: value === u ? pr : 'transparent' }}>
          <Text style={{ color: value === u ? onPr : fg, fontWeight: '700', fontSize: 15 }}>{u}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const Checkbox = ({ on }: { on: boolean }) => (
    <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: on ? pr : mt, backgroundColor: on ? pr : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Text style={{ color: onPr, fontSize: 15, fontWeight: '800' }}>✓</Text> : null}
    </View>
  );

  // ── Steps ─────────────────────────────────────────────────

  const renderStep = () => {
    switch (current) {
      case 'language':
        return (
          <View style={s.step}>
            <Hero figure="chest" height={210} />
            <Question>{t('languageTitle')}</Question>
            <View style={[row, { gap: 12 }]}>
              {(['en', 'ar'] as Language[]).map((l) => (
                <OptionCard
                  key={l}
                  variant="tile"
                  label={l === 'en' ? 'English' : 'العربية'}
                  desc={l === 'en' ? 'Left to right' : 'من اليمين إلى اليسار'}
                  icon={<Text style={{ fontSize: 34 }}>{l === 'en' ? '🇬🇧' : '🇪🇬'}</Text>}
                  selected={lang === l}
                  onPress={() => setLang(l)}
                  colors={cardColors}
                  style={{ flex: 1, paddingVertical: 26 }}
                />
              ))}
            </View>
            <Text style={{ color: mt, fontSize: 13, textAlign: 'center', marginTop: 14 }}>{t('languageHint')}</Text>
          </View>
        );

      case 'gender':
        return (
          <View style={s.step}>
            <Hero figure="traps" />
            <Question>{t('genderTitle')}</Question>
            <View style={[row, { gap: 14, flex: 1 }]}>
              {(['female', 'male'] as const).map((g) => (
                <OptionCard
                  key={g}
                  variant="tile"
                  label={t(g)}
                  icon={<FigureHero figure={g} height={Math.min(300, SCREEN_W * 0.62)} accent="#E5533D" base={figureBase} border={bord} />}
                  selected={gender === g}
                  onPress={() => setGender(g)}
                  colors={cardColors}
                  style={{ flex: 1 }}
                />
              ))}
            </View>
          </View>
        );

      case 'goal':
        return (
          <View style={s.step}>
            <Hero figure="biceps" height={170} />
            <Question>{t('goalTitle')}</Question>
            <View style={[row, { flexWrap: 'wrap', gap: 12 }]}>
              {GOALS.map((g) => (
                <OptionCard
                  key={g.key}
                  variant="tile"
                  label={t(`goal_${g.key}` as StringKey)}
                  icon={
                    <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: surf3, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: goal === g.key ? pr : bord }}>
                      <Text style={{ fontSize: 40 }}>{g.emoji}</Text>
                    </View>
                  }
                  selected={goal === g.key}
                  onPress={() => setGoal(g.key)}
                  colors={cardColors}
                  style={{ width: (SCREEN_W - 40 - 12) / 2 }}
                />
              ))}
            </View>
            <View style={{ marginTop: 14 }}>
              <HintBanner text={t('goalHint')} color={mt} bold={fg} bg={surf} />
            </View>
          </View>
        );

      case 'activity':
        return (
          <View style={s.step}>
            <Hero figure="quads" height={170} />
            <Question>{t('activityTitle')}</Question>
            <View style={{ gap: 12 }}>
              {ACTIVITY.map((lvl) => (
                <OptionCard
                  key={lvl}
                  label={t(`activity_${lvl}` as StringKey)}
                  badge={
                    <View style={{ width: 58, height: 58, borderRadius: 14, backgroundColor: activity === lvl ? pr : surf3, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: activity === lvl ? onPr : fg, fontSize: 22, fontWeight: '800', lineHeight: 26 }}>{localizeDigits(lvl, lang)}</Text>
                      <Text style={{ color: activity === lvl ? onPr : mt, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>{t('level')}</Text>
                    </View>
                  }
                  selected={activity === lvl}
                  onPress={() => setActivity(lvl)}
                  colors={cardColors}
                  style={{ borderRadius: 30, paddingVertical: 10 }}
                />
              ))}
            </View>
          </View>
        );

      case 'experience':
        return (
          <View style={s.step}>
            <Hero figure="lats" height={170} />
            <Question>{t('experienceTitle')}</Question>
            <View style={{ gap: 12 }}>
              {EXPERIENCE.map((e) => (
                <OptionCard
                  key={e.key}
                  label={t(`exp_${e.key}` as StringKey)}
                  desc={t(`exp_${e.key}_desc` as StringKey)}
                  icon={<Text style={{ fontSize: 30 }}>{e.emoji}</Text>}
                  selected={experience === e.key}
                  onPress={() => setExperience(e.key)}
                  colors={cardColors}
                />
              ))}
            </View>
            <View style={{ marginTop: 14 }}>
              <HintBanner text={t('experienceHint')} color={mt} bold={fg} bg={surf} />
            </View>
          </View>
        );

      case 'height': {
        const isFt = heightUnit === 'ft';
        const shown = isFt ? fmtFtIn(cmToIn(heightCm)) : `${localizeDigits(heightCm, lang)} ${t('cm')}`;
        return (
          <View style={s.step}>
            <Hero figure="chest" height={150} />
            <Question>{t('heightTitle')}</Question>
            <UnitToggle units={['ft', 'cm']} value={heightUnit} onChange={setHeightUnit} />
            <View style={[row, { flex: 1, alignItems: 'center' }]}>
              {isFt ? (
                <RulerPicker
                  key="ft"
                  orientation="vertical"
                  min={48}
                  max={87}
                  step={1}
                  majorEvery={6}
                  value={cmToIn(heightCm)}
                  onChange={(v) => setHeightCm(inToCm(v))}
                  length={300}
                  thickness={82}
                  accent={pr}
                  tick={mt}
                  label={mt}
                  formatLabel={(v) => fmtFtIn(v)}
                />
              ) : (
                <RulerPicker
                  key="cm"
                  orientation="vertical"
                  min={120}
                  max={220}
                  step={1}
                  majorEvery={10}
                  value={heightCm}
                  onChange={setHeightCm}
                  length={300}
                  thickness={82}
                  accent={pr}
                  tick={mt}
                  label={mt}
                  formatLabel={(v) => localizeDigits(v, lang)}
                />
              )}
              <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Text style={{ color: fg, fontSize: 30, fontWeight: '800' }}>{shown}</Text>
                <FigureHero figure="chest" gender={gender} height={230} accent="#E5533D" base={figureBase} border={bord} />
              </View>
            </View>
          </View>
        );
      }

      case 'weight': {
        const isLb = weightUnit === 'lb';
        const cat = bmiCategory(bmi);
        const hintKey: StringKey = cat === 'bmi_under' ? 'weightHint_under' : cat === 'bmi_normal' ? 'weightHint_normal' : 'weightHint_over';
        const shown = isLb ? `${localizeDigits(kgToLb(weightKg), lang)} ${t('lb')}` : `${localizeDigits(weightKg, lang)} ${t('kg')}`;
        return (
          <View style={s.step}>
            <Hero figure="shoulders" height={150} />
            <Question>{t('weightTitle')}</Question>
            <UnitToggle units={['lb', 'kg']} value={weightUnit} onChange={setWeightUnit} />
            <Text style={{ color: fg, fontSize: 15, textAlign: 'center' }}>{t('bmiLabel')}</Text>
            <Text style={{ color: '#F59E0B', fontSize: 30, fontWeight: '800', textAlign: 'center', marginVertical: 4 }}>{localizeDigits(bmi.toFixed(1), lang)}</Text>
            <HintBanner text={t(hintKey)} color={mt} bold={fg} bg={surf} />
            <View style={{ marginTop: 14 }}>
              <BmiGauge bmi={bmi} fg={fg} muted={mt} />
            </View>
            <View style={{ flex: 1 }} />
            <Text style={{ color: fg, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 }}>{shown}</Text>
            <View style={{ alignItems: 'center' }}>
              {isLb ? (
                <RulerPicker key="lb" orientation="horizontal" min={66} max={440} step={1} majorEvery={5} value={Math.round(kgToLb(weightKg))} onChange={(v) => setWeightKg(lbToKg(v))} length={SCREEN_W - 40} thickness={64} accent={pr} tick={mt} label={mt} formatLabel={(v) => localizeDigits(v, lang)} />
              ) : (
                <RulerPicker key="kg" orientation="horizontal" min={30} max={200} step={0.5} majorEvery={1} value={weightKg} onChange={setWeightKg} length={SCREEN_W - 40} thickness={64} accent={pr} tick={mt} label={mt} formatLabel={(v) => localizeDigits(v, lang)} />
              )}
            </View>
          </View>
        );
      }

      case 'age': {
        const hintKey: StringKey = age < 30 ? 'ageHint_young' : age < 45 ? 'ageHint_prime' : 'ageHint_master';
        return (
          <View style={s.step}>
            <Hero figure="abs" height={170} />
            <Question>{t('ageTitle')}</Question>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <WheelPicker items={AGES} index={AGES.indexOf(age)} onChange={(i) => setAge(AGES[i])} fg={fg} muted={mt} rule={bord} format={(v) => localizeDigits(v, lang)} />
            </View>
            <HintBanner text={t(hintKey)} color={mt} bold={fg} bg={surf} />
          </View>
        );
      }

      case 'focus': {
        const all = focus.length === ALL_FOCUS_MUSCLES.length;
        const toggle = (m: FocusMuscle) => setFocus((f) => (f.includes(m) ? f.filter((x) => x !== m) : [...f, m]));
        const listW = 128;
        return (
          <View style={s.step}>
            <Hero figure="lats" height={150} />
            <Question>{t('focusTitle')}</Question>
            <View style={[row, { flex: 1, gap: 8 }]}>
              <ScrollView style={{ width: listW }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                {ALL_FOCUS_MUSCLES.map((m) => {
                  const on = focus.includes(m);
                  const spec = MUSCLE_SPECS[m];
                  return (
                    <TouchableOpacity key={m} onPress={() => toggle(m)} activeOpacity={0.75} style={[row, { alignItems: 'center', gap: 8 }]}>
                      <View style={{ width: 54, height: 66, borderRadius: 8, borderWidth: 2, borderColor: on ? pr : 'transparent', backgroundColor: surf, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <Body data={spec.slugs.map((slug) => ({ slug, intensity: 1 }))} colors={['#E5533D']} defaultFill={figureBase} defaultStroke={bord} gender={gender === 'female' ? 'female' : 'male'} side={spec.side} scale={0.14} border="none" />
                      </View>
                      <Text style={{ flex: 1, color: on ? pr : fg, fontSize: 13, fontWeight: on ? '700' : '500', ...tx }}>{t(`m_${m}` as StringKey)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ height: 340, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <Body
                    data={slugsForSide(focus, figureSide).map((slug) => ({ slug, intensity: 1 }))}
                    colors={['#E5533D']}
                    defaultFill={figureBase}
                    defaultStroke={bord}
                    gender={gender === 'female' ? 'female' : 'male'}
                    side={figureSide}
                    scale={0.8}
                    border="none"
                    onBodyPartPress={(part) => {
                      const m = ALL_FOCUS_MUSCLES.find((k) => MUSCLE_SPECS[k].slugs.includes(part.slug as any));
                      if (m) toggle(m);
                    }}
                  />
                </View>
              </View>
            </View>
            <View style={[row, { alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }]}>
              <TouchableOpacity onPress={() => setFigureSide((sd) => (sd === 'front' ? 'back' : 'front'))} style={{ backgroundColor: surf3, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                <MaterialCommunityIcons name="rotate-3d-variant" size={20} color={fg} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFocus(all ? [] : [...ALL_FOCUS_MUSCLES])} style={[row, { alignItems: 'center', gap: 8 }]}>
                <Text style={{ color: fg, fontSize: 14 }}>{t('selectAll')}</Text>
                <Checkbox on={all} />
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      case 'frequency': {
        const habit = 1 - ((days - 1) / 6) * 0.55;
        const progress = 0.3 + ((days - 1) / 6) * 0.7;
        const label = days === 1 ? t('timesPerWeek_1') : t('timesPerWeek', { n: localizeDigits(days, lang) });
        return (
          <View style={s.step}>
            <Hero figure="shoulders" height={170} />
            <Question>{t('frequencyTitle')}</Question>
            <View style={{ backgroundColor: surf, borderRadius: 18, padding: 18, gap: 16 }}>
              {[
                { key: 'freq_habit' as StringKey, pct: habit, icon: 'chart-bar' as const },
                { key: 'freq_progress' as StringKey, pct: progress, icon: 'speedometer' as const },
              ].map((b) => (
                <View key={b.key} style={[row, { alignItems: 'center', gap: 12 }]}>
                  <MaterialCommunityIcons name={b.icon} size={26} color={fg} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: fg, fontSize: 13, ...tx }}>{t(b.key)}</Text>
                    <View style={[row, { height: 14, borderRadius: 7, backgroundColor: surf3, overflow: 'hidden' }]}>
                      <View style={{ width: `${b.pct * 100}%`, backgroundColor: pr, borderRadius: 7 }} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <Text style={{ color: fg, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 }}>{label}</Text>
            <DaySlider value={days} onChange={setDays} accent={pr} track={surf3} fill={pr + 'AA'} />
            <View style={{ marginTop: 10 }}>
              <HintBanner text={t('frequencyHint')} color={mt} bold={fg} bg={surf} />
            </View>
          </View>
        );
      }

      case 'equipment':
        return (
          <View style={s.step}>
            <Hero figure="abs" height={170} />
            <Question>{t('equipmentTitle')}</Question>
            <View style={{ gap: 12 }}>
              {EQUIPMENT.map((e) => (
                <OptionCard
                  key={e.key}
                  label={t(`eq_${e.key}` as StringKey)}
                  desc={t(`eq_${e.key}_desc` as StringKey)}
                  icon={<MaterialCommunityIcons name={e.icon} size={40} color={fg} />}
                  selected={equipment === e.key}
                  onPress={() => setEquipment(e.key)}
                  colors={cardColors}
                />
              ))}
            </View>
          </View>
        );

      case 'reminders':
        return (
          <ScrollView style={s.step} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            <Hero figure="neck" height={150} />
            <Question>{t('remindersTitle')}</Question>
            <View style={{ gap: 10 }}>
              {DAYS.map((d) => {
                const on = !!reminderTimes[d.iso];
                return (
                  <OptionCard
                    key={d.iso}
                    label={t(d.key)}
                    icon={<Text style={{ fontSize: 22 }}>{d.emoji}</Text>}
                    selected={on}
                    onPress={() => setReminderTimes((r) => {
                      const next = { ...r };
                      if (on) delete next[d.iso];
                      else next[d.iso] = DEFAULT_TIME;
                      return next;
                    })}
                    colors={cardColors}
                    style={{ paddingVertical: 10 }}
                    trailing={
                      <View style={[row, { alignItems: 'center', gap: 14 }]}>
                        <TouchableOpacity onPress={() => setTimeEditDay(d.iso)} hitSlop={8}>
                          <Text style={{ color: on ? pr : mt, fontSize: 15, textDecorationLine: 'underline' }}>{fmtTime(reminderTimes[d.iso] ?? DEFAULT_TIME, t, lang)}</Text>
                        </TouchableOpacity>
                        <Checkbox on={on} />
                      </View>
                    }
                  />
                );
              })}
            </View>
            <View style={{ marginTop: 12 }}>
              <HintBanner text={t('remindersHint')} color={mt} bold={fg} bg={surf} />
            </View>
          </ScrollView>
        );

      case 'name':
        return (
          <View style={s.step}>
            <Hero figure="neck" height={190} />
            <Question>{t('nameTitle')}</Question>
            <View style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('namePlaceholder')}
                placeholderTextColor={mt}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleNext}
                style={{ color: fg, fontSize: 24, textAlign: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: bord }}
              />
              {name.trim() ? <HintBanner text={t('nameHint', { name: name.trim() })} color={mt} bold={pr} bg={surf} /> : null}
            </View>
          </View>
        );

      case 'summary': {
        const goalLabel = goal ? t(`goal_${goal}` as StringKey) : '';
        const focusLabel = focus.length === 0 || focus.length === ALL_FOCUS_MUSCLES.length ? t('fullBody') : focus.map((m) => t(`m_${m}` as StringKey)).join('، ');
        const equipLabel = equipment ? t(`eq_${equipment}` as StringKey) : '';
        const chartW = SCREEN_W - 40 - 32;
        const chartH = 130;
        // progression curve — rises with small dips, like the reference
        const pts = [0, 0.08, 0.22, 0.18, 0.4, 0.55, 0.5, 0.72, 0.82, 0.78, 1].map((y, i, a) => [(i / (a.length - 1)) * chartW, chartH - 12 - y * (chartH - 30)]);
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const area = `${path} L${chartW},${chartH} L0,${chartH} Z`;
        const [title1, title2] = t('summaryTitle', { goal: '§' }).split('§');
        const rows: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }[] = [
          { icon: 'arm-flex', label: t('summaryGoal'), value: goalLabel },
          { icon: 'target', label: t('summaryFocus'), value: focusLabel },
          { icon: 'dumbbell', label: t('summaryEquipment'), value: equipLabel },
          { icon: 'calendar-check', label: t('summaryDays'), value: `${localizeDigits(days, lang)}${t('perWeek')}` },
        ];
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            <View style={[row, { alignItems: 'center', gap: 14, marginTop: 8 }]}>
              <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: pr, backgroundColor: surf, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <Animated.Image source={require('@/assets/images/logo.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
              </View>
              <Text style={{ flex: 1, color: fg, fontSize: 24, fontWeight: '800', lineHeight: 30, ...tx }}>
                {title1}
                <Text style={{ color: pr }}>{goalLabel}</Text>
                {title2}
              </Text>
            </View>

            <View style={{ backgroundColor: surf, borderRadius: 18, padding: 16, gap: 8 }}>
              <Text style={{ color: fg, fontWeight: '700', fontSize: 15, ...tx }}>{goalLabel}</Text>
              <Svg width={chartW} height={chartH} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
                <Defs>
                  <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={pr} stopOpacity={0.45} />
                    <Stop offset="1" stopColor={pr} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Path d={area} fill="url(#g)" />
                <Path d={path} stroke={pr} strokeWidth={3} fill="none" strokeLinejoin="round" />
                <Line x1={pts[0][0]} y1={pts[0][1]} x2={pts[0][0]} y2={chartH} stroke={bord} strokeDasharray="4 4" />
                <Line x1={chartW} y1={pts[pts.length - 1][1]} x2={chartW} y2={chartH} stroke={bord} strokeDasharray="4 4" />
                <Circle cx={pts[0][0] + 3} cy={pts[0][1]} r={5} fill={pr} />
                <Circle cx={chartW - 3} cy={pts[pts.length - 1][1]} r={5} fill="#fff" stroke={pr} strokeWidth={3} />
              </Svg>
              <View style={[row, { justifyContent: 'space-between' }]}>
                <Text style={{ color: mt, fontSize: 12 }}>{t('start')} · {t('today')}</Text>
                <Text style={{ color: mt, fontSize: 12 }}>{t('end')} · {t('weekN', { n: localizeDigits(8, lang) })}</Text>
              </View>
            </View>

            <View style={[row, { backgroundColor: surf, borderRadius: 18, padding: 16, gap: 12 }]}>
              <View style={{ flex: 1, gap: 14 }}>
                {rows.map((r) => (
                  <View key={r.label} style={[row, { alignItems: 'flex-start', gap: 10 }]}>
                    <MaterialCommunityIcons name={r.icon} size={22} color={pr} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: mt, fontSize: 12, ...tx }}>{r.label}</Text>
                      <Text style={{ color: fg, fontSize: 15, fontWeight: '700', ...tx }}>{r.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                {(['front', 'back'] as const).map((side) => (
                  <View key={side} style={{ height: 190, width: 70, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    <Body data={slugsForSide(focus.length ? focus : ALL_FOCUS_MUSCLES, side).map((slug) => ({ slug, intensity: 1 }))} colors={['#E5533D']} defaultFill={figureBase} defaultStroke={bord} gender={gender === 'female' ? 'female' : 'male'} side={side} scale={0.42} border="none" />
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        );
      }

      default:
        return null;
    }
  };

  // ── Main render ───────────────────────────────────────────

  const isLast = step === STEPS.length - 1;
  const ctaLabel = saving ? t('settingUp') : isLast ? t('startNow') : current === 'name' ? t('finish') : t('continue');
  const editingTime = timeEditDay ? (reminderTimes[timeEditDay] ?? DEFAULT_TIME) : DEFAULT_TIME;
  const [editH, editM] = editingTime.split(':').map(Number);

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.container}>
        <ProgressHeader step={step} total={STEPS.length} accent={pr} track={surf3} fg={fg} onForward={canProceed && !isLast ? handleNext : undefined} />

        <Animated.View style={[s.animatedWrap, { opacity: fadeAnim }]}>{renderStep()}</Animated.View>

        <View style={[s.bottomNav, row]}>
          {step > 0 ? (
            <TouchableOpacity style={[s.backBtn, { borderColor: bord }]} onPress={handleBack} activeOpacity={0.7} accessibilityLabel={t('back')}>
              <Text style={{ color: fg, fontSize: 22 }}>{isRTL ? '→' : '←'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[s.nextBtn, { backgroundColor: canProceed ? pr : bord, opacity: canProceed ? 1 : 0.5 }]}
            onPress={handleNext}
            disabled={!canProceed || saving}
            activeOpacity={0.8}
          >
            <Text style={[s.nextBtnText, { color: onPr }]}>{ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* reminder time picker */}
      <Modal visible={timeEditDay !== null} transparent animationType="fade" onRequestClose={() => setTimeEditDay(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setTimeEditDay(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: surf, borderRadius: 20, padding: 18, gap: 10 }} onStartShouldSetResponder={() => true}>
            <Text style={{ color: fg, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{t('reminderTime')}</Text>
            <View style={[row, { justifyContent: 'center' }]}>
              <WheelPicker
                items={HOURS}
                index={Math.max(0, HOURS.indexOf(editH))}
                onChange={(i) => timeEditDay && setReminderTimes((r) => ({ ...r, [timeEditDay]: `${String(HOURS[i]).padStart(2, '0')}:${String(editM).padStart(2, '0')}` }))}
                fg={fg}
                muted={mt}
                rule={bord}
                width={110}
                format={(h) => localizeDigits(Number(h) % 12 === 0 ? 12 : Number(h) % 12, lang) + (Number(h) < 12 ? ` ${t('am')}` : ` ${t('pm')}`)}
              />
              <WheelPicker
                items={MINUTES}
                index={Math.max(0, MINUTES.indexOf(editM))}
                onChange={(i) => timeEditDay && setReminderTimes((r) => ({ ...r, [timeEditDay]: `${String(editH).padStart(2, '0')}:${String(MINUTES[i]).padStart(2, '0')}` }))}
                fg={fg}
                muted={mt}
                rule={bord}
                width={90}
                format={(m) => localizeDigits(String(m).padStart(2, '0'), lang)}
              />
            </View>
            <TouchableOpacity onPress={() => setTimeEditDay(null)} style={{ backgroundColor: pr, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: onPr, fontWeight: '700', fontSize: 16 }}>{t('done')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  animatedWrap: { flex: 1 },
  step: { flex: 1 },
  question: { fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  bottomNav: { alignItems: 'center', gap: 12, paddingBottom: 20, paddingTop: 12 },
  backBtn: { width: 52, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { fontSize: 17, fontWeight: '700' },
});
