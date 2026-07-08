// ============================================================
// LOGIN SCREEN
// First screen shown to unauthenticated users.
// Self-hosted deployments have no Manus OAuth portal, so sign-in
// mints a guest session from our own backend instead.
// ============================================================
import { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { GUEST_CODE } from '@/constants/oauth';
import * as Api from '@/lib/_core/api';
import * as Auth from '@/lib/_core/auth';
import { notifyAuthChanged } from '@/hooks/use-auth';

export default function LoginScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const { sessionToken, user } = await Api.guestLogin('Yehia', GUEST_CODE);

      await Auth.setSessionToken(sessionToken);
      await Auth.setUserInfo({
        id: user.id ?? 0,
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? 'guest',
        lastSignedIn: new Date(user.lastSignedIn || Date.now()),
      });

      // Wake the root AuthGate so it re-reads storage and routes to
      // onboarding / tabs — this screen doesn't navigate itself.
      notifyAuthChanged();
    } catch (error) {
      console.error('[Login] Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Sign-in failed', `Could not reach the server.\n\n${message}`);
    } finally {
      setLoading(false);
    }
  };

  const fg = colors.foreground;
  const mt = colors.muted;
  const pr = colors.primary;
  const bg = colors.background;

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.container}>
        {/* Hero section */}
        <View style={s.hero}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={s.appIcon}
          />
          <Text style={[s.title, { color: fg }]}>Banana Pro Gym</Text>
          <Text style={[s.subtitle, { color: mt }]}>
            AI-powered workout tracking with personalized coaching by Zaki
          </Text>
        </View>

        {/* Features list */}
        <View style={s.features}>
          {[
            { icon: '📊', text: 'Track workouts, nutrition & body composition' },
            { icon: '🤖', text: 'AI Coach Zaki adapts your training in real-time' },
            { icon: '⌚', text: 'WHOOP recovery integration for smart scheduling' },
            { icon: '🎯', text: 'Personalized mesocycle programming' },
          ].map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={[s.featureText, { color: fg }]}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Sign in button */}
        <View style={s.bottom}>
          <TouchableOpacity
            style={[s.signInBtn, { backgroundColor: pr }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.signInText}>Sign In to Get Started</Text>
            )}
          </TouchableOpacity>
          <Text style={[s.disclaimer, { color: mt }]}>
            Your data is stored securely and synced across devices
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  appIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  features: {
    gap: 16,
    paddingVertical: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    lineHeight: 21,
  },
  bottom: {
    alignItems: 'center',
    paddingBottom: 40,
    gap: 14,
  },
  signInBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
  },
});
