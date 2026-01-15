import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { ProgressPhotoSlider } from '@/components/progress-photo-slider';
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
import { Platform } from 'react-native';

export default function ProgressGalleryScreen() {
  const colors = useColors();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<'front' | 'side' | 'back' | 'other'>('front');
  const [stats, setStats] = useState<any>(null);

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

  const handlePickImage = async () => {
    try {
      setUploading(true);
      // Demo: Use a placeholder image
      const demoUri = 'https://via.placeholder.com/300x400?text=Progress+Photo';
      
      const photo = await addProgressPhoto(demoUri, '', category);
      setPhotos(prev => [photo, ...prev]);
      loadStats();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', 'Progress photo added!');
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to add photo. Please try again.');
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
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to delete photo');
          }
        },
      },
    ]);
  };

  const handleUpdateNotes = async () => {
    if (selectedPhoto) {
      try {
        await updateProgressPhotoNotes(selectedPhoto.id, notes);
        setPhotos(prev =>
          prev.map(p => (p.id === selectedPhoto.id ? { ...p, notes } : p))
        );
        setModalVisible(false);
        setNotes('');
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to update notes');
      }
    }
  };

  const renderPhoto = ({ item }: { item: ProgressPhoto }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedPhoto(item);
        setNotes(item.notes || '');
        setModalVisible(true);
      }}
      className="flex-1 m-2"
    >
      <View className="rounded-xl overflow-hidden" style={{ aspectRatio: 3 / 4 }}>
                <Image
                  source={{ uri: item.uri }}
                  style={{ width: '100%', height: '100%' }}
                />
        <View
          className="absolute bottom-0 left-0 right-0 p-2"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <Text className="text-white text-xs font-semibold">
            {new Date(item.date).toLocaleDateString()}
          </Text>
          {item.category && (
            <Text className="text-white text-xs mt-1 capitalize">{item.category}</Text>
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
        <View className="px-4 py-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Progress Gallery</Text>
          <Text className="text-muted">Track your transformation over time</Text>
        </View>

        {/* Stats */}
        {stats && (
          <View className="px-4 mb-6">
            <View
              className="bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">{stats.totalPhotos}</Text>
                  <Text className="text-xs text-muted mt-1">Total Photos</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">{stats.daysSinceFirst}</Text>
                  <Text className="text-xs text-muted mt-1">Days Tracked</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">{stats.averagePhotosPerMonth}</Text>
                  <Text className="text-xs text-muted mt-1">Per Month</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Add Photo Button */}
        <View className="px-4 mb-6">
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={uploading}
            className="flex-row items-center justify-center py-4 rounded-xl"
            style={{ backgroundColor: colors.primary, opacity: uploading ? 0.7 : 1 }}
          >
            {uploading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <IconSymbol name="plus" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Add Progress Photo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Photos Grid */}
        {photos.length > 0 ? (
          <View className="px-2">
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
          <View className="items-center py-12 px-4">
            <Text className="text-5xl mb-4">📸</Text>
            <Text className="text-lg font-semibold text-foreground mb-2">No photos yet</Text>
            <Text className="text-muted text-center text-sm">
              Start tracking your progress by adding your first photo
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Photo Detail Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <View className="flex-1 justify-center items-center px-4">
            {selectedPhoto && (
              <View className="w-full">
                <Image
                  source={{ uri: selectedPhoto.uri }}
                  style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }}
                />
                <View className="mt-6 bg-surface rounded-xl p-4" style={{ borderWidth: 1, borderColor: colors.border }}>
                  <Text className="text-foreground font-semibold mb-2">Date</Text>
                  <Text className="text-muted mb-4">
                    {new Date(selectedPhoto.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>

                  {selectedPhoto.category && (
                    <>
                      <Text className="text-foreground font-semibold mb-2 capitalize">
                        Category: {selectedPhoto.category}
                      </Text>
                    </>
                  )}

                  <Text className="text-foreground font-semibold mb-2">Notes</Text>
                  <View
                    className="bg-background rounded-lg p-3 mb-4"
                    style={{ borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text className="text-foreground">{selectedPhoto.notes || 'No notes'}</Text>
                  </View>

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleDeletePhoto(selectedPhoto.id)}
                      className="flex-1 py-3 rounded-lg"
                      style={{ backgroundColor: colors.error }}
                    >
                      <Text className="text-center text-white font-semibold">Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setModalVisible(false)}
                      className="flex-1 py-3 rounded-lg"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Text className="text-center text-white font-semibold">Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
