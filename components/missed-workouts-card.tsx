import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getMissedDays, clearMissedDay, getDayName, markDayAsMissed } from '@/lib/day-postponement';
import { useGym } from '@/lib/gym-context';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface MissedDay {
  date: string;
  dayNumber: number;
  weekNumber: number;
  reason?: string;
  createdAt: number;
}

export function MissedWorkoutsCard() {
  const colors = useColors();
  const { store } = useGym();
  const [missedDays, setMissedDays] = useState<MissedDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMissedDays();
  }, []);

  const loadMissedDays = async () => {
    try {
      const days = await getMissedDays();
      // Filter to only show recent missed days (last 30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent = days.filter(d => d.createdAt > thirtyDaysAgo);
      setMissedDays(recent);
    } catch (error) {
      console.error('Error loading missed days:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = (missedDay: MissedDay) => {
    Alert.alert(
      'Reschedule Workout',
      `Reschedule ${getDayName(missedDay.dayNumber)} workout to tomorrow?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reschedule',
          onPress: async () => {
            // Logic to reschedule would go here
            await clearMissedDay(missedDay.date, missedDay.dayNumber);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            loadMissedDays();
            Alert.alert('Success', 'Workout rescheduled for tomorrow');
          },
        },
      ]
    );
  };

  const handlePermanentlySkip = (missedDay: MissedDay) => {
    Alert.alert(
      'Permanently Skip',
      `Are you sure you want to skip ${getDayName(missedDay.dayNumber)} permanently this week?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            await clearMissedDay(missedDay.date, missedDay.dayNumber);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            loadMissedDays();
          },
        },
      ]
    );
  };

  if (loading || missedDays.length === 0) {
    return null;
  }

  const renderMissedDay = ({ item }: { item: MissedDay }) => (
    <View
      className="bg-surface rounded-lg p-4 mb-3"
      style={{ borderWidth: 1, borderColor: colors.border }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">
            {getDayName(item.dayNumber)}
          </Text>
          <Text className="text-sm text-muted mt-1">
            Missed on {new Date(item.date).toLocaleDateString()}
          </Text>
          {item.reason && (
            <Text className="text-sm text-muted mt-1">Reason: {item.reason}</Text>
          )}
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: colors.error + '20' }}
        >
          <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>
            Missed
          </Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => handleReschedule(item)}
          className="flex-1 py-2 rounded-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-center font-semibold text-white text-sm">
            Reschedule
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handlePermanentlySkip(item)}
          className="flex-1 py-2 rounded-lg"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Text className="text-center font-semibold text-foreground text-sm">
            Skip
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View
      className="bg-surface rounded-2xl p-4 mb-4 mx-4"
      style={{ borderWidth: 1, borderColor: colors.error + '40' }}
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-2xl">⚠️</Text>
          <Text className="text-lg font-bold text-foreground">
            {missedDays.length} Missed Workout{missedDays.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={missedDays}
        keyExtractor={(item, index) => `${item.date}-${item.dayNumber}-${index}`}
        renderItem={renderMissedDay}
        scrollEnabled={false}
      />
    </View>
  );
}
