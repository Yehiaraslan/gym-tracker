// ============================================================
// PIN SYNC SCREEN
// Cross-device sync via a 6-digit PIN
//
// Modes:
//  - Setup: Create a new PIN to start syncing
//  - Login: Enter existing PIN to link this device
//  - Status: View sync status and manage the link
// ============================================================

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { getDeviceId } from '@/lib/device-id';
import {
  loadPinSyncState,
  setPinLinked,
  clearPinLink,
  updateLastSync,
  type PinSyncState,
} from '@/lib/pin-sync-store';
import { loadUserProfile } from '@/lib/profile-store';
import { getSplitWorkouts } from '@/lib/split-workout-store';

// ── PIN Pad ──────────────────────────────────────────────────
const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

function PinDots({ pin, length = 6 }: { pin: string; length?: number }) {
  const colors = useColors();
  return (
    <View style={styles.pinDots}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pinDot,
            {
              backgroundColor: i < pin.length ? colors.primary : 'transparent',
              borderColor: i < pin.length ? colors.primary : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

function PinPad({ onPress }: { onPress: (key: string) => void }) {
  const colors = useColors();
  return (
    <View style={styles.pinPad}>
      {PIN_KEYS.map((key, i) => (
        <TouchableOpacity
          key={i}
          style={[
            styles.pinKey,
            {
              backgroundColor: key ? colors.surface : 'transparent',
              borderColor: colors.border,
            },
          ]}
          onPress={() => key && onPress(key)}
          activeOpacity={key ? 0.6 : 1}
          disabled={!key}
        >
          <Text style={[styles.pinKeyText, { color: colors.foreground }]}>{key}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────
type Mode = 'status' | 'setup' | 'login';

export default function PinSyncScreen() {
  const colors = useColors();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('status');
  const [syncState, setSyncState] = useState<PinSyncState | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const setupOrLoginMutation = trpc.pin.setupOrLogin.useMutation();
  const unlinkMutation = trpc.pin.unlink.useMutation();
  const bulkUpsertWorkouts = trpc.sync.bulkUpsertWorkouts.useMutation();

  useEffect(() => {
    (async () => {
      const [state, id] = await Promise.all([loadPinSyncState(), getDeviceId()]);
      setSyncState(state);
      setDeviceId(id);
      if (!state.linked) setMode('status');
    })();
  }, []);

  const handlePinKey = (key: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === '⌫') {
      if (mode === 'setup' && step === 'confirm') {
        setConfirmPin(p => p.slice(0, -1));
      } else {
        setPin(p => p.slice(0, -1));
      }
      return;
    }

    if (mode === 'setup') {
      if (step === 'enter') {
        const next = pin + key;
        setPin(next);
        if (next.length === 6) {
          // Move to confirm step
          setTimeout(() => setStep('confirm'), 200);
        }
      } else {
        const next = confirmPin + key;
        setConfirmPin(next);
        if (next.length === 6) {
          setTimeout(() => handleSetup(pin, next), 200);
        }
      }
    } else if (mode === 'login') {
      const next = pin + key;
      setPin(next);
      if (next.length === 6) {
        setTimeout(() => handleLogin(next), 200);
      }
    }
  };

  const handleSetup = async (newPin: string, confirm: string) => {
    if (newPin !== confirm) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('PINs do not match', 'Please try again.');
      setPin('');
      setConfirmPin('');
      setStep('enter');
      return;
    }

    setLoading(true);
    try {
      const profile = await loadUserProfile();
      const result = await setupOrLoginMutation.mutateAsync({
        deviceId,
        pin: newPin,
        displayName: profile.name || undefined,
      });

      await setPinLinked(result.userOpenId, profile.name || null);
      const newState = await loadPinSyncState();
      setSyncState(newState);

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result.isNew) {
        Alert.alert(
          '✅ PIN Created',
          `Your sync PIN is set up. Use this PIN on any device to access your data.\n\nYour PIN: ${newPin}\n\nKeep it safe — there's no recovery option.`,
          [{ text: 'Got it', onPress: () => { setMode('status'); setPin(''); setConfirmPin(''); setStep('enter'); } }],
        );
      } else {
        Alert.alert(
          '✅ Linked',
          'This device is now linked to your existing data.',
          [{ text: 'Done', onPress: () => { setMode('status'); setPin(''); setConfirmPin(''); setStep('enter'); } }],
        );
      }
    } catch (err: any) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to set up PIN. Please try again.');
      setPin('');
      setConfirmPin('');
      setStep('enter');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (enteredPin: string) => {
    setLoading(true);
    try {
      const profile = await loadUserProfile();
      const result = await setupOrLoginMutation.mutateAsync({
        deviceId,
        pin: enteredPin,
        displayName: profile.name || undefined,
      });

      await setPinLinked(result.userOpenId, profile.name || null);
      const newState = await loadPinSyncState();
      setSyncState(newState);

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '✅ Device Linked',
        result.isNew
          ? 'New identity created. Your data will now sync to this PIN.'
          : 'This device is now linked to your existing data.',
        [{ text: 'Done', onPress: () => { setMode('status'); setPin(''); } }],
      );
    } catch (err: any) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to link device. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!syncState?.userOpenId) return;
    setSyncing(true);
    try {
      // Sync all local workouts to cloud
      const workouts = await getSplitWorkouts();
      if (workouts.length > 0) {
        await bulkUpsertWorkouts.mutateAsync({
          deviceId: syncState.userOpenId, // use userOpenId as the sync key
          sessions: workouts.map(w => ({
            id: w.id,
            date: w.date,
            sessionType: w.sessionType,
            startTime: w.startTime,
            endTime: w.endTime,
            completed: w.completed,
            durationMinutes: w.durationMinutes,
            totalVolumeKg: w.totalVolume,
            notes: w.notes,
          })),
        });
      }
      await updateLastSync();
      const newState = await loadPinSyncState();
      setSyncState(newState);

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Synced', `${workouts.length} workout sessions synced to cloud.`);
    } catch (err: any) {
      Alert.alert('Sync Failed', err.message || 'Could not sync data. Check your connection.');
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = () => {
    Alert.alert(
      'Unlink Device',
      'This device will no longer sync with your PIN identity. Your local data stays intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              await unlinkMutation.mutateAsync({ deviceId });
              await clearPinLink();
              setSyncState(await loadPinSyncState());
              setMode('status');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to unlink device.');
            }
          },
        },
      ],
    );
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── Render: Status ────────────────────────────────────────
  if (syncState === null) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (mode === 'status') {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <IconSymbol name="chevron.left" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cloud Sync</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Status Card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: syncState.linked ? '#22C55E' : '#94A3B8' }]} />
              <Text style={[styles.statusLabel, { color: colors.foreground }]}>
                {syncState.linked ? 'Linked' : 'Not Linked'}
              </Text>
            </View>

            {syncState.linked ? (
              <>
                <Text style={[styles.statusDetail, { color: colors.muted }]}>
                  Syncing as: {syncState.displayName || 'Anonymous'}
                </Text>
                <Text style={[styles.statusDetail, { color: colors.muted }]}>
                  Linked: {formatDate(syncState.linkedAt)}
                </Text>
                <Text style={[styles.statusDetail, { color: colors.muted }]}>
                  Last sync: {formatDate(syncState.lastSyncAt)}
                </Text>
              </>
            ) : (
              <Text style={[styles.statusDetail, { color: colors.muted }]}>
                Set up a PIN to sync your workouts across devices.
              </Text>
            )}
          </View>

          {/* How it works */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How It Works</Text>
            {[
              { icon: '🔢', text: 'Create a 6-digit PIN on your first device' },
              { icon: '📱', text: 'Enter the same PIN on any other device' },
              { icon: '☁️', text: 'Your workouts sync automatically to the cloud' },
              { icon: '🔒', text: 'PIN is hashed — never stored in plaintext' },
            ].map((item, i) => (
              <View key={i} style={styles.howRow}>
                <Text style={styles.howIcon}>{item.icon}</Text>
                <Text style={[styles.howText, { color: colors.muted }]}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          {syncState.linked ? (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleSync}
                disabled={syncing}
                activeOpacity={0.8}
              >
                {syncing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <IconSymbol name="arrow.triangle.2.circlepath" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Sync Now</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: '#EF4444' }]}
                onPress={handleUnlink}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryBtnText, { color: '#EF4444' }]}>Unlink This Device</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => { setMode('setup'); setPin(''); setConfirmPin(''); setStep('enter'); }}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Create PIN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => { setMode('login'); setPin(''); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                  I Already Have a PIN
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Render: Setup / Login ─────────────────────────────────
  const isSetup = mode === 'setup';
  const isConfirmStep = isSetup && step === 'confirm';
  const currentPin = isConfirmStep ? confirmPin : pin;

  const title = isSetup
    ? (isConfirmStep ? 'Confirm PIN' : 'Create PIN')
    : 'Enter Your PIN';

  const subtitle = isSetup
    ? (isConfirmStep ? 'Enter the same PIN again to confirm' : 'Choose a 6-digit PIN for cross-device sync')
    : 'Enter your PIN to link this device';

  return (
    <ScreenContainer>
      <View style={styles.pinScreen}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setMode('status');
              setPin('');
              setConfirmPin('');
              setStep('enter');
            }}
            style={styles.backBtn}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={[styles.pinSubtitle, { color: colors.muted }]}>{subtitle}</Text>

        {/* PIN Dots */}
        <PinDots pin={currentPin} />

        {/* Loading */}
        {loading && (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        )}

        {/* PIN Pad */}
        {!loading && (
          <PinPad onPress={handlePinKey} />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusDetail: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  howIcon: {
    fontSize: 16,
    marginRight: 10,
    width: 24,
  },
  howText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
  // PIN screen
  pinScreen: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pinSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  pinPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    gap: 12,
    justifyContent: 'center',
  },
  pinKey: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pinKeyText: {
    fontSize: 24,
    fontWeight: '400',
  },
});
