// ============================================================
// RECOVERY BANNER — WHOOP recovery status for split workout
// ============================================================

import { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getTodayRecoveryData, type RecoveryData } from '@/lib/whoop-recovery-service';

interface RecoveryBannerProps {
  onSuggestDeload?: () => void;
}

export function RecoveryBanner({ onSuggestDeload }: RecoveryBannerProps) {
  const colors = useColors();
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);

  useEffect(() => {
    getTodayRecoveryData().then(data => setRecovery(data));
  }, []);

  if (!recovery) return null;

  const score = recovery.recoveryScore;

  // Color and messaging based on WHOOP zones
  let zone: { color: string; bg: string; label: string; message: string; icon: string };
  if (score >= 67) {
    zone = {
      color: '#10B981',
      bg: '#10B98112',
      label: 'Green',
      message: 'Excellent recovery — train hard today!',
      icon: '🟢',
    };
  } else if (score >= 34) {
    zone = {
      color: '#F59E0B',
      bg: '#F59E0B12',
      label: 'Yellow',
      message: 'Moderate recovery — consider reducing intensity',
      icon: '🟡',
    };
  } else {
    zone = {
      color: '#EF4444',
      bg: '#EF444412',
      label: 'Red',
      message: 'Low recovery — rest or light session recommended',
      icon: '🔴',
    };
  }

  return (
    <View
      className="rounded-2xl p-4 mb-4"
      style={{ backgroundColor: zone.bg, borderWidth: 1.5, borderColor: zone.color + '35' }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Text style={{ fontSize: 14 }}>{zone.icon}</Text>
          <Text className="text-xs font-medium ml-1.5" style={{ color: zone.color, textTransform: 'uppercase', letterSpacing: 1 }}>
            WHOOP Recovery
          </Text>
        </View>
        <Text className="text-xs text-muted">{zone.label} Zone</Text>
      </View>

      <View className="flex-row items-center">
        <Text className="text-3xl font-black" style={{ color: zone.color }}>
          {Math.round(score)}%
        </Text>
        <View className="ml-3 flex-1">
          <Text className="text-sm text-foreground">{zone.message}</Text>
        </View>
      </View>

      {/* Extra metrics */}
      <View className="flex-row mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: zone.color + '20', gap: 16 }}>
        {recovery.strain > 0 && (
          <View>
            <Text className="text-xs text-muted">Strain</Text>
            <Text className="text-sm font-semibold text-foreground">{recovery.strain.toFixed(1)}</Text>
          </View>
        )}
        {recovery.sleepScore > 0 && (
          <View>
            <Text className="text-xs text-muted">Sleep</Text>
            <Text className="text-sm font-semibold text-foreground">{recovery.sleepScore}%</Text>
          </View>
        )}
      </View>

      {/* Auto-deload suggestion if recovery is red */}
      {score < 34 && onSuggestDeload && (
        <TouchableOpacity
          onPress={onSuggestDeload}
          className="mt-3 py-2.5 rounded-xl items-center"
          style={{ backgroundColor: zone.color + '20' }}
        >
          <Text className="text-sm font-semibold" style={{ color: zone.color }}>
            💤 Switch to Deload Mode
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
