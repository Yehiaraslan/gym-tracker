// ============================================================
// PROGRAM SETUP SCREEN
// Shown after onboarding — recommends a tailored program based
// on the user's goal, experience, and equipment.
// ============================================================
import { useState, useEffect } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { loadUserProfile } from '@/lib/profile-store';
import {
  findBestTemplate,
  applyProgramTemplate,
  type ProgramTemplate,
} from '@/lib/custom-program-store';
import { SESSION_NAMES, SESSION_COLORS } from '@/lib/training-program';

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ProgramSetupScreen() {
  const colors = useColors();
  const router = useRouter();

  const [template, setTemplate] = useState<ProgramTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const fg = colors.foreground;
  const mt = colors.muted;
  const pr = colors.primary;
  const bg = colors.background;
  const surf = colors.surface;
  const bord = colors.border;
  const succ = colors.success;

  useEffect(() => {
    (async () => {
      const profile = await loadUserProfile();
      const goal = profile.fitnessGoal || 'muscle_gain';
      const exp = profile.experienceLevel || 'intermediate';
      const equip = profile.equipment || 'full_gym';
      const best = findBestTemplate(goal, exp, equip);
      setTemplate(best);
      setLoading(false);
    })();
  }, []);

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

  const handleSkip = () => {
    // Skip program setup — use default Upper/Lower
    router.replace('/(tabs)');
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

  if (!template) return null;

  // Build schedule display
  const scheduleRows = DAY_ORDER.map((day, i) => {
    const sessionId = template.weeklySchedule[day] || 'rest';
    const isRest = sessionId === 'rest';
    const displayName = template.sessionNames[sessionId] || SESSION_NAMES[sessionId as keyof typeof SESSION_NAMES] || sessionId;
    const color = template.sessions[sessionId]
      ? ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'][Object.keys(template.sessionNames).indexOf(sessionId) % 6]
      : SESSION_COLORS[sessionId as keyof typeof SESSION_COLORS] || '#6B7280';
    return { day: DAY_SHORT[i], sessionId, displayName, isRest, color };
  });

  // Count training days
  const trainingDays = scheduleRows.filter(r => !r.isRest).length;

  // Count total exercises per session
  const sessionSummaries = Object.entries(template.sessionNames).map(([id, name]) => {
    const exercises = template.sessions[id] || [];
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
          <Text style={[s.headerTitle, { color: fg }]}>Your Program</Text>
          <Text style={[s.headerSubtitle, { color: mt }]}>
            Based on your goals and experience, here's what Zaki recommends
          </Text>
        </View>

        {/* Program Card */}
        <View style={[s.programCard, { backgroundColor: surf, borderColor: bord }]}>
          <View style={s.programHeader}>
            <Text style={[s.programName, { color: fg }]}>{template.name}</Text>
            <View style={[s.badge, { backgroundColor: pr + '20' }]}>
              <Text style={[s.badgeText, { color: pr }]}>{trainingDays}x/week</Text>
            </View>
          </View>
          <Text style={[s.programDesc, { color: mt }]}>{template.description}</Text>
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
            This program is your starting point. As you train, I'll learn your strengths and weaknesses.
            Ask me anytime to adjust exercises, add cardio sessions, or change the schedule.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.applyBtn, { backgroundColor: pr }]}
            onPress={handleApply}
            disabled={applying}
            activeOpacity={0.8}
          >
            {applying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.applyBtnText}>Start This Program</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.skipBtn, { borderColor: bord }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[s.skipBtnText, { color: mt }]}>Skip — I'll set up later</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
});
