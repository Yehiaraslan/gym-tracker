// ============================================================
// LOGIN SCREEN
// Email + password accounts, because coaching needs a durable
// identity: a trainer has to be able to address a specific
// athlete next month, on a different phone.
//
// Guest sign-in is kept as a clearly-labelled fallback for
// solo use. A guest cannot be coached — there is no account to
// link — and the copy says so rather than letting someone
// discover it after a trainer sends them a code.
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { GUEST_CODE } from '@/constants/oauth';
import * as Api from '@/lib/_core/api';
import * as Auth from '@/lib/_core/auth';
import { notifyAuthChanged } from '@/hooks/use-auth';

type Mode = 'signin' | 'signup';
type Role = 'user' | 'trainer';

export default function LoginScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('user');

  const persist = async (sessionToken: string, user: any, fallbackMethod: string) => {
    await Auth.setSessionToken(sessionToken);
    await Auth.setUserInfo({
      id: user.id ?? 0,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? fallbackMethod,
      role: user.role ?? null,
      lastSignedIn: new Date(user.lastSignedIn || Date.now()),
    });
    // Wake the root AuthGate so it re-reads storage and routes onward —
    // this screen does not navigate itself.
    notifyAuthChanged();
  };

  const handleAccount = async () => {
    const e = email.trim();
    if (!e || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 10) {
      Alert.alert('Password too short', 'Use at least 10 characters.');
      return;
    }
    try {
      setLoading(true);
      const result =
        mode === 'signup'
          ? await Api.signupWithPassword({ email: e, password, name: name.trim() || undefined, role })
          : await Api.loginWithPassword({ email: e, password });
      await persist(result.sessionToken, result.user, 'password');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(mode === 'signup' ? 'Could not create account' : 'Sign-in failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    try {
      setLoading(true);
      const { sessionToken, user } = await Api.guestLogin(name.trim() || 'Guest', GUEST_CODE);
      await persist(sessionToken, user, 'guest');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Sign-in failed', `Could not reach the server.\n\n${message}`);
    } finally {
      setLoading(false);
    }
  };

  const fg = colors.foreground;
  const mt = colors.muted;
  const pr = colors.primary;
  const isSignup = mode === 'signup';

  const field = {
    color: fg,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  };

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.hero}>
            <Image source={require('@/assets/images/icon.png')} style={s.appIcon} />
            <Text style={[s.title, { color: fg }]}>MY Lifestyle</Text>
            <Text style={[s.subtitle, { color: mt }]}>
              {isSignup
                ? 'Create an account to train, or to coach others.'
                : 'Welcome back.'}
            </Text>
          </View>

          {/* Mode switch */}
          <View style={[s.segment, { borderColor: field.borderColor }]}>
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.segmentBtn, mode === m && { backgroundColor: pr }]}
                onPress={() => setMode(m)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={[s.segmentText, { color: mode === m ? '#fff' : mt }]}>
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.form}>
            {isSignup && (
              <TextInput
                style={[s.input, field]}
                placeholder="Your name"
                placeholderTextColor={mt}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            )}
            <TextInput
              style={[s.input, field]}
              placeholder="Email"
              placeholderTextColor={mt}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
            />
            <TextInput
              style={[s.input, field]}
              placeholder={isSignup ? 'Password (10+ characters)' : 'Password'}
              placeholderTextColor={mt}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {isSignup && (
              <View style={s.roleBlock}>
                <Text style={[s.roleLabel, { color: mt }]}>I am signing up to…</Text>
                <View style={s.roleRow}>
                  {([
                    { key: 'user' as Role, icon: '🏋️', label: 'Train', hint: 'Follow a plan' },
                    { key: 'trainer' as Role, icon: '📋', label: 'Coach', hint: 'Set plans for others' },
                  ]).map((r) => (
                    <TouchableOpacity
                      key={r.key}
                      style={[
                        s.roleCard,
                        { borderColor: role === r.key ? pr : field.borderColor },
                        role === r.key && { backgroundColor: 'rgba(255,255,255,0.06)' },
                      ]}
                      onPress={() => setRole(r.key)}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <Text style={s.roleIcon}>{r.icon}</Text>
                      <Text style={[s.roleName, { color: fg }]}>{r.label}</Text>
                      <Text style={[s.roleHint, { color: mt }]}>{r.hint}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={s.bottom}>
            <TouchableOpacity
              style={[s.signInBtn, { backgroundColor: pr }, loading && { opacity: 0.7 }]}
              onPress={handleAccount}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.signInText}>{isSignup ? 'Create account' : 'Sign in'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGuest} disabled={loading} activeOpacity={0.7}>
              <Text style={[s.guestLink, { color: mt }]}>Continue without an account</Text>
            </TouchableOpacity>
            <Text style={[s.disclaimer, { color: mt }]}>
              Without an account your data stays on this device only, and a coach
              cannot be linked to you.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 28, justifyContent: 'space-between', paddingBottom: 24 },
  hero: { alignItems: 'center', paddingTop: 36, gap: 10 },
  appIcon: { width: 76, height: 76, borderRadius: 20, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, marginTop: 24, gap: 4 },
  segmentBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '700' },
  form: { gap: 12, paddingTop: 18 },
  input: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 16 },
  roleBlock: { gap: 10, paddingTop: 4 },
  roleLabel: { fontSize: 13, fontWeight: '600' },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleCard: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 3 },
  roleIcon: { fontSize: 24 },
  roleName: { fontSize: 15, fontWeight: '700' },
  roleHint: { fontSize: 11, textAlign: 'center' },
  bottom: { alignItems: 'center', paddingTop: 26, gap: 12 },
  signInBtn: { width: '100%', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  signInText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  guestLink: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  disclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
});
