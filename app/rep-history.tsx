// REP HISTORY SCREEN
// Shows per-exercise timeline of weight, reps, estimated 1RM, and AI form scores.
// Accessible from the Exercise Library card and from the active Workout exercise row.
// ============================================================
import { useEffect, useState, useMemo } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import {
  getExerciseHistory,
  getFormCoachHistory,
  type ExerciseSetEntry,
  type FormCoachSession,
} from '@/lib/split-workout-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48; // 24px padding each side
const CHART_HEIGHT = 140;

// ── Tiny SVG-less sparkline using absolute-positioned Views ──────────────────
function MiniChart({
  data,
  color,
  label,
}: {
  data: { date: string; value: number }[];
  color: string;
  label: string;
}) {
  const colors = useColors();
  if (data.length < 2) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * CHART_WIDTH,
    y: CHART_HEIGHT - ((d.value - min) / range) * (CHART_HEIGHT - 20) - 10,
    value: d.value,
    date: d.date,
  }));

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[s.chartLabel, { color: colors.muted }]}>{label}</Text>
      <View style={[s.chartContainer, { backgroundColor: colors.surface }]}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(pct => (
          <View
            key={pct}
            style={[
              s.gridLine,
              {
                top: CHART_HEIGHT * (1 - pct),
                borderColor: colors.border,
              },
            ]}
          />
        ))}

        {/* Connecting lines between dots */}
        {pts.slice(0, -1).map((pt, i) => {
          const next = pts[i + 1];
          const dx = next.x - pt.x;
          const dy = next.y - pt.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: pt.x,
                top: pt.y,
                width: length,
                height: 2,
                backgroundColor: color + '66',
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: '0 50%',
              }}
            />
          );
        })}

        {/* Dots */}
        {pts.map((pt, i) => (
          <View
            key={i}
            style={[
              s.dot,
              {
                left: pt.x - 5,
                top: pt.y - 5,
                backgroundColor: color,
                borderColor: colors.background,
              },
            ]}
          />
        ))}

        {/* Y-axis labels */}
        <Text style={[s.yMax, { color: colors.muted }]}>{max.toFixed(1)}</Text>
        <Text style={[s.yMin, { color: colors.muted }]}>{min.toFixed(1)}</Text>
      </View>
    </View>
  );
}

// ── Grade badge ──────────────────────────────────────────────
function GradeBadge({ grade, score }: { grade: string; score: number }) {
  const color =
    score >= 85 ? '#4ADE80' :
    score >= 70 ? '#60A5FA' :
    score >= 55 ? '#FBBF24' :
    '#F87171';
  return (
    <View style={[s.gradeBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[s.gradeText, { color }]}>{grade}</Text>
      <Text style={[s.scoreText, { color }]}>{score}</Text>
    </View>
  );
}

// ── Session card ─────────────────────────────────────────────
function WorkoutSessionCard({
  entry,
  isFirst,
  isPR,
}: {
  entry: ExerciseSetEntry;
  isFirst: boolean;
  isPR: boolean;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(isFirst);

  const workingSets = entry.sets.filter(s => !s.isWarmup && s.weightKg > 0 && s.reps > 0);
  const warmupSets = entry.sets.filter(s => s.isWarmup);

  const sessionLabel: Record<string, string> = {
    'upper-a': 'Upper A',
    'upper-b': 'Upper B',
    'lower-a': 'Lower A',
    'lower-b': 'Lower B',
    rest: 'Rest',
  };

  return (
    <TouchableOpacity
      style={[s.sessionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        setExpanded(e => !e);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={s.sessionHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sessionDate, { color: colors.foreground }]}>
              {formatDisplayDate(entry.date)}
            </Text>
            {isPR && (
              <View style={s.prBadge}>
                <Text style={s.prBadgeText}>🏆 PR</Text>
              </View>
            )}
          </View>
          <Text style={[s.sessionType, { color: colors.muted }]}>
            {sessionLabel[entry.sessionType] ?? entry.sessionType}
          </Text>
        </View>

        {/* Key stats */}
        <View style={s.sessionStats}>
          <View style={s.statPill}>
            <Text style={[s.statValue, { color: colors.primary }]}>
              {entry.bestWeightKg} kg
            </Text>
            <Text style={[s.statLabel, { color: colors.muted }]}>Best</Text>
          </View>
          <View style={s.statPill}>
            <Text style={[s.statValue, { color: colors.foreground }]}>
              {entry.totalReps}
            </Text>
            <Text style={[s.statLabel, { color: colors.muted }]}>Reps</Text>
          </View>
          <View style={s.statPill}>
            <Text style={[s.statValue, { color: '#A78BFA' }]}>
              {entry.e1rm}
            </Text>
            <Text style={[s.statLabel, { color: colors.muted }]}>e1RM</Text>
          </View>
        </View>

        <Text style={[s.chevron, { color: colors.muted }]}>{expanded ? '▼' : '›'}</Text>
      </View>

      {/* Expanded set breakdown */}
      {expanded && (
        <View style={[s.setBreakdown, { borderTopColor: colors.border }]}>
          {warmupSets.length > 0 && (
            <Text style={[s.warmupLabel, { color: colors.muted }]}>
              Warm-up: {warmupSets.map(s => `${s.weightKg}×${s.reps}`).join('  ')}
            </Text>
          )}
          {workingSets.map((set, i) => {
            const e1rm = set.weightKg > 0 && set.reps > 0
              ? (set.weightKg * (1 + set.reps / 30)).toFixed(1)
              : '—';
            return (
              <View key={i} style={s.setRow}>
                <Text style={[s.setNum, { color: colors.muted }]}>Set {set.setNumber}</Text>
                <Text style={[s.setWeight, { color: colors.foreground }]}>
                  {set.weightKg} kg × {set.reps} reps
                </Text>
                <Text style={[s.setE1rm, { color: '#A78BFA' }]}>
                  ~{e1rm} kg 1RM
                </Text>
                {set.rpe != null && (
                  <Text style={[s.setRpe, { color: colors.muted }]}>RPE {set.rpe}</Text>
                )}
              </View>
            );
          })}
          <View style={s.volumeRow}>
            <Text style={[s.volumeLabel, { color: colors.muted }]}>Session volume</Text>
            <Text style={[s.volumeValue, { color: colors.foreground }]}>
              {entry.totalVolume.toLocaleString()} kg
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Form coach session card ───────────────────────────────────
function FormCoachCard({ session }: { session: FormCoachSession }) {
  const colors = useColors();
  return (
    <View style={[s.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.formCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.sessionDate, { color: colors.foreground }]}>
            {formatDisplayDate(session.date)}
          </Text>
          <Text style={[s.sessionType, { color: colors.muted }]}>AI Form Coach</Text>
        </View>
        <GradeBadge grade={session.grade} score={session.formScore} />
        <View style={s.statPill}>
          <Text style={[s.statValue, { color: colors.foreground }]}>{session.reps}</Text>
          <Text style={[s.statLabel, { color: colors.muted }]}>Reps</Text>
        </View>
      </View>
      {session.topIssues.length > 0 && (
        <View style={s.issueList}>
          {session.topIssues.slice(0, 2).map((issue, i) => (
            <Text key={i} style={[s.issueText, { color: colors.muted }]}>• {issue}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Main screen ───────────────────────────────────────────────
type TabId = 'weight' | 'form';

export default function RepHistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ exercise: string; exerciseType?: string }>();
  const exerciseName = params.exercise ?? '';
  const exerciseType = params.exerciseType ?? '';

  const [loading, setLoading] = useState(true);
  const [weightHistory, setWeightHistory] = useState<ExerciseSetEntry[]>([]);
  const [formHistory, setFormHistory] = useState<FormCoachSession[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('weight');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [wh, fh] = await Promise.all([
        getExerciseHistory(exerciseName, 30),
        exerciseType ? getFormCoachHistory(exerciseType, 30) : Promise.resolve([]),
      ]);
      if (mounted) {
        setWeightHistory(wh);
        setFormHistory(fh);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [exerciseName, exerciseType]);

  // Build chart data
  const e1rmChartData = useMemo(
    () =>
      weightHistory
        .slice()
        .reverse()
        .map(e => ({ date: e.date, value: e.e1rm })),
    [weightHistory],
  );

  const weightChartData = useMemo(
    () =>
      weightHistory
        .slice()
        .reverse()
        .map(e => ({ date: e.date, value: e.bestWeightKg })),
    [weightHistory],
  );

  const volumeChartData = useMemo(
    () =>
      weightHistory
        .slice()
        .reverse()
        .map(e => ({ date: e.date, value: e.totalVolume })),
    [weightHistory],
  );

  const formScoreChartData = useMemo(
    () =>
      formHistory
        .slice()
        .reverse()
        .map(f => ({ date: f.date, value: f.formScore })),
    [formHistory],
  );

  // Summary stats
  const bestE1RM = weightHistory.length > 0 ? Math.max(...weightHistory.map(e => e.e1rm)) : 0;
  const bestWeight = weightHistory.length > 0 ? Math.max(...weightHistory.map(e => e.bestWeightKg)) : 0;
  const avgFormScore =
    formHistory.length > 0
      ? Math.round(formHistory.reduce((sum, f) => sum + f.formScore, 0) / formHistory.length)
      : null;

  const hasWeightData = weightHistory.length > 0;
  const hasFormData = formHistory.length > 0;

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Nav header */}
      <View style={[s.navHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[s.backArrow, { color: colors.primary }]}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.navTitle, { color: colors.foreground }]} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text style={[s.navSubtitle, { color: colors.muted }]}>Rep History</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[s.loadingText, { color: colors.muted }]}>Loading history…</Text>
          </View>
        ) : (
          <>
            {/* Summary stats row */}
            {(hasWeightData || hasFormData) && (
              <View style={[s.summaryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {hasWeightData && (
                  <>
                    <View style={s.summaryItem}>
                      <Text style={[s.summaryValue, { color: colors.primary }]}>
                        {bestWeight} kg
                      </Text>
                      <Text style={[s.summaryLabel, { color: colors.muted }]}>Best Weight</Text>
                    </View>
                    <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={s.summaryItem}>
                      <Text style={[s.summaryValue, { color: '#A78BFA' }]}>
                        {bestE1RM} kg
                      </Text>
                      <Text style={[s.summaryLabel, { color: colors.muted }]}>Best e1RM</Text>
                    </View>
                    <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={s.summaryItem}>
                      <Text style={[s.summaryValue, { color: colors.foreground }]}>
                        {weightHistory.length}
                      </Text>
                      <Text style={[s.summaryLabel, { color: colors.muted }]}>Sessions</Text>
                    </View>
                  </>
                )}
                {hasFormData && hasWeightData && (
                  <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
                )}
                {hasFormData && (
                  <View style={s.summaryItem}>
                    <Text style={[s.summaryValue, { color: '#4ADE80' }]}>
                      {avgFormScore}
                    </Text>
                    <Text style={[s.summaryLabel, { color: colors.muted }]}>Avg Form</Text>
                  </View>
                )}
              </View>
            )}

            {/* Tab switcher */}
            {hasWeightData && hasFormData && (
              <View style={[s.tabBar, { backgroundColor: colors.surface }]}>
                {(['weight', 'form'] as TabId[]).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      s.tabBtn,
                      activeTab === tab && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => {
                      setActiveTab(tab);
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text
                      style={[
                        s.tabText,
                        { color: activeTab === tab ? '#fff' : colors.muted },
                      ]}
                    >
                      {tab === 'weight' ? '🏋️ Weight & Reps' : '🤖 Form Scores'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Weight & Reps tab */}
            {(activeTab === 'weight' || !hasFormData) && (
              <>
                {/* Charts */}
                {e1rmChartData.length >= 2 && (
                  <View style={s.chartsSection}>
                    <MiniChart
                      data={e1rmChartData}
                      color="#A78BFA"
                      label="Estimated 1RM (kg)"
                    />
                    <MiniChart
                      data={weightChartData}
                      color={colors.primary}
                      label="Best Set Weight (kg)"
                    />
                    <MiniChart
                      data={volumeChartData}
                      color="#F59E0B"
                      label="Session Volume (kg total)"
                    />
                  </View>
                )}

                {/* Session list */}
                {hasWeightData ? (
                  <>
                    <Text style={[s.sectionTitle, { color: colors.muted }]}>
                      SESSION HISTORY ({weightHistory.length})
                    </Text>
                    {weightHistory.map((entry, i) => (
                      <WorkoutSessionCard key={entry.date + i} entry={entry} isFirst={i === 0} isPR={entry.e1rm === bestE1RM && bestE1RM > 0} />
                    ))}
                  </>
                ) : (
                  <EmptyState
                    icon="🏋️"
                    title="No weight history yet"
                    subtitle={`Complete a workout that includes ${exerciseName} to start tracking progress.`}
                    color={colors.muted}
                    fg={colors.foreground}
                  />
                )}
              </>
            )}

            {/* Form Scores tab */}
            {activeTab === 'form' && (
              <>
                {formScoreChartData.length >= 2 && (
                  <View style={s.chartsSection}>
                    <MiniChart
                      data={formScoreChartData}
                      color="#4ADE80"
                      label="Form Score (0–100)"
                    />
                  </View>
                )}

                {hasFormData ? (
                  <>
                    <Text style={[s.sectionTitle, { color: colors.muted }]}>
                      COACHING SESSIONS ({formHistory.length})
                    </Text>
                    {formHistory.map((session, i) => (
                      <FormCoachCard key={session.id + i} session={session} />
                    ))}
                  </>
                ) : (
                  <EmptyState
                    icon="🤖"
                    title="No form sessions yet"
                    subtitle="Use the AI Form Coach to track your form score over time."
                    color={colors.muted}
                    fg={colors.foreground}
                  />
                )}
              </>
            )}

            {/* If no data at all */}
            {!hasWeightData && !hasFormData && !loading && (
              <EmptyState
                icon="📊"
                title="No history yet"
                subtitle={`Log a workout with ${exerciseName} to start building your history.`}
                color={colors.muted}
                fg={colors.foreground}
              />
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  color,
  fg,
}: {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  fg: string;
}) {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={[s.emptyTitle, { color: fg }]}>{title}</Text>
      <Text style={[s.emptySubtitle, { color }]}>{subtitle}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  backBtn: { paddingRight: 4 },
  backArrow: { fontSize: 32, lineHeight: 36, fontWeight: '300' },
  navTitle: { fontSize: 18, fontWeight: '700' },
  navSubtitle: { fontSize: 12, marginTop: 1 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  loadingText: { marginTop: 12, fontSize: 14 },

  summaryRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 0.5,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 0.5, height: 36, marginHorizontal: 4 },

  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '600' },

  chartsSection: { marginBottom: 20, gap: 16 },
  chartLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 },
  chartContainer: {
    height: CHART_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.5,
    borderTopWidth: 0.5,
    borderStyle: 'dashed',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  yMax: { position: 'absolute', top: 4, right: 8, fontSize: 10 },
  yMin: { position: 'absolute', bottom: 4, right: 8, fontSize: 10 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },

  sessionCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 8,
    overflow: 'hidden',
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  sessionDate: { fontSize: 14, fontWeight: '600' },
  sessionType: { fontSize: 12, marginTop: 2 },
  prBadge: {
    backgroundColor: '#F59E0B22',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#F59E0B55',
  },
  prBadgeText: { fontSize: 10, fontWeight: '700', color: '#F59E0B' },
  sessionStats: { flexDirection: 'row', gap: 8 },
  statPill: { alignItems: 'center', minWidth: 44 },
  statValue: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 10, marginTop: 1 },
  chevron: { fontSize: 18, marginLeft: 4 },

  setBreakdown: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 0.5,
    paddingTop: 10,
    gap: 6,
  },
  warmupLabel: { fontSize: 12, marginBottom: 4 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  setNum: { fontSize: 12, width: 40 },
  setWeight: { fontSize: 14, fontWeight: '600', flex: 1 },
  setE1rm: { fontSize: 12 },
  setRpe: { fontSize: 11 },
  volumeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  volumeLabel: { fontSize: 12 },
  volumeValue: { fontSize: 12, fontWeight: '600' },

  formCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 8,
    padding: 14,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gradeBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  gradeText: { fontSize: 18, fontWeight: '800' },
  scoreText: { fontSize: 11, fontWeight: '600' },
  issueList: { marginTop: 8, gap: 2 },
  issueText: { fontSize: 12 },

  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
