// ============================================================
// PROGRESS PICTURES SCREEN
// Log and view body transformation photos over time
// Stored locally in AsyncStorage
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StyleSheet,
  Image,
  Modal,
  Dimensions,
  PanResponder,
  Animated,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { persistImage, deletePersistedImage } from '@/lib/image-store';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { trpc } from '@/lib/trpc';

const PICTURES_KEY = '@gym_progress_pictures';
// In-app camera ref type
type CameraRef = { takePictureAsync: (opts?: object) => Promise<{ uri: string }> };
const PERM_ONBOARDING_KEY = '@gym_tracker_photo_perm_onboarded';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 48 - 8) / 3;

export interface ProgressPicture {
  id: string;
  uri: string;
  date: string; // ISO date YYYY-MM-DD
  label: 'front' | 'back' | 'side' | 'other';
  note: string;
  weightKg?: number;
}

async function loadPictures(): Promise<ProgressPicture[]> {
  try {
    const raw = await AsyncStorage.getItem(PICTURES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function savePictures(pics: ProgressPicture[]): Promise<void> {
  await AsyncStorage.setItem(PICTURES_KEY, JSON.stringify(pics));
}

const LABELS: { key: ProgressPicture['label']; label: string; emoji: string }[] = [
  { key: 'front', label: 'Front', emoji: '⬆️' },
  { key: 'back', label: 'Back', emoji: '⬇️' },
  { key: 'side', label: 'Side', emoji: '➡️' },
  { key: 'other', label: 'Other', emoji: '📸' },
];

// ─── Comparison Slider Component ────────────────────────────
function ComparisonSlider({ before, after, onClose }: {
  before: ProgressPicture;
  after: ProgressPicture;
  onClose: () => void;
}) {
  const sliderX = useRef(new Animated.Value(SCREEN_WIDTH / 2)).current;
  const currentX = useRef(SCREEN_WIDTH / 2);
  const IMG_HEIGHT = SCREEN_HEIGHT * 0.55;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        const newX = Math.max(20, Math.min(SCREEN_WIDTH - 20, currentX.current + gs.dx));
        sliderX.setValue(newX);
      },
      onPanResponderRelease: (_, gs) => {
        currentX.current = Math.max(20, Math.min(SCREEN_WIDTH - 20, currentX.current + gs.dx));
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    })
  ).current;

  const beforeDays = Math.round(
    (new Date(after.date).getTime() - new Date(before.date).getTime()) / 86_400_000
  );

  return (
    <View style={cmpStyles.container}>
      {/* Close button */}
      <TouchableOpacity style={cmpStyles.closeBtn} onPress={onClose}>
        <Text style={cmpStyles.closeTxt}>✕</Text>
      </TouchableOpacity>

      {/* Title */}
      <View style={cmpStyles.titleRow}>
        <Text style={cmpStyles.title}>Progress Comparison</Text>
        <Text style={cmpStyles.subtitle}>{beforeDays} days apart</Text>
      </View>

      {/* Image comparison area */}
      <View style={[cmpStyles.imageArea, { height: IMG_HEIGHT }]}>
        {/* After image (right side — full width underneath) */}
        <Image source={{ uri: after.uri }} style={[cmpStyles.fullImg, { height: IMG_HEIGHT }]} resizeMode="cover" />

        {/* Before image (left side — clipped by slider position) */}
        <Animated.View style={[cmpStyles.beforeClip, { width: sliderX, height: IMG_HEIGHT }]}>
          <Image
            source={{ uri: before.uri }}
            style={[cmpStyles.fullImg, { width: SCREEN_WIDTH, height: IMG_HEIGHT }]}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Slider handle */}
        <Animated.View
          style={[cmpStyles.sliderLine, { left: Animated.subtract(sliderX, 1) }]}
          {...panResponder.panHandlers}
        >
          <View style={cmpStyles.sliderHandle}>
            <Text style={cmpStyles.sliderArrows}>◀  ▶</Text>
          </View>
        </Animated.View>

        {/* Labels on images */}
        <View style={cmpStyles.labelBefore} pointerEvents="none">
          <Text style={cmpStyles.labelTxt}>BEFORE</Text>
          <Text style={cmpStyles.labelDate}>{before.date}</Text>
        </View>
        <View style={cmpStyles.labelAfter} pointerEvents="none">
          <Text style={cmpStyles.labelTxt}>AFTER</Text>
          <Text style={cmpStyles.labelDate}>{after.date}</Text>
        </View>
      </View>

      {/* Hint */}
      <Text style={cmpStyles.hint}>Drag the slider to compare</Text>
    </View>
  );
}

const cmpStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-start' },
  closeBtn: { position: 'absolute', top: 56, right: 20, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  titleRow: { paddingTop: 60, paddingBottom: 16, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  imageArea: { width: SCREEN_WIDTH, overflow: 'hidden', position: 'relative' },
  fullImg: { position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH },
  beforeClip: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  sliderLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff', zIndex: 10 },
  sliderHandle: { position: 'absolute', top: '50%', left: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  sliderArrows: { fontSize: 11, color: '#333', fontWeight: '700' },
  labelBefore: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  labelAfter: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  labelTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  labelDate: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 1 },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginTop: 20 },
});

// ─── Time-lapse Player Component ────────────────────────────
const SPEED_OPTIONS = [
  { label: '0.5×', ms: 2500 },
  { label: '1×', ms: 1500 },
  { label: '2×', ms: 750 },
  { label: '3×', ms: 400 },
];

function TimeLapsePlayer({ photos, label, onClose }: {
  photos: ProgressPicture[];
  label: string;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}) {
  const sorted = [...photos].sort((a, b) => a.date.localeCompare(b.date));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedIndex, setSpeedIndex] = useState(1); // default 1×
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const IMG_HEIGHT = SCREEN_HEIGHT * 0.52; // slightly shorter to fit save button

  const saveToLibrary = async () => {
    if ((Platform.OS as string) === 'web') {
      Alert.alert('Not supported', 'Saving to camera roll is only available on iOS and Android.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSaving(true);
      setSavedCount(0);

      // Request permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to save frames.');
        setIsSaving(false);
        return;
      }

      // Get or create album
      let album = await MediaLibrary.getAlbumAsync('Gym Tracker');

      let count = 0;
      for (const photo of sorted) {
        try {
          // Ensure we have a local file URI
          let localUri = photo.uri;
          if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
            // Download remote URI to temp file
            const ext = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
            const dest = `${FileSystem.cacheDirectory}tl_frame_${count}.${ext}`;
            await FileSystem.downloadAsync(localUri, dest);
            localUri = dest;
          }

          if (album === null) {
            // createAlbumAsync needs an asset on Android — create asset first then album
            const asset = await MediaLibrary.createAssetAsync(localUri);
            album = await MediaLibrary.createAlbumAsync('Gym Tracker', asset, false);
          } else {
            const asset = await MediaLibrary.createAssetAsync(localUri);
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          }
          count++;
          setSavedCount(count);
        } catch (err) {
          console.warn('[TimeLapse] Failed to save frame:', err);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '✅ Saved to Camera Roll',
        `${count} photo${count !== 1 ? 's' : ''} saved to the "Gym Tracker" album in your camera roll.`,
      );
    } catch (err) {
      console.error('[TimeLapse] Save error:', err);
      Alert.alert('Error', 'Failed to save photos. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentPhoto = sorted[currentIndex];
  const totalPhotos = sorted.length;

  const advanceFrame = useCallback(() => {
    setCurrentIndex(prev => {
      const next = (prev + 1) % totalPhotos;
      // Fade transition
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      if (Platform.OS !== 'web' && next === 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return next;
    });
  }, [totalPhotos, fadeAnim]);

  // Start/stop interval based on isPlaying
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying) {
      intervalRef.current = setInterval(advanceFrame, SPEED_OPTIONS[speedIndex].ms);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speedIndex, advanceFrame]);

  const togglePlay = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlaying(p => !p);
  };

  const changeSpeed = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpeedIndex(s => (s + 1) % SPEED_OPTIONS.length);
  };

  const goTo = (idx: number) => {
    setCurrentIndex(idx);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  if (!currentPhoto) return null;

  const daysSinceFirst = sorted.length > 1
    ? Math.round((new Date(currentPhoto.date).getTime() - new Date(sorted[0].date).getTime()) / 86_400_000)
    : 0;

  return (
    <View style={tlStyles.container}>
      {/* Close button */}
      <TouchableOpacity style={tlStyles.closeBtn} onPress={onClose}>
        <Text style={tlStyles.closeTxt}>✕</Text>
      </TouchableOpacity>

      {/* Title */}
      <View style={tlStyles.titleRow}>
        <Text style={tlStyles.title}>📽 Time-lapse — {label}</Text>
        <Text style={tlStyles.subtitle}>{totalPhotos} photos · {daysSinceFirst} days of progress</Text>
      </View>

      {/* Photo */}
      <View style={[tlStyles.imageArea, { height: IMG_HEIGHT }]}>
        <Animated.Image
          source={{ uri: currentPhoto.uri }}
          style={[tlStyles.photo, { height: IMG_HEIGHT, opacity: fadeAnim }]}
          resizeMode="cover"
        />
        {/* Date overlay */}
        <View style={tlStyles.dateOverlay} pointerEvents="none">
          <Text style={tlStyles.dateText}>{currentPhoto.date}</Text>
          {currentIndex > 0 && (
            <Text style={tlStyles.daysText}>+{daysSinceFirst}d</Text>
          )}
        </View>
        {/* Frame counter */}
        <View style={tlStyles.frameCounter} pointerEvents="none">
          <Text style={tlStyles.frameText}>{currentIndex + 1} / {totalPhotos}</Text>
        </View>
      </View>

      {/* Progress dots */}
      <View style={tlStyles.dotsRow}>
        {sorted.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => { setIsPlaying(false); goTo(i); }}>
            <View style={[
              tlStyles.dot,
              i === currentIndex ? tlStyles.dotActive : tlStyles.dotInactive,
            ]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Controls */}
      <View style={tlStyles.controls}>
        {/* Prev */}
        <TouchableOpacity
          onPress={() => { setIsPlaying(false); goTo(Math.max(0, currentIndex - 1)); }}
          style={tlStyles.navBtn}
        >
          <Text style={tlStyles.navBtnText}>◀</Text>
        </TouchableOpacity>

        {/* Play/Pause */}
        <TouchableOpacity onPress={togglePlay} style={tlStyles.playBtn}>
          <Text style={tlStyles.playBtnText}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>

        {/* Next */}
        <TouchableOpacity
          onPress={() => { setIsPlaying(false); goTo(Math.min(totalPhotos - 1, currentIndex + 1)); }}
          style={tlStyles.navBtn}
        >
          <Text style={tlStyles.navBtnText}>▶</Text>
        </TouchableOpacity>

        {/* Speed */}
        <TouchableOpacity onPress={changeSpeed} style={tlStyles.speedBtn}>
          <Text style={tlStyles.speedText}>{SPEED_OPTIONS[speedIndex].label}</Text>
        </TouchableOpacity>
      </View>

      {/* Save to Camera Roll */}
      <TouchableOpacity
        onPress={saveToLibrary}
        disabled={isSaving}
        style={[tlStyles.saveBtn, isSaving && { opacity: 0.6 }]}
      >
        <Text style={tlStyles.saveBtnText}>
          {isSaving
            ? `Saving... ${savedCount}/${sorted.length}`
            : `📥 Save All ${sorted.length} Photos to Camera Roll`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const tlStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-start' },
  closeBtn: { position: 'absolute', top: 56, right: 20, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  titleRow: { paddingTop: 60, paddingBottom: 12, alignItems: 'center' },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3 },
  imageArea: { width: SCREEN_WIDTH, position: 'relative', overflow: 'hidden' },
  photo: { width: SCREEN_WIDTH, position: 'absolute', top: 0, left: 0 },
  dateOverlay: { position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  dateText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  daysText: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },
  frameCounter: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  frameText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 5, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { backgroundColor: '#fff' },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, paddingTop: 12 },
  navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  navBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  playBtnText: { fontSize: 26, color: '#000' },
  speedBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', minWidth: 52, alignItems: 'center' },
  speedText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  saveBtn: { marginTop: 16, marginHorizontal: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

// ─── Zaki Body Analysis Result Types ────────────────────────
interface BodyAnalysis {
  overallAssessment: string;
  postureFindings: string[];
  muscleImbalances: { area: string; finding: string; severity: 'mild' | 'moderate' | 'significant' }[];
  weakPoints: { muscle: string; recommendation: string }[];
  strengths: string[];
  priorityActions: string[];
  estimatedBodyFatRange?: string | null;
}

// ─── Zaki Body Analysis Modal ────────────────────────────────
function ZakiAnalysisModal({ analysis, onClose, colors }: {
  analysis: BodyAnalysis;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const severityColor = (s: string) =>
    s === 'significant' ? '#EF4444' : s === 'moderate' ? '#F59E0B' : '#10B981';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>🤖</Text>
            <View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.cardForeground }}>Zaki Body Analysis</Text>
              <Text style={{ fontSize: 12, color: colors.cardMuted }}>AI-powered physique assessment</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: colors.cardForeground, fontSize: 16, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {/* Overall Assessment */}
          <View style={{ backgroundColor: '#6366F110', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#6366F130' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#6366F1', marginBottom: 8 }}>OVERALL ASSESSMENT</Text>
            <Text style={{ fontSize: 14, color: colors.cardForeground, lineHeight: 22 }}>{analysis.overallAssessment}</Text>
            {analysis.estimatedBodyFatRange && (
              <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, color: colors.cardMuted }}>Estimated body fat:</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6366F1' }}>{analysis.estimatedBodyFatRange}</Text>
              </View>
            )}
          </View>

          {/* Strengths */}
          {analysis.strengths.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.cardForeground, marginBottom: 10 }}>💪 STRENGTHS</Text>
              {analysis.strengths.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <Text style={{ color: '#10B981', fontSize: 14, marginTop: 1 }}>✓</Text>
                  <Text style={{ fontSize: 14, color: colors.cardForeground, flex: 1, lineHeight: 20 }}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Posture Findings */}
          {analysis.postureFindings.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.cardForeground, marginBottom: 10 }}>🧍 POSTURE FINDINGS</Text>
              {analysis.postureFindings.map((f, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <Text style={{ color: '#F59E0B', fontSize: 14, marginTop: 1 }}>→</Text>
                  <Text style={{ fontSize: 14, color: colors.cardForeground, flex: 1, lineHeight: 20 }}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Muscle Imbalances */}
          {analysis.muscleImbalances.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.cardForeground, marginBottom: 10 }}>⚖️ MUSCLE IMBALANCES</Text>
              {analysis.muscleImbalances.map((m, i) => (
                <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: severityColor(m.severity) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.cardForeground }}>{m.area}</Text>
                    <View style={{ backgroundColor: severityColor(m.severity) + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: severityColor(m.severity), textTransform: 'uppercase' }}>{m.severity}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: colors.cardMuted, lineHeight: 18 }}>{m.finding}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Weak Points */}
          {analysis.weakPoints.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.cardForeground, marginBottom: 10 }}>🎯 WEAK POINTS & RECOMMENDATIONS</Text>
              {analysis.weakPoints.map((w, i) => (
                <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444', marginBottom: 4 }}>{w.muscle}</Text>
                  <Text style={{ fontSize: 13, color: colors.cardForeground, lineHeight: 18 }}>{w.recommendation}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Priority Actions */}
          {analysis.priorityActions.length > 0 && (
            <View style={{ backgroundColor: '#10B98110', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#10B98130' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981', marginBottom: 10 }}>🚀 PRIORITY ACTIONS</Text>
              {analysis.priorityActions.map((a, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginTop: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.cardForeground, flex: 1, lineHeight: 20 }}>{a}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function ProgressPicturesScreen() {
  const colors = useColors();
  const router = useRouter();
  const [pictures, setPictures] = useState<ProgressPicture[]>([]);
  const [viewPic, setViewPic] = useState<ProgressPicture | null>(null);
  const [addLabel, setAddLabel] = useState<ProgressPicture['label']>('front');
  const [compareLabel, setCompareLabel] = useState<ProgressPicture['label'] | null>(null);
  const [timeLapseLabel, setTimeLapseLabel] = useState<ProgressPicture['label'] | null>(null);
  const [zakiAnalysis, setZakiAnalysis] = useState<BodyAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sourcePickerVisible, setSourcePickerVisible] = useState(false);
  const [permOnboardingVisible, setPermOnboardingVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<'camera' | 'library'>('camera');
  const [isSavingPreview, setIsSavingPreview] = useState(false);

  // Pending action after source picker modal closes — avoids the race condition
  // where setTimeout(fn, 300) fires before the Modal animation finishes,
  // causing expo-image-picker to silently fail to present its UI.
  const pendingSourceAction = useRef<'camera' | 'library' | null>(null);
  // In-app camera (Android) — avoids the external Activity hand-off that crashes on foldables
  const [inAppCameraVisible, setInAppCameraVisible] = useState(false);
  const [inAppCameraFacing, setInAppCameraFacing] = useState<'front' | 'back'>('back');
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const inAppCameraRef = useRef<CameraRef | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const bodyAnalysisMutation = trpc.zaki.bodyAnalysis.useMutation();

  useEffect(() => {
    loadPictures().then(setPictures);
  }, []);

  // Fire the pending image-picker action once the source-picker modal has closed.
  // On Android, the modal dismiss animation takes ~400ms and the OS blocks any
  // new Activity (camera/gallery) while the previous one is still animating out.
  // We use a 700ms delay on Android to guarantee the transition is fully done.
  useEffect(() => {
    if (!sourcePickerVisible && pendingSourceAction.current) {
      const action = pendingSourceAction.current;
      pendingSourceAction.current = null;
      const delay = Platform.OS === 'android' ? 700 : 300;
      const handle = InteractionManager.runAfterInteractions(() => {
        const t = setTimeout(() => {
          if (action === 'camera') openCamera();
          else openLibrary();
        }, delay);
        return () => clearTimeout(t);
      });
      return () => handle.cancel();
    }
  }, [sourcePickerVisible]);

  // Find oldest & newest for each label (for comparison)
  const comparisonPairs: Partial<Record<ProgressPicture['label'], { before: ProgressPicture; after: ProgressPicture } | null>> = {};
  for (const lbl of LABELS.map(l => l.key)) {
    const byLabel = pictures.filter(p => p.label === lbl).sort((a, b) => a.date.localeCompare(b.date));
    if (byLabel.length >= 2) {
      comparisonPairs[lbl] = { before: byLabel[0], after: byLabel[byLabel.length - 1] };
    } else {
      comparisonPairs[lbl] = null;
    }
  }

  // Labels with 2+ photos (eligible for time-lapse)
  const timeLapseLabels = LABELS.filter(l => {
    const count = pictures.filter(p => p.label === l.key).length;
    return count >= 2;
  });

  const addPicture = async (uri: string, base64?: string | null) => {
    try {
      const permanentUri = await persistImage(uri, 'progress', undefined, base64);
      const newPic: ProgressPicture = {
        id: Date.now().toString(),
        uri: permanentUri,
        date: new Date().toLocaleDateString('en-CA'),
        label: addLabel,
        note: '',
      };
      const updated = [newPic, ...pictures];
      setPictures(updated);
      await savePictures(updated);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[progress-pictures] Failed to save photo:', err);
      // Still save with the temp URI as fallback so the photo at least appears this session
      const newPic: ProgressPicture = {
        id: Date.now().toString(),
        uri,
        date: new Date().toLocaleDateString('en-CA'),
        label: addLabel,
        note: '',
      };
      const updated = [newPic, ...pictures];
      setPictures(updated);
      await savePictures(updated);
      Alert.alert('Photo Saved', 'Photo was saved but may not persist after app restart. Please try again if the photo disappears.');
    }
  };

  const openCamera = async () => {
    // On Android, use the in-app CameraView to avoid the external Activity
    // hand-off that crashes on foldables (Pixel Fold 9 and similar).
    if (Platform.OS === 'android') {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          if (!result.canAskAgain) {
            Alert.alert(
              'Camera Permission Blocked',
              'Camera access was permanently denied. Open Settings and enable Camera permission.',
              [
                { text: 'Not Now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
            );
          } else {
            Alert.alert('Permission Required', 'Please allow camera access to take a progress photo.');
          }
          return;
        }
      }
      setInAppCameraVisible(true);
      return;
    }
    // iOS / web: use expo-image-picker as before
    try {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Camera Permission Blocked',
            'Camera access was permanently denied. Open Settings and enable Camera permission.',
            [
              { text: 'Not Now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert('Permission Required', 'Please allow camera access to take a progress photo.');
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        base64: false,
      });
      if (!result.canceled && result.assets[0]) {
        setPreviewUri(result.assets[0].uri);
        setPreviewBase64(null);
        setPreviewSource('camera');
      }
    } catch (error) {
      console.error('[progress-pictures] openCamera error:', error);
      Alert.alert(
        'Camera Error',
        'Could not open the camera. Make sure the app has Camera permission.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleInAppCapture = async () => {
    if (!inAppCameraRef.current || isTakingPicture) return;
    setIsTakingPicture(true);
    try {
      const photo = await inAppCameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: true });
      setInAppCameraVisible(false);
      setPreviewUri(photo.uri);
      setPreviewBase64(null);
      setPreviewSource('camera');
    } catch (err) {
      console.error('[progress-pictures] in-app capture error:', err);
      Alert.alert('Capture Error', 'Could not capture the photo. Please try again.');
    } finally {
      setIsTakingPicture(false);
    }
  };

  const openLibrary = async () => {
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Photo Library Permission Blocked',
            'Photo library access was permanently denied. Open Settings and enable Photos & Videos permission for Banana Pro Gym.',
            [
              { text: 'Not Now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert('Permission Required', 'Please allow access to your photo library.');
        }
        return;
      }
      const isWeb = Platform.OS === 'web';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsMultipleSelection: false,
        // allowsEditing launches a separate crop Activity on Android which crashes
        // on some Android 13+ devices (including foldables). Disabled on Android.
        allowsEditing: Platform.OS !== 'android',
        base64: isWeb,
      });
      if (!result.canceled && result.assets[0]) {
        setPreviewUri(result.assets[0].uri);
        setPreviewBase64(result.assets[0].base64 ?? null);
        setPreviewSource('library');
      }
    } catch (error) {
      console.error('[progress-pictures] openLibrary error:', error);
      Alert.alert(
        'Photo Library Error',
        'Could not open the photo library. Make sure the app has Photos & Videos permission.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const getSaveLocationDisplay = (): string => {
    if (Platform.OS === 'web') return 'Browser Storage (IndexedDB)';
    return `App Storage / images / progress /`;
  };

  const handlePreviewConfirm = async () => {
    if (!previewUri) return;
    setIsSavingPreview(true);
    try {
      await addPicture(previewUri, previewBase64);
      setPreviewUri(null);
      setPreviewBase64(null);
    } catch (err) {
      console.error('[preview] save failed:', err);
    } finally {
      setIsSavingPreview(false);
    }
  };

  const handlePreviewDiscard = () => {
    setPreviewUri(null);
    setPreviewBase64(null);
  };

  const handlePreviewRetake = () => {
    setPreviewUri(null);
    setPreviewBase64(null);
    // Re-open the same source after a short delay (let modal dismiss)
    setTimeout(() => {
      if (previewSource === 'camera') openCamera();
      else openLibrary();
    }, 300);
  };

  const handleAdd = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // On first use, show the permission onboarding sheet before the source picker.
    // This explains WHY we need camera/photos access, improving grant rate.
    if (Platform.OS !== 'web') {
      const seen = await AsyncStorage.getItem(PERM_ONBOARDING_KEY);
      if (!seen) {
        setPermOnboardingVisible(true);
        return;
      }
    }
    setSourcePickerVisible(true);
  };

  const handleAnalyzeWithZaki = async () => {
    // Pick the most recent photo from each available label (front, back, side)
    const photosToAnalyze: { label: ProgressPicture['label']; uri: string }[] = [];
    for (const lbl of (['front', 'back', 'side'] as ProgressPicture['label'][])) {
      const byLabel = pictures.filter(p => p.label === lbl).sort((a, b) => b.date.localeCompare(a.date));
      if (byLabel.length > 0) photosToAnalyze.push({ label: lbl, uri: byLabel[0].uri });
    }
    // Fallback: if no front/back/side, use the 3 most recent photos of any label
    if (photosToAnalyze.length === 0) {
      const recent = [...pictures].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
      for (const p of recent) photosToAnalyze.push({ label: p.label, uri: p.uri });
    }
    if (photosToAnalyze.length === 0) {
      Alert.alert('No Photos', 'Add at least one progress photo before running the analysis.');
      return;
    }

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    try {
      // Read each image as base64
      const photoPayload: { label: 'front' | 'back' | 'side' | 'other'; base64: string; mimeType: string }[] = [];
      for (const p of photosToAnalyze) {
        let uri = p.uri;
        // Ensure we have a local file:// URI (not content://)
        if (uri.startsWith('content://') || uri.startsWith('ph://')) {
          const dest = `${FileSystem.cacheDirectory}zaki_analysis_${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: uri, to: dest });
          uri = dest;
        }
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        photoPayload.push({ label: p.label, base64, mimeType: 'image/jpeg' });
      }

      const result = await bodyAnalysisMutation.mutateAsync({ photos: photoPayload });
      setZakiAnalysis(result.analysis as unknown as BodyAnalysis);
    } catch (err) {
      console.error('[Zaki body analysis]', err);
      Alert.alert('Analysis Failed', 'Zaki could not analyse your photos. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Photo', 'Are you sure you want to delete this progress photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const target = pictures.find(p => p.id === id);
          if (target) await deletePersistedImage(target.uri);
          const updated = pictures.filter(p => p.id !== id);
          setPictures(updated);
          await savePictures(updated);
          setViewPic(null);
        },
      },
    ]);
  };

  // Group pictures by month for timeline view
  const grouped: { month: string; pics: ProgressPicture[] }[] = [];
  for (const pic of pictures) {
    const month = pic.date.substring(0, 7);
    const existing = grouped.find(g => g.month === month);
    if (existing) existing.pics.push(pic);
    else grouped.push({ month, pics: [pic] });
  }

  const formatMonth = (m: string) => {
    const d = new Date(m + '-01');
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Check if any label has a comparison pair available
  const hasAnyComparison = LABELS.some(l => comparisonPairs[l.key] != null);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.cardMuted} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.cardForeground }]}>Progress Photos</Text>
        <TouchableOpacity
          onPress={handleAdd}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Label selector */}
      <View style={styles.labelRow}>
        {LABELS.map(l => (
          <TouchableOpacity
            key={l.key}
            onPress={() => setAddLabel(l.key)}
            style={[
              styles.labelChip,
              { backgroundColor: addLabel === l.key ? colors.primary : colors.surface, borderColor: addLabel === l.key ? colors.primary : colors.cardBorder },
            ]}
          >
            <Text style={styles.labelEmoji}>{l.emoji}</Text>
            <Text style={[styles.labelText, { color: addLabel === l.key ? '#FFFFFF' : colors.cardForeground }]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Comparison + Time-lapse banner — shown when 2+ photos of same label exist */}
      {hasAnyComparison && (
        <View style={[styles.compareBanner, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          {/* Before vs After row */}
          <Text style={[styles.compareBannerTitle, { color: colors.cardForeground }]}>📊 Before vs After</Text>
          <View style={styles.compareBannerRow}>
            {LABELS.filter(l => comparisonPairs[l.key] != null).map(l => (
              <TouchableOpacity
                key={l.key}
                style={[styles.compareChip, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setCompareLabel(l.key);
                }}
              >
                <Text style={[styles.compareChipText, { color: colors.primary }]}>{l.emoji} {l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Time-lapse row */}
          {timeLapseLabels.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
              <Text style={[styles.compareBannerTitle, { color: colors.cardForeground, marginTop: 4 }]}>📽 Time-lapse</Text>
              <View style={styles.compareBannerRow}>
                {timeLapseLabels.map(l => {
                  const count = pictures.filter(p => p.label === l.key).length;
                  return (
                    <TouchableOpacity
                      key={l.key}
                      style={[styles.compareChip, { backgroundColor: '#8B5CF620', borderColor: '#8B5CF6' }]}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setTimeLapseLabel(l.key);
                      }}
                    >
                      <Text style={[styles.compareChipText, { color: '#8B5CF6' }]}>▶ {l.emoji} {l.label} ({count})</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      )}

      {/* Zaki Body Analysis button — shown when there are photos */}
      {pictures.length > 0 && (
        <TouchableOpacity
          style={[styles.zakiBtn, { backgroundColor: '#6366F1', opacity: isAnalyzing ? 0.7 : 1 }]}
          onPress={handleAnalyzeWithZaki}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ fontSize: 16 }}>🤖</Text>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              {isAnalyzing ? 'Analysing your physique…' : 'Analyse with Zaki'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 }}>
              {isAnalyzing ? 'This may take 15–30 seconds' : 'AI body composition & posture assessment'}
            </Text>
          </View>
          {!isAnalyzing && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>›</Text>}
        </TouchableOpacity>
      )}

      {pictures.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📸</Text>
          <Text style={[styles.emptyTitle, { color: colors.cardForeground }]}>No Progress Photos Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.cardMuted }]}>
            Start documenting your transformation. Add your first photo today.
          </Text>
          <TouchableOpacity
            onPress={handleAdd}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.emptyBtnText}>Add First Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}>
          {grouped.map(group => (
            <View key={group.month} style={styles.monthSection}>
              <View style={styles.monthHeader}>
                <Text style={[styles.monthTitle, { color: colors.cardForeground }]}>{formatMonth(group.month)}</Text>
                <Text style={[styles.monthCount, { color: colors.cardMuted }]}>{group.pics.length} photo{group.pics.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.grid}>
                {group.pics.map(pic => (
                  <TouchableOpacity
                    key={pic.id}
                    onPress={() => setViewPic(pic)}
                    activeOpacity={0.85}
                    style={[styles.thumb, { borderColor: colors.cardBorder }]}
                  >
                    <Image source={{ uri: pic.uri }} style={styles.thumbImg} />
                    <View style={[styles.thumbLabel, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                      <Text style={styles.thumbLabelText}>
                        {LABELS.find(l => l.key === pic.label)?.emoji} {pic.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Full-screen photo viewer */}
      <Modal visible={!!viewPic} transparent animationType="fade" onRequestClose={() => setViewPic(null)}>
        <View style={styles.viewer}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewPic(null)}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </TouchableOpacity>
          {viewPic && (
            <>
              <Image source={{ uri: viewPic.uri }} style={styles.viewerImage} resizeMode="contain" />
              <View style={styles.viewerInfo}>
                <Text style={styles.viewerDate}>
                  {new Date(viewPic.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
                <Text style={styles.viewerLabel}>
                  {LABELS.find(l => l.key === viewPic.label)?.emoji} {viewPic.label}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDelete(viewPic.id)}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteBtnText}>🗑 Delete Photo</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>


      {/* Photo source picker modal — replaces Alert.alert which is broken on web */}
      <Modal visible={sourcePickerVisible} transparent animationType="fade" onRequestClose={() => setSourcePickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, backgroundColor: colors.surface }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20, backgroundColor: colors.cardBorder }} />
            <Text style={{ fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6, color: colors.cardForeground }}>Add Progress Photo</Text>
            <Text style={{ color: colors.cardMuted, fontSize: 14, marginBottom: 20, textAlign: 'center' }}>Choose a photo source</Text>
            <TouchableOpacity
              onPress={() => {
                pendingSourceAction.current = 'camera';
                setSourcePickerVisible(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, marginBottom: 10, backgroundColor: colors.primary }}
            >
              <Text style={{ fontSize: 18 }}>📷</Text>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                pendingSourceAction.current = 'library';
                setSourcePickerVisible(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, marginBottom: 10, backgroundColor: colors.primary }}
            >
              <Text style={{ fontSize: 18 }}>🖼</Text>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSourcePickerVisible(false)}
              style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder, marginTop: 4 }}
            >
              <Text style={{ color: colors.cardForeground, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Photo preview modal — shown after capture, before saving */}
      <Modal
        visible={previewUri != null}
        animationType="slide"
        onRequestClose={handlePreviewDiscard}
      >
        <View style={pvStyles.container}>
          {/* Close / Discard */}
          <TouchableOpacity style={pvStyles.closeBtn} onPress={handlePreviewDiscard}>
            <Text style={pvStyles.closeTxt}>✕</Text>
          </TouchableOpacity>

          {/* Title */}
          <View style={pvStyles.titleRow}>
            <Text style={pvStyles.title}>📸 Photo Preview</Text>
            <Text style={pvStyles.subtitle}>
              {LABELS.find(l => l.key === addLabel)?.emoji} {addLabel} · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>

          {/* Image preview */}
          {previewUri && (
            <View style={pvStyles.imageArea}>
              <Image
                source={{ uri: previewUri }}
                style={pvStyles.previewImage}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Save location info */}
          <View style={pvStyles.locationCard}>
            <View style={pvStyles.locationIconRow}>
              <Text style={{ fontSize: 16 }}>📂</Text>
              <Text style={pvStyles.locationLabel}>Save Location</Text>
            </View>
            <Text style={pvStyles.locationPath}>{getSaveLocationDisplay()}</Text>
            <Text style={pvStyles.locationHint}>
              {Platform.OS === 'web'
                ? 'Photo will be stored as a base64 data URL in browser storage.'
                : 'Photo will be copied to the app\'s permanent document directory.'}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={pvStyles.actions}>
            <TouchableOpacity
              onPress={handlePreviewConfirm}
              disabled={isSavingPreview}
              style={[pvStyles.saveBtn, isSavingPreview && { opacity: 0.6 }]}
            >
              {isSavingPreview ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={pvStyles.saveBtnText}>✓ Save Photo</Text>
              )}
            </TouchableOpacity>

            <View style={pvStyles.secondaryRow}>
              {previewSource === 'camera' && (
                <TouchableOpacity onPress={handlePreviewRetake} style={pvStyles.retakeBtn}>
                  <Text style={pvStyles.retakeBtnText}>📷 Retake</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handlePreviewDiscard} style={pvStyles.discardBtn}>
                <Text style={pvStyles.discardBtnText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Comparison slider modal */}
      <Modal
        visible={compareLabel != null}
        animationType="slide"
        onRequestClose={() => setCompareLabel(null)}
      >
        {compareLabel != null && comparisonPairs[compareLabel] != null && (
          <ComparisonSlider
            before={comparisonPairs[compareLabel]!.before}
            after={comparisonPairs[compareLabel]!.after}
            onClose={() => setCompareLabel(null)}
          />
        )}
      </Modal>

      {/* Time-lapse player modal */}
      <Modal
        visible={timeLapseLabel != null}
        animationType="slide"
        onRequestClose={() => setTimeLapseLabel(null)}
      >
        {timeLapseLabel != null && (
          <TimeLapsePlayer
            photos={pictures.filter(p => p.label === timeLapseLabel)}
            label={LABELS.find(l => l.key === timeLapseLabel)?.label ?? timeLapseLabel}
            onClose={() => setTimeLapseLabel(null)}
          />
        )}
      </Modal>
      {/* Permission Onboarding Sheet — shown once before first camera/library access */}
      <Modal
        visible={permOnboardingVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPermOnboardingVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 28,
            paddingBottom: 44,
            backgroundColor: colors.surface,
          }}>
            {/* Drag handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 24, backgroundColor: colors.cardBorder }} />

            {/* Icon row */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 28 }}>📷</Text>
              </View>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 28 }}>🖼️</Text>
              </View>
            </View>

            <Text style={{ fontSize: 22, fontWeight: '800', textAlign: 'center', color: colors.cardForeground, marginBottom: 10 }}>
              Track Your Transformation
            </Text>
            <Text style={{ fontSize: 15, color: colors.cardMuted, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
              Banana Pro Gym needs access to your{' '}
              <Text style={{ fontWeight: '700', color: colors.cardForeground }}>Camera</Text> and{' '}
              <Text style={{ fontWeight: '700', color: colors.cardForeground }}>Photo Library</Text>{' '}
              to let you log progress photos.{`\n\n`}Photos are stored{' '}
              <Text style={{ fontWeight: '700', color: colors.cardForeground }}>only on your device</Text>{' '}
              — never uploaded without your permission.
            </Text>

            {/* What we use each for */}
            <View style={{ gap: 12, marginBottom: 28 }}>
              {[
                { icon: '📷', title: 'Camera', desc: 'Take a fresh progress photo right now' },
                { icon: '🖼️', title: 'Photo Library', desc: 'Pick an existing photo from your gallery' },
              ].map(item => (
                <View key={item.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: colors.background }}>
                  <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.cardForeground, fontSize: 14 }}>{item.title}</Text>
                    <Text style={{ color: colors.cardMuted, fontSize: 13, marginTop: 2 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity
              onPress={async () => {
                await AsyncStorage.setItem(PERM_ONBOARDING_KEY, '1');
                setPermOnboardingVisible(false);
                // Small delay so the sheet fully closes before the source picker opens
                setTimeout(() => setSourcePickerVisible(true), Platform.OS === 'android' ? 500 : 250);
              }}
              style={{ paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: colors.primary }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPermOnboardingVisible(false)}
              style={{ paddingVertical: 12, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: colors.cardMuted, fontSize: 14 }}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Zaki Body Analysis modal */}
      {zakiAnalysis && (
        <ZakiAnalysisModal
          analysis={zakiAnalysis}
          onClose={() => setZakiAnalysis(null)}
          colors={colors}
        />
       )}
      {/* In-app camera modal — Android only, avoids external Activity crash on foldables */}
      <Modal
        visible={inAppCameraVisible}
        animationType="slide"
        onRequestClose={() => setInAppCameraVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={inAppCameraRef as any}
            style={{ flex: 1 }}
            facing={inAppCameraFacing}
          />
          {/* Controls overlay */}
          <View style={camStyles.controls}>
            {/* Close */}
            <TouchableOpacity style={camStyles.sideBtn} onPress={() => setInAppCameraVisible(false)}>
              <Text style={camStyles.sideBtnTxt}>✕</Text>
            </TouchableOpacity>
            {/* Shutter */}
            <TouchableOpacity
              style={[camStyles.shutter, isTakingPicture && { opacity: 0.5 }]}
              onPress={handleInAppCapture}
              disabled={isTakingPicture}
            >
              {isTakingPicture
                ? <ActivityIndicator size="small" color="#000" />
                : <View style={camStyles.shutterInner} />}
            </TouchableOpacity>
            {/* Flip */}
            <TouchableOpacity
              style={camStyles.sideBtn}
              onPress={() => setInAppCameraFacing(f => f === 'back' ? 'front' : 'back')}
            >
              <Text style={camStyles.sideBtnTxt}>🔄</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
const camStyles = StyleSheet.create({
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 32,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnTxt: {
    fontSize: 20,
    color: '#fff',
  },
});
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  labelRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  labelChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 4 },
  labelEmoji: { fontSize: 14 },
  labelText: { fontSize: 13, fontWeight: '600' },
  compareBanner: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  compareBannerTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  compareBannerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compareChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  compareChipText: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, marginVertical: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  monthSection: { marginBottom: 24 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthTitle: { fontSize: 16, fontWeight: '700' },
  monthCount: { fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10, overflow: 'hidden', borderWidth: 1 },
  thumbImg: { width: '100%', height: '100%' },
  thumbLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 4, paddingHorizontal: 6 },
  thumbLabelText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 56, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  viewerCloseText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  viewerImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 },
  viewerInfo: { paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' },
  viewerDate: { color: '#FFFFFF', fontSize: 14, marginBottom: 4 },
  viewerLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textTransform: 'capitalize', marginBottom: 20 },
  deleteBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  deleteBtnText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },
  zakiBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16 },
});

// ─── Photo Preview Modal Styles ─────────────────────────────
const pvStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  closeBtn: { position: 'absolute', top: 56, right: 20, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  titleRow: { paddingTop: 60, paddingBottom: 12, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 3 },
  imageArea: { flex: 1, maxHeight: SCREEN_HEIGHT * 0.48, marginHorizontal: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111' },
  previewImage: { width: '100%', height: '100%' },
  locationCard: { marginHorizontal: 20, marginTop: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  locationIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  locationLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  locationPath: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 4 },
  locationHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 16 },
  actions: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  saveBtn: { backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  retakeBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  retakeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  discardBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  discardBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
});
