import { useState } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { WarmupCooldownExercise } from '@/lib/types';
import * as Haptics from 'expo-haptics';

type ExerciseType = 'warmup' | 'cooldown';

export function WarmupCooldownAdmin() {
  const colors = useColors();
  const { 
    store,
    addWarmupExercise,
    addCooldownExercise,
    updateWarmupExercise,
    updateCooldownExercise,
    deleteWarmupExercise,
    deleteCooldownExercise,
  } = useGym();
  
  const [activeTab, setActiveTab] = useState<ExerciseType>('warmup');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<WarmupCooldownExercise | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    duration: '30',
    videoUrl: '',
    notes: '',
  });

  const exercises = activeTab === 'warmup' 
    ? store.warmupCooldown.warmupExercises 
    : store.warmupCooldown.cooldownExercises;

  const resetForm = () => {
    setFormData({
      name: '',
      duration: '30',
      videoUrl: '',
      notes: '',
    });
    setEditingExercise(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (exercise: WarmupCooldownExercise) => {
    setEditingExercise(exercise);
    setFormData({
      name: exercise.name,
      duration: exercise.duration.toString(),
      videoUrl: exercise.videoUrl || '',
      notes: exercise.notes || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    const duration = parseInt(formData.duration) || 30;
    const exerciseData = {
      name: formData.name.trim(),
      duration,
      videoUrl: formData.videoUrl.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    };

    if (editingExercise) {
      // Update existing
      if (activeTab === 'warmup') {
        await updateWarmupExercise(editingExercise.id, exerciseData);
      } else {
        await updateCooldownExercise(editingExercise.id, exerciseData);
      }
    } else {
      // Add new
      if (activeTab === 'warmup') {
        await addWarmupExercise(exerciseData);
      } else {
        await addCooldownExercise(exerciseData);
      }
    }

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (exercise: WarmupCooldownExercise) => {
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete "${exercise.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            if (activeTab === 'warmup') {
              await deleteWarmupExercise(exercise.id);
            } else {
              await deleteCooldownExercise(exercise.id);
            }
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        },
      ]
    );
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const totalDuration = exercises.reduce((acc, ex) => acc + ex.duration, 0);

  return (
    <View className="flex-1">
      {/* Tab Selector */}
      <View className="flex-row px-4 mb-4">
        <TouchableOpacity
          onPress={() => setActiveTab('warmup')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            marginRight: 4,
            backgroundColor: activeTab === 'warmup' ? colors.warning : colors.surface,
          }}
        >
          <Text 
            style={{ 
              textAlign: 'center', 
              fontWeight: '600',
              color: activeTab === 'warmup' ? '#FFFFFF' : colors.cardForeground,
            }}
          >
            🔥 Warm-up
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('cooldown')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            marginLeft: 4,
            backgroundColor: activeTab === 'cooldown' ? colors.primary : colors.surface,
          }}
        >
          <Text 
            style={{ 
              textAlign: 'center', 
              fontWeight: '600',
              color: activeTab === 'cooldown' ? '#FFFFFF' : colors.cardForeground,
            }}
          >
            ❄️ Cool-down
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View 
        className="mx-4 mb-4 p-4 rounded-xl"
        style={{ backgroundColor: activeTab === 'warmup' ? colors.warning + '15' : colors.primary + '15' }}
      >
        <Text className="text-cardForeground font-medium">
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} • Total: {formatDuration(totalDuration)}
        </Text>
      </View>

      {/* Exercise List */}
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {exercises.length === 0 ? (
          <View className="items-center py-12">
            <IconSymbol 
              name={activeTab === 'warmup' ? 'flame.fill' : 'snowflake'} 
              size={48} 
              color={colors.cardMuted} 
            />
            <Text className="text-cardForeground font-medium mt-4">
              No {activeTab === 'warmup' ? 'Warm-up' : 'Cool-down'} Exercises
            </Text>
            <Text className="text-cardMuted text-center mt-1">
              Add exercises to {activeTab === 'warmup' ? 'prepare your body before training' : 'recover after your workout'}
            </Text>
          </View>
        ) : (
          exercises
            .sort((a, b) => a.order - b.order)
            .map((exercise, index) => (
              <View
                key={exercise.id}
                className="bg-surface rounded-xl mb-3 overflow-hidden"
                style={{ borderWidth: 1, borderColor: colors.cardBorder }}
              >
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View 
                        className="w-8 h-8 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: activeTab === 'warmup' ? colors.warning + '20' : colors.primary + '20' }}
                      >
                        <Text 
                          className="font-bold"
                          style={{ color: activeTab === 'warmup' ? colors.warning : colors.primary }}
                        >
                          {index + 1}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-cardForeground">{exercise.name}</Text>
                        <Text className="text-sm text-cardMuted">{formatDuration(exercise.duration)}</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center">
                      {exercise.videoUrl && (
                        <IconSymbol name="play.fill" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                      )}
                      <TouchableOpacity
                        onPress={() => openEditModal(exercise)}
                        className="p-2"
                      >
                        <IconSymbol name="pencil" size={18} color={colors.cardMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(exercise)}
                        className="p-2"
                      >
                        <IconSymbol name="trash.fill" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {exercise.notes && (
                    <View 
                      className="mt-3 p-3 rounded-lg"
                      style={{ backgroundColor: colors.background }}
                    >
                      <Text className="text-sm text-cardMuted">{exercise.notes}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

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
          backgroundColor: activeTab === 'warmup' ? colors.warning : colors.primary,
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
          <View className="bg-background rounded-t-3xl">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-4 border-b" style={{ borderBottomColor: colors.cardBorder }}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.cardMuted }}>Cancel</Text>
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-cardForeground">
                {editingExercise ? 'Edit' : 'Add'} {activeTab === 'warmup' ? 'Warm-up' : 'Cool-down'}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4">
              {/* Name */}
              <Text className="text-sm font-medium text-cardMuted mb-2">Exercise Name *</Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="e.g., Jumping Jacks, Stretching"
                placeholderTextColor={colors.cardMuted}
                className="bg-surface rounded-xl p-4 text-cardForeground mb-4"
                style={{ borderWidth: 1, borderColor: colors.cardBorder }}
              />

              {/* Duration */}
              <Text className="text-sm font-medium text-cardMuted mb-2">Duration (seconds)</Text>
              <TextInput
                value={formData.duration}
                onChangeText={(text) => setFormData(prev => ({ ...prev, duration: text }))}
                placeholder="30"
                placeholderTextColor={colors.cardMuted}
                keyboardType="number-pad"
                className="bg-surface rounded-xl p-4 text-cardForeground mb-4"
                style={{ borderWidth: 1, borderColor: colors.cardBorder }}
              />

              {/* Video URL */}
              <Text className="text-sm font-medium text-cardMuted mb-2">Video URL (optional)</Text>
              <TextInput
                value={formData.videoUrl}
                onChangeText={(text) => setFormData(prev => ({ ...prev, videoUrl: text }))}
                placeholder="https://youtube.com/..."
                placeholderTextColor={colors.cardMuted}
                autoCapitalize="none"
                className="bg-surface rounded-xl p-4 text-cardForeground mb-4"
                style={{ borderWidth: 1, borderColor: colors.cardBorder }}
              />

              {/* Notes */}
              <Text className="text-sm font-medium text-cardMuted mb-2">Notes (optional)</Text>
              <TextInput
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                placeholder="Instructions or tips"
                placeholderTextColor={colors.cardMuted}
                multiline
                numberOfLines={3}
                className="bg-surface rounded-xl p-4 text-cardForeground mb-8"
                style={{ borderWidth: 1, borderColor: colors.cardBorder, minHeight: 80 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
