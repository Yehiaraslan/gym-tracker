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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { persistImage, deletePersistedImage } from '@/lib/image-store';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

const PICTURES_KEY = '@gym_progress_pictures';
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

// ─── Main Screen ─────────────────────────────────────────────
export default function ProgressPicturesScreen() {
  const colors = useColors();
  const router = useRouter();
  const [pictures, setPictures] = useState<ProgressPicture[]>([]);
  const [viewPic, setViewPic] = useState<ProgressPicture | null>(null);
  const [addLabel, setAddLabel] = useState<ProgressPicture['label']>('front');
  const [compareLabel, setCompareLabel] = useState<ProgressPicture['label'] | null>(null);
  const [timeLapseLabel, setTimeLapseLabel] = useState<ProgressPicture['label'] | null>(null);

  useEffect(() => {
    loadPictures().then(setPictures);
  }, []);

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

  const addPicture = async (uri: string) => {
    let permanentUri = uri;
    try {
      permanentUri = await persistImage(uri, 'progress');
    } catch { /* fall back to temp URI */ }
    const newPic: ProgressPicture = {
      id: Date.now().toString(),
      uri: permanentUri,
      date: new Date().toISOString().split('T')[0],
      label: addLabel,
      note: '',
    };
    const updated = [newPic, ...pictures];
    setPictures(updated);
    await savePictures(updated);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAdd = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Add Progress Photo', 'Choose a photo source', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Camera permission required'); return; }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
          if (!result.canceled && result.assets[0]) await addPicture(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Photo library permission required'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: false });
          if (!result.canceled && result.assets[0]) await addPicture(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
          <IconSymbol name="chevron.left" size={24} color={colors.muted} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Progress Photos</Text>
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
              { backgroundColor: addLabel === l.key ? colors.primary : colors.surface, borderColor: addLabel === l.key ? colors.primary : colors.border },
            ]}
          >
            <Text style={styles.labelEmoji}>{l.emoji}</Text>
            <Text style={[styles.labelText, { color: addLabel === l.key ? '#FFFFFF' : colors.foreground }]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Comparison + Time-lapse banner — shown when 2+ photos of same label exist */}
      {hasAnyComparison && (
        <View style={[styles.compareBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Before vs After row */}
          <Text style={[styles.compareBannerTitle, { color: colors.foreground }]}>📊 Before vs After</Text>
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
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.compareBannerTitle, { color: colors.foreground, marginTop: 4 }]}>📽 Time-lapse</Text>
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

      {pictures.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📸</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Progress Photos Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
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
                <Text style={[styles.monthTitle, { color: colors.foreground }]}>{formatMonth(group.month)}</Text>
                <Text style={[styles.monthCount, { color: colors.muted }]}>{group.pics.length} photo{group.pics.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.grid}>
                {group.pics.map(pic => (
                  <TouchableOpacity
                    key={pic.id}
                    onPress={() => setViewPic(pic)}
                    activeOpacity={0.85}
                    style={[styles.thumb, { borderColor: colors.border }]}
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
    </ScreenContainer>
  );
}

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
});
