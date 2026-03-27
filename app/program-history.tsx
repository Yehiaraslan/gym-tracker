// ============================================================
// PROGRAM HISTORY SCREEN
// Shows all past training programs with stats:
// - Total workouts completed during the mesocycle
// - PRs hit during the program period
// - Duration and dates
// - Whether it was Zaki-generated or a template
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import {
  loadProgramHistory,
  type ProgramHistoryEntry,
  type CustomProgram,
} from '@/lib/custom-program-store';
import { getSplitWorkouts, getAllPRs } from '@/lib/split-workout-store';

// ── Types ─────────────────────────────────────────────────────

interface ProgramStats {
  totalWorkouts: number;
  totalVolume: number;
  prsHit: number;
  prDetails: { name: string; weight: number; reps: number }[];
  durationDays: number;
  startDate: string;
  endDate: string;
}

// ── Helpers ───────────────────────────────────────────────────

async function computeStats(entry: ProgramHistoryEntry): Promise<ProgramStats> {
  const start = new Date(entry.program.createdAt);
  const end = entry.program.completedAt
    ? new Date(entry.program.completedAt)
    : new Date(entry.archivedAt);

  const allWorkouts = await getSplitWorkouts();
  const programWorkouts = allWorkouts.filter(w => {
    const d = new Date(w.date);
    return d >= start && d <= end && w.completed;
  });

  const totalVolume = programWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

  // Find PRs hit during this program window
  const allPRs = await getAllPRs();
  const prDetails: { name: string; weight: number; reps: number }[] = [];
  for (const [name, pr] of Object.entries(allPRs)) {
    const prDate = new Date(pr.date);
    if (prDate >= start && prDate <= end) {
      prDetails.push({ name, weight: pr.weight, reps: pr.reps });
    }
  }

  const durationDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)));

  return {
    totalWorkouts: programWorkouts.length,
    totalVolume: Math.round(totalVolume),
    prsHit: prDetails.length,
    prDetails: prDetails.slice(0, 5),
    durationDays,
    startDate: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    endDate: end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(0)}k`;
  return `${vol}`;
}

function getSessionColorList(program: CustomProgram): string[] {
  return Object.values(program.sessionColors || {}).slice(0, 4);
}

// ── Component ─────────────────────────────────────────────────

export default function ProgramHistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const [history, setHistory] = useState<ProgramHistoryEntry[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, ProgramStats>>({});
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fg = colors.foreground;
  const mt = colors.muted;
  const pr = colors.primary;
  const surf = colors.surface;
  const bord = colors.border;
  const bg = colors.background;

  const loadData = useCallback(async () => {
    setLoading(true);
    const entries = await loadProgramHistory();
    setHistory(entries);
    // Compute stats for all entries in parallel
    const statsResults = await Promise.all(entries.map(e => computeStats(e)));
    const map: Record<number, ProgramStats> = {};
    statsResults.forEach((s, i) => { map[i] = s; });
    setStatsMap(map);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={pr} />
          <Text style={{ color: mt, fontSize: 15 }}>Loading program history...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginBottom: 8 }}>
            <Text style={{ color: pr, fontSize: 15, fontWeight: '600' }}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: fg }]}>Program History</Text>
          <Text style={[s.subtitle, { color: mt }]}>
            {history.length === 0
              ? 'No past programs yet'
              : `${history.length} program${history.length > 1 ? 's' : ''} completed`}
          </Text>
        </View>

        {history.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: surf, borderColor: bord }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🏋️</Text>
            <Text style={[s.emptyTitle, { color: fg }]}>No history yet</Text>
            <Text style={[s.emptyText, { color: mt }]}>
              Complete a training program and it will appear here with full stats.
            </Text>
          </View>
        ) : (
          history.map((entry, idx) => {
            const stats = statsMap[idx];
            const isExpanded = expandedIndex === idx;
            const sessionColors = getSessionColorList(entry.program);
            const daysPerWeek = Object.values(entry.program.weeklySchedule).filter(v => v !== 'rest').length;

            return (
              <TouchableOpacity
                key={idx}
                style={[s.card, { backgroundColor: surf, borderColor: bord }]}
                onPress={() => setExpandedIndex(isExpanded ? null : idx)}
                activeOpacity={0.85}
              >
                {/* Card Header */}
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={s.cardTitleRow}>
                      <Text style={[s.cardTitle, { color: fg }]} numberOfLines={1}>
                        {entry.program.name}
                      </Text>
                      {entry.program.generatedByZaki && (
                        <View style={[s.zakiBadge, { backgroundColor: pr + '20' }]}>
                          <Text style={{ color: pr, fontSize: 10, fontWeight: '700' }}>🤖 ZAKI</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.cardDates, { color: mt }]}>
                      {stats ? `${stats.startDate} → ${stats.endDate}` : '...'}
                    </Text>
                  </View>
                  <Text style={{ color: mt, fontSize: 20 }}>{isExpanded ? '▲' : '▼'}</Text>
                </View>

                {/* Session color dots */}
                <View style={s.colorDots}>
                  {sessionColors.map((c, i) => (
                    <View key={i} style={[s.colorDot, { backgroundColor: c }]} />
                  ))}
                  <Text style={[s.daysLabel, { color: mt }]}>{daysPerWeek}x/week</Text>
                </View>

                {/* Quick Stats Row */}
                {stats && (
                  <View style={[s.statsRow, { borderTopColor: bord }]}>
                    <View style={s.statItem}>
                      <Text style={[s.statNum, { color: pr }]}>{stats.totalWorkouts}</Text>
                      <Text style={[s.statLabel, { color: mt }]}>workouts</Text>
                    </View>
                    <View style={[s.statDivider, { backgroundColor: bord }]} />
                    <View style={s.statItem}>
                      <Text style={[s.statNum, { color: '#F59E0B' }]}>{stats.prsHit}</Text>
                      <Text style={[s.statLabel, { color: mt }]}>PRs hit</Text>
                    </View>
                    <View style={[s.statDivider, { backgroundColor: bord }]} />
                    <View style={s.statItem}>
                      <Text style={[s.statNum, { color: '#10B981' }]}>{formatVolume(stats.totalVolume)}</Text>
                      <Text style={[s.statLabel, { color: mt }]}>kg volume</Text>
                    </View>
                    <View style={[s.statDivider, { backgroundColor: bord }]} />
                    <View style={s.statItem}>
                      <Text style={[s.statNum, { color: fg }]}>{stats.durationDays}</Text>
                      <Text style={[s.statLabel, { color: mt }]}>days</Text>
                    </View>
                  </View>
                )}

                {/* Expanded Detail */}
                {isExpanded && stats && (
                  <View style={[s.expandedSection, { borderTopColor: bord }]}>
                    {/* Description */}
                    <Text style={[s.expandedDesc, { color: mt }]}>{entry.program.description}</Text>

                    {/* Session Breakdown */}
                    <Text style={[s.expandedSectionTitle, { color: fg }]}>Sessions</Text>
                    {Object.entries(entry.program.sessionNames).map(([id, name]) => {
                      const exercises = entry.program.sessions[id] || [];
                      const color = entry.program.sessionColors[id] || pr;
                      return (
                        <View key={id} style={s.sessionRow}>
                          <View style={[s.sessionDot, { backgroundColor: color }]} />
                          <Text style={[s.sessionName, { color: fg }]}>{name}</Text>
                          <Text style={[s.sessionExCount, { color: mt }]}>{exercises.length} exercises</Text>
                        </View>
                      );
                    })}

                    {/* PRs Hit */}
                    {stats.prsHit > 0 && (
                      <>
                        <Text style={[s.expandedSectionTitle, { color: fg, marginTop: 16 }]}>
                          PRs Hit During This Program 🏆
                        </Text>
                        {stats.prDetails.map((pr, i) => (
                          <View key={i} style={s.prRow}>
                            <Text style={[s.prName, { color: fg }]}>{pr.name}</Text>
                            <Text style={[s.prValue, { color: '#F59E0B' }]}>
                              {pr.weight}kg × {pr.reps}
                            </Text>
                          </View>
                        ))}
                        {stats.prsHit > 5 && (
                          <Text style={{ color: mt, fontSize: 12, marginTop: 4 }}>
                            +{stats.prsHit - 5} more PRs
                          </Text>
                        )}
                      </>
                    )}

                    {/* Weekly Schedule */}
                    <Text style={[s.expandedSectionTitle, { color: fg, marginTop: 16 }]}>Schedule</Text>
                    <View style={s.scheduleGrid}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                        const fullDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i];
                        const sessionId = entry.program.weeklySchedule[fullDay] || 'rest';
                        const isRest = sessionId === 'rest';
                        const color = isRest ? bord : (entry.program.sessionColors[sessionId] || pr);
                        const abbr = isRest ? '—' : (entry.program.sessionNames[sessionId] || sessionId).slice(0, 2).toUpperCase();
                        return (
                          <View key={day} style={s.scheduleCell}>
                            <View style={[s.scheduleDot, { backgroundColor: isRest ? 'transparent' : color, borderColor: color }]} />
                            <Text style={[s.scheduleDayLabel, { color: mt }]}>{day}</Text>
                            <Text style={[s.scheduleAbbr, { color: isRest ? mt : color }]}>{abbr}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
    gap: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  zakiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cardDates: {
    fontSize: 12,
    lineHeight: 16,
  },
  colorDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  daysLabel: {
    fontSize: 12,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 0.5,
    marginVertical: 2,
  },
  statNum: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  expandedSection: {
    borderTopWidth: 0.5,
    padding: 16,
  },
  expandedDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  expandedSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  sessionExCount: {
    fontSize: 12,
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  prName: {
    fontSize: 13,
    flex: 1,
  },
  prValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scheduleCell: {
    alignItems: 'center',
    gap: 4,
  },
  scheduleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  scheduleDayLabel: {
    fontSize: 10,
  },
  scheduleAbbr: {
    fontSize: 10,
    fontWeight: '700',
  },
});
