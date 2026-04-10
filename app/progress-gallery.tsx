import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  InteractionManager,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  addProgressPhoto,
  getProgressPhotos,
  deleteProgressPhoto,
  updateProgressPhotoNotes,
  getProgressStats,
  ProgressPhoto,
} from '@/lib/progress-photos';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Linking } from 'react-native';
import { trpc } from '@/lib/trpc';
import { USER_PROFILE } from '@/lib/training-program';

type PhotoCategory = 'front' | 'side' | 'back' | 'other';

const CATEGORIES: { value: PhotoCategory; label: string; emoji: string }[] = [
  { value: 'front', label: 'Front', emoji: '🧍' },
  { value: 'back', label: 'Back', emoji: '🔙' },
  { value: 'side', label: 'Side', emoji: '↔️' },
  { value: 'other', label: 'Other', emoji: '📷' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProgressGalleryScreen() {
  const colors = useColors();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Category picker state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory>('front');

  // Photo source picker state (replaces Alert.alert which doesn't work on web)
  const [sourcePickerVisible, setSourcePickerVisible] = useState(false);

  // Pending action after source picker modal closes — avoids the race condition
  // where setTimeout(fn, 300) fires before the Modal animation finishes,
  // causing expo-image-picker to silently fail to present its UI.
  const pendingSourceAction = useRef<'camera' | 'library' | null>(null);

  // Zaki body analysis state
  const [zakiAnalysisVisible, setZakiAnalysisVisible] = useState(false);
  const [zakiAnalysisLoading, setZakiAnalysisLoading] = useState(false);
  const [zakiAnalysisResult, setZakiAnalysisResult] = useState<{
    overallAssessment: string;
    postureFindings: string[];
    muscleImbalances: { area: string; finding: string; severity: string }[];
    weakPoints: { muscle: string; recommendation: string }[];
    strengths: string[];
    priorityActions: string[];
    estimatedBodyFatRange?: string | null;
  } | null>(null);
  const [zakiAnalysisDate, setZakiAnalysisDate] = useState<string | null>(null);
  const bodyAnalysisMutation = trpc.zaki.bodyAnalysis.useMutation();

  // Comparison slider state
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareCategory, setCompareCategory] = useState<PhotoCategory>('front');
  const sliderX = useRef(new Animated.Value(SCREEN_WIDTH / 2)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newX = Math.max(40, Math.min(SCREEN_WIDTH - 40, gestureState.moveX));
        sliderX.setValue(newX);
      },
    })
  ).current;

  useEffect(() => {
    loadPhotos();
    loadStats();
  }, []);

  // Fire the pending image-picker action once the source-picker modal has closed.
  // InteractionManager.runAfterInteractions waits for the Modal dismiss animation
  // to truly finish, then an extra 300ms buffer ensures expo-image-picker can
  // present its own UI without silently failing.
  useEffect(() => {
    if (!sourcePickerVisible && pendingSourceAction.current) {
      const action = pendingSourceAction.current;
      pendingSourceAction.current = null;
      const handle = InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          if (action === 'camera') openGalleryCamera();
          else openGalleryLibrary();
        }, 300);
      });
      return () => handle.cancel();
    }
  }, [sourcePickerVisible]);

  const loadPhotos = async () => {
    try {
      const data = await getProgressPhotos();
      setPhotos(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getProgressStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Step 1a: Open camera
  const openGalleryCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to take a progress photo.');
        return;
      }
      const isWeb = Platform.OS === 'web';
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'] as any,
        quality: 0.85,
        allowsEditing: true,
        aspect: [3, 4],
        base64: isWeb,
      });
      if (!result.canceled && result.assets[0]) {
        setPendingImageUri(result.assets[0].uri);
        setPendingBase64(result.assets[0].base64 ?? null);
        setSelectedCategory('front');
        setCategoryModalVisible(true);
      }
    } catch (error) {
      console.error('[progress-gallery] openGalleryCamera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Step 1b: Open library
  const openGalleryLibrary = async () => {
    try {
      // On Android 13+, use expo-media-library permission (more reliable than ImagePicker's)
      if (Platform.OS === 'android') {
        const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            canAskAgain ? 'Permission Required' : 'Photo Library Permission Blocked',
            canAskAgain
              ? 'Please allow access to your photo library to pick a progress photo.'
              : 'Photo library access was permanently denied. Open Settings → Apps → Banana Pro Gym → Permissions and enable Photos & Videos.',
            canAskAgain
              ? [{ text: 'OK' }]
              : [
                  { text: 'Not Now', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() },
                ]
          );
          return;
        }
      } else {
        const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            canAskAgain ? 'Permission Required' : 'Photo Library Permission Blocked',
            canAskAgain
              ? 'Please allow access to your photo library.'
              : 'Photo library access was permanently denied. Open Settings and enable Photos permission.',
            canAskAgain
              ? [{ text: 'OK' }]
              : [
                  { text: 'Not Now', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() },
                ]
          );
          return;
        }
      }

      const isWeb = Platform.OS === 'web';
      const result = await ImagePicker.launchImageLibraryAsync({
        // Use array syntax — MediaTypeOptions enum is deprecated in expo-image-picker SDK 15+
        mediaTypes: ['images'] as any,
        quality: 0.85,
        allowsEditing: Platform.OS !== 'android',
        aspect: [3, 4],
        allowsMultipleSelection: false,
        base64: isWeb,
      });
      if (!result.canceled && result.assets[0]) {
        setPendingImageUri(result.assets[0].uri);
        setPendingBase64(result.assets[0].base64 ?? null);
        setSelectedCategory('front');
        setCategoryModalVisible(true);
      }
    } catch (error) {
      console.error('[progress-gallery] openGalleryLibrary error:', error);
      Alert.alert(
        'Photo Library Error',
        'Could not open the photo library. If this keeps happening, check Photos & Videos permission in Settings.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  // Step 1: Choose source — uses a Modal instead of Alert.alert (which is broken on web)
  const handlePickImage = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSourcePickerVisible(true);
  };

  // Step 2: Confirm category and save
  const handleConfirmCategory = async () => {
    if (!pendingImageUri) return;
    const uri = pendingImageUri;
    const b64 = pendingBase64;
    const cat = selectedCategory;

    setUploading(true);
    try {
      const photo = await addProgressPhoto(uri, '', cat, b64);
      setPhotos(prev => [photo, ...prev]);
      loadStats();
      // Only dismiss modal + clear state after successful save
      setCategoryModalVisible(false);
      setPendingImageUri(null);
      setPendingBase64(null);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[progress-gallery] handleConfirmCategory error:', error);
      Alert.alert('Error', 'Failed to save photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProgressPhoto(photoId);
            setPhotos(prev => prev.filter(p => p.id !== photoId));
            loadStats();
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete photo');
          }
        },
      },
    ]);
  };

  // Zaki body analysis handler
  const handleZakiBodyAnalysis = async () => {
    // Gather the most recent photo per category (front, back, side)
    const byCategory: Partial<Record<PhotoCategory, ProgressPhoto>> = {};
    for (const photo of photos) {
      const cat = (photo.category as PhotoCategory) || 'other';
      if (!byCategory[cat]) byCategory[cat] = photo;
    }
    const selected = Object.entries(byCategory)
      .filter(([, p]) => p && p.uri)
      .slice(0, 3);
    if (selected.length === 0) {
      Alert.alert('No Photos', 'Add at least one progress photo to get a Zaki body analysis.');
      return;
    }
    setZakiAnalysisLoading(true);
    setZakiAnalysisResult(null);
    setZakiAnalysisVisible(true);
    try {
      // Build base64 for each photo — use stored base64 or fetch from URI
      const photosPayload: { label: 'front' | 'back' | 'side' | 'other'; base64: string; mimeType: string }[] = [];
      for (const [cat, photo] of selected) {
        if (!photo) continue;
        let b64: string | null = null;
        if (photo.uri) {
          // Fetch and convert URI to base64
          try {
            const resp = await fetch(photo.uri);
            const blob = await resp.blob();
            b64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1] ?? result);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch {
            continue;
          }
        }
        if (!b64) continue;
        photosPayload.push({
          label: cat as 'front' | 'back' | 'side' | 'other',
          base64: b64,
          mimeType: 'image/jpeg',
        });
      }
      if (photosPayload.length === 0) {
        Alert.alert('Error', 'Could not read photo data. Try re-adding photos from your library.');
        setZakiAnalysisLoading(false);
        setZakiAnalysisVisible(false);
        return;
      }
      const result = await bodyAnalysisMutation.mutateAsync({
        photos: photosPayload,
        userContext: {
          weightKg: USER_PROFILE.startingWeightKg,
          heightCm: USER_PROFILE.heightCm,
          goals: USER_PROFILE.goal,
        },
      });
      setZakiAnalysisResult(result.analysis as any);
      setZakiAnalysisDate(result.analyzedAt);
    } catch (err) {
      Alert.alert('Zaki Error', 'Could not complete body analysis. Please try again.');
      setZakiAnalysisVisible(false);
    } finally {
      setZakiAnalysisLoading(false);
    }
  };

  // Comparison helpers
  const getPhotosForCategory = (cat: PhotoCategory) =>
    photos.filter(p => p.category === cat).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const oldestForCategory = getPhotosForCategory(compareCategory)[0];
  const newestForCategory = getPhotosForCategory(compareCategory).slice(-1)[0];

  // Render a single photo tile (used in the manual grid below)
  const renderPhotoTile = (item: ProgressPhoto) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => {
        setSelectedPhoto(item);
        setModalVisible(true);
      }}
      style={{ width: '48%', marginBottom: 8 }}
    >
      <View style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: 3 / 4 }}>
        <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} />
        <View style={[styles.photoOverlay]}>
          <Text style={styles.photoDate}>{new Date(item.date).toLocaleDateString()}</Text>
          {item.category && (
            <View style={[styles.categoryBadge, { backgroundColor: colors.primary + 'CC' }]}>
              <Text style={styles.categoryBadgeText}>{item.category.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12 }}>
          <Text style={[styles.title, { color: colors.cardForeground }]}>Progress Gallery</Text>
          <Text style={{ color: colors.cardMuted, fontSize: 14, marginTop: 4 }}>Track your transformation over time</Text>
        </View>

        {/* Stats */}
        {stats && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.statNum, { color: colors.cardForeground }]}>{stats.totalPhotos}</Text>
                  <Text style={{ color: colors.cardMuted, fontSize: 11, marginTop: 2 }}>Total Photos</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.statNum, { color: colors.cardForeground }]}>{stats.daysSinceFirst}</Text>
                  <Text style={{ color: colors.cardMuted, fontSize: 11, marginTop: 2 }}>Days Tracked</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.statNum, { color: colors.cardForeground }]}>{stats.averagePhotosPerMonth}</Text>
                  <Text style={{ color: colors.cardMuted, fontSize: 11, marginTop: 2 }}>Per Month</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16, flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={uploading}
            style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1, opacity: uploading ? 0.7 : 1 }]}
          >
            {uploading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <IconSymbol name="plus" size={18} color="white" />
                <Text style={styles.actionBtnText}>Add Photo</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setCompareCategory('front');
              sliderX.setValue(SCREEN_WIDTH / 2);
              setCompareModalVisible(true);
            }}
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder, flex: 1 }]}
          >
            <Text style={{ fontSize: 16 }}>⚖️</Text>
            <Text style={[styles.actionBtnText, { color: colors.cardForeground }]}>Compare</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleZakiBodyAnalysis}
            disabled={photos.length === 0}
            style={[styles.actionBtn, { backgroundColor: '#7C3AED', flex: 1, opacity: photos.length === 0 ? 0.4 : 1 }]}
          >
            <Text style={{ fontSize: 16 }}>🤖</Text>
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Zaki</Text>
          </TouchableOpacity>
        </View>

        {/* Photos Grid — using View + map instead of FlatList to avoid
            FlatList-in-ScrollView rendering bugs (zero-height virtualisation) */}
        {photos.length > 0 ? (
          <View style={{
            paddingHorizontal: 8,
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}>
            {photos.map(renderPhotoTile)}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📸</Text>
            <Text style={[styles.emptyTitle, { color: colors.cardForeground }]}>No photos yet</Text>
            <Text style={{ color: colors.cardMuted, textAlign: 'center', fontSize: 14 }}>
              Start tracking your progress by adding your first photo
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Photo Source Picker Modal ── */}
      {/* Replaces Alert.alert which doesn't show custom buttons on web */}
      <Modal visible={sourcePickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.cardBorder }]} />
            <Text style={[styles.sheetTitle, { color: colors.cardForeground }]}>Add Progress Photo</Text>
            <Text style={{ color: colors.cardMuted, fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
              Choose a photo source
            </Text>
            <TouchableOpacity
              onPress={() => {
                pendingSourceAction.current = 'camera';
                setSourcePickerVisible(false);
              }}
              style={[styles.sourceBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={{ fontSize: 18 }}>📷</Text>
              <Text style={[styles.sourceBtnText, { color: '#fff' }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                pendingSourceAction.current = 'library';
                setSourcePickerVisible(false);
              }}
              style={[styles.sourceBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={{ fontSize: 18 }}>🖼</Text>
              <Text style={[styles.sourceBtnText, { color: '#fff' }]}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSourcePickerVisible(false)}
              style={[styles.sheetBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder, marginTop: 8 }]}
            >
              <Text style={{ color: colors.cardForeground, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Category Picker Modal ── */}
      <Modal visible={categoryModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.cardBorder }]} />
            <Text style={[styles.sheetTitle, { color: colors.cardForeground }]}>Tag This Photo</Text>
            <Text style={{ color: colors.cardMuted, fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
              Which angle is this photo?
            </Text>
            {pendingImageUri && (
              <Image
                source={{ uri: pendingBase64 ? `data:image/jpeg;base64,${pendingBase64}` : pendingImageUri }}
                style={{ width: 120, height: 160, borderRadius: 10, alignSelf: 'center', marginBottom: 20 }}
              />
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCategory(cat.value);
                  }}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: selectedCategory === cat.value ? colors.primary : colors.background,
                      borderColor: selectedCategory === cat.value ? colors.primary : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{cat.emoji}</Text>
                  <Text style={{
                    color: selectedCategory === cat.value ? 'white' : colors.cardForeground,
                    fontWeight: '600',
                    fontSize: 13,
                  }}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setCategoryModalVisible(false); setPendingImageUri(null); setPendingBase64(null); }}
                style={[styles.sheetBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder, flex: 1 }]}
              >
                <Text style={{ color: colors.cardForeground, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmCategory}
                disabled={uploading}
                style={[styles.sheetBtn, { backgroundColor: colors.primary, flex: 1, opacity: uploading ? 0.7 : 1 }]}
              >
                {uploading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '700' }}>Save Photo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Photo Detail Modal ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            {selectedPhoto && (
              <View style={{ width: '100%' }}>
                <Image
                  source={{ uri: selectedPhoto.uri }}
                  style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }}
                />
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder, marginTop: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ color: colors.cardMuted, fontSize: 13 }}>
                      {new Date(selectedPhoto.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </Text>
                    {selectedPhoto.category && (
                      <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '33' }]}>
                        <Text style={[styles.categoryBadgeText, { color: colors.primary }]}>
                          {selectedPhoto.category.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  {selectedPhoto.notes ? (
                    <Text style={{ color: colors.cardForeground, fontSize: 14, marginBottom: 16 }}>{selectedPhoto.notes}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => { handleDeletePhoto(selectedPhoto.id); setModalVisible(false); }}
                      style={[styles.sheetBtn, { backgroundColor: '#EF444420', borderWidth: 1, borderColor: '#EF4444', flex: 1 }]}
                    >
                      <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setModalVisible(false)}
                      style={[styles.sheetBtn, { backgroundColor: colors.primary, flex: 1 }]}
                    >
                      <Text style={{ color: 'white', fontWeight: '700' }}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Comparison Slider Modal ── */}
      <Modal visible={compareModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Category selector */}
          <View style={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
              Progress Comparison
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCompareCategory(cat.value);
                    sliderX.setValue(SCREEN_WIDTH / 2);
                  }}
                  style={[
                    styles.categoryChipSmall,
                    { backgroundColor: compareCategory === cat.value ? colors.primary : '#333' },
                  ]}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{cat.emoji} {cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Slider comparison view */}
          {oldestForCategory && newestForCategory && oldestForCategory.id !== newestForCategory.id ? (
            <View style={{ flex: 1, position: 'relative' }}>
              {/* Newest photo (right) — full width */}
              <Image
                source={{ uri: newestForCategory.uri }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                resizeMode="cover"
              />
              {/* Oldest photo (left) — clipped by slider */}
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: sliderX,
                  overflow: 'hidden',
                }}
              >
                <Image
                  source={{ uri: oldestForCategory.uri }}
                  style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, bottom: 0 }}
                  resizeMode="cover"
                />
              </Animated.View>

              {/* Divider line */}
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: sliderX,
                  width: 2,
                  backgroundColor: 'white',
                  marginLeft: -1,
                }}
              />

              {/* Drag handle */}
              <Animated.View
                {...panResponder.panHandlers}
                style={[styles.dragHandle, { left: sliderX, marginLeft: -22 }]}
              >
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>⇔</Text>
              </Animated.View>

              {/* Labels */}
              <View style={[styles.compareLabel, { left: 12 }]}>
                <Text style={styles.compareLabelText}>BEFORE</Text>
                <Text style={styles.compareLabelDate}>{new Date(oldestForCategory.date).toLocaleDateString()}</Text>
              </View>
              <View style={[styles.compareLabel, { right: 12 }]}>
                <Text style={styles.compareLabelText}>AFTER</Text>
                <Text style={styles.compareLabelDate}>{new Date(newestForCategory.date).toLocaleDateString()}</Text>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>📸</Text>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                Need 2+ {compareCategory} photos
              </Text>
              <Text style={{ color: '#999', textAlign: 'center', fontSize: 14 }}>
                Add more {compareCategory} photos over time to see your transformation here.
              </Text>
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity
            onPress={() => setCompareModalVisible(false)}
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
          >
            <Text style={{ color: colors.cardForeground, fontWeight: '700', fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Zaki Body Analysis Modal ── */}
      <Modal visible={zakiAnalysisVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, maxHeight: '90%' }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.cardBorder }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 22 }}>🤖</Text>
              <Text style={[styles.sheetTitle, { color: colors.cardForeground, marginLeft: 8, marginBottom: 0 }]}>Zaki Body Analysis</Text>
            </View>
            {zakiAnalysisDate && (
              <Text style={{ color: colors.cardMuted, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
                Analyzed {new Date(zakiAnalysisDate).toLocaleString()}
              </Text>
            )}
            {zakiAnalysisLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={{ color: colors.cardMuted, marginTop: 16, fontSize: 14 }}>Zaki is analyzing your photos...</Text>
                <Text style={{ color: colors.cardMuted, marginTop: 4, fontSize: 12 }}>This may take 15-30 seconds</Text>
              </View>
            ) : zakiAnalysisResult ? (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
                {/* Overall Assessment */}
                <View style={{ backgroundColor: '#7C3AED22', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 13, marginBottom: 6 }}>OVERALL ASSESSMENT</Text>
                  <Text style={{ color: colors.cardForeground, fontSize: 14, lineHeight: 20 }}>{zakiAnalysisResult.overallAssessment}</Text>
                  {zakiAnalysisResult.estimatedBodyFatRange && (
                    <Text style={{ color: colors.cardMuted, fontSize: 12, marginTop: 6 }}>Est. Body Fat: {zakiAnalysisResult.estimatedBodyFatRange}</Text>
                  )}
                </View>
                {/* Strengths */}
                {zakiAnalysisResult.strengths?.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#22C55E', fontWeight: '700', fontSize: 13, marginBottom: 6 }}>✅ STRENGTHS</Text>
                    {zakiAnalysisResult.strengths.map((s, i) => (
                      <Text key={i} style={{ color: colors.cardForeground, fontSize: 13, lineHeight: 20, marginBottom: 2 }}>• {s}</Text>
                    ))}
                  </View>
                )}
                {/* Posture Findings */}
                {zakiAnalysisResult.postureFindings?.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 13, marginBottom: 6 }}>🔍 POSTURE FINDINGS</Text>
                    {zakiAnalysisResult.postureFindings.map((f, i) => (
                      <Text key={i} style={{ color: colors.cardForeground, fontSize: 13, lineHeight: 20, marginBottom: 2 }}>• {f}</Text>
                    ))}
                  </View>
                )}
                {/* Muscle Imbalances */}
                {zakiAnalysisResult.muscleImbalances?.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13, marginBottom: 6 }}>⚖️ MUSCLE IMBALANCES</Text>
                    {zakiAnalysisResult.muscleImbalances.map((m, i) => (
                      <View key={i} style={{ marginBottom: 6 }}>
                        <Text style={{ color: colors.cardForeground, fontSize: 13, fontWeight: '600' }}>{m.area}</Text>
                        <Text style={{ color: colors.cardMuted, fontSize: 12, lineHeight: 18 }}>{m.finding}</Text>
                        <Text style={{ color: m.severity === 'significant' ? '#EF4444' : m.severity === 'moderate' ? '#F59E0B' : '#22C55E', fontSize: 11, fontWeight: '600', marginTop: 2 }}>{m.severity?.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {/* Weak Points */}
                {zakiAnalysisResult.weakPoints?.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#0EA5E9', fontWeight: '700', fontSize: 13, marginBottom: 6 }}>💪 WEAK POINTS & FIXES</Text>
                    {zakiAnalysisResult.weakPoints.map((w, i) => (
                      <View key={i} style={{ marginBottom: 6 }}>
                        <Text style={{ color: colors.cardForeground, fontSize: 13, fontWeight: '600' }}>{w.muscle}</Text>
                        <Text style={{ color: colors.cardMuted, fontSize: 12, lineHeight: 18 }}>{w.recommendation}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {/* Priority Actions */}
                {zakiAnalysisResult.priorityActions?.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 13, marginBottom: 6 }}>🎯 PRIORITY ACTIONS</Text>
                    {zakiAnalysisResult.priorityActions.map((a, i) => (
                      <Text key={i} style={{ color: colors.cardForeground, fontSize: 13, lineHeight: 20, marginBottom: 4 }}>{i + 1}. {a}</Text>
                    ))}
                  </View>
                )}
              </ScrollView>
            ) : null}
            <TouchableOpacity
              onPress={() => setZakiAnalysisVisible(false)}
              style={[styles.sheetBtn, { backgroundColor: '#7C3AED', marginTop: 12 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1 },
  statNum: { fontSize: 22, fontWeight: '800' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 6 },
  actionBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  photoDate: { color: 'white', fontSize: 11, fontWeight: '600' },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  categoryBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  categoryChip: { width: 80, height: 80, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  categoryChipSmall: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  sheetBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  sourceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, marginBottom: 10 },
  sourceBtnText: { fontWeight: '700', fontSize: 16 },
  dragHandle: { position: 'absolute', top: '45%', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  compareLabel: { position: 'absolute', top: 12, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  compareLabelText: { color: 'white', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  compareLabelDate: { color: '#ccc', fontSize: 10, marginTop: 2 },
  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30 },
});
