// ============================================================
// AGENT ZAKI COACHING DASHBOARD
// Real AI coaching via openclaw-bridge MCP — Agent Zaki
// Receives actual WHOOP, workout, nutrition data and responds
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { buildUserSnapshot, snapshotToPromptContext } from '@/lib/ai-data-aggregator';
import { getSplitWorkouts } from '@/lib/split-workout-store';
import { getDeviceId } from '@/lib/device-id';

// ── Storage keys ──────────────────────────────────────────────
const DAILY_CACHE_KEY = '@zaki_daily_cache';
const DAILY_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const DEBRIEF_HISTORY_KEY = '@zaki_debrief_history';
const CHAT_HISTORY_KEY = '@zaki_chat_history';
const ZAKI_SESSION_KEY = '@zaki_session_id';
const MAX_DEBRIEF_HISTORY = 5;
const MAX_CHAT_HISTORY = 20;

interface DailyCacheEntry {
  timestamp: number;
  response: string;
  contextSummary: string;
}

interface DebriefEntry {
  timestamp: number;
  response: string;
  sessionCount: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'zaki';
  text: string;
  timestamp: number;
}

export default function AICoachingDashboard() {
  const colors = useColors();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // ── Tab state ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'daily' | 'debrief' | 'chat' | 'weekly'>('daily');

  // ── Daily coaching state ──────────────────────────────────
  const [dailyResponse, setDailyResponse] = useState<string | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailyContextSummary, setDailyContextSummary] = useState('');

  // ── Session debrief state ─────────────────────────────────
  const [debriefResponse, setDebriefResponse] = useState<string | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefError, setDebriefError] = useState<string | null>(null);
  const [debriefHistory, setDebriefHistory] = useState<DebriefEntry[]>([]);
  const [showDebriefHistory, setShowDebriefHistory] = useState(false);

  // ── Chat state ────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  // Zaki conversation session ID — persisted so context survives app restarts
  const zakiSessionIdRef = useRef<string | undefined>(undefined);

  // ── Weekly digest state ───────────────────────────────────
  const [weeklyResponse, setWeeklyResponse] = useState<string | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  // ── Device ID (for server-side session persistence) ─────────
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => { getDeviceId().then(setDeviceId); }, []);

  // ── tRPC mutations ────────────────────────────────────────
  const zakiDailyMutation = trpc.zaki.dailyCoaching.useMutation();
  const zakiDebriefMutation = trpc.zaki.sessionDebrief.useMutation();
  const zakiAskMutation = trpc.zaki.ask.useMutation();
  const zakiWeeklyMutation = trpc.zaki.weeklyDigest.useMutation();
  const triggerDigestMutation = trpc.zaki.triggerDailyDigest.useMutation();
  const personalizedDigestMutation = trpc.zaki.personalizedDigest.useMutation();
  const saveSessionMutation = trpc.zaki.saveSession.useMutation();

  // ── Load Zaki session ID from server DB on mount ──────────
  const serverSessionQuery = trpc.zaki.getSession.useQuery(
    { deviceId: deviceId! },
    { enabled: !!deviceId, staleTime: Infinity, retry: 1 }
  );
  useEffect(() => {
    if (serverSessionQuery.data?.zakiSessionId && !zakiSessionIdRef.current) {
      zakiSessionIdRef.current = serverSessionQuery.data.zakiSessionId;
    }
  }, [serverSessionQuery.data]);
  const [digestTriggerLoading, setDigestTriggerLoading] = useState(false);
  const [digestTriggerResult, setDigestTriggerResult] = useState<string | null>(null);

  // ── Body composition analysis state ──────────────────────
  const [bodyCompLoading, setBodyCompLoading] = useState(false);
  const [bodyCompResult, setBodyCompResult] = useState<string | null>(null);
  const [bodyCompError, setBodyCompError] = useState<string | null>(null);
  const uploadPhotoMutation = trpc.zaki.uploadProgressPhoto.useMutation();
  const analyzeBodyMutation = trpc.zaki.analyzeBodyComposition.useMutation();

  const handleAnalyzeBodyComposition = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBodyCompLoading(true);
    setBodyCompResult(null);
    setBodyCompError(null);
    try {
      const { getProgressPhotos } = await import('@/lib/progress-photos');
      const photos = await getProgressPhotos();
      if (photos.length === 0) {
        setBodyCompError('No progress photos found. Add photos in the Progress Gallery first.');
        setBodyCompLoading(false);
        return;
      }
      // Take the most recent photo per category (up to 4)
      const byCategory = new Map<string, typeof photos[0]>();
      for (const p of photos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())) {
        const cat = p.category || 'other';
        if (!byCategory.has(cat)) byCategory.set(cat, p);
      }
      const selected = Array.from(byCategory.values()).slice(0, 4);
      // Upload each to S3 to get a public URL for Zaki to analyze
      const FileSystem = await import('expo-file-system/legacy');
      const uploadedPhotos: { url: string; category: string; date: string }[] = [];
      for (const photo of selected) {
        try {
          const base64 = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
          const result = await uploadPhotoMutation.mutateAsync({
            deviceId: deviceId || 'unknown',
            base64,
            mimeType: 'image/jpeg',
            category: photo.category || 'other',
            date: photo.date,
          });
          uploadedPhotos.push({ url: result.url, category: photo.category || 'other', date: photo.date });
        } catch (uploadErr) {
          console.warn('[BodyComp] Failed to upload photo:', uploadErr);
        }
      }
      if (uploadedPhotos.length === 0) {
        setBodyCompError('Could not upload photos for analysis. Check your connection.');
        setBodyCompLoading(false);
        return;
      }
      const snapshot = await buildUserSnapshot();
      const context = snapshotToPromptContext(snapshot);
      const result = await analyzeBodyMutation.mutateAsync({
        deviceId: deviceId || 'unknown',
        photoUrls: uploadedPhotos,
        userContext: context,
        zakiSessionId: zakiSessionIdRef.current,
      });
      setBodyCompResult(result.analysis);
      if (result.zakiSessionId) {
        zakiSessionIdRef.current = result.zakiSessionId;
      }
    } catch (err) {
      console.error('[BodyComp]', err);
      setBodyCompError('Could not analyze photos. Please try again.');
    } finally {
      setBodyCompLoading(false);
    }
  }, [uploadPhotoMutation, analyzeBodyMutation, deviceId]);

  const handleTriggerDigest = useCallback(async () => {
    setDigestTriggerLoading(true);
    setDigestTriggerResult(null);
    try {
      // Pull yesterday's workout from AsyncStorage for personalised brief
      const allWorkouts = await getSplitWorkouts();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yDate = yesterday.toISOString().split('T')[0];
      const yWorkout = allWorkouts
        .filter(w => w.completed && w.date.startsWith(yDate))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

      // Find top lift (highest single-set weight across all exercises)
      let topExercise: string | undefined;
      let topWeight: number | undefined;
      if (yWorkout) {
        for (const ex of yWorkout.exercises) {
          for (const s of ex.sets) {
            if (!topWeight || s.weightKg > topWeight) {
              topWeight = s.weightKg;
              topExercise = ex.exerciseName;
            }
          }
        }
      }

      const result = await personalizedDigestMutation.mutateAsync({
        yesterdayWorkout: yWorkout ? {
          sessionName: yWorkout.sessionType,
          durationMinutes: yWorkout.durationMinutes,
          totalVolume: yWorkout.totalVolume,
          exerciseCount: yWorkout.exercises.filter(e => !e.skipped).length,
          topExercise,
          topWeight,
        } : undefined,
      });
      setDigestTriggerResult(result.success
        ? `✅ Sent! Preview: "${result.preview.substring(0, 120)}…"`
        : '⚠️ Zaki responded but notification delivery failed.');
    } catch {
      setDigestTriggerResult('❌ Failed to reach Zaki. Check server logs.');
    } finally {
      setDigestTriggerLoading(false);
    }
  }, [personalizedDigestMutation]);

  // ── Load persisted data ───────────────────────────────────
  const loadPersistedData = useCallback(async () => {
    try {
      const dailyRaw = await AsyncStorage.getItem(DAILY_CACHE_KEY);
      if (dailyRaw) {
        const cached: DailyCacheEntry = JSON.parse(dailyRaw);
        if (Date.now() - cached.timestamp < DAILY_CACHE_TTL) {
          setDailyResponse(cached.response);
          setDailyContextSummary(cached.contextSummary);
        }
      }
      const debriefRaw = await AsyncStorage.getItem(DEBRIEF_HISTORY_KEY);
      if (debriefRaw) setDebriefHistory(JSON.parse(debriefRaw));
      const chatRaw = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
      if (chatRaw) setChatMessages(JSON.parse(chatRaw));
      const savedSessionId = await AsyncStorage.getItem(ZAKI_SESSION_KEY);
      if (savedSessionId) zakiSessionIdRef.current = savedSessionId;
    } catch {}
  }, []);

  useEffect(() => {
    loadPersistedData();
  }, []);

  // ── Daily coaching ────────────────────────────────────────
  const fetchDailyCoaching = useCallback(async (force = false) => {
    if (!force && dailyResponse) return;
    setDailyLoading(true);
    setDailyError(null);
    try {
      const snapshot = await buildUserSnapshot();
      const recoveryScore = snapshot.recovery.available ? snapshot.recovery.score : undefined;
      const hrv = snapshot.recovery.available ? snapshot.recovery.hrv : undefined;
      const lastWorkout = snapshot.recentWorkouts[0]
        ? {
            name: snapshot.recentWorkouts[0].sessionName,
            volume: snapshot.recentWorkouts[0].totalVolume,
            date: snapshot.recentWorkouts[0].date,
          }
        : undefined;
      const recentWorkouts = snapshot.recentWorkouts.slice(0, 3).map(w => ({
        name: w.sessionName,
        volume: w.totalVolume,
        date: w.date,
        notes: w.notes,
      }));
      const todayNutrition = snapshot.recentNutrition[0];
      const result = await zakiDailyMutation.mutateAsync({
        recoveryScore: recoveryScore ?? undefined,
        hrv: hrv ?? undefined,
        todaySession: snapshot.todaySessionName,
        lastWorkout,
        recentWorkouts,
        todayCalories: todayNutrition?.totalCalories,
        todayProtein: todayNutrition?.totalProtein,
        calorieTarget: todayNutrition?.targetCalories,
        mesocycleWeek: snapshot.mesocycleWeek,
        totalWeeks: snapshot.mesocycleTotalWeeks,
        isDeloadWeek: snapshot.daysUntilDeload === 0,
      });
      setDailyResponse(result.response);
      const parts: string[] = [];
      if (recoveryScore != null) parts.push(`Recovery: ${recoveryScore}%`);
      if (snapshot.workoutsThisWeek > 0) parts.push(`${snapshot.workoutsThisWeek} workouts this week`);
      if (todayNutrition) parts.push(`${todayNutrition.totalCalories}kcal today`);
      const summary = parts.join(' · ');
      setDailyContextSummary(summary);
      const cacheEntry: DailyCacheEntry = {
        timestamp: Date.now(),
        response: result.response,
        contextSummary: summary,
      };
      await AsyncStorage.setItem(DAILY_CACHE_KEY, JSON.stringify(cacheEntry));
    } catch (err) {
      console.error('[Zaki Daily]', err);
      setDailyError('Could not reach Agent Zaki. Check your connection and try again.');
    } finally {
      setDailyLoading(false);
    }
  }, [dailyResponse, zakiDailyMutation]);

  useEffect(() => {
    fetchDailyCoaching();
  }, []);

  // ── Session debrief ───────────────────────────────────────
  const runDebrief = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDebriefLoading(true);
    setDebriefError(null);
    try {
      const sessions = await getSplitWorkouts();
      const recent = sessions
        .filter(s => s.completed)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);
      if (recent.length === 0) {
        setDebriefError('No completed workouts found yet.');
        setDebriefLoading(false);
        return;
      }
      const notesContext = recent.map((s, i) => {
        const exerciseLines = s.exercises
          .filter(e => !e.skipped)
          .map(e => {
            const sets = e.sets;
            if (sets.length === 0) return `  - ${e.exerciseName}`;
            const bestSet = sets.reduce((best, st) => (st.weightKg > best.weightKg ? st : best), sets[0]);
            return `  - ${e.exerciseName}: ${sets.length} sets, best ${bestSet.weightKg}kg x ${bestSet.reps}`;
          });
        return [
          `Session ${i + 1} - ${new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
          `Type: ${s.sessionType}`,
          exerciseLines.join('\n'),
          s.notes ? `Notes: "${s.notes}"` : 'Notes: (none)',
        ].join('\n');
      }).join('\n\n');
      const snapshot = await buildUserSnapshot();
      const context = snapshotToPromptContext(snapshot);
      const result = await zakiDebriefMutation.mutateAsync({
        sessionNotesContext: notesContext,
        userContext: context,
      });
      setDebriefResponse(result.response);
      const newEntry: DebriefEntry = {
        timestamp: Date.now(),
        response: result.response,
        sessionCount: recent.length,
      };
      const updated = [newEntry, ...debriefHistory].slice(0, MAX_DEBRIEF_HISTORY);
      setDebriefHistory(updated);
      await AsyncStorage.setItem(DEBRIEF_HISTORY_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('[Zaki Debrief]', err);
      setDebriefError('Could not generate debrief. Please try again.');
    } finally {
      setDebriefLoading(false);
    }
  }, [zakiDebriefMutation, debriefHistory]);

  // ── Chat with Zaki ────────────────────────────────────────
  const sendChatMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const snapshot = await buildUserSnapshot();
      const contextLine = snapshotToPromptContext(snapshot).split('\n').slice(0, 6).join('\n');
      const fullMessage = `[Context]\n${contextLine}\n\n[Question]\n${text}`;
      const result = await zakiAskMutation.mutateAsync({
        message: fullMessage,
        zakiSessionId: zakiSessionIdRef.current,
      });
      // Persist the session ID for conversation continuity
      if (result.zakiSessionId) {
        zakiSessionIdRef.current = result.zakiSessionId;
        await AsyncStorage.setItem(ZAKI_SESSION_KEY, result.zakiSessionId);
        // Also save to server DB so session survives reinstalls
        if (deviceId) {
          saveSessionMutation.mutate({ deviceId, zakiSessionId: result.zakiSessionId });
        }
      }
      const zakiMsg: ChatMessage = {
        id: `z_${Date.now()}`,
        role: 'zaki',
        text: result.response,
        timestamp: Date.now(),
      };
      const withZaki = [...updatedMessages, zakiMsg];
      setChatMessages(withZaki);
      const toSave = withZaki.slice(-MAX_CHAT_HISTORY);
      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error('[Zaki Chat]', err);
      const errMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: 'zaki',
        text: 'I could not process that right now. Please try again.',
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, zakiAskMutation]);

  // ── Weekly digest ─────────────────────────────────────────
  const fetchWeeklyDigest = useCallback(async () => {
    setWeeklyLoading(true);
    setWeeklyError(null);
    try {
      const snapshot = await buildUserSnapshot();
      const context = snapshotToPromptContext(snapshot);
      const result = await zakiWeeklyMutation.mutateAsync({ userContext: context });
      setWeeklyResponse(result.response);
    } catch (err) {
      console.error('[Zaki Weekly]', err);
      setWeeklyError('Could not generate weekly digest. Please try again.');
    } finally {
      setWeeklyLoading(false);
    }
  }, [zakiWeeklyMutation]);

  // ── Refresh ───────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeTab === 'daily') {
      setDailyResponse(null);
      await fetchDailyCoaching(true);
    } else if (activeTab === 'weekly') {
      await fetchWeeklyDigest();
    }
    setRefreshing(false);
  }, [activeTab, fetchDailyCoaching, fetchWeeklyDigest]);

  const tabs = [
    { key: 'daily' as const, label: 'Daily', icon: '⚡' },
    { key: 'debrief' as const, label: 'Debrief', icon: '📓' },
    { key: 'chat' as const, label: 'Ask Zaki', icon: '💬' },
    { key: 'weekly' as const, label: 'Weekly', icon: '📊' },
  ];

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Agent Zaki</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={[styles.headerSub, { color: colors.muted }]}>
              Your AI coach — powered by real data
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ fontSize: 16 }}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* ── Tab Bar ── */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.tabItem,
                activeTab === tab.key && { borderBottomColor: '#6366F1', borderBottomWidth: 2 },
              ]}
            >
              <Text style={{ fontSize: 14 }}>{tab.icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === tab.key ? '#6366F1' : colors.muted },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab Content ── */}
        {activeTab === 'chat' ? (
          <View style={{ flex: 1 }}>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 12 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            >
              {chatMessages.length === 0 && (
                <View style={[styles.zakiBubble, { backgroundColor: '#6366F115', borderColor: '#6366F130' }]}>
                  <View style={styles.zakiAvatar}>
                    <Text style={{ fontSize: 18 }}>🤖</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.zakiName, { color: '#6366F1' }]}>Agent Zaki</Text>
                    <Text style={[styles.bubbleText, { color: colors.foreground }]}>
                      Hey Yehia — I have full access to your WHOOP data, workout history, and nutrition logs. Ask me anything: training advice, exercise substitutions, recovery questions, or how to push through a plateau.
                    </Text>
                  </View>
                </View>
              )}
              {chatMessages.map(msg => (
                <View key={msg.id}>
                  {msg.role === 'zaki' && (
                    <View style={[styles.zakiBubble, { backgroundColor: '#6366F115', borderColor: '#6366F130' }]}>
                      <View style={styles.zakiAvatar}>
                        <Text style={{ fontSize: 18 }}>🤖</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.zakiName, { color: '#6366F1' }]}>Agent Zaki</Text>
                        <Text style={[styles.bubbleText, { color: colors.foreground }]}>{msg.text}</Text>
                      </View>
                    </View>
                  )}
                  {msg.role === 'user' && (
                    <View style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                      <View style={[styles.userBubbleInner, { backgroundColor: '#6366F1' }]}>
                        <Text style={[styles.bubbleText, { color: '#FFFFFF' }]}>{msg.text}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
              {chatLoading && (
                <View style={[styles.zakiBubble, { backgroundColor: '#6366F115', borderColor: '#6366F130' }]}>
                  <View style={styles.zakiAvatar}>
                    <Text style={{ fontSize: 18 }}>🤖</Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={{ color: colors.muted, fontSize: 13 }}>Zaki is thinking...</Text>
                  </View>
                </View>
              )}
            </ScrollView>
            <View style={[styles.chatInputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.chatInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask Zaki anything..."
                placeholderTextColor={colors.muted}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={sendChatMessage}
              />
              <TouchableOpacity
                onPress={sendChatMessage}
                disabled={!chatInput.trim() || chatLoading}
                style={[
                  styles.sendBtn,
                  { backgroundColor: chatInput.trim() && !chatLoading ? '#6366F1' : colors.border },
                ]}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16 }}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
            }
          >
            {/* ── DAILY TAB ── */}
            {activeTab === 'daily' && (
              <View style={styles.tabContent}>
                {dailyContextSummary ? (
                  <View style={[styles.contextPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={{ fontSize: 10, color: colors.muted }}>📡 DATA USED: {dailyContextSummary}</Text>
                  </View>
                ) : null}

                {dailyLoading ? (
                  <View style={styles.loadingCard}>
                    <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🤖</Text>
                    <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
                      Zaki is analyzing your data...
                    </Text>
                    <Text style={[styles.loadingSubtitle, { color: colors.muted }]}>
                      Checking WHOOP recovery, workout history, and nutrition
                    </Text>
                    <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
                  </View>
                ) : dailyError ? (
                  <View style={[styles.errorCard, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={{ color: '#991B1B', fontSize: 14, marginBottom: 8 }}>{dailyError}</Text>
                    <TouchableOpacity onPress={() => fetchDailyCoaching(true)}>
                      <Text style={{ color: '#DC2626', fontWeight: '700' }}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : dailyResponse ? (
                  <View style={[styles.responseCard, { backgroundColor: '#6366F108', borderColor: '#6366F130' }]}>
                    <View style={styles.zakiHeaderRow}>
                      <View style={styles.zakiAvatarLg}>
                        <Text style={{ fontSize: 28 }}>🤖</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.zakiNameLg, { color: '#6366F1' }]}>Agent Zaki</Text>
                        <Text style={[styles.zakiTimestamp, { color: colors.muted }]}>
                          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.responseText, { color: colors.foreground }]}>
                      {dailyResponse}
                    </Text>
                    <TouchableOpacity
                      onPress={() => fetchDailyCoaching(true)}
                      style={[styles.refreshSmallBtn, { borderColor: '#6366F140' }]}
                    >
                      <Text style={{ color: '#6366F1', fontSize: 12, fontWeight: '600' }}>🔄 Refresh coaching</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                    <Text style={{ fontSize: 48, textAlign: 'center' }}>🤖</Text>
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                      Get your daily coaching
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                      Zaki will analyze your WHOOP recovery, recent workouts, and nutrition to give you personalized advice.
                    </Text>
                    <TouchableOpacity
                      onPress={() => fetchDailyCoaching(true)}
                      style={[styles.ctaBtn, { backgroundColor: '#6366F1' }]}
                    >
                      <Text style={styles.ctaBtnText}>Ask Zaki for Today's Plan</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[styles.quickPromptsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.sectionLabel, { color: colors.muted }]}>QUICK QUESTIONS FOR ZAKI</Text>
                  {[
                    'Should I push hard today or take it easy?',
                    'What should I eat before my workout?',
                    'How is my recovery trend this week?',
                  ].map((prompt, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        setActiveTab('chat');
                        setChatInput(prompt);
                      }}
                      style={[styles.promptChip, { borderColor: '#6366F130', backgroundColor: '#6366F108' }]}
                    >
                      <Text style={{ fontSize: 13, color: '#6366F1', flex: 1 }}>{prompt}</Text>
                      <Text style={{ color: '#6366F1', fontSize: 14 }}>→</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── DEBRIEF TAB ── */}
            {activeTab === 'debrief' && (
              <View style={styles.tabContent}>
                <View style={[styles.card, { backgroundColor: '#6366F108', borderColor: '#6366F130' }]}>
                  <View style={styles.zakiHeaderRow}>
                    <View style={styles.zakiAvatarLg}>
                      <Text style={{ fontSize: 28 }}>🤖</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.zakiNameLg, { color: '#6366F1' }]}>Session Debrief</Text>
                      <Text style={[styles.zakiTimestamp, { color: colors.muted }]}>
                        Pattern analysis across last 3 sessions
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cardBody, { color: colors.muted, marginBottom: 14 }]}>
                    Zaki will analyze your recent workout data and session notes to identify physical patterns, energy trends, and give you one concrete coaching recommendation.
                  </Text>

                  {debriefResponse ? (
                    <View style={{ gap: 12 }}>
                      <Text style={[styles.responseText, { color: colors.foreground }]}>
                        {debriefResponse}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setDebriefResponse(null)}
                        style={{ alignSelf: 'flex-end' }}
                      >
                        <Text style={{ fontSize: 12, color: colors.muted }}>Clear ×</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={runDebrief}
                      disabled={debriefLoading}
                      style={[styles.ctaBtn, { backgroundColor: '#6366F1', alignSelf: 'flex-start' }]}
                    >
                      {debriefLoading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.ctaBtnText}>Analyzing sessions...</Text>
                        </View>
                      ) : (
                        <Text style={styles.ctaBtnText}>Run Session Debrief</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {debriefError && (
                    <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 8 }}>{debriefError}</Text>
                  )}
                </View>

                {debriefHistory.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => setShowDebriefHistory(v => !v)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#6366F1' }}>
                        {showDebriefHistory ? '▲' : '▼'} PAST DEBRIEFS ({debriefHistory.length})
                      </Text>
                    </TouchableOpacity>
                    {showDebriefHistory && debriefHistory.map((entry, idx) => (
                      <View
                        key={idx}
                        style={[styles.historyEntry, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 6 }}>
                          {new Date(entry.timestamp).toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })} · {entry.sessionCount} sessions analyzed
                        </Text>
                        <Text style={[styles.historyText, { color: colors.foreground }]} numberOfLines={6}>
                          {entry.response}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── WEEKLY TAB ── */}
            {activeTab === 'weekly' && (
              <View style={styles.tabContent}>
                {/* Weekly digest — loading / error / response / empty */}
                {weeklyLoading ? (
                  <View style={styles.loadingCard}>
                    <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>📊</Text>
                    <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
                      Generating weekly digest...
                    </Text>
                    <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
                  </View>
                ) : weeklyError ? (
                  <View style={[styles.errorCard, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={{ color: '#991B1B', fontSize: 14, marginBottom: 8 }}>{weeklyError}</Text>
                    <TouchableOpacity onPress={fetchWeeklyDigest}>
                      <Text style={{ color: '#DC2626', fontWeight: '700' }}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : weeklyResponse ? (
                  <View style={[styles.responseCard, { backgroundColor: '#6366F108', borderColor: '#6366F130' }]}>
                    <View style={styles.zakiHeaderRow}>
                      <View style={styles.zakiAvatarLg}>
                        <Text style={{ fontSize: 28 }}>🤖</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.zakiNameLg, { color: '#6366F1' }]}>Weekly Digest</Text>
                        <Text style={[styles.zakiTimestamp, { color: colors.muted }]}>
                          Performance review by Agent Zaki
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.responseText, { color: colors.foreground }]}>
                      {weeklyResponse}
                    </Text>
                    <TouchableOpacity
                      onPress={fetchWeeklyDigest}
                      style={[styles.refreshSmallBtn, { borderColor: '#6366F140' }]}
                    >
                      <Text style={{ color: '#6366F1', fontSize: 12, fontWeight: '600' }}>🔄 Regenerate</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                    <Text style={{ fontSize: 48, textAlign: 'center' }}>📊</Text>
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                      Weekly Performance Review
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                      Zaki will grade your week, highlight your best performances, and build a plan for next week.
                    </Text>
                    <TouchableOpacity
                      onPress={fetchWeeklyDigest}
                      style={[styles.ctaBtn, { backgroundColor: '#6366F1' }]}
                    >
                      <Text style={styles.ctaBtnText}>Generate Weekly Digest</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Always-visible utility cards below the digest */}
                {!weeklyLoading && (
                  <>

                  {/* Daily Digest Test Panel */}
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface, marginTop: 12 }]}>
                    <Text style={{ fontSize: 32, textAlign: 'center' }}>🔔</Text>
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                      Morning Brief Notification
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                      Auto-fires daily at 07:00 Dubai time. Tap below to send one now.
                    </Text>
                    <TouchableOpacity
                      onPress={handleTriggerDigest}
                      style={[styles.ctaBtn, { backgroundColor: '#F59E0B', opacity: digestTriggerLoading ? 0.6 : 1 }]}
                    >
                      <Text style={styles.ctaBtnText}>
                        {digestTriggerLoading ? 'Sending…' : 'Send Morning Brief Now'}
                      </Text>
                    </TouchableOpacity>
                    {digestTriggerResult && (
                      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
                        {digestTriggerResult}
                      </Text>
                    )}
                  </View>

                  {/* Body Composition Analysis Panel */}
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface, marginTop: 12 }]}>
                    <Text style={{ fontSize: 32, textAlign: 'center' }}>📸</Text>
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                      Body Composition Analysis
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                      Zaki will analyze your most recent progress photos alongside your training and nutrition data.
                    </Text>
                    {bodyCompLoading ? (
                      <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 12 }} />
                    ) : (
                      <TouchableOpacity
                        onPress={handleAnalyzeBodyComposition}
                        style={[styles.ctaBtn, { backgroundColor: '#10B981' }]}
                      >
                        <Text style={styles.ctaBtnText}>Analyze My Progress Photos</Text>
                      </TouchableOpacity>
                    )}
                    {bodyCompError && (
                      <Text style={{ color: '#EF4444', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
                        {bodyCompError}
                      </Text>
                    )}
                    {bodyCompResult && (
                      <View style={[styles.responseCard, { backgroundColor: '#10B98108', borderColor: '#10B98130', marginTop: 12 }]}>
                        <View style={styles.zakiHeaderRow}>
                          <View style={[styles.zakiAvatarLg, { backgroundColor: '#10B98120' }]}>
                            <Text style={{ fontSize: 24 }}>🤖</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.zakiNameLg, { color: '#10B981' }]}>Body Composition Report</Text>
                            <Text style={[styles.zakiTimestamp, { color: colors.muted }]}>Analysis by Agent Zaki</Text>
                          </View>
                        </View>
                        <Text style={[styles.responseText, { color: colors.foreground }]}>{bodyCompResult}</Text>
                        <TouchableOpacity
                          onPress={handleAnalyzeBodyComposition}
                          style={[styles.refreshSmallBtn, { borderColor: '#10B98140' }]}
                        >
                          <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>🔄 Re-analyze</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22C55E20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  liveText: { fontSize: 9, fontWeight: '800', color: '#22C55E', letterSpacing: 0.5 },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 2,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  tabContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  responseCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  responseText: {
    fontSize: 14,
    lineHeight: 22,
  },
  zakiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  zakiAvatarLg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F120',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zakiNameLg: { fontSize: 16, fontWeight: '800' },
  zakiTimestamp: { fontSize: 11, marginTop: 2 },
  refreshSmallBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  loadingCard: {
    padding: 32,
    alignItems: 'center',
  },
  loadingTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  loadingSubtitle: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  errorCard: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  ctaBtn: {
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  ctaBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  contextPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  quickPromptsCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  promptChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 8,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  cardBody: { fontSize: 14, lineHeight: 22 },
  zakiBubble: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  zakiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F120',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  zakiName: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  userBubbleInner: {
    borderRadius: 14,
    padding: 12,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyEntry: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  historyText: { fontSize: 12, lineHeight: 18 },
});
