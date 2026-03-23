import { useState, useEffect, useCallback } from 'react';
import { saveWhoopRecoveryToStorage } from '@/lib/whoop-recovery-service';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { getDeviceId } from '@/lib/device-id';
import * as Haptics from 'expo-haptics';

export default function WhoopScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  // tRPC queries — all require deviceId
  const statusQuery = trpc.whoop.status.useQuery(
    { deviceId: deviceId! },
    { enabled: !!deviceId, retry: 1, staleTime: 30_000 }
  );
  const authUrlQuery = trpc.whoop.authUrl.useQuery(
    { deviceId: deviceId! },
    { enabled: false } // Only fetch when user clicks connect
  );
  const recoveryQuery = trpc.whoop.recovery.useQuery(
    { deviceId: deviceId!, days: 7 },
    { enabled: !!deviceId && statusQuery.data?.connected === true, retry: 1 }
  );
  const sleepQuery = trpc.whoop.sleep.useQuery(
    { deviceId: deviceId!, days: 7 },
    { enabled: !!deviceId && statusQuery.data?.connected === true, retry: 1 }
  );
  const cyclesQuery = trpc.whoop.cycles.useQuery(
    { deviceId: deviceId!, days: 7 },
    { enabled: !!deviceId && statusQuery.data?.connected === true, retry: 1 }
  );

  const disconnectMutation = trpc.whoop.disconnect.useMutation({
    onSuccess: () => {
      statusQuery.refetch();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const isConnected = statusQuery.data?.connected ?? false;
  const tokenExpired = statusQuery.data?.tokenExpired ?? false;
  const profile = statusQuery.data?.profile;
  const isLoading = !deviceId || statusQuery.isLoading;
  const needsReconnect = isConnected && tokenExpired;

  const latestRecovery = recoveryQuery.data?.records?.[0]?.score;
  const latestCycle = cyclesQuery.data?.records?.[0]?.score;
  const latestSleep = sleepQuery.data?.records?.[0]?.score;

  // Persist full WHOOP biometrics to AsyncStorage so Zaki coaching context has HRV, RHR, sleep stages
  useEffect(() => {
    if (!isConnected) return;
    if (!latestRecovery && !latestSleep) return;
    const sleepRecord = sleepQuery.data?.records?.[0];
    const stages = sleepRecord?.score?.stage_summary;
    const totalSleepMs = stages
      ? ((stages as any).total_light_sleep_time_milli ?? 0)
        + ((stages as any).total_slow_wave_sleep_time_milli ?? 0)
        + ((stages as any).total_rem_sleep_time_milli ?? 0)
      : null;
    saveWhoopRecoveryToStorage({
      isConnected: true,
      recoveryScore: latestRecovery?.recovery_score != null ? Math.round(latestRecovery.recovery_score) : undefined,
      strain: latestCycle?.strain ?? undefined,
      sleepScore: latestSleep?.sleep_performance_percentage != null ? Math.round(latestSleep.sleep_performance_percentage) : undefined,
      hrv: latestRecovery?.hrv_rmssd_milli != null ? Math.round(latestRecovery.hrv_rmssd_milli) : null,
      rhr: latestRecovery?.resting_heart_rate != null ? Math.round(latestRecovery.resting_heart_rate) : null,
      spo2: latestRecovery?.spo2_percentage != null ? Math.round(latestRecovery.spo2_percentage) : null,
      sleepDurationHours: totalSleepMs != null ? Math.round((totalSleepMs / 3_600_000) * 10) / 10 : null,
      sleepEfficiency: latestSleep?.sleep_efficiency_percentage != null ? Math.round(latestSleep.sleep_efficiency_percentage) : null,
      sleepConsistency: latestSleep?.sleep_consistency_percentage != null ? Math.round(latestSleep.sleep_consistency_percentage) : null,
      remSleepMinutes: stages ? Math.round(((stages as any).total_rem_sleep_time_milli ?? 0) / 60_000) : null,
      deepSleepMinutes: stages ? Math.round(((stages as any).total_slow_wave_sleep_time_milli ?? 0) / 60_000) : null,
      lightSleepMinutes: stages ? Math.round(((stages as any).total_light_sleep_time_milli ?? 0) / 60_000) : null,
    });
  }, [isConnected, latestRecovery, latestSleep, latestCycle]);

  const handleConnect = async () => {
    if (!deviceId) return;
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const result = await authUrlQuery.refetch();
      if (result.data?.url) {
        await Linking.openURL(result.data.url);
      } else {
        Alert.alert('Error', 'Could not generate WHOOP authorization URL. Please try again.');
      }
    } catch (error) {
      console.error('Error initiating WHOOP OAuth:', error);
      Alert.alert('Connection Error', 'Could not initiate WHOOP connection. Please try again.');
    }
  };

  const handleDisconnect = () => {
    if (!deviceId) return;
    Alert.alert(
      'Disconnect WHOOP',
      'Are you sure you want to disconnect your WHOOP account? Your cached data will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: () => disconnectMutation.mutate({ deviceId }),
        },
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      statusQuery.refetch(),
      recoveryQuery.refetch(),
      sleepQuery.refetch(),
      cyclesQuery.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Checking WHOOP connection...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 8 }}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">WHOOP Integration</Text>
      </View>

      <ScrollView 
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Connection Status Card */}
        <View 
          className="bg-surface rounded-2xl p-6 mb-4"
          style={{
            borderWidth: 1.5,
            borderColor: needsReconnect ? '#F59E0B60' : isConnected ? colors.success + '40' : colors.border,
            backgroundColor: needsReconnect ? '#F59E0B08' : undefined,
          }}
        >
          <View className="flex-row items-center mb-4">
            <View 
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: needsReconnect ? '#F59E0B25' : isConnected ? colors.success + '20' : colors.muted + '20',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 28 }}>{needsReconnect ? '⚠️' : '⌚'}</Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold text-foreground">
                {needsReconnect ? 'Session Expired' : isConnected ? 'Connected' : 'Not Connected'}
              </Text>
              <Text className="text-sm text-muted">
                {needsReconnect
                  ? 'Your WHOOP token has expired — tap Reconnect below'
                  : isConnected 
                    ? profile?.first_name 
                      ? `Welcome, ${profile.first_name}!`
                      : 'WHOOP account linked'
                    : 'Connect your WHOOP to sync recovery data'}
              </Text>
            </View>
            <View 
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: needsReconnect ? '#F59E0B' : isConnected ? colors.success : colors.muted,
              }}
            />
          </View>

          {/* Token expired: show Reconnect + Disconnect */}
          {needsReconnect ? (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={handleConnect}
                disabled={authUrlQuery.isFetching}
                style={{
                  backgroundColor: '#F59E0B',
                  opacity: authUrlQuery.isFetching ? 0.7 : 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {authUrlQuery.isFetching ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Text style={{ fontSize: 16, marginRight: 8 }}>🔄</Text>
                    <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Reconnect WHOOP</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDisconnect}
                disabled={disconnectMutation.isPending}
                style={{ backgroundColor: colors.error + '15', paddingVertical: 10, borderRadius: 12 }}
              >
                <Text style={{ textAlign: 'center', fontSize: 14, color: colors.error }}>
                  {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : isConnected ? (
            <TouchableOpacity
              onPress={handleDisconnect}
              disabled={disconnectMutation.isPending}
              style={{ backgroundColor: colors.error + '20', paddingVertical: 12, borderRadius: 12 }}
            >
              <Text style={{ textAlign: 'center', fontWeight: '600', color: colors.error }}>
                {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleConnect}
              disabled={authUrlQuery.isFetching}
              style={{ 
                backgroundColor: colors.primary,
                opacity: authUrlQuery.isFetching ? 0.7 : 1,
                paddingVertical: 12,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {authUrlQuery.isFetching ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>🔐</Text>
                  <Text style={{ fontWeight: '600', color: '#fff' }}>Connect with WHOOP</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Recovery Data */}
        {isConnected && (
          <>
            <Text className="text-sm font-medium text-muted mb-3">Today's Metrics</Text>
            
            {/* Recovery Score */}
            <View 
              className="bg-surface rounded-2xl p-5 mb-3"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm text-muted">Recovery Score</Text>
                  {recoveryQuery.isLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text className="text-3xl font-bold text-foreground">
                      {latestRecovery?.recovery_score != null 
                        ? `${Math.round(latestRecovery.recovery_score)}%`
                        : '--'}
                    </Text>
                  )}
                </View>
                <View 
                  style={{
                    width: 64, height: 64, borderRadius: 32,
                    backgroundColor: getRecoveryColor(latestRecovery?.recovery_score || 0, colors),
                    justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>
                    {(latestRecovery?.recovery_score ?? 0) >= 67 ? '💚' : 
                     (latestRecovery?.recovery_score ?? 0) >= 34 ? '💛' : '❤️'}
                  </Text>
                </View>
              </View>
              {latestRecovery && (
                <>
                  <Text className="text-sm text-muted mt-2">
                    {getRecoveryMessage(latestRecovery.recovery_score ?? 0)}
                  </Text>
                  <View className="flex-row mt-3" style={{ gap: 16 }}>
                    <View>
                      <Text className="text-xs text-muted">HRV</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {latestRecovery.hrv_rmssd_milli != null 
                          ? `${Math.round(latestRecovery.hrv_rmssd_milli)} ms` : '--'}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-xs text-muted">RHR</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {latestRecovery.resting_heart_rate != null 
                          ? `${Math.round(latestRecovery.resting_heart_rate)} bpm` : '--'}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-xs text-muted">SpO2</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {latestRecovery.spo2_percentage != null 
                          ? `${Math.round(latestRecovery.spo2_percentage)}%` : '--'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Strain */}
            <View 
              className="bg-surface rounded-2xl p-5 mb-3"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm text-muted">Day Strain</Text>
                  {cyclesQuery.isLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text className="text-3xl font-bold text-foreground">
                      {latestCycle?.strain != null ? latestCycle.strain.toFixed(1) : '--'}
                    </Text>
                  )}
                </View>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.warning + '20', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24 }}>🔥</Text>
                </View>
              </View>
              {latestCycle?.strain != null && (
                <View className="mt-3">
                  <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                    <View 
                      className="h-full rounded-full"
                      style={{ width: `${Math.min((latestCycle.strain / 21) * 100, 100)}%`, backgroundColor: colors.warning }}
                    />
                  </View>
                  <Text className="text-xs text-muted mt-1">Target: 10-14 for optimal training</Text>
                </View>
              )}
            </View>

            {/* Sleep */}
            <View 
              className="bg-surface rounded-2xl p-5 mb-6"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm text-muted">Sleep Performance</Text>
                  {sleepQuery.isLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text className="text-3xl font-bold text-foreground">
                      {latestSleep?.sleep_performance_percentage != null 
                        ? `${Math.round(latestSleep.sleep_performance_percentage)}%` : '--'}
                    </Text>
                  )}
                </View>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24 }}>😴</Text>
                </View>
              </View>
              {latestSleep && (
                <View className="flex-row mt-3" style={{ gap: 16 }}>
                  <View>
                    <Text className="text-xs text-muted">Efficiency</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {latestSleep.sleep_efficiency_percentage != null 
                        ? `${Math.round(latestSleep.sleep_efficiency_percentage)}%` : '--'}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-muted">Consistency</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {latestSleep.sleep_consistency_percentage != null 
                        ? `${Math.round(latestSleep.sleep_consistency_percentage)}%` : '--'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* Info Section */}
        <View 
          className="bg-surface rounded-2xl p-5 mb-8"
          style={{ borderWidth: 1, borderColor: colors.border }}
        >
          <Text className="text-sm font-medium text-foreground mb-3">About WHOOP Integration</Text>
          <Text className="text-sm text-muted leading-5">
            Connect your WHOOP device to see your recovery score, strain, and sleep data 
            directly in the app. This helps you make informed decisions about your workout 
            intensity based on how recovered you are.
          </Text>
          <View className="mt-4 pt-4 border-t" style={{ borderTopColor: colors.border }}>
            <Text className="text-xs text-muted">
              {isConnected 
                ? 'Pull down to refresh your WHOOP data. Data is cached for offline access.'
                : 'Tap "Connect with WHOOP" to link your WHOOP account. The OAuth flow will open in your browser.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function getRecoveryColor(score: number, colors: ReturnType<typeof useColors>): string {
  if (score >= 67) return colors.success + '20';
  if (score >= 34) return colors.warning + '20';
  return colors.error + '20';
}

function getRecoveryMessage(score: number): string {
  if (score >= 67) return 'Great recovery! You\'re ready for high intensity training.';
  if (score >= 34) return 'Moderate recovery. Consider a medium intensity workout.';
  return 'Low recovery. Focus on rest and light activity today.';
}
