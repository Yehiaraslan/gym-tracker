import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { ReadinessCard } from '@/components/readiness-card';
import { useColors } from '@/hooks/use-colors';
import {
  computeReadiness,
  type ReadinessInput,
  type ReadinessResult,
} from '@/lib/readiness-score';
import { useGym } from '@/lib/gym-context';
import { getStreakData } from '@/lib/streak-tracker';
import { getDailyNutrition } from '@/lib/nutrition-store';
import { getTodayRecoveryData } from '@/lib/whoop-recovery-service';

const READINESS_HISTORY_KEY = '@gym_readiness_history';

interface ReadinessHistoryEntry {
  date: string;
  score: number;
  label: string;
}

export default function ReadinessScreen() {
  const router = useRouter();
  const colors = useColors();
  const { store } = useGym();
  const [loading, setLoading] = useState(true);
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(
    null
  );
  const [history, setHistory] = useState<ReadinessHistoryEntry[]>([]);

  useEffect(() => {
    loadReadinessData();
  }, []);

  async function loadReadinessData() {
    try {
      setLoading(true);

      // Load all required data
      const streakData = await getStreakData();
      const today = new Date().toLocaleDateString('en-CA');
      const nutrition = await getDailyNutrition(today);
      const whoopData = await getTodayRecoveryData();

      // Get the most recent sleep entry (today or the last logged entry)
      const sortedSleep = [...store.sleepEntries].sort((a, b) => b.date.localeCompare(a.date));
      const sleepEntry = sortedSleep[0] ?? null;

      // Calculate totals for last 7 days
      const last7DaysStart = new Date();
      last7DaysStart.setDate(last7DaysStart.getDate() - 7);
      const last7DaysDate = last7DaysStart.toLocaleDateString('en-CA');

      const last7DaysWorkouts = store.workoutLogs.filter(
        w => w.date >= last7DaysDate && w.date <= today && w.isCompleted
      );
      const workoutsLast7Days = last7DaysWorkouts.length;

      // Calculate training volume (kg * reps for all sets)
      let totalVolumeLast7Days = 0;
      last7DaysWorkouts.forEach(workout => {
        workout.exercises.forEach(exercise => {
          exercise.sets.forEach(set => {
            totalVolumeLast7Days += set.weight * set.reps;
          });
        });
      });

      // Calculate previous 7 days volume for comparison
      const previous7DaysStart = new Date();
      previous7DaysStart.setDate(previous7DaysStart.getDate() - 14);
      const previous7DaysEnd = new Date();
      previous7DaysEnd.setDate(previous7DaysEnd.getDate() - 7);
      const previous7DaysStartDate = previous7DaysStart.toLocaleDateString(
        'en-CA'
      );
      const previous7DaysEndDate = previous7DaysEnd.toLocaleDateString('en-CA');

      const previous7DaysWorkouts = store.workoutLogs.filter(
        w =>
          w.date >= previous7DaysStartDate &&
          w.date <= previous7DaysEndDate &&
          w.isCompleted
      );

      let totalVolumePrevious7Days = 0;
      previous7DaysWorkouts.forEach(workout => {
        workout.exercises.forEach(exercise => {
          exercise.sets.forEach(set => {
            totalVolumePrevious7Days += set.weight * set.reps;
          });
        });
      });

      // Calculate nutrition ratios
      let caloriesVsTarget: number | null = null;
      let proteinVsTarget: number | null = null;

      if (nutrition && nutrition.targetCalories && nutrition.targetProtein) {
        const totalCalories = nutrition.meals.reduce(
          (sum, meal) => sum + meal.calories,
          0
        );
        const totalProtein = nutrition.meals.reduce(
          (sum, meal) => sum + meal.protein,
          0
        );

        caloriesVsTarget = nutrition.targetCalories > 0
          ? totalCalories / nutrition.targetCalories
          : null;
        proteinVsTarget = nutrition.targetProtein > 0
          ? totalProtein / nutrition.targetProtein
          : null;
      }

      // Build readiness input
      const readinessInput: ReadinessInput = {
        sleepDurationHours: sleepEntry?.durationHours ?? null,
        sleepQuality: sleepEntry?.qualityRating ?? null,
        whoopRecoveryScore: whoopData?.recoveryScore ?? null,
        hrv: whoopData?.hrv ?? null,
        rhr: whoopData?.rhr ?? null,
        caloriesVsTarget,
        proteinVsTarget,
        workoutsLast7Days,
        totalVolumeLast7Days,
        totalVolumePrevious7Days,
        currentStreak: streakData.currentStreak,
      };

      // Compute readiness score
      const result = computeReadiness(readinessInput);
      setReadinessResult(result);

      // Save to history
      await saveToHistory(result);

      // Load history
      const historyData = await loadHistory();
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading readiness data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveToHistory(result: ReadinessResult) {
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const history = await loadHistory();

      // Remove existing entry for today
      const filtered = history.filter(h => h.date !== today);

      // Add new entry
      filtered.push({
        date: today,
        score: result.score,
        label: result.label,
      });

      // Keep last 30 days
      const last30Days = filtered.slice(-30);

      await AsyncStorage.setItem(
        READINESS_HISTORY_KEY,
        JSON.stringify(last30Days)
      );
    } catch (error) {
      console.error('Error saving readiness to history:', error);
    }
  }

  async function loadHistory(): Promise<ReadinessHistoryEntry[]> {
    try {
      const data = await AsyncStorage.getItem(READINESS_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading readiness history:', error);
      return [];
    }
  }

  const getHistoryColor = (score: number) => {
    if (score >= 85) return '#22C55E';
    if (score >= 70) return '#3B82F6';
    if (score >= 50) return '#F59E0B';
    if (score >= 30) return '#F97316';
    return '#EF4444';
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.cardMuted }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.backButton, { color: colors.primary }]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.cardForeground }]}>
          Readiness Score
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.cardForeground }]}>
            Computing readiness...
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main readiness card */}
          {readinessResult && (
            <>
              <View style={styles.cardContainer}>
                <ReadinessCard readinessResult={readinessResult} />
              </View>

              {/* 7-day trend */}
              {history.length > 0 && (
                <View style={styles.trendSection}>
                  <Text
                    style={[styles.trendTitle, { color: colors.cardForeground }]}
                  >
                    7-Day Trend
                  </Text>
                  <View style={styles.trendChartContainer}>
                    <FlatList
                      data={history.slice(-7)}
                      horizontal
                      scrollEnabled={false}
                      keyExtractor={item => item.date}
                      renderItem={({ item }) => {
                        const isToday =
                          item.date ===
                          new Date().toLocaleDateString('en-CA');
                        return (
                          <View
                            style={[
                              styles.trendBarContainer,
                              isToday && {
                                borderBottomWidth: 3,
                                borderBottomColor: colors.primary,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.trendBar,
                                {
                                  height: Math.max(30, (item.score / 100) * 150),
                                  backgroundColor: getHistoryColor(item.score),
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.trendDate,
                                { color: colors.cardMuted },
                              ]}
                            >
                              {new Date(item.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                              })}
                            </Text>
                            <Text
                              style={[
                                styles.trendScore,
                                { color: colors.cardForeground },
                              ]}
                            >
                              {item.score}
                            </Text>
                          </View>
                        );
                      }}
                      ItemSeparatorComponent={() => (
                        <View style={{ width: 8 }} />
                      )}
                    />
                  </View>
                </View>
              )}

              {/* Additional info */}
              <View
                style={[
                  styles.infoSection,
                  { backgroundColor: colors.surface, borderColor: colors.cardBorder },
                ]}
              >
                <Text
                  style={[styles.infoTitle, { color: colors.cardForeground }]}
                >
                  How It Works
                </Text>
                <Text
                  style={[styles.infoText, { color: colors.cardMuted }]}
                >
                  Your readiness score combines four key factors:
                </Text>
                <Text
                  style={[styles.infoText, { color: colors.cardMuted }]}
                >
                  • <Text style={{ fontWeight: '600' }}>Sleep (25%)</Text> - Duration and quality of sleep
                </Text>
                <Text
                  style={[styles.infoText, { color: colors.cardMuted }]}
                >
                  • <Text style={{ fontWeight: '600' }}>Recovery (30%)</Text> - WHOOP recovery score and HRV
                </Text>
                <Text
                  style={[styles.infoText, { color: colors.cardMuted }]}
                >
                  • <Text style={{ fontWeight: '600' }}>Nutrition (20%)</Text> - Calorie and protein targets
                </Text>
                <Text
                  style={[styles.infoText, { color: colors.cardMuted }]}
                >
                  • <Text style={{ fontWeight: '600' }}>Training Load (25%)</Text> - Volume and frequency
                </Text>
              </View>

              <View style={{ height: 20 }} />
            </>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  cardContainer: {
    marginBottom: 24,
  },
  trendSection: {
    marginBottom: 24,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  trendChartContainer: {
    height: 200,
    justifyContent: 'flex-end',
  },
  trendBarContainer: {
    alignItems: 'center',
    flex: 1,
    minWidth: 50,
  },
  trendBar: {
    width: 30,
    borderRadius: 6,
    marginBottom: 8,
  },
  trendDate: {
    fontSize: 11,
    marginBottom: 4,
  },
  trendScore: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
});
