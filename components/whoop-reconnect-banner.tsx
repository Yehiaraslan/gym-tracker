// ============================================================
// WHOOP RECONNECT BANNER
// Shows an amber warning banner when the WHOOP token has expired
// or the connection has failed. Tapping opens the WHOOP screen.
// ============================================================
import { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import * as Haptics from 'expo-haptics';

export function WhoopReconnectBanner() {
  const colors = useColors();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const statusQuery = trpc.whoop.status.useQuery(undefined, {
    retry: 1,
    staleTime: 60_000,
    // Re-check every 5 minutes in the background
    refetchInterval: 5 * 60 * 1000,
  });

  const isConnected = statusQuery.data?.connected ?? false;
  const tokenExpired = statusQuery.data?.tokenExpired ?? false;
  const needsReconnect = isConnected && tokenExpired;

  // Fade in when banner becomes visible
  useEffect(() => {
    if (needsReconnect && !dismissed) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [needsReconnect, dismissed, fadeAnim]);

  // Reset dismissed state if status changes (e.g. user reconnects)
  useEffect(() => {
    if (!needsReconnect) {
      setDismissed(false);
      fadeAnim.setValue(0);
    }
  }, [needsReconnect, fadeAnim]);

  if (!needsReconnect || dismissed || statusQuery.isLoading) return null;

  const handleReconnect = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/(tabs)/whoop' as any);
  };

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        marginBottom: 12,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#F59E0B60',
        backgroundColor: '#F59E0B12',
      }}
    >
      <TouchableOpacity
        onPress={handleReconnect}
        activeOpacity={0.85}
        style={{ padding: 14 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
            {/* Warning icon circle */}
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#F59E0B25',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 18 }}>⚠️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B', letterSpacing: 0.3 }}>
                WHOOP Session Expired
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 }}>
                Your WHOOP token has expired. Tap to reconnect and resume syncing recovery data.
              </Text>
            </View>
          </View>
          {/* Dismiss button */}
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ paddingLeft: 8 }}
          >
            <Text style={{ fontSize: 18, color: colors.muted }}>✕</Text>
          </TouchableOpacity>
        </View>
        {/* Reconnect CTA row */}
        <View style={{
          marginTop: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: '#F59E0B25',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Recovery data paused until reconnected
          </Text>
          <View style={{
            backgroundColor: '#F59E0B20',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#F59E0B50',
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>
              Reconnect →
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
