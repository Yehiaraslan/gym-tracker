import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { getAllPRs, getExerciseWeeklyVolume } from '@/lib/split-workout-store';
import { PROGRAM_SESSIONS } from '@/lib/training-program';

// Build a name → bodyPart lookup from all program sessions
const EXERCISE_BODY_PART: Record<string, string> = {};
for (const exercises of Object.values(PROGRAM_SESSIONS)) {
  for (const ex of exercises) {
    EXERCISE_BODY_PART[ex.name] = ex.bodyPart;
  }
}

interface PRRecord {
  exerciseName: string;
  bestWeight: number;
  bestReps: number;
  estimated1RM: number;
  date: string;
  bodyPart: string;
}

const ACCENT = '#C8F53C';
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDALS = ['🥇', '🥈', '🥉'];
const BODY_PART_ORDER = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];
const BAR_CHART_HEIGHT = 72;
const BAR_CHART_WIDTH = 280;

// ── Inline volume bar chart ─────────────────────────────────────────────────
function VolumeBarChart({ exerciseName, accent }: { exerciseName: string; accent: string }) {
  const [weeks, setWeeks] = useState<{ weekLabel: string; volume: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExerciseWeeklyVolume(exerciseName, 8)
      .then(data => { setWeeks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [exerciseName]);

  if (loading) {
    return (
      <View style={{ height: BAR_CHART_HEIGHT + 24, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={accent} />
      </View>
    );
  }

  const maxVol = Math.max(...weeks.map(w => w.volume), 1);
  const barW = Math.floor((BAR_CHART_WIDTH - (weeks.length - 1) * 4) / weeks.length);
  const hasData = weeks.some(w => w.volume > 0);

  if (!hasData) {
    return (
      <View style={{ height: BAR_CHART_HEIGHT + 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#687076', fontSize: 12 }}>No volume data yet — complete a workout to see progress</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 }}>
      <Text style={{ color: '#687076', fontSize: 10, marginBottom: 6, letterSpacing: 0.8, textTransform: 'uppercase' }}>
        Weekly Volume (kg·reps) — last 8 weeks
      </Text>
      <Svg width={BAR_CHART_WIDTH} height={BAR_CHART_HEIGHT + 18}>
        {weeks.map((w, i) => {
          const barH = w.volume > 0 ? Math.max(4, Math.round((w.volume / maxVol) * BAR_CHART_HEIGHT)) : 0;
          const x = i * (barW + 4);
          const y = BAR_CHART_HEIGHT - barH;
          const isLast = i === weeks.length - 1;
          return (
            <React.Fragment key={w.weekLabel}>
              <Rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={3}
                fill={isLast ? accent : accent + '60'}
              />
              <SvgText
                x={x + barW / 2}
                y={BAR_CHART_HEIGHT + 14}
                fontSize={8}
                fill="#687076"
                textAnchor="middle"
              >
                {w.weekLabel}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      <Text style={{ color: '#687076', fontSize: 10, marginTop: 2 }}>
        Peak: {Math.max(...weeks.map(w => w.volume)).toLocaleString()} kg·reps
      </Text>
    </View>
  );
}

// ── PR Row with expandable chart ────────────────────────────────────────────
function PRRow({ pr, idx, accent, colors }: {
  pr: PRRecord;
  idx: number;
  accent: string;
  colors: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: expanded ? accent + '50' : colors.cardBorder,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
        style={{
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.cardMuted, fontSize: 13, fontWeight: '700', width: 24 }}>
          {idx + 1}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.cardForeground, fontSize: 14, fontWeight: '600' }}>
            {pr.exerciseName}
          </Text>
          <Text style={{ color: colors.cardMuted, fontSize: 11, marginTop: 2 }}>
            {pr.bestWeight}kg × {pr.bestReps} reps · {new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
          <Text style={{ color: accent, fontSize: 20, fontWeight: '800' }}>
            {pr.estimated1RM}
          </Text>
          <Text style={{ color: colors.cardMuted, fontSize: 9 }}>est. 1RM</Text>
        </View>
        <Text style={{ color: expanded ? accent : colors.cardMuted, fontSize: 16 }}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
          <VolumeBarChart exerciseName={pr.exerciseName} accent={accent} />
        </View>
      )}
    </View>
  );
}

import React from 'react';

export default function PRBoardScreen() {
  const router = useRouter();
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [rawPRs, setRawPRs] = useState<Record<string, { e1rm: number; weight: number; reps: number; date: string }>>({});

  useEffect(() => {
    getAllPRs()
      .then(prs => { setRawPRs(prs); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const prRecords: PRRecord[] = useMemo(() =>
    Object.entries(rawPRs)
      .map(([name, pr]) => ({
        exerciseName: name,
        bestWeight: pr.weight,
        bestReps: pr.reps,
        estimated1RM: Math.round(pr.e1rm),
        date: pr.date,
        bodyPart: EXERCISE_BODY_PART[name] ?? 'Other',
      }))
      .sort((a, b) => b.estimated1RM - a.estimated1RM),
    [rawPRs]);

  const groupedPRs = useMemo(() => {
    const groups: Record<string, PRRecord[]> = {};
    for (const pr of prRecords) {
      if (!groups[pr.bodyPart]) groups[pr.bodyPart] = [];
      groups[pr.bodyPart].push(pr);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = BODY_PART_ORDER.indexOf(a);
      const bi = BODY_PART_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [prRecords]);

  const topLifts = prRecords.slice(0, 3);
  const totalE1RM = Math.round(prRecords.reduce((s, pr) => s + pr.estimated1RM, 0));

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <Text style={{ color: colors.cardForeground, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.cardForeground, fontSize: 22, fontWeight: '800', flex: 1 }}>
          🏆 PR Board
        </Text>
        <Text style={{ color: colors.cardMuted, fontSize: 12 }}>
          {prRecords.length} exercises
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={{ color: colors.cardMuted, marginTop: 12 }}>Loading your PRs…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Total strength score */}
          {prRecords.length > 0 && (
            <View style={{
              marginHorizontal: 16,
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: ACCENT + '30',
            }}>
              <Text style={{ color: colors.cardMuted, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>Total Strength Score</Text>
              <Text style={{ color: ACCENT, fontSize: 48, fontWeight: '900', marginTop: 4 }}>
                {totalE1RM}
              </Text>
              <Text style={{ color: colors.cardMuted, fontSize: 12 }}>kg combined estimated 1RM · {prRecords.length} exercises</Text>
            </View>
          )}

          {/* Top 3 Podium */}
          {topLifts.length > 0 && (
            <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
              <Text style={{ color: colors.cardMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
                Top Lifts
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {topLifts.map((pr, index) => (
                  <View
                    key={pr.exerciseName}
                    style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      padding: 12,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: MEDAL_COLORS[index] + '50',
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>{MEDALS[index]}</Text>
                    <Text style={{ color: MEDAL_COLORS[index], fontSize: 24, fontWeight: '900', marginTop: 4 }}>
                      {pr.estimated1RM}
                    </Text>
                    <Text style={{ color: colors.cardMuted, fontSize: 9, marginTop: 1 }}>est. 1RM (kg)</Text>
                    <Text style={{ color: colors.cardForeground, fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'center' }} numberOfLines={2}>
                      {pr.exerciseName}
                    </Text>
                    <Text style={{ color: colors.cardMuted, fontSize: 10, marginTop: 2 }}>
                      {pr.bestWeight}kg × {pr.bestReps}
                    </Text>
                    <Text style={{ color: colors.cardMuted, fontSize: 9, marginTop: 2 }}>
                      {new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* PRs by Body Part — tap any row to expand volume chart */}
          {prRecords.length > 0 && (
            <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
              <Text style={{ color: colors.cardMuted, fontSize: 11, marginBottom: 4 }}>
                💡 Tap any exercise to see 8-week volume trend
              </Text>
            </View>
          )}
          {groupedPRs.map(([bodyPart, prs]) => (
            <View key={bodyPart} style={{ marginHorizontal: 16, marginBottom: 20 }}>
              <Text style={{ color: colors.cardMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
                {bodyPart}
              </Text>
              {prs.map((pr, idx) => (
                <PRRow
                  key={pr.exerciseName}
                  pr={pr}
                  idx={idx}
                  accent={ACCENT}
                  colors={colors}
                />
              ))}
            </View>
          ))}

          {/* Empty state */}
          {prRecords.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 40 }}>
              <Text style={{ fontSize: 56 }}>🏋️</Text>
              <Text style={{ color: colors.cardForeground, fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
                No PRs Yet
              </Text>
              <Text style={{ color: colors.cardMuted, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
                Complete workouts with weight tracking to see your personal records here.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
