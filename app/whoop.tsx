import { useState, useEffect } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';

const WHOOP_STORAGE_KEY = '@gym_tracker_whoop';

interface WhoopData {
  isConnected: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  recoveryScore?: number;
  strain?: number;
  sleepScore?: number;
  lastSynced?: number;
}

export default function WhoopScreen() {
  const colors = useColors();
  const router = useRouter();
  const [whoopData, setWhoopData] = useState<WhoopData>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWhoopData();
  }, []);

  const loadWhoopData = async () => {
    try {
      const stored = await AsyncStorage.getItem(WHOOP_STORAGE_KEY);
      if (stored) {
        setWhoopData(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading Whoop data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWhoopData = async (data: WhoopData) => {
    try {
      await AsyncStorage.setItem(WHOOP_STORAGE_KEY, JSON.stringify(data));
      setWhoopData(data);
    } catch (error) {
      console.error('Error saving Whoop data:', error);
    }
  };

  const handleConnect = () => {
    Alert.alert(
      'Whoop Integration',
      'To connect your Whoop account, you need to:\n\n' +
      '1. Create an app at developer.whoop.com\n' +
      '2. Get your Client ID and Secret\n' +
      '3. Configure the OAuth redirect URL\n\n' +
      'Would you like to open the Whoop Developer Portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Portal', 
          onPress: () => Linking.openURL('https://developer.whoop.com')
        },
      ]
    );
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Whoop',
      'Are you sure you want to disconnect your Whoop account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: async () => {
            await saveWhoopData({ isConnected: false });
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        },
      ]
    );
  };

  // Simulated data for demonstration
  const handleSimulateConnection = async () => {
    const simulatedData: WhoopData = {
      isConnected: true,
      recoveryScore: 78,
      strain: 12.4,
      sleepScore: 85,
      lastSynced: Date.now(),
    };
    await saveWhoopData(simulatedData);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert('Demo Mode', 'Whoop connection simulated with sample data.');
  };

  const formatLastSynced = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Whoop Integration</Text>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Connection Status Card */}
        <View 
          className="bg-surface rounded-2xl p-6 mb-4"
          style={{ borderWidth: 1, borderColor: colors.border }}
        >
          <View className="flex-row items-center mb-4">
            <View 
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: whoopData.isConnected ? colors.success + '20' : colors.muted + '20',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 28 }}>⌚</Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-lg font-semibold text-foreground">
                {whoopData.isConnected ? 'Connected' : 'Not Connected'}
              </Text>
              <Text className="text-sm text-muted">
                {whoopData.isConnected 
                  ? `Last synced: ${formatLastSynced(whoopData.lastSynced)}`
                  : 'Connect your Whoop to sync recovery data'}
              </Text>
            </View>
            <View 
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: whoopData.isConnected ? colors.success : colors.muted,
              }}
            />
          </View>

          {whoopData.isConnected ? (
            <TouchableOpacity
              onPress={handleDisconnect}
              className="py-3 rounded-xl"
              style={{ backgroundColor: colors.error + '20' }}
            >
              <Text className="text-center font-semibold" style={{ color: colors.error }}>
                Disconnect
              </Text>
            </TouchableOpacity>
          ) : (
            <View>
              <TouchableOpacity
                onPress={handleConnect}
                className="py-3 rounded-xl mb-2"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-center font-semibold text-white">
                  Connect Whoop Account
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSimulateConnection}
                className="py-3 rounded-xl"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                <Text className="text-center font-semibold text-foreground">
                  Try Demo Mode
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recovery Data */}
        {whoopData.isConnected && (
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
                  <Text className="text-3xl font-bold text-foreground">
                    {whoopData.recoveryScore}%
                  </Text>
                </View>
                <View 
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: getRecoveryColor(whoopData.recoveryScore || 0, colors),
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>💚</Text>
                </View>
              </View>
              <Text className="text-sm text-muted mt-2">
                {getRecoveryMessage(whoopData.recoveryScore || 0)}
              </Text>
            </View>

            {/* Strain */}
            <View 
              className="bg-surface rounded-2xl p-5 mb-3"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm text-muted">Day Strain</Text>
                  <Text className="text-3xl font-bold text-foreground">
                    {whoopData.strain?.toFixed(1)}
                  </Text>
                </View>
                <View 
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.warning + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>🔥</Text>
                </View>
              </View>
              <View className="mt-3">
                <View 
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: colors.border }}
                >
                  <View 
                    className="h-full rounded-full"
                    style={{ 
                      width: `${Math.min((whoopData.strain || 0) / 21 * 100, 100)}%`,
                      backgroundColor: colors.warning,
                    }}
                  />
                </View>
                <Text className="text-xs text-muted mt-1">Target: 10-14 for optimal training</Text>
              </View>
            </View>

            {/* Sleep Score */}
            <View 
              className="bg-surface rounded-2xl p-5 mb-6"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm text-muted">Sleep Performance</Text>
                  <Text className="text-3xl font-bold text-foreground">
                    {whoopData.sleepScore}%
                  </Text>
                </View>
                <View 
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.primary + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>😴</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Info Section */}
        <View 
          className="bg-surface rounded-2xl p-5 mb-8"
          style={{ borderWidth: 1, borderColor: colors.border }}
        >
          <Text className="text-sm font-medium text-foreground mb-3">About Whoop Integration</Text>
          <Text className="text-sm text-muted leading-5">
            Connect your Whoop device to see your recovery score, strain, and sleep data 
            directly in the app. This helps you make informed decisions about your workout 
            intensity based on how recovered you are.
          </Text>
          <View className="mt-4 pt-4 border-t" style={{ borderTopColor: colors.border }}>
            <Text className="text-xs text-muted">
              Note: Full Whoop API integration requires setting up OAuth credentials in the 
              Whoop Developer Portal. The demo mode shows sample data for preview purposes.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function getRecoveryColor(score: number, colors: any): string {
  if (score >= 67) return colors.success + '20';
  if (score >= 34) return colors.warning + '20';
  return colors.error + '20';
}

function getRecoveryMessage(score: number): string {
  if (score >= 67) return 'Great recovery! You\'re ready for high intensity training.';
  if (score >= 34) return 'Moderate recovery. Consider a medium intensity workout.';
  return 'Low recovery. Focus on rest and light activity today.';
}
