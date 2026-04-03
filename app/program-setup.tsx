// ============================================================
// PROGRAM SETUP SCREEN
// Shown after onboarding — recommends a tailored program based
// on the user's goal, experience, and equipment.
// Includes Zaki AI generation: full custom program via LLM.
// ============================================================
import { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { loadUserProfile } from '@/lib/profile-store';
import {
  findBestTemplate,
  applyProgramTemplate,
  loadCustomProgram,
  PROGRAM_TEMPLATES,
  type ProgramTemplate,
  type CustomProgram,
} from '@/lib/custom-program-store';
import { getRecentSplitWorkouts } from '@/lib/split-workout-store';
import { getAllPRs } from '@/lib/split-workout-store';
import { SESSION_NAMES, SESSION_COLORS } from '@/lib/training-program';
import { trpcClient } from '@/lib/trpc';
import { applyScheduleWithHistory, buildFullSchedule, type DayName } from '@/lib/schedule-store';
import { saveCustomProgram } from '@/lib/custom-program-store';
import type { SessionType } from '@/lib/training-program';

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Zaki AI Questionnaire ─────────────────────────────────────

interface ZakiQuestionnaire {
  daysPerWeek: number;
  weakPoints: string;
  injuryHistory: string;
  preferredExercises: string;
  avoidedExercises: string;
}

const DEFAULT_Q: ZakiQuestionnaire = {
  daysPerWeek: 4,
  weakPoints: '',
  injuryHistory: '',
  preferredExercises: '',
  avoidedExercises: '',
};

// ── Template → CustomProgram adapter ─────────────────────────

function templateToCustomProgram(template: ProgramTemplate): CustomProgram {
  const colorPool = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
  return {
    name: template.name,
    description: template.description,
    sessions: template.sessions,
    sessionNames: template.sessionNames,
    sessionColors: Object.fromEntries(
      Object.keys(template.sessionNames).map((key, i) => [key, colorPool[i % colorPool.length]])
    ),
    weeklySchedule: template.weeklySchedule,
    createdAt: new Date().toISOString(),
    generatedByZaki: false,
    durationWeeks: 4,
  };
}

export default function ProgramSetupScreen() {
  const colors = useColors();
  const router = useRouter();
  const [template, setTemplate] = useState<ProgramTemplate | null>(null);
  const [allTemplates, setAllTemplates] = useState<ProgramTemplate[]>([]);
  const [showBrowse, setShowBrowse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [isChangeMode, setIsChangeMode] = useState(false);
  const [currentProgramName, setCurrentProgramName] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Zaki AI generation
  const [showZakiModal, setShowZakiModal] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<ZakiQuestionnaire>(DEFAULT_Q);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [aiGeneratedProgram, setAiGeneratedProgram] = useState<CustomProgram | null>(null);

  // Refinement loop
  const [refinementFeedback, setRefinementFeedback] = useState('');
  const [refinementRound, setRefinementRound] = useState(0);
  const [refinementHistory, setRefinementHistory] = useState<{ round: number; feedback: string; programName: string }[]>([]);
  const [showRefinementHistory, setShowRefinementHistory] = useState(false);

  const fg = colors.cardForeground;
  const mt = colors.cardMuted;
  const pr = colors.primary;
  const bg = colors.background;
  const surf = colors.surface;
  const bord = colors.cardBorder;
  const succ = colors.success;

  useEffect(() => {
    (async () => {
      const [profile, existingProg] = await Promise.all([
        loadUserProfile(),
        loadCustomProgram(),
      ]);
      setUserProfile(profile);
      if (existingProg) {
        setIsChangeMode(true);
        setCurrentProgramName(existingProg.name);
      }
      const goal = profile.fitnessGoal || 'muscle_gain';
      const exp = profile.experienceLevel || 'intermediate';
      const equip = profile.equipment || 'full_gym';
      const best = findBestTemplate(goal, exp, equip);
      setTemplate(best);
      setAllTemplates(PROGRAM_TEMPLATES);
      setLoading(false);
    })();
  }, []);

  // ── Apply template program ────────────────────────────────

  const handleApply = async () => {
    if (!template) return;
    setApplying(true);
    try {
      await applyProgramTemplate(template);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e) {
      console.error('[ProgramSetup] Apply error:', e);
    }
    setApplying(false);
  };

  // ── Apply AI-generated program ────────────────────────────

  const handleApplyAI = async () => {
    if (!aiGeneratedProgram) return;
    setApplying(true);
    try {
      // Archive existing program
      const existing = await loadCustomProgram();
      if (existing) {
        const { archiveProgram } = await import('@/lib/custom-program-store');
        await archiveProgram(existing);
      }
      await saveCustomProgram(aiGeneratedProgram);
      // Update schedule
      const schedule = buildFullSchedule(
        aiGeneratedProgram.weeklySchedule as Partial<Record<DayName, SessionType>>
      );
      await applyScheduleWithHistory({
        appliedAt: new Date().toISOString(),
        description: `Applied Zaki AI program: ${aiGeneratedProgram.name}`,
        schedule,
        appliedByZaki: true,
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e) {
      console.error('[ProgramSetup] Apply AI error:', e);
    }
    setApplying(false);
  };

  // ── Zaki AI Generation ────────────────────────────────────

  const handleGenerateWithZaki = async () => {
    setGeneratingAI(true);
    setGenerationStatus('Analyzing your training history...');
    try {
      // Gather context
      const [recentWorkouts, allPRs] = await Promise.all([
        getRecentSplitWorkouts(10),
        getAllPRs(),
      ]);

      setGenerationStatus('Building your performance profile...');

      // Format recent workout history
      const workoutHistoryLines = recentWorkouts.slice(0, 5).map(w => {
        const exNames = w.exercises.map(e => e.exerciseName).join(', ');
        return `${w.date} — ${w.sessionType} (${w.durationMinutes ?? '?'}min): ${exNames}`;
      });

      // Format PRs
      const prLines = Object.entries(allPRs).slice(0, 10).map(([name, pr]) =>
        `${name}: ${pr.weight}kg × ${pr.reps} reps (e1RM: ${Math.round(pr.e1rm)}kg)`
      );

      setGenerationStatus('Zaki is designing your custom program...');

      const result = await trpcClient.zaki.generateProgram.mutate({
        goal: userProfile?.fitnessGoal || 'muscle_gain',
        experience: userProfile?.experienceLevel || 'intermediate',
        equipment: userProfile?.equipment || 'full_gym',
        daysPerWeek: questionnaire.daysPerWeek,
        weakPoints: questionnaire.weakPoints,
        injuryHistory: questionnaire.injuryHistory,
        preferredExercises: questionnaire.preferredExercises,
        avoidedExercises: questionnaire.avoidedExercises,
        recentPRs: prLines.join('\n'),
        bodyWeightKg: userProfile?.weightKg || 80,
        heightCm: userProfile?.heightCm || 175,
        age: userProfile?.dateOfBirth
          ? Math.floor((Date.now() - new Date(userProfile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
          : 30,
        recentWorkoutHistory: workoutHistoryLines.join('\n'),
      });

      setGenerationStatus('Program ready!');

      // Convert to CustomProgram format
      const generated = result.program;
      const customProgram: CustomProgram = {
        name: generated.name,
        description: generated.description,
        sessions: Object.fromEntries(
          generated.sessions.map(s => [s.id, s.exercises.map(e => ({
            name: e.name,
            sets: e.sets,
            repsMin: e.repsMin,
            repsMax: e.repsMax,
            restSeconds: e.restSeconds,
            notes: e.notes,
            muscleGroup: e.muscleGroup as 'upper' | 'lower' | 'core',
            bodyPart: e.bodyPart as import('@/lib/types').BodyPart,
            category: e.category as 'compound' | 'isolation',
          }))])
        ),
        sessionNames: Object.fromEntries(generated.sessions.map(s => [s.id, s.name])),
        sessionColors: Object.fromEntries(generated.sessions.map(s => [s.id, s.color])),
        weeklySchedule: generated.weeklySchedule,
        nutritionTargets: generated.nutritionTargets,
        createdAt: new Date().toISOString(),
        generatedByZaki: true,
        durationWeeks: generated.durationWeeks || 4,
      };

      setAiGeneratedProgram(customProgram);
      setRefinementRound(0);
      setRefinementFeedback('');
      setRefinementHistory([]);
      setShowZakiModal(false);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[ProgramSetup] AI generation error:', e);
      setGenerationStatus('Generation failed — please try again');
    }
    setGeneratingAI(false);
  };

  // ── Refinement Loop ───────────────────────────────────────

  const handleRefineProgram = async () => {
    if (!refinementFeedback.trim() || !aiGeneratedProgram) return;
    const round = refinementRound + 1;
    setGeneratingAI(true);
    setGenerationStatus(`Applying your feedback (round ${round})...`);
    try {
      const [recentWorkouts, allPRs] = await Promise.all([
        getRecentSplitWorkouts(10),
        getAllPRs(),
      ]);
      const workoutHistoryLines = recentWorkouts.slice(0, 5).map(w => {
        const exNames = w.exercises.map((e: any) => e.exerciseName).join(', ');
        return `${w.date} — ${w.sessionType} (${w.durationMinutes ?? '?'}min): ${exNames}`;
      });
      const prLines = Object.entries(allPRs).slice(0, 10).map(([name, pr]) =>
        `${name}: ${(pr as any).weight}kg × ${(pr as any).reps} reps`
      );

      setGenerationStatus('Zaki is refining your program...');

      const result = await trpcClient.zaki.generateProgram.mutate({
        goal: userProfile?.fitnessGoal || 'muscle_gain',
        experience: userProfile?.experienceLevel || 'intermediate',
        equipment: userProfile?.equipment || 'full_gym',
        daysPerWeek: questionnaire.daysPerWeek,
        weakPoints: questionnaire.weakPoints,
        injuryHistory: questionnaire.injuryHistory,
        preferredExercises: questionnaire.preferredExercises,
        avoidedExercises: questionnaire.avoidedExercises,
        recentPRs: prLines.join('\n'),
        bodyWeightKg: userProfile?.weightKg || 80,
        heightCm: userProfile?.heightCm || 175,
        age: userProfile?.dateOfBirth
          ? Math.floor((Date.now() - new Date(userProfile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
          : 30,
        recentWorkoutHistory: workoutHistoryLines.join('\n'),
        // Refinement context
        refinementFeedback: refinementFeedback.trim(),
        previousProgramJson: JSON.stringify(aiGeneratedProgram),
        refinementRound: round,
      });

      setGenerationStatus('Program updated!');

      const generated = result.program;
      const customProgram: CustomProgram = {
        name: generated.name,
        description: generated.description,
        sessions: Object.fromEntries(
          generated.sessions.map(s => [s.id, s.exercises.map(e => ({
            name: e.name,
            sets: e.sets,
            repsMin: e.repsMin,
            repsMax: e.repsMax,
            restSeconds: e.restSeconds,
            notes: e.notes,
            muscleGroup: e.muscleGroup as 'upper' | 'lower' | 'core',
            bodyPart: e.bodyPart as import('@/lib/types').BodyPart,
            category: e.category as 'compound' | 'isolation',
          }))])
        ),
        sessionNames: Object.fromEntries(generated.sessions.map(s => [s.id, s.name])),
        sessionColors: Object.fromEntries(generated.sessions.map(s => [s.id, s.color])),
        weeklySchedule: generated.weeklySchedule,
        nutritionTargets: generated.nutritionTargets,
        createdAt: new Date().toISOString(),
        generatedByZaki: true,
        durationWeeks: generated.durationWeeks || 4,
      };

      // Save to refinement history
      setRefinementHistory(prev => [
        ...prev,
        { round, feedback: refinementFeedback.trim(), programName: customProgram.name },
      ]);
      setRefinementRound(round);
      setRefinementFeedback('');
      setAiGeneratedProgram(customProgram);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[ProgramSetup] Refinement error:', e);
      setGenerationStatus('Refinement failed — please try again');
    }
    setGeneratingAI(false);
  };

  const handleSkip = () => {
    if (isChangeMode) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  if (loading) {
    return (
      <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={pr} />
          <Text style={[s.loadingText, { color: mt }]}>Analyzing your profile...</Text>
        </View>
      </ScreenContainer>
    );
  }

  // ── Active program to display (AI or template) ────────────
  const activeProgram: CustomProgram | null = aiGeneratedProgram
    || (template ? templateToCustomProgram(template) : null);

  if (!activeProgram) return null;

  // Build schedule display
  const scheduleRows = DAY_ORDER.map((day, i) => {
    const sessionId = activeProgram.weeklySchedule[day] || 'rest';
    const isRest = sessionId === 'rest';
    const displayName = activeProgram.sessionNames[sessionId]
      || SESSION_NAMES[sessionId as keyof typeof SESSION_NAMES]
      || sessionId;
    const color = activeProgram.sessionColors[sessionId]
      || SESSION_COLORS[sessionId as keyof typeof SESSION_COLORS]
      || '#6B7280';
    return { day: DAY_SHORT[i], sessionId, displayName, isRest, color };
  });

  const trainingDays = scheduleRows.filter(r => !r.isRest).length;

  const sessionSummaries = Object.entries(activeProgram.sessionNames).map(([id, name]) => {
    const exercises = activeProgram.sessions[id] || [];
    const compounds = exercises.filter(e => e.category === 'compound').length;
    const isolations = exercises.filter(e => e.category === 'isolation').length;
    const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
    return { id, name, exerciseCount: exercises.length, compounds, isolations, totalSets };
  });

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          {isChangeMode && (
            <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }} activeOpacity={0.7}>
              <Text style={{ color: pr, fontSize: 15, fontWeight: '600' }}>‹ Back to Profile</Text>
            </TouchableOpacity>
          )}
          <Text style={[s.headerTitle, { color: fg }]}>
            {isChangeMode ? 'Change Program' : 'Your Program'}
          </Text>
          <Text style={[s.headerSubtitle, { color: mt }]}>
            {aiGeneratedProgram
              ? 'Zaki designed this program specifically for you'
              : isChangeMode
              ? `Currently: ${currentProgramName || 'Default Upper/Lower'}. Pick a new program below.`
              : "Based on your goals and experience, here's what Zaki recommends"}
          </Text>
        </View>

        {/* Zaki AI Banner */}
        {!aiGeneratedProgram && (
          <TouchableOpacity
            style={[s.zakiAIBanner, { backgroundColor: pr + '12', borderColor: pr + '40' }]}
            onPress={() => setShowZakiModal(true)}
            activeOpacity={0.85}
          >
            <View style={s.zakiAILeft}>
              <Text style={s.zakiAIEmoji}>🤖</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.zakiAITitle, { color: pr }]}>Let Zaki Build My Program</Text>
                <Text style={[s.zakiAISub, { color: mt }]}>
                  Custom exercises based on your weak points, injuries & preferences
                </Text>
              </View>
            </View>
            <Text style={{ color: pr, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        )}

        {/* AI Generated Badge */}
        {aiGeneratedProgram && (
          <View style={[s.aiBadge, { backgroundColor: '#22C55E15', borderColor: '#22C55E40' }]}>
            <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '700' }}>
              🤖 Zaki-Generated Program
            </Text>
            <TouchableOpacity onPress={() => setAiGeneratedProgram(null)} activeOpacity={0.7}>
              <Text style={{ color: mt, fontSize: 12 }}>Use template instead</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Program Card */}
        <View style={[s.programCard, { backgroundColor: surf, borderColor: bord }]}>
          <View style={s.programHeader}>
            <Text style={[s.programName, { color: fg }]}>{activeProgram.name}</Text>
            <View style={[s.badge, { backgroundColor: pr + '20' }]}>
              <Text style={[s.badgeText, { color: pr }]}>{trainingDays}x/week</Text>
            </View>
          </View>
          <Text style={[s.programDesc, { color: mt }]}>{activeProgram.description}</Text>
        </View>

        {/* Weekly Schedule */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: fg }]}>Weekly Schedule</Text>
          <View style={[s.scheduleCard, { backgroundColor: surf, borderColor: bord }]}>
            {scheduleRows.map((row, i) => (
              <View
                key={row.day}
                style={[
                  s.scheduleRow,
                  i < scheduleRows.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: bord },
                ]}
              >
                <Text style={[s.scheduleDay, { color: mt }]}>{row.day}</Text>
                {row.isRest ? (
                  <Text style={[s.scheduleSession, { color: mt, fontStyle: 'italic' }]}>Rest</Text>
                ) : (
                  <View style={s.scheduleSessionWrap}>
                    <View style={[s.sessionDot, { backgroundColor: row.color }]} />
                    <Text style={[s.scheduleSession, { color: fg }]}>{row.displayName}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Session Breakdown */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: fg }]}>Session Breakdown</Text>
          {sessionSummaries.map(sess => (
            <View key={sess.id} style={[s.sessionCard, { backgroundColor: surf, borderColor: bord }]}>
              <Text style={[s.sessionName, { color: fg }]}>{sess.name}</Text>
              <View style={s.sessionStats}>
                <View style={s.stat}>
                  <Text style={[s.statNum, { color: pr }]}>{sess.exerciseCount}</Text>
                  <Text style={[s.statLabel, { color: mt }]}>exercises</Text>
                </View>
                <View style={s.stat}>
                  <Text style={[s.statNum, { color: pr }]}>{sess.totalSets}</Text>
                  <Text style={[s.statLabel, { color: mt }]}>total sets</Text>
                </View>
                <View style={s.stat}>
                  <Text style={[s.statNum, { color: pr }]}>{sess.compounds}</Text>
                  <Text style={[s.statLabel, { color: mt }]}>compound</Text>
                </View>
                <View style={s.stat}>
                  <Text style={[s.statNum, { color: pr }]}>{sess.isolations}</Text>
                  <Text style={[s.statLabel, { color: mt }]}>isolation</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Zaki Note */}
        <View style={[s.zakiNote, { backgroundColor: pr + '10', borderColor: pr + '30' }]}>
          <Text style={[s.zakiNoteTitle, { color: pr }]}>Zaki says</Text>
          <Text style={[s.zakiNoteText, { color: fg }]}>
            {aiGeneratedProgram
              ? `This program was built specifically for you. ${(aiGeneratedProgram as any).zakiNotes || 'Train hard, recover well, and ask me anytime to adjust.'}`
              : 'This program is your starting point. As you train, I\'ll learn your strengths and weaknesses. Ask me anytime to adjust exercises, add cardio sessions, or change the schedule.'}
          </Text>
        </View>

        {/* ── Refinement Loop (shown only after AI generation) ── */}
        {aiGeneratedProgram && (
          <View style={[s.refinementCard, { backgroundColor: surf, borderColor: bord }]}>
            <View style={s.refinementHeader}>
              <Text style={[s.refinementTitle, { color: fg }]}>🔄 Refine This Program</Text>
              {refinementHistory.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowRefinementHistory(!showRefinementHistory)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: pr, fontSize: 12 }}>
                    {showRefinementHistory ? 'Hide history' : `${refinementHistory.length} revision${refinementHistory.length > 1 ? 's' : ''}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Revision history */}
            {showRefinementHistory && refinementHistory.map((h, i) => (
              <View key={i} style={[s.revisionRow, { borderColor: bord }]}>
                <Text style={{ color: pr, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>Round {h.round}</Text>
                <Text style={{ color: mt, fontSize: 12 }}>Feedback: "{h.feedback}"</Text>
                <Text style={{ color: fg, fontSize: 12, marginTop: 2 }}>→ {h.programName}</Text>
              </View>
            ))}

            <Text style={[s.refinementHint, { color: mt }]}>
              Tell Zaki what to change. Be specific — e.g. "make it 3 days/week", "replace squats with leg press", "add more chest volume"
            </Text>

            {generatingAI ? (
              <View style={{ alignItems: 'center', paddingVertical: 20, gap: 12 }}>
                <ActivityIndicator size="small" color={pr} />
                <Text style={{ color: mt, fontSize: 13, textAlign: 'center' }}>{generationStatus}</Text>
              </View>
            ) : (
              <View style={s.refinementInputRow}>
                <TextInput
                  style={[s.refinementInput, { backgroundColor: colors.background, borderColor: bord, color: fg }]}
                  value={refinementFeedback}
                  onChangeText={setRefinementFeedback}
                  placeholder="e.g. make it 3 days/week, add more back work..."
                  placeholderTextColor={mt}
                  multiline
                  numberOfLines={2}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[s.refinementBtn, {
                    backgroundColor: refinementFeedback.trim() ? pr : bord,
                    opacity: refinementFeedback.trim() ? 1 : 0.5,
                  }]}
                  onPress={handleRefineProgram}
                  disabled={!refinementFeedback.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Apply</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Quick suggestion chips */}
            {!generatingAI && (
              <View style={s.chipRow}>
                {[
                  'Make it 3 days/week',
                  'Add more volume',
                  'Less exercises per session',
                  'More compound movements',
                  'Add cardio day',
                ].map(chip => (
                  <TouchableOpacity
                    key={chip}
                    style={[s.chip, { backgroundColor: pr + '15', borderColor: pr + '40' }]}
                    onPress={() => setRefinementFeedback(chip)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: pr, fontSize: 11 }}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.applyBtn, { backgroundColor: aiGeneratedProgram ? '#22C55E' : pr }]}
            onPress={aiGeneratedProgram ? handleApplyAI : handleApply}
            disabled={applying}
            activeOpacity={0.8}
          >
            {applying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.applyBtnText}>
                {aiGeneratedProgram
                  ? '🤖 Start Zaki\'s Program'
                  : isChangeMode ? 'Switch to This Program' : 'Start This Program'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Browse All Programs */}
          {!aiGeneratedProgram && (
            <>
              <TouchableOpacity
                style={[s.skipBtn, { borderColor: pr, marginBottom: 4 }]}
                onPress={() => setShowBrowse(!showBrowse)}
                activeOpacity={0.7}
              >
                <Text style={[s.skipBtnText, { color: pr }]}>
                  {showBrowse ? 'Hide Other Programs' : 'Browse All Programs'}
                </Text>
              </TouchableOpacity>

              {showBrowse && allTemplates.filter(t => t.id !== template?.id).map(t => {
                const tDays = Object.values(t.weeklySchedule).filter(s => s !== 'rest').length;
                const isCurrent = t.name === currentProgramName;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.sessionCard, {
                      backgroundColor: isCurrent ? pr + '08' : surf,
                      borderColor: isCurrent ? pr : bord,
                      marginBottom: 8,
                    }]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTemplate(t);
                      setShowBrowse(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={[s.sessionName, { color: fg, marginBottom: 0, flex: 1 }]}>{t.name}</Text>
                      <View style={[s.badge, { backgroundColor: pr + '20' }]}>
                        <Text style={[s.badgeText, { color: pr }]}>{tDays}x/week</Text>
                      </View>
                    </View>
                    <Text style={{ color: mt, fontSize: 13, lineHeight: 18 }}>{t.description}</Text>
                    {isCurrent && (
                      <Text style={{ color: pr, fontSize: 11, fontWeight: '700', marginTop: 6 }}>CURRENT PROGRAM</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <TouchableOpacity
            style={[s.skipBtn, { borderColor: bord }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[s.skipBtnText, { color: mt }]}>
              {isChangeMode ? 'Keep Current Program' : "Skip — I'll set up later"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Zaki AI Questionnaire Modal ── */}
      <Modal
        visible={showZakiModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !generatingAI && setShowZakiModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: bg }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                <Text style={{ color: fg, fontSize: 22, fontWeight: '700' }}>🤖 Zaki's Program Builder</Text>
                <Text style={{ color: mt, fontSize: 14, marginTop: 4 }}>
                  Answer a few questions for a fully custom program
                </Text>
              </View>
              {!generatingAI && (
                <TouchableOpacity onPress={() => setShowZakiModal(false)} activeOpacity={0.7}>
                  <Text style={{ color: mt, fontSize: 28, lineHeight: 32 }}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            {generatingAI ? (
              <View style={{ alignItems: 'center', paddingVertical: 60, gap: 20 }}>
                <ActivityIndicator size="large" color={pr} />
                <Text style={{ color: fg, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
                  {generationStatus}
                </Text>
                <Text style={{ color: mt, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                  Zaki is analyzing your training history and designing a program tailored to your body and goals...
                </Text>
              </View>
            ) : (
              <>
                {/* Days per week */}
                <View style={s.qSection}>
                  <Text style={[s.qLabel, { color: fg }]}>How many days can you train per week?</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    {[2, 3, 4, 5, 6].map(d => (
                      <TouchableOpacity
                        key={d}
                        style={[s.dayChip, {
                          backgroundColor: questionnaire.daysPerWeek === d ? pr : surf,
                          borderColor: questionnaire.daysPerWeek === d ? pr : bord,
                        }]}
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setQuestionnaire(q => ({ ...q, daysPerWeek: d }));
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: questionnaire.daysPerWeek === d ? '#fff' : fg, fontWeight: '600' }}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Weak points */}
                <View style={s.qSection}>
                  <Text style={[s.qLabel, { color: fg }]}>What are your weak points or lagging muscle groups?</Text>
                  <Text style={[s.qHint, { color: mt }]}>e.g. "Chest is lagging, arms are weak, poor shoulder mobility"</Text>
                  <TextInput
                    style={[s.qInput, { backgroundColor: surf, borderColor: bord, color: fg }]}
                    value={questionnaire.weakPoints}
                    onChangeText={v => setQuestionnaire(q => ({ ...q, weakPoints: v }))}
                    placeholder="Your weak points..."
                    placeholderTextColor={mt}
                    multiline
                    numberOfLines={2}
                    returnKeyType="done"
                  />
                </View>

                {/* Injury history */}
                <View style={s.qSection}>
                  <Text style={[s.qLabel, { color: fg }]}>Any injuries or areas to avoid?</Text>
                  <Text style={[s.qHint, { color: mt }]}>e.g. "Left shoulder impingement, lower back pain"</Text>
                  <TextInput
                    style={[s.qInput, { backgroundColor: surf, borderColor: bord, color: fg }]}
                    value={questionnaire.injuryHistory}
                    onChangeText={v => setQuestionnaire(q => ({ ...q, injuryHistory: v }))}
                    placeholder="Injuries or limitations (or leave blank)..."
                    placeholderTextColor={mt}
                    multiline
                    numberOfLines={2}
                    returnKeyType="done"
                  />
                </View>

                {/* Preferred exercises */}
                <View style={s.qSection}>
                  <Text style={[s.qLabel, { color: fg }]}>Exercises you enjoy or want included?</Text>
                  <Text style={[s.qHint, { color: mt }]}>e.g. "Love deadlifts and pull-ups, want more back work"</Text>
                  <TextInput
                    style={[s.qInput, { backgroundColor: surf, borderColor: bord, color: fg }]}
                    value={questionnaire.preferredExercises}
                    onChangeText={v => setQuestionnaire(q => ({ ...q, preferredExercises: v }))}
                    placeholder="Preferred exercises (or leave blank)..."
                    placeholderTextColor={mt}
                    multiline
                    numberOfLines={2}
                    returnKeyType="done"
                  />
                </View>

                {/* Avoided exercises */}
                <View style={s.qSection}>
                  <Text style={[s.qLabel, { color: fg }]}>Exercises to avoid?</Text>
                  <Text style={[s.qHint, { color: mt }]}>e.g. "No barbell squats, avoid overhead pressing"</Text>
                  <TextInput
                    style={[s.qInput, { backgroundColor: surf, borderColor: bord, color: fg }]}
                    value={questionnaire.avoidedExercises}
                    onChangeText={v => setQuestionnaire(q => ({ ...q, avoidedExercises: v }))}
                    placeholder="Exercises to avoid (or leave blank)..."
                    placeholderTextColor={mt}
                    multiline
                    numberOfLines={2}
                    returnKeyType="done"
                  />
                </View>

                {/* Generate button */}
                <TouchableOpacity
                  style={[s.applyBtn, { backgroundColor: pr, marginTop: 8 }]}
                  onPress={handleGenerateWithZaki}
                  activeOpacity={0.85}
                >
                  <Text style={s.applyBtnText}>🤖 Generate My Program</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ alignItems: 'center', marginTop: 16 }}
                  onPress={() => setShowZakiModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: mt, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  zakiAIBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zakiAILeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  zakiAIEmoji: {
    fontSize: 28,
  },
  zakiAITitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  zakiAISub: {
    fontSize: 13,
    lineHeight: 18,
  },
  aiBadge: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  programCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  programName: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  programDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  scheduleCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scheduleDay: {
    fontSize: 14,
    fontWeight: '500',
    width: 40,
  },
  scheduleSessionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scheduleSession: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  zakiNote: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  zakiNoteTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  zakiNoteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
    paddingBottom: 20,
  },
  applyBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 15,
  },
  // Questionnaire styles
  qSection: {
    marginBottom: 24,
  },
  qLabel: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 4,
  },
  qHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  qInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Refinement loop styles
  refinementCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  refinementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refinementTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  refinementHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  refinementInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  refinementInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  refinementBtn: {
    height: 52,
    width: 64,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  revisionRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
});
