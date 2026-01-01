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
import { BodyMeasurement, formatDate } from '@/lib/types';
import * as Haptics from 'expo-haptics';

const MEASUREMENT_FIELDS = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'leftArm', label: 'Left Arm', unit: 'cm' },
  { key: 'rightArm', label: 'Right Arm', unit: 'cm' },
  { key: 'leftThigh', label: 'Left Thigh', unit: 'cm' },
  { key: 'rightThigh', label: 'Right Thigh', unit: 'cm' },
] as const;

type MeasurementKey = typeof MEASUREMENT_FIELDS[number]['key'];

export function BodyMeasurementsView() {
  const colors = useColors();
  const { 
    addBodyMeasurement, 
    deleteBodyMeasurement, 
    getBodyMeasurementHistory 
  } = useGym();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    chest: '',
    waist: '',
    hips: '',
    leftArm: '',
    rightArm: '',
    leftThigh: '',
    rightThigh: '',
    notes: '',
  });

  const measurements = getBodyMeasurementHistory();

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      weight: '',
      chest: '',
      waist: '',
      hips: '',
      leftArm: '',
      rightArm: '',
      leftThigh: '',
      rightThigh: '',
      notes: '',
    });
  };

  const handleSave = async () => {
    // Validate at least one measurement
    const hasValue = MEASUREMENT_FIELDS.some(f => formData[f.key]?.trim());
    if (!hasValue) {
      Alert.alert('Error', 'Please enter at least one measurement');
      return;
    }

    const measurement: Omit<BodyMeasurement, 'id' | 'createdAt'> = {
      date: formData.date,
      notes: formData.notes || undefined,
    };

    MEASUREMENT_FIELDS.forEach(field => {
      const value = parseFloat(formData[field.key]);
      if (!isNaN(value) && value > 0) {
        (measurement as any)[field.key] = value;
      }
    });

    await addBodyMeasurement(measurement);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Measurement',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteBodyMeasurement(id);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        },
      ]
    );
  };

  // Calculate progress between two measurements
  const getProgress = (current: number | undefined, previous: number | undefined) => {
    if (!current || !previous) return null;
    const diff = current - previous;
    return { diff, percentage: ((diff / previous) * 100).toFixed(1) };
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {measurements.length === 0 ? (
          <View className="items-center py-12">
            <IconSymbol name="person.fill" size={48} color={colors.muted} />
            <Text className="text-foreground font-medium mt-4">No Measurements Yet</Text>
            <Text className="text-muted text-center mt-1">
              Track your body weight and measurements over time
            </Text>
          </View>
        ) : (
          measurements.map((m, index) => {
            const previousMeasurement = measurements[index + 1];
            const isExpanded = expandedId === m.id;
            
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => setExpandedId(isExpanded ? null : m.id)}
                className="bg-surface rounded-xl mb-3 overflow-hidden"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                {/* Header */}
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-lg font-semibold text-foreground">
                        {formatDate(m.date)}
                      </Text>
                      {m.weight && (
                        <View className="flex-row items-center mt-1">
                          <Text className="text-2xl font-bold text-foreground">
                            {m.weight} kg
                          </Text>
                          {previousMeasurement?.weight && (
                            <View 
                              className="ml-2 px-2 py-1 rounded-full"
                              style={{ 
                                backgroundColor: m.weight < previousMeasurement.weight 
                                  ? colors.success + '20' 
                                  : m.weight > previousMeasurement.weight 
                                    ? colors.error + '20' 
                                    : colors.muted + '20'
                              }}
                            >
                              <Text 
                                className="text-xs font-medium"
                                style={{ 
                                  color: m.weight < previousMeasurement.weight 
                                    ? colors.success 
                                    : m.weight > previousMeasurement.weight 
                                      ? colors.error 
                                      : colors.muted
                                }}
                              >
                                {m.weight < previousMeasurement.weight ? '↓' : m.weight > previousMeasurement.weight ? '↑' : '='} 
                                {Math.abs(m.weight - previousMeasurement.weight).toFixed(1)} kg
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(m.id)}
                      className="p-2"
                    >
                      <IconSymbol name="trash.fill" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Expanded Details */}
                {isExpanded && (
                  <View className="px-4 pb-4 border-t" style={{ borderTopColor: colors.border }}>
                    <View className="pt-3">
                      {MEASUREMENT_FIELDS.filter(f => f.key !== 'weight' && (m as any)[f.key]).map(field => {
                        const value = (m as any)[field.key];
                        const prevValue = previousMeasurement ? (previousMeasurement as any)[field.key] : null;
                        const progress = getProgress(value, prevValue);
                        
                        return (
                          <View 
                            key={field.key}
                            className="flex-row items-center justify-between py-2 border-b"
                            style={{ borderBottomColor: colors.border }}
                          >
                            <Text className="text-muted">{field.label}</Text>
                            <View className="flex-row items-center">
                              <Text className="font-semibold text-foreground">
                                {value} {field.unit}
                              </Text>
                              {progress && (
                                <Text 
                                  className="ml-2 text-xs"
                                  style={{ 
                                    color: progress.diff < 0 ? colors.success : progress.diff > 0 ? colors.warning : colors.muted 
                                  }}
                                >
                                  ({progress.diff > 0 ? '+' : ''}{progress.diff.toFixed(1)})
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                      {m.notes && (
                        <View className="pt-3">
                          <Text className="text-sm text-muted">Notes</Text>
                          <Text className="text-foreground mt-1">{m.notes}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
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

      {/* Add Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View 
            className="bg-background rounded-t-3xl"
            style={{ maxHeight: '90%' }}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-4 border-b" style={{ borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.muted }}>Cancel</Text>
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-foreground">Add Measurement</Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4">
              {/* Date */}
              <Text className="text-sm font-medium text-muted mb-2">Date (YYYY-MM-DD)</Text>
              <TextInput
                value={formData.date}
                onChangeText={(text) => setFormData(prev => ({ ...prev, date: text }))}
                placeholder="2024-01-01"
                placeholderTextColor={colors.muted}
                className="bg-surface rounded-xl p-4 text-foreground mb-4"
                style={{ borderWidth: 1, borderColor: colors.border }}
              />

              {/* Measurement Fields */}
              {MEASUREMENT_FIELDS.map(field => (
                <View key={field.key} className="mb-4">
                  <Text className="text-sm font-medium text-muted mb-2">
                    {field.label} ({field.unit})
                  </Text>
                  <TextInput
                    value={formData[field.key]}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, [field.key]: text }))}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    className="bg-surface rounded-xl p-4 text-foreground"
                    style={{ borderWidth: 1, borderColor: colors.border }}
                  />
                </View>
              ))}

              {/* Notes */}
              <Text className="text-sm font-medium text-muted mb-2">Notes (optional)</Text>
              <TextInput
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                placeholder="Any notes about this measurement"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                className="bg-surface rounded-xl p-4 text-foreground mb-8"
                style={{ borderWidth: 1, borderColor: colors.border, minHeight: 80 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
