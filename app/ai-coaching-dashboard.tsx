// ============================================================
// AI COACHING DASHBOARD — Personalized daily coaching, workout
// adjustments, nutrition insights, and weekly digest
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { buildUserSnapshot, snapshotToPromptContext } from '@/lib/ai-data-aggregator';
import type {
  DailyCoachingMessage,
  WorkoutAdjustment,
  NutritionInsight,
  WeeklyDigest,
} from '@/server/ai-coaching-service';

const CACHE_KEY = '@ai_coaching_cache';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

interface CachedCoaching {
  timestamp: number;
  dailyMessage: DailyCoachingMessage;
  workoutAdjustments: WorkoutAdjustment[];
  nutritionInsights: NutritionInsight[];
  weeklyDigest: WeeklyDigest | null;
}

export default function AICoachingDashboard() {
  const colors = useColors();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyMessage, setDailyMessage] = useState<DailyCoachingMessage | null>(null);
  const [workoutAdjustments, setWorkoutAdjustments] = useState<WorkoutAdjustment[]>([]);
  const [nutritionInsights, setNutritionInsights] = useState<NutritionInsight[]>([]);
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyDigest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'workout' | 'nutrition' | 'weekly'>('daily');

  const dailyCoachingMutation = trpc.aiCoaching.dailyCoaching.useMutation();

  const loadCached = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: CachedCoaching = JSON.parse(raw);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          setDailyMessage(cached.dailyMessage);
          setWorkoutAdjustments(cached.workoutAdjustments);
          setNutritionInsights(cached.nutritionInsights);
          setWeeklyDigest(cached.weeklyDigest);
          return true;
        }
      }
    } catch {}
    return false;
  }, []);

  const fetchCoaching = useCallback(async (force = false) => {
    try {
      setError(null);
      if (!force) {
        const hasCached = await loadCached();
        if (hasCached) {
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      const snapshot = await buildUserSnapshot();
      const context = snapshotToPromptContext(snapshot);

      const result = await dailyCoachingMutation.mutateAsync({ userContext: context });

      setDailyMessage(result.dailyMessage);
      setWorkoutAdjustments(result.workoutAdjustments);
      setNutritionInsights(result.nutritionInsights);
      setWeeklyDigest(result.weeklyDigest);

      // Cache the result
      const cacheData: CachedCoaching = {
        timestamp: Date.now(),
        dailyMessage: result.dailyMessage,
        workoutAdjustments: result.workoutAdjustments,
        nutritionInsights: result.nutritionInsights,
        weeklyDigest: result.weeklyDigest,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.error('[AI Coach Dashboard] Error:', err);
      setError('Could not generate coaching insights. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dailyCoachingMutation, loadCached]);

  useEffect(() => {
    fetchCoaching();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    fetchCoaching(true);
  }, [fetchCoaching]);

  const intensityColor = (advice: string) => {
    switch (advice) {
      case 'push_hard': return '#22C55E';
      case 'moderate': return '#3B82F6';
      case 'go_light': return '#F59E0B';
      case 'rest': return '#EF4444';
      default: return colors.muted;
    }
  };

  const intensityLabel = (advice: string) => {
    switch (advice) {
      case 'push_hard': return 'PUSH HARD';
      case 'moderate': return 'MODERATE';
      case 'go_light': return 'GO LIGHT';
      case 'rest': return 'REST DAY';
      default: return advice.toUpperCase();
    }
  };

  const adjustmentIcon = (type: string) => {
    switch (type) {
      case 'weight_increase': return '⬆️';
      case 'weight_decrease': return '⬇️';
      case 'deload': return '🔄';
      case 'substitute': return '🔀';
      case 'add_set': return '➕';
      case 'remove_set': return '➖';
      default: return '💡';
    }
  };

  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#22C55E';
      default: return colors.muted;
    }
  };

  const gradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return '#22C55E';
      case 'B': return '#3B82F6';
      case 'C': return '#F59E0B';
      case 'D': return '#F97316';
      case 'F': return '#EF4444';
      default: return colors.muted;
    }
  };

  const tabs = [
    { key: 'daily' as const, label: 'Daily' },
    { key: 'workout' as const, label: 'Workout' },
    { key: 'nutrition' as const, label: 'Nutrition' },
    { key: 'weekly' as const, label: 'Weekly' },
  ];

  if (loading && !dailyMessage) {
    return (
      <ScreenContainer className="p-6">
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingIcon]}>🧠</Text>
          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
            Analyzing your data...
          </Text>
          <Text style={[styles.loadingSubtitle, { color: colors.muted }]}>
            Your AI coach is reviewing workouts, nutrition, and recovery
          </Text>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.surface }]}
          >
            <Text style={{ color: colors.foreground, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>AI Coach</Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              Personalized insights powered by your data
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={[styles.refreshBtn, { backgroundColor: colors.surface }]}
          >
            <Text style={{ fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2' }]}>
            <Text style={{ color: '#991B1B', fontSize: 14 }}>{error}</Text>
            <TouchableOpacity onPress={() => fetchCoaching(true)}>
              <Text style={{ color: '#DC2626', fontWeight: '700', marginTop: 4 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.tabItem,
                activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === tab.key ? colors.primary : colors.muted },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Daily Tab */}
        {activeTab === 'daily' && dailyMessage && (
          <View style={styles.tabContent}>
            {/* Greeting & Intensity Badge */}
            <View style={styles.greetingCard}>
              <Text style={[styles.greeting, { color: colors.foreground }]}>
                {dailyMessage.greeting}
              </Text>
              <View
                style={[
                  styles.intensityBadge,
                  { backgroundColor: intensityColor(dailyMessage.intensityAdvice) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.intensityText,
                    { color: intensityColor(dailyMessage.intensityAdvice) },
                  ]}
                >
                  {intensityLabel(dailyMessage.intensityAdvice)}
                </Text>
              </View>
            </View>

            {/* Headline */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                {dailyMessage.headline}
              </Text>
              <Text style={[styles.cardBody, { color: colors.muted }]}>
                {dailyMessage.bodyText}
              </Text>
            </View>

            {/* Today's Focus */}
            <View style={[styles.card, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
              <Text style={[styles.cardLabel, { color: colors.primary }]}>TODAY&apos;S FOCUS</Text>
              <Text style={[styles.focusText, { color: colors.foreground }]}>
                {dailyMessage.todayFocus}
              </Text>
            </View>

            {/* Nutrition Tip */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardLabel, { color: '#22C55E' }]}>🥗 NUTRITION TIP</Text>
              <Text style={[styles.cardBody, { color: colors.foreground }]}>
                {dailyMessage.nutritionTip}
              </Text>
            </View>

            {/* Recovery Note */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardLabel, { color: '#8B5CF6' }]}>💤 RECOVERY</Text>
              <Text style={[styles.cardBody, { color: colors.foreground }]}>
                {dailyMessage.recoveryNote}
              </Text>
            </View>

            {/* Motivational Close */}
            <View style={[styles.motivationalCard, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.motivationalText, { color: colors.primary }]}>
                &ldquo;{dailyMessage.motivationalClose}&rdquo;
              </Text>
            </View>
          </View>
        )}

        {/* Workout Tab */}
        {activeTab === 'workout' && (
          <View style={styles.tabContent}>
            {workoutAdjustments.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                <Text style={{ fontSize: 40, textAlign: 'center' }}>🏋️</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No adjustments yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Complete a few more workouts and your AI coach will suggest smart adjustments
                </Text>
              </View>
            ) : (
              workoutAdjustments.map((adj, i) => (
                <View
                  key={i}
                  style={[styles.adjustmentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.adjustmentHeader}>
                    <Text style={{ fontSize: 20 }}>{adjustmentIcon(adj.adjustmentType)}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.adjustmentExercise, { color: colors.foreground }]}>
                        {adj.exerciseName}
                      </Text>
                      <Text style={[styles.adjustmentType, { color: colors.primary }]}>
                        {adj.adjustmentType.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.confidenceBadge,
                        {
                          backgroundColor:
                            adj.confidence === 'high'
                              ? '#22C55E20'
                              : adj.confidence === 'medium'
                                ? '#F59E0B20'
                                : '#EF444420',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color:
                            adj.confidence === 'high'
                              ? '#22C55E'
                              : adj.confidence === 'medium'
                                ? '#F59E0B'
                                : '#EF4444',
                        }}
                      >
                        {adj.confidence.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.adjustmentSuggestion, { color: colors.foreground }]}>
                    {adj.suggestion}
                  </Text>
                  <Text style={[styles.adjustmentReason, { color: colors.muted }]}>
                    {adj.reason}
                  </Text>
                </View>
              ))
            )}

            {/* Form Coach Link */}
            <TouchableOpacity
              onPress={() => router.push('/form-coach-tracking' as any)}
              style={[styles.formCoachLink, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.formCoachLinkText}>📸 Open AI Form Coach</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Nutrition Tab */}
        {activeTab === 'nutrition' && (
          <View style={styles.tabContent}>
            {nutritionInsights.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                <Text style={{ fontSize: 40, textAlign: 'center' }}>🥗</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No nutrition insights yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Log your meals in the Nutrition tab and your AI coach will analyze your intake
                </Text>
              </View>
            ) : (
              nutritionInsights.map((insight, i) => (
                <View
                  key={i}
                  style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.insightHeader}>
                    <View
                      style={[
                        styles.priorityDot,
                        { backgroundColor: priorityColor(insight.priority) },
                      ]}
                    />
                    <Text style={[styles.insightTitle, { color: colors.foreground }]}>
                      {insight.title}
                    </Text>
                  </View>
                  <Text style={[styles.insightDetail, { color: colors.muted }]}>
                    {insight.detail}
                  </Text>
                  <View style={[styles.actionableBox, { backgroundColor: colors.primary + '10' }]}>
                    <Text style={[styles.actionableLabel, { color: colors.primary }]}>
                      ACTION
                    </Text>
                    <Text style={[styles.actionableText, { color: colors.foreground }]}>
                      {insight.actionable}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Weekly Tab */}
        {activeTab === 'weekly' && (
          <View style={styles.tabContent}>
            {weeklyDigest ? (
              <>
                {/* Grade */}
                <View style={[styles.gradeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View
                    style={[
                      styles.gradeBadge,
                      { backgroundColor: gradeColor(weeklyDigest.overallGrade) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.gradeText,
                        { color: gradeColor(weeklyDigest.overallGrade) },
                      ]}
                    >
                      {weeklyDigest.overallGrade}
                    </Text>
                  </View>
                  <Text style={[styles.gradeSummary, { color: colors.foreground }]}>
                    {weeklyDigest.weekSummary}
                  </Text>
                </View>

                {/* Highlights */}
                {weeklyDigest.strengthHighlights.length > 0 && (
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.cardLabel, { color: '#22C55E' }]}>
                      💪 STRENGTH HIGHLIGHTS
                    </Text>
                    {weeklyDigest.strengthHighlights.map((h, i) => (
                      <Text key={i} style={[styles.listItem, { color: colors.foreground }]}>
                        • {h}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Areas to Improve */}
                {weeklyDigest.areasToImprove.length > 0 && (
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.cardLabel, { color: '#F59E0B' }]}>
                      📈 AREAS TO IMPROVE
                    </Text>
                    {weeklyDigest.areasToImprove.map((a, i) => (
                      <Text key={i} style={[styles.listItem, { color: colors.foreground }]}>
                        • {a}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Next Week Plan */}
                <View style={[styles.card, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                  <Text style={[styles.cardLabel, { color: colors.primary }]}>
                    📋 NEXT WEEK PLAN
                  </Text>
                  <Text style={[styles.cardBody, { color: colors.foreground }]}>
                    {weeklyDigest.nextWeekPlan}
                  </Text>
                </View>
              </>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                <Text style={{ fontSize: 40, textAlign: 'center' }}>📊</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Weekly digest available on weekends
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Your AI coach generates a weekly performance review every Saturday
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setActiveTab('weekly');
                    fetchCoaching(true);
                  }}
                  style={[styles.generateBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.generateBtnText}>Generate Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingIcon: { fontSize: 48, marginBottom: 16 },
  loadingTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  loadingSubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  tabContent: { paddingHorizontal: 16, gap: 12 },
  greetingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  greeting: { fontSize: 24, fontWeight: '800' },
  intensityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  intensityText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 14, lineHeight: 22 },
  cardLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  focusText: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  motivationalCard: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  motivationalText: { fontSize: 16, fontWeight: '600', fontStyle: 'italic', textAlign: 'center', lineHeight: 24 },
  emptyCard: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  adjustmentCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  adjustmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  adjustmentExercise: { fontSize: 16, fontWeight: '700' },
  adjustmentType: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adjustmentSuggestion: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  adjustmentReason: { fontSize: 13, lineHeight: 20 },
  formCoachLink: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  formCoachLinkText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  insightCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  insightTitle: { fontSize: 16, fontWeight: '700' },
  insightDetail: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  actionableBox: {
    borderRadius: 10,
    padding: 12,
  },
  actionableLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  actionableText: { fontSize: 14, lineHeight: 20 },
  gradeCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  gradeBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeText: { fontSize: 32, fontWeight: '900' },
  gradeSummary: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  listItem: { fontSize: 14, lineHeight: 22, marginTop: 4 },
  generateBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 12,
  },
  generateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
