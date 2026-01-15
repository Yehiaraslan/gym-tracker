import { useState, useCallback, useEffect } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  Alert,
  Modal,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { Exercise, DayExercise, getDayName } from '@/lib/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { WarmupCooldownAdmin } from '@/components/warmup-cooldown-admin';
import { 
  findExerciseVideo, 
  getExerciseSuggestions,
  VideoSearchResult,
  getCuratedExerciseGifUrl,
} from '@/lib/exercise-video-service';
import {
  getCacheMetadata,
  clearExerciseCache,
  formatCacheSize,
  CacheMetadata,
} from '@/lib/exercise-cache';

type AdminTab = 'exercises' | 'program' | 'warmup' | 'settings';

export default function AdminScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<AdminTab>('exercises');

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Admin Panel</Text>
      </View>

      {/* Tab Bar */}
      <View className="flex-row px-4 mb-4">
        {(['exercises', 'program', 'warmup', 'settings'] as AdminTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab);
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              marginHorizontal: 2,
              backgroundColor: activeTab === tab ? colors.primary : colors.surface,
            }}
          >
            <Text 
              style={{ 
                textAlign: 'center', 
                fontWeight: '600',
                color: activeTab === tab ? '#FFFFFF' : colors.foreground,
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View className="flex-1">
        {activeTab === 'exercises' && <ExercisesTab />}
        {activeTab === 'program' && <ProgramTab />}
        {activeTab === 'warmup' && <WarmupCooldownAdmin />}
        {activeTab === 'settings' && <SettingsTab />}
      </View>
    </ScreenContainer>
  );
}

// Exercises Tab Component
function ExercisesTab() {
  const colors = useColors();
  const { store, addExercise, updateExercise, deleteExercise } = useGym();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [name, setName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [restSeconds, setRestSeconds] = useState('90');
  const [defaultReps, setDefaultReps] = useState('8-12');
  const [defaultDuration, setDefaultDuration] = useState('60');
  const [exerciseType, setExerciseType] = useState('reps');
  const [bodyPart, setBodyPart] = useState('Other');
  const [notes, setNotes] = useState('');
  
  // Auto-fetch video states
  const [isSearchingVideo, setIsSearchingVideo] = useState(false);
  const [videoSuggestions, setVideoSuggestions] = useState<VideoSearchResult[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoSearchResult | null>(null);
  const [showVideoSuggestions, setShowVideoSuggestions] = useState(false);
  
  // RapidAPI key for ExerciseDB (stored in settings)
  const apiKey = store.settings.rapidApiKey || null;

  const openAddModal = () => {
    setEditingExercise(null);
    setName('');
    setVideoUrl('');
    setRestSeconds('90');
    setDefaultReps('8-12');
    setDefaultDuration('60');
    setExerciseType('reps');
    setBodyPart('Other');
    setNotes('');
    setSelectedVideo(null);
    setVideoSuggestions([]);
    setShowVideoSuggestions(false);
    setModalVisible(true);
  };

  const openEditModal = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setName(exercise.name);
    setVideoUrl(exercise.videoUrl);
    setRestSeconds(exercise.defaultRestSeconds.toString());
    setDefaultReps(exercise.defaultReps || '8-12');
    setNotes(exercise.notes || '');
    setSelectedVideo(null);
    setVideoSuggestions([]);
    setShowVideoSuggestions(false);
    setModalVisible(true);
  };

  // Auto-search for exercise video when name changes
  const handleSearchVideo = useCallback(async () => {
    if (!name.trim() || name.length < 3) {
      setVideoSuggestions([]);
      setShowVideoSuggestions(false);
      return;
    }

    setIsSearchingVideo(true);
    setShowVideoSuggestions(true);
    
    try {
      // Use real API if key is configured
      if (apiKey) {
        const results = await getExerciseSuggestions(name.trim(), apiKey, 5);
        if (results.length > 0) {
          setVideoSuggestions(results);
        } else {
          // No results found, show message
          Alert.alert(
            'No Results',
            `No exercises found matching "${name}". Try a different search term.`
          );
          setVideoSuggestions([]);
          setShowVideoSuggestions(false);
        }
      } else {
        // Demo mode - show placeholder suggestions
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const demoSuggestions: VideoSearchResult[] = [
          {
            exerciseId: 'demo-1',
            exerciseName: `${name} (Standard Form)`,
            gifUrl: `https://via.placeholder.com/360x360/1a1a2e/ffffff?text=${encodeURIComponent(name)}`,
            bodyPart: 'full body',
            target: 'multiple muscles',
            equipment: 'body weight',
            instructions: ['Maintain proper form throughout the movement', 'Control the eccentric phase', 'Breathe steadily'],
          },
          {
            exerciseId: 'demo-2',
            exerciseName: `${name} (With Barbell)`,
            gifUrl: `https://via.placeholder.com/360x360/16213e/ffffff?text=${encodeURIComponent(name + ' Barbell')}`,
            bodyPart: 'full body',
            target: 'multiple muscles',
            equipment: 'barbell',
            instructions: ['Keep your back straight', 'Engage your core', 'Use full range of motion'],
          },
          {
            exerciseId: 'demo-3',
            exerciseName: `${name} (With Dumbbells)`,
            gifUrl: `https://via.placeholder.com/360x360/0f3460/ffffff?text=${encodeURIComponent(name + ' DB')}`,
            bodyPart: 'full body',
            target: 'multiple muscles',
            equipment: 'dumbbell',
            instructions: ['Equal weight on both sides', 'Slow and controlled', 'Full extension'],
          },
        ];
        
        setVideoSuggestions(demoSuggestions);
        
        // Show hint about API key
        Alert.alert(
          'Demo Mode',
          'Add your RapidAPI key in Settings to fetch real exercise GIFs from ExerciseDB.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error searching videos:', error);
      Alert.alert('Error', 'Failed to search for exercise videos. Please check your API key.');
    } finally {
      setIsSearchingVideo(false);
    }
  }, [name, apiKey]);

  const handleSelectVideo = (video: VideoSearchResult) => {
    setSelectedVideo(video);
    setVideoUrl(video.gifUrl);
    setShowVideoSuggestions(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Exercise name is required');
      return;
    }
    const rest = parseInt(restSeconds) || 90;
    
    if (editingExercise) {
      await updateExercise(editingExercise.id, {
        name: name.trim(),
        videoUrl: videoUrl.trim(),
        defaultRestSeconds: rest,
        defaultReps: defaultReps.trim() || '8-12',
        notes: notes.trim(),
      });
    } else {
      await addExercise(name.trim(), videoUrl.trim(), rest, defaultReps.trim() || '8-12', notes.trim());
    }
    
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
  };

  const handleDelete = (exercise: Exercise) => {
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete "${exercise.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteExercise(exercise.id);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      ]
    );
  };

  const renderExercise = ({ item }: { item: Exercise }) => (
    <View 
      className="bg-surface rounded-xl p-4 mb-3 mx-4"
      style={{ borderWidth: 1, borderColor: colors.border }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
          <Text className="text-sm text-muted mt-1">
            {item.defaultReps || '8-12'} reps • Rest: {item.defaultRestSeconds}s
          </Text>
          {item.notes ? (
            <View 
              className="mt-2 p-2 rounded-lg"
              style={{ backgroundColor: colors.warning + '15' }}
            >
              <Text className="text-sm" style={{ color: colors.warning }}>
                📝 {item.notes}
              </Text>
            </View>
          ) : null}
          {item.videoUrl ? (
            <TouchableOpacity 
              onPress={() => Linking.openURL(item.videoUrl)}
              className="flex-row items-center mt-2"
            >
              <IconSymbol name="video.fill" size={16} color={colors.primary} />
              <Text className="text-sm ml-1" style={{ color: colors.primary }}>Watch Video</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View className="flex-row">
          <TouchableOpacity 
            onPress={() => openEditModal(item)}
            className="p-2 mr-2"
          >
            <IconSymbol name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => handleDelete(item)}
            className="p-2"
          >
            <IconSymbol name="trash.fill" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={store.exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExercise}
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="dumbbell.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-4">No exercises yet</Text>
            <Text className="text-muted text-sm">Tap + to add your first exercise</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Add Button */}
      <TouchableOpacity
        onPress={openAddModal}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <IconSymbol name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ScrollView 
            className="bg-background rounded-t-3xl"
            style={{ maxHeight: '90%' }}
            contentContainerStyle={{ padding: 24 }}
          >
            <Text className="text-xl font-bold text-foreground mb-6">
              {editingExercise ? 'Edit Exercise' : 'Add Exercise'}
            </Text>

            <Text className="text-sm font-medium text-muted mb-2">Exercise Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Bench Press"
              placeholderTextColor={colors.muted}
              className="bg-surface rounded-xl p-4 text-foreground mb-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            />

            <Text className="text-sm font-medium text-muted mb-2">Default Reps</Text>
            <TextInput
              value={defaultReps}
              onChangeText={setDefaultReps}
              placeholder="e.g., 8-12 or 10"
              placeholderTextColor={colors.muted}
              className="bg-surface rounded-xl p-4 text-foreground mb-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            />

            <Text className="text-sm font-medium text-muted mb-2">Form Video</Text>
            
            {/* Auto-search button */}
            <TouchableOpacity
              onPress={handleSearchVideo}
              disabled={isSearchingVideo || name.length < 3}
              className="flex-row items-center justify-center py-3 rounded-xl mb-3"
              style={{ 
                backgroundColor: name.length >= 3 ? colors.primary : colors.surface,
                opacity: name.length < 3 ? 0.5 : 1,
              }}
            >
              {isSearchingVideo ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text className="text-white font-semibold mr-2">🔍</Text>
                  <Text className="text-white font-semibold">
                    {name.length < 3 ? 'Enter exercise name first' : 'Find Best Form Video'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            
            {/* Selected video preview */}
            {selectedVideo && (
              <View className="mb-3 rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border }}>
                <Image
                  source={{ uri: selectedVideo.gifUrl }}
                  style={{ width: '100%', height: 200 }}
                  contentFit="cover"
                />
                <View className="p-3 bg-surface">
                  <Text className="text-foreground font-medium">{selectedVideo.exerciseName}</Text>
                  <Text className="text-muted text-sm">{selectedVideo.equipment} • {selectedVideo.target}</Text>
                </View>
              </View>
            )}
            
            {/* Video suggestions */}
            {showVideoSuggestions && videoSuggestions.length > 0 && (
              <View className="mb-4">
                <Text className="text-sm text-muted mb-2">Select a form video:</Text>
                {videoSuggestions.map((video, index) => (
                  <TouchableOpacity
                    key={video.exerciseId}
                    onPress={() => handleSelectVideo(video)}
                    className="flex-row items-center p-3 rounded-xl mb-2"
                    style={{ 
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: selectedVideo?.exerciseId === video.exerciseId ? colors.primary : colors.border,
                    }}
                  >
                    <View className="w-16 h-16 rounded-lg overflow-hidden mr-3">
                      <Image
                        source={{ uri: video.gifUrl }}
                        style={{ width: 64, height: 64 }}
                        contentFit="cover"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-medium">{video.exerciseName}</Text>
                      <Text className="text-muted text-xs">{video.equipment}</Text>
                    </View>
                    {selectedVideo?.exerciseId === video.exerciseId && (
                      <Text className="text-primary">✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            {/* Manual URL input (collapsed by default) */}
            <TouchableOpacity
              onPress={() => setShowVideoSuggestions(false)}
              className="mb-2"
            >
              <Text className="text-sm text-muted underline">Or enter URL manually</Text>
            </TouchableOpacity>
            {!showVideoSuggestions && !selectedVideo && (
              <TextInput
                value={videoUrl}
                onChangeText={setVideoUrl}
                placeholder="https://youtube.com/..."
                placeholderTextColor={colors.muted}
                className="bg-surface rounded-xl p-4 text-foreground mb-4"
                style={{ borderWidth: 1, borderColor: colors.border }}
                autoCapitalize="none"
                keyboardType="url"
              />
            )}

            <Text className="text-sm font-medium text-muted mb-2">Default Rest Time (seconds)</Text>
            <TextInput
              value={restSeconds}
              onChangeText={setRestSeconds}
              placeholder="90"
              placeholderTextColor={colors.muted}
              className="bg-surface rounded-xl p-4 text-foreground mb-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
              keyboardType="numeric"
            />

            <Text className="text-sm font-medium text-muted mb-2">Personal Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g., Pause 2 sec at bottom, lift heavy, slow eccentric..."
              placeholderTextColor={colors.muted}
              className="bg-surface rounded-xl p-4 text-foreground mb-6"
              style={{ borderWidth: 1, borderColor: colors.border, minHeight: 80 }}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View className="flex-row">
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="flex-1 py-4 rounded-xl mr-2"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-center font-semibold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                className="flex-1 py-4 rounded-xl ml-2"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-center font-semibold text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// Program Tab Component
function ProgramTab() {
  const colors = useColors();
  const { store, setProgramDay, getProgramDay, getExerciseById } = useGym();
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [dayExercises, setDayExercises] = useState<DayExercise[]>([]);

  const currentProgram = getProgramDay(selectedWeek, selectedDay);

  const openDayEditor = () => {
    const existing = getProgramDay(selectedWeek, selectedDay);
    if (existing) {
      setDayExercises([...existing.exercises]);
    } else {
      setDayExercises([]);
    }
    setModalVisible(true);
  };

  const addExerciseToDay = (exerciseId: string) => {
    const exercise = getExerciseById(exerciseId);
    if (!exercise) return;
    
    setDayExercises(prev => [
      ...prev,
      {
        exerciseId,
        sets: 3,
        reps: exercise.defaultReps || '8-12',
        restSeconds: exercise.defaultRestSeconds,
        order: prev.length,
      }
    ]);
  };

  const updateDayExercise = (index: number, updates: Partial<DayExercise>) => {
    setDayExercises(prev => prev.map((ex, i) => 
      i === index ? { ...ex, ...updates } : ex
    ));
  };

  const removeDayExercise = (index: number) => {
    setDayExercises(prev => prev.filter((_, i) => i !== index));
  };

  const saveDayProgram = async () => {
    await setProgramDay(selectedWeek, selectedDay, dayExercises, dayExercises.length === 0);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
  };

  return (
    <View className="flex-1 px-4">
      {/* Week Selector */}
      <Text className="text-sm font-medium text-muted mb-2">Select Week</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(week => (
          <TouchableOpacity
            key={week}
            onPress={() => setSelectedWeek(week)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: selectedWeek === week ? colors.primary : colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 8,
              borderWidth: 1,
              borderColor: selectedWeek === week ? colors.primary : colors.border,
            }}
          >
            <Text style={{ 
              color: selectedWeek === week ? '#FFFFFF' : colors.foreground,
              fontWeight: '600',
            }}>
              {week}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Day Selector */}
      <Text className="text-sm font-medium text-muted mb-2">Select Day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        {[1, 2, 3, 4, 5, 6, 7].map(day => {
          const hasProgram = getProgramDay(selectedWeek, day);
          return (
            <TouchableOpacity
              key={day}
              onPress={() => setSelectedDay(day)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: selectedDay === day ? colors.primary : colors.surface,
                marginRight: 8,
                borderWidth: 1,
                borderColor: selectedDay === day ? colors.primary : colors.border,
              }}
            >
              <Text style={{ 
                color: selectedDay === day ? '#FFFFFF' : colors.foreground,
                fontWeight: '600',
                fontSize: 12,
              }}>
                {getDayName(day).substring(0, 3)}
              </Text>
              {hasProgram && hasProgram.exercises.length > 0 && (
                <View 
                  style={{ 
                    width: 6, 
                    height: 6, 
                    borderRadius: 3, 
                    backgroundColor: selectedDay === day ? '#FFFFFF' : colors.success,
                    alignSelf: 'center',
                    marginTop: 4,
                  }} 
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Current Day Program */}
      <View 
        className="bg-surface rounded-xl p-4 flex-1"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-semibold text-foreground">
            Week {selectedWeek}, {getDayName(selectedDay)}
          </Text>
          <TouchableOpacity
            onPress={openDayEditor}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        </View>

        {currentProgram && currentProgram.exercises.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {currentProgram.exercises.map((ex, index) => {
              const exercise = getExerciseById(ex.exerciseId);
              return (
                <View 
                  key={index}
                  className="py-3 border-b"
                  style={{ borderBottomColor: colors.border }}
                >
                  <Text className="font-medium text-foreground">
                    {index + 1}. {exercise?.name || 'Unknown'}
                  </Text>
                  <Text className="text-sm text-muted mt-1">
                    {ex.sets} sets × {ex.reps} reps • Rest: {ex.restSeconds}s
                  </Text>
                  {exercise?.notes ? (
                    <Text className="text-xs mt-1" style={{ color: colors.warning }}>
                      📝 {exercise.notes}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted">No exercises for this day</Text>
            <Text className="text-sm text-muted">Tap Edit to add exercises</Text>
          </View>
        )}
      </View>

      {/* Day Editor Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View 
            className="bg-background rounded-t-3xl p-6"
            style={{ maxHeight: '90%' }}
          >
            <Text className="text-xl font-bold text-foreground mb-4">
              Edit Week {selectedWeek}, {getDayName(selectedDay)}
            </Text>

            {/* Add Exercise Dropdown */}
            <Text className="text-sm font-medium text-muted mb-2">Add Exercise</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="mb-4"
            >
              {store.exercises
                .filter(ex => !dayExercises.find(de => de.exerciseId === ex.id))
                .map(exercise => (
                  <TouchableOpacity
                    key={exercise.id}
                    onPress={() => addExerciseToDay(exercise.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: colors.surface,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text className="text-foreground">{exercise.name}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Day Exercises List */}
            <ScrollView className="flex-1 mb-4" style={{ maxHeight: 400 }}>
              {dayExercises.map((dayEx, index) => {
                const exercise = getExerciseById(dayEx.exerciseId);
                return (
                  <View 
                    key={index}
                    className="bg-surface rounded-xl p-4 mb-3"
                    style={{ borderWidth: 1, borderColor: colors.border }}
                  >
                    <View className="flex-row justify-between items-center mb-3">
                      <Text className="font-semibold text-foreground">
                        {index + 1}. {exercise?.name}
                      </Text>
                      <TouchableOpacity onPress={() => removeDayExercise(index)}>
                        <IconSymbol name="trash.fill" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                    
                    <View className="flex-row">
                      <View className="flex-1 mr-2">
                        <Text className="text-xs text-muted mb-1">Sets</Text>
                        <TextInput
                          value={dayEx.sets.toString()}
                          onChangeText={(v) => updateDayExercise(index, { sets: parseInt(v) || 1 })}
                          keyboardType="numeric"
                          className="bg-background rounded-lg p-2 text-foreground text-center"
                          style={{ borderWidth: 1, borderColor: colors.border }}
                        />
                      </View>
                      <View className="flex-1 mr-2">
                        <Text className="text-xs text-muted mb-1">Reps</Text>
                        <TextInput
                          value={dayEx.reps}
                          onChangeText={(v) => updateDayExercise(index, { reps: v })}
                          className="bg-background rounded-lg p-2 text-foreground text-center"
                          style={{ borderWidth: 1, borderColor: colors.border }}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-muted mb-1">Rest (s)</Text>
                        <TextInput
                          value={dayEx.restSeconds.toString()}
                          onChangeText={(v) => updateDayExercise(index, { restSeconds: parseInt(v) || 60 })}
                          keyboardType="numeric"
                          className="bg-background rounded-lg p-2 text-foreground text-center"
                          style={{ borderWidth: 1, borderColor: colors.border }}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
              
              {dayExercises.length === 0 && (
                <View className="items-center py-8">
                  <Text className="text-muted">No exercises added</Text>
                  <Text className="text-sm text-muted">Select exercises above to add</Text>
                </View>
              )}
            </ScrollView>

            <View className="flex-row">
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="flex-1 py-4 rounded-xl mr-2"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-center font-semibold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveDayProgram}
                className="flex-1 py-4 rounded-xl ml-2"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-center font-semibold text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Settings Tab Component
function SettingsTab() {
  const colors = useColors();
  const router = useRouter();
  const { store, updateSettings } = useGym();
  const [startDate, setStartDate] = useState(store.settings.cycleStartDate);
  const [rapidApiKey, setRapidApiKey] = useState(store.settings.rapidApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'none' | 'valid' | 'invalid'>(
    store.settings.rapidApiKey ? 'valid' : 'none'
  );
  
  // Cache management state
  const [cacheMetadata, setCacheMetadata] = useState<CacheMetadata | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  
  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    recoveryAlertsEnabled: true,
    milestoneNotificationsEnabled: true,
  });
  // Load cache metadata on mount
  useEffect(() => {
    loadCacheMetadata();
  }, []);
  
  const loadCacheMetadata = async () => {
    try {
      const metadata = await getCacheMetadata();
      setCacheMetadata(metadata);
    } catch (error) {
      console.error('Error loading cache metadata:', error);
    }
  };
  
  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will delete all cached exercise GIFs and instructions. You will need to re-download them when online.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsClearingCache(true);
            try {
              await clearExerciseCache();
              await loadCacheMetadata();
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Exercise cache cleared');
            } catch (error) {
              console.error('Error clearing cache:', error);
              Alert.alert('Error', 'Failed to clear cache');
            } finally {
              setIsClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveDate = async () => {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate)) {
      Alert.alert('Error', 'Please enter date in YYYY-MM-DD format');
      return;
    }
    await updateSettings({ cycleStartDate: startDate });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Cycle start date updated');
  };

  const handleSaveApiKey = async () => {
    if (!rapidApiKey.trim()) {
      await updateSettings({ rapidApiKey: '' });
      setApiKeyStatus('none');
      Alert.alert('Cleared', 'API key has been removed');
      return;
    }

    setIsValidatingKey(true);
    try {
      // Test the API key with a simple request
      const response = await fetch(
        'https://exercisedb.p.rapidapi.com/exercises?limit=1',
        {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': rapidApiKey.trim(),
            'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
          },
        }
      );

      if (response.ok) {
        await updateSettings({ rapidApiKey: rapidApiKey.trim() });
        setApiKeyStatus('valid');
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'ExerciseDB API key saved and validated!');
      } else {
        setApiKeyStatus('invalid');
        Alert.alert(
          'Invalid API Key',
          'The API key could not be validated. Please check that you have subscribed to the ExerciseDB API on RapidAPI.'
        );
      }
    } catch (error) {
      setApiKeyStatus('invalid');
      Alert.alert('Error', 'Failed to validate API key. Please check your internet connection.');
    } finally {
      setIsValidatingKey(false);
    }
  };
  
  const handleToggleNotification = async (key: 'recoveryAlertsEnabled' | 'milestoneNotificationsEnabled') => {
    try {
      const { notificationService } = await import('@/lib/notification-service');
      const updated = { ...notificationSettings, [key]: !notificationSettings[key] };
      await notificationService.updateNotificationSettings(updated);
      setNotificationSettings(updated);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  return (
    <ScrollView className="flex-1 px-4">
      <View 
        className="bg-surface rounded-xl p-4 mb-4"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <Text className="text-lg font-semibold text-foreground mb-4">Cycle Settings</Text>
        
        <Text className="text-sm font-medium text-muted mb-2">
          Cycle Start Date (YYYY-MM-DD)
        </Text>
        <TextInput
          value={startDate}
          onChangeText={setStartDate}
          placeholder="2024-01-01"
          placeholderTextColor={colors.muted}
          className="bg-background rounded-xl p-4 text-foreground mb-4"
          style={{ borderWidth: 1, borderColor: colors.border }}
        />
        
        <TouchableOpacity
          onPress={handleSaveDate}
          className="py-3 rounded-xl"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-center font-semibold text-white">Save Start Date</Text>
        </TouchableOpacity>
      </View>

      {/* ExerciseDB API Key Settings */}
      <View 
        className="bg-surface rounded-xl p-4 mb-4"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-semibold text-foreground">ExerciseDB API</Text>
          <View 
            className="px-2 py-1 rounded-full"
            style={{ 
              backgroundColor: apiKeyStatus === 'valid' ? colors.success + '20' : 
                             apiKeyStatus === 'invalid' ? colors.error + '20' : colors.surface 
            }}
          >
            <Text style={{ 
              color: apiKeyStatus === 'valid' ? colors.success : 
                     apiKeyStatus === 'invalid' ? colors.error : colors.muted,
              fontSize: 12,
              fontWeight: '600',
            }}>
              {apiKeyStatus === 'valid' ? 'Connected' : 
               apiKeyStatus === 'invalid' ? 'Invalid' : 'Not configured'}
            </Text>
          </View>
        </View>
        
        <Text className="text-sm text-muted mb-3">
          Enter your RapidAPI key to fetch real exercise demonstration GIFs from ExerciseDB.
        </Text>
        
        <Text className="text-sm font-medium text-muted mb-2">RapidAPI Key</Text>
        <View className="flex-row items-center mb-4">
          <TextInput
            value={rapidApiKey}
            onChangeText={setRapidApiKey}
            placeholder="Enter your RapidAPI key"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showApiKey}
            className="flex-1 bg-background rounded-xl p-4 text-foreground"
            style={{ borderWidth: 1, borderColor: colors.border }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => setShowApiKey(!showApiKey)}
            className="ml-2 p-4"
          >
            <Text style={{ fontSize: 18 }}>{showApiKey ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          onPress={handleSaveApiKey}
          disabled={isValidatingKey}
          className="py-3 rounded-xl mb-3"
          style={{ 
            backgroundColor: colors.primary,
            opacity: isValidatingKey ? 0.7 : 1,
          }}
        >
          {isValidatingKey ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-center font-semibold text-white">
              {rapidApiKey.trim() ? 'Validate & Save Key' : 'Clear Key'}
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => Linking.openURL('https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb')}
          className="py-2"
        >
          <Text className="text-center text-sm" style={{ color: colors.primary }}>
            Get your free API key from RapidAPI →
          </Text>
        </TouchableOpacity>

      {/* OpenAI API Key Settings */}
      <View 
        className="bg-surface rounded-xl p-4 mb-4"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-semibold text-foreground">OpenAI API</Text>
          <View 
            className="px-2 py-1 rounded-full"
            style={{ 
              backgroundColor: store.settings.openAiKey ? colors.success + '20' : colors.surface 
            }}
          >
            <Text style={{ 
              color: store.settings.openAiKey ? colors.success : colors.muted,
              fontSize: 12,
              fontWeight: '600',
            }}>
              {store.settings.openAiKey ? 'Configured' : 'Not configured'}
            </Text>
          </View>
        </View>
        
        <Text className="text-sm text-muted mb-3">
          Enter your OpenAI API key to enable ChatGPT integration for personalized fitness insights.
        </Text>
        
        <Text className="text-sm font-medium text-muted mb-2">OpenAI API Key</Text>
        <View className="flex-row items-center mb-4">
          <TextInput
            value={store.settings.openAiKey || ''}
            onChangeText={(value) => updateSettings({ openAiKey: value })}
            placeholder="sk-..."
            placeholderTextColor={colors.muted}
            secureTextEntry={true}
            className="flex-1 bg-background rounded-xl p-4 text-foreground"
            style={{ borderWidth: 1, borderColor: colors.border }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <TouchableOpacity
          onPress={() => {
            if (store.settings.openAiKey) {
              updateSettings({ openAiKey: '' });
              Alert.alert('Cleared', 'OpenAI API key has been removed');
            }
          }}
          disabled={!store.settings.openAiKey}
          className="py-3 rounded-xl"
          style={{ 
            backgroundColor: colors.error + '20',
            opacity: store.settings.openAiKey ? 1 : 0.5,
          }}
        >
          <Text className="text-center font-semibold" style={{ color: colors.error }}>
            Clear Key
          </Text>
        </TouchableOpacity>
      </View>
      </View>

      <View 
        className="bg-surface rounded-xl p-4"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <Text className="text-lg font-semibold text-foreground mb-4">Statistics</Text>
        
        <View className="flex-row justify-between py-2 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-muted">Total Exercises</Text>
          <Text className="font-semibold text-foreground">{store.exercises.length}</Text>
        </View>
        
        <View className="flex-row justify-between py-2 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-muted">Program Days Configured</Text>
          <Text className="font-semibold text-foreground">
            {store.programDays.filter(d => d.exercises.length > 0).length}
          </Text>
        </View>
        
        <View className="flex-row justify-between py-2">
          <Text className="text-muted">Total Workouts Logged</Text>
          <Text className="font-semibold text-foreground">
            {store.workoutLogs.filter(l => l.isCompleted).length}
          </Text>
        </View>
      </View>

      {/* Exercise Cache Management */}
      <View 
        className="bg-surface rounded-xl p-4"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <Text className="text-lg font-semibold text-foreground mb-2">Exercise Cache</Text>
        <Text className="text-sm text-muted mb-4">
          Cached exercise GIFs and instructions are available offline.
        </Text>
        
        <View className="flex-row justify-between py-2 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-muted">Cached Exercises</Text>
          <Text className="font-semibold text-foreground">
            {cacheMetadata?.itemCount ?? 0}
          </Text>
        </View>
        
        <View className="flex-row justify-between py-2 border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-muted">Cache Size</Text>
          <Text className="font-semibold text-foreground">
            {cacheMetadata ? formatCacheSize(cacheMetadata.totalSize) : '0 B'}
          </Text>
        </View>
        
        <View className="flex-row justify-between py-2 mb-3" style={{ borderBottomColor: colors.border }}>
          <Text className="text-muted">Last Updated</Text>
          <Text className="font-semibold text-foreground">
            {cacheMetadata?.lastUpdated 
              ? new Date(cacheMetadata.lastUpdated).toLocaleDateString()
              : 'Never'}
          </Text>
        </View>
        
        <TouchableOpacity
          onPress={handleClearCache}
          disabled={isClearingCache || (cacheMetadata?.itemCount ?? 0) === 0}
          className="py-3 rounded-xl"
          style={{ 
            backgroundColor: colors.error + '20',
            opacity: isClearingCache || (cacheMetadata?.itemCount ?? 0) === 0 ? 0.5 : 1,
          }}
        >
          {isClearingCache ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <Text className="text-center font-semibold" style={{ color: colors.error }}>
              Clear Cache
            </Text>
          )}
        </TouchableOpacity>
      </View>


      {/* Notification Settings */}
      <View 
        className="bg-surface rounded-xl p-4 mb-4"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <Text className="text-lg font-semibold text-foreground mb-4">Notifications</Text>
        
        <View className="flex-row items-center justify-between py-3 border-b" style={{ borderBottomColor: colors.border }}>
          <View className="flex-1">
            <Text className="text-foreground font-medium">Recovery Alerts</Text>
            <Text className="text-sm text-muted">Get notified when recovery drops below 50%</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleToggleNotification('recoveryAlertsEnabled')}
            className="ml-4 p-2 rounded-lg"
            style={{ backgroundColor: notificationSettings.recoveryAlertsEnabled ? colors.primary + '20' : colors.surface }}
          >
            <Text style={{ fontSize: 20 }}>
              {notificationSettings.recoveryAlertsEnabled ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View className="flex-row items-center justify-between py-3">
          <View className="flex-1">
            <Text className="text-foreground font-medium">Milestone Notifications</Text>
            <Text className="text-sm text-muted">Celebrate when you unlock new badges</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleToggleNotification('milestoneNotificationsEnabled')}
            className="ml-4 p-2 rounded-lg"
            style={{ backgroundColor: notificationSettings.milestoneNotificationsEnabled ? colors.primary + '20' : colors.surface }}
          >
            <Text style={{ fontSize: 20 }}>
              {notificationSettings.milestoneNotificationsEnabled ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Whoop Integration */}
      <TouchableOpacity
        onPress={() => router.push('/whoop' as any)}
        className="bg-surface rounded-xl p-4 mb-8"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View 
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary + '20',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}
            >
              <Text style={{ fontSize: 20 }}>⌚</Text>
            </View>
            <View>
              <Text className="text-lg font-semibold text-foreground">Whoop Integration</Text>
              <Text className="text-sm text-muted">Connect your Whoop device</Text>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={20} color={colors.muted} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}
