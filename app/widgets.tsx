import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { WidgetPreview } from '@/components/widget-preview';
import { useColors } from '@/hooks/use-colors';
import { updateWidgetData, getWidgetData, type WidgetData } from '@/lib/widget-data';

export default function WidgetsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Load widget data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadWidgetData();
    }, [])
  );

  const loadWidgetData = async () => {
    try {
      let data = await getWidgetData();
      // Auto-generate widget data on first load if cache is empty
      if (!data) {
        data = await updateWidgetData();
      }
      setWidgetData(data);
      if (data?.updatedAt) {
        const date = new Date(data.updatedAt);
        setLastUpdated(date.toLocaleString());
      }
    } catch (error) {
      console.error('Error loading widget data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await updateWidgetData();
      setWidgetData(data);
      if (data?.updatedAt) {
        const date = new Date(data.updatedAt);
        setLastUpdated(date.toLocaleString());
      }
    } catch (error) {
      console.error('Error updating widget data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <ScreenContainer className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 gap-8 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="gap-2">
          <Text
            className="text-3xl font-bold"
            style={{ color: colors.foreground }}
          >
            Home Screen Widgets
          </Text>
          <Text style={{ color: colors.muted }}>
            Add Banana Pro Gym to your home screen for quick access to your
            stats
          </Text>
        </View>

        {/* Configure Widget Stats */}
        <TouchableOpacity
          onPress={() => router.push('/widget-config')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 16,
            borderWidth: 1.5,
            borderColor: colors.primary,
          }}
        >
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>⚙️  Configure Widget Stats</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Choose which stats appear on your home screen</Text>
          </View>
          <Text style={{ color: colors.primary, fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* iOS Instructions */}
        <View className="gap-3">
          <Text
            className="text-lg font-semibold"
            style={{ color: colors.foreground }}
          >
            📱 iOS Setup
          </Text>
          <View
            className="p-4 rounded-xl gap-2"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              1. Long press your home screen{'\n'}
              2. Tap the + button to add a widget{'\n'}
              3. Search for "Banana Pro Gym"{'\n'}
              4. Select your preferred widget size
            </Text>
          </View>
        </View>

        {/* Android Instructions */}
        <View className="gap-3">
          <Text
            className="text-lg font-semibold"
            style={{ color: colors.foreground }}
          >
            🤖 Android Setup
          </Text>
          <View
            className="p-4 rounded-xl gap-2"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              1. Long press your home screen{'\n'}
              2. Tap "Widgets"{'\n'}
              3. Find and tap "Banana Pro Gym"{'\n'}
              4. Drag to place on home screen
            </Text>
          </View>
        </View>

        {/* Widget Previews Section */}
        <View className="gap-4">
          <View className="gap-2">
            <Text
              className="text-lg font-semibold"
              style={{ color: colors.foreground }}
            >
              Widget Previews
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              These show what your widgets will look like
            </Text>
          </View>

          {/* Small Widget */}
          <View className="gap-2">
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.foreground }}
            >
              Small (2x2)
            </Text>
            <WidgetPreview size="small" data={widgetData || undefined} />
          </View>

          {/* Medium Widget */}
          <View className="gap-2">
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.foreground }}
            >
              Medium (4x2)
            </Text>
            <WidgetPreview size="medium" data={widgetData || undefined} />
          </View>

          {/* Large Widget */}
          <View className="gap-2">
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.foreground }}
            >
              Large (4x4)
            </Text>
            <WidgetPreview size="large" data={widgetData || undefined} />
          </View>
        </View>

        {/* Refresh Button */}
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={isRefreshing}
          className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-lg"
          style={{
            backgroundColor: colors.primary,
            opacity: isRefreshing ? 0.7 : 1,
          }}
        >
          {isRefreshing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              ⟳ Refresh Widget Data
            </Text>
          )}
        </TouchableOpacity>

        {/* Last Updated Info */}
        {lastUpdated && (
          <View
            className="p-3 rounded-lg gap-1"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            <Text className="text-xs" style={{ color: colors.muted }}>
              Last Updated
            </Text>
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.foreground }}
            >
              {lastUpdated}
            </Text>
          </View>
        )}

        {/* Info Box */}
        <View
          className="p-4 rounded-lg gap-2"
          style={{
            backgroundColor: colors.primary,
            opacity: 0.1,
          }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.primary }}
          >
            💡 Pro Tip
          </Text>
          <Text
            className="text-xs"
            style={{ color: colors.primary, lineHeight: 18 }}
          >
            Widget data is automatically synced when you log workouts and update
            your stats. Tap "Refresh Widget Data" to manually force an update.
          </Text>
        </View>

        {/* Technical Details */}
        <View
          className="p-4 rounded-lg gap-3"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.foreground }}
          >
            Technical Details
          </Text>
          <View className="gap-2">
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              • Widget data is stored in device storage and updated automatically
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              • Shows current streak, today's workout, weekly progress, and readiness
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              • Displays next scheduled workout and last updated timestamp
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              • Real-time updates sync across the app and widget extensions
            </Text>
          </View>
        </View>

        {/* Status Message */}
        {widgetData?.updatedAt && (
          <View
            className="p-3 rounded-lg flex-row items-center gap-2"
            style={{
              backgroundColor: '#22C55E',
              opacity: 0.15,
            }}
          >
            <Text style={{ color: '#22C55E', fontSize: 16 }}>✓</Text>
            <Text
              className="flex-1 text-sm"
              style={{ color: '#22C55E' }}
            >
              Widget data is up to date and ready to display
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
