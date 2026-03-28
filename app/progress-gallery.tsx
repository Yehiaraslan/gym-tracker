import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
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
import { Platform } from 'react-native';

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

  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory>('front');

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

  // Step 1: Choose source
  const handlePickImage = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Add Progress Photo', 'Choose a photo source', [
      {
        text: '📷  Take Photo',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Please allow camera access to take a progress photo.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.85,
              allowsEditing: true,
              aspect: [3, 4],
            });
            if (!result.canceled && result.assets[0]) {
              setPendingImageUri(result.assets[0].uri);
              setSelectedCategory('front');
              setCategoryModalVisible(true);
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to take photo. Please try again.');
          }
        },
      },
      {
        text: '🖼  Choose from Library',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Please allow access to your photo library.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
              allowsEditing: true,
              aspect: [3, 4],
              allowsMultipleSelection: false,
            });
            if (!result.canceled && result.assets[0]) {
              setPendingImageUri(result.assets[0].uri);
              setSelectedCategory('front');
              setCategoryModalVisible(true);
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to add photo. Please try again.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Step 2: Confirm category and save
  const handleConfirmCategory = async () => {
    if (!pendingImageUri) return;
    try {
      setUploading(true);
      setCategoryModalVisible(false);
      const photo = await addProgressPhoto(pendingImageUri, '', selectedCategory);
      setPhotos(prev => [photo, ...prev]);
      loadStats();
      setPendingImageUri(null);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
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

  // Comparison helpers
  const getPhotosForCategory = (cat: PhotoCategory) =>
    photos.filter(p => p.category === cat).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const oldestForCategory = getPhotosForCategory(compareCategory)[0];
  const newestForCategory = getPhotosForCategory(compareCategory).slice(-1)[0];

  const renderPhoto = ({ item }: { item: ProgressPhoto }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedPhoto(item);
        setModalVisible(true);
      }}
      style={{ flex: 1, margin: 4 }}
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
          <Text style={[styles.title, { color: colors.foreground }]}>Progress Gallery</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>Track your transformation over time</Text>
        </View>

        {/* Stats */}
        {stats && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.statNum, { color: colors.foreground }]}>{stats.totalPhotos}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Total Photos</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.statNum, { color: colors.foreground }]}>{stats.daysSinceFirst}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Days Tracked</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.statNum, { color: colors.foreground }]}>{stats.averagePhotosPerMonth}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Per Month</Text>
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
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flex: 1 }]}
          >
            <Text style={{ fontSize: 16 }}>⚖️</Text>
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Compare</Text>
          </TouchableOpacity>
        </View>

        {/* Photos Grid */}
        {photos.length > 0 ? (
          <View style={{ paddingHorizontal: 8 }}>
            <FlatList
              data={photos}
              keyExtractor={item => item.id}
              renderItem={renderPhoto}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
            />
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📸</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No photos yet</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>
              Start tracking your progress by adding your first photo
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Category Picker Modal ── */}
      <Modal visible={categoryModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Tag This Photo</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
              Which angle is this photo?
            </Text>
            {pendingImageUri && (
              <Image
                source={{ uri: pendingImageUri }}
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
                      borderColor: selectedCategory === cat.value ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{cat.emoji}</Text>
                  <Text style={{
                    color: selectedCategory === cat.value ? 'white' : colors.foreground,
                    fontWeight: '600',
                    fontSize: 13,
                  }}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setCategoryModalVisible(false); setPendingImageUri(null); }}
                style={[styles.sheetBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, flex: 1 }]}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmCategory}
                style={[styles.sheetBtn, { backgroundColor: colors.primary, flex: 1 }]}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Save Photo</Text>
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
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
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
                    <Text style={{ color: colors.foreground, fontSize: 14, marginBottom: 16 }}>{selectedPhoto.notes}</Text>
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
            <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
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
  dragHandle: { position: 'absolute', top: '45%', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  compareLabel: { position: 'absolute', top: 12, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  compareLabelText: { color: 'white', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  compareLabelDate: { color: '#ccc', fontSize: 10, marginTop: 2 },
  closeBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30 },
});
