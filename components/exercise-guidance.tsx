import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { getCachedExercise, cacheExercise, CachedExercise } from '@/lib/exercise-cache';
import { findExerciseVideo, VideoSearchResult } from '@/lib/exercise-video-service';

interface ExerciseGuidanceProps {
  exerciseName: string;
  exerciseId: string;
  videoUrl?: string;
  notes?: string;
  apiKey?: string;
}

export function ExerciseGuidance({ 
  exerciseName, 
  exerciseId, 
  videoUrl, 
  notes,
  apiKey 
}: ExerciseGuidanceProps) {
  const colors = useColors();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState<CachedExercise | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Load cached exercise data on mount
  useEffect(() => {
    loadExerciseData();
  }, [exerciseId, exerciseName]);

  const loadExerciseData = async () => {
    setIsLoading(true);
    try {
      // First check cache
      const cached = await getCachedExercise(exerciseId);
      if (cached) {
        setCachedData(cached);
        setIsLoading(false);
        return;
      }

      // If not cached and we have an API key, try to fetch
      if (apiKey) {
        const result = await findExerciseVideo(exerciseName, apiKey);
        if (result) {
          const newCachedData: CachedExercise = {
            exerciseId,
            exerciseName,
            gifUrl: result.gifUrl,
            localGifPath: null,
            bodyPart: result.bodyPart || '',
            target: result.target || '',
            equipment: result.equipment || '',
            instructions: result.instructions || [],
            cachedAt: Date.now(),
            lastAccessed: Date.now(),
          };
          await cacheExercise(newCachedData);
          setCachedData(newCachedData);
        }
      }
    } catch (error) {
      console.error('Error loading exercise data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine what to display
  const gifUrl = cachedData?.gifUrl || videoUrl;
  const instructions = cachedData?.instructions || [];
  const hasInstructions = instructions.length > 0;
  const hasNotes = notes && notes.trim().length > 0;
  const hasContent = gifUrl || hasInstructions || hasNotes;

  if (!hasContent && !isLoading) {
    return null;
  }

  return (
    <View 
      className="mb-4 rounded-2xl overflow-hidden"
      style={{ 
        backgroundColor: colors.surface,
        borderWidth: 1, 
        borderColor: colors.border 
      }}
    >
      {/* Header - Always visible */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          backgroundColor: colors.primary + '10',
        }}
      >
        <View className="flex-row items-center">
          <Text style={{ fontSize: 18, marginRight: 8 }}>📖</Text>
          <Text className="font-semibold" style={{ color: colors.foreground }}>
            Form Guide
          </Text>
        </View>
        <View className="flex-row items-center">
          {isLoading && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          )}
          <IconSymbol 
            name={isExpanded ? "chevron.up" : "chevron.down"} 
            size={20} 
            color={colors.muted} 
          />
        </View>
      </TouchableOpacity>

      {/* Expandable Content */}
      {isExpanded && (
        <View className="p-3">
          {/* GIF/Video Display */}
          {gifUrl && (
            <View className="mb-3">
              <Image
                source={{ uri: gifUrl }}
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: 12,
                  backgroundColor: colors.border,
                }}
                contentFit="contain"
                transition={300}
              />
              <Text className="text-xs text-center mt-2" style={{ color: colors.muted }}>
                Watch the movement pattern above
              </Text>
            </View>
          )}

          {/* Quick Tips Section */}
          {(hasInstructions || hasNotes) && (
            <View>
              {/* Toggle between Instructions and Notes */}
              {hasInstructions && hasNotes && (
                <View className="flex-row mb-3">
                  <TouchableOpacity
                    onPress={() => setShowInstructions(false)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      marginRight: 4,
                      backgroundColor: !showInstructions ? colors.primary : colors.border,
                    }}
                  >
                    <Text 
                      className="text-center text-sm font-medium"
                      style={{ color: !showInstructions ? '#FFFFFF' : colors.muted }}
                    >
                      Your Notes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowInstructions(true)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      marginLeft: 4,
                      backgroundColor: showInstructions ? colors.primary : colors.border,
                    }}
                  >
                    <Text 
                      className="text-center text-sm font-medium"
                      style={{ color: showInstructions ? '#FFFFFF' : colors.muted }}
                    >
                      Instructions
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Notes Display */}
              {hasNotes && !showInstructions && (
                <View 
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: colors.warning + '15' }}
                >
                  <View className="flex-row items-start">
                    <Text style={{ fontSize: 14, marginRight: 8 }}>📝</Text>
                    <View className="flex-1">
                      <Text className="text-sm font-medium mb-1" style={{ color: colors.warning }}>
                        Coach Notes
                      </Text>
                      <Text className="text-sm" style={{ color: colors.foreground }}>
                        {notes}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Instructions Display */}
              {hasInstructions && (showInstructions || !hasNotes) && (
                <View 
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: colors.primary + '10' }}
                >
                  <View className="flex-row items-center mb-2">
                    <Text style={{ fontSize: 14, marginRight: 8 }}>📋</Text>
                    <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                      Step-by-Step Instructions
                    </Text>
                  </View>
                  <ScrollView 
                    style={{ maxHeight: 150 }} 
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    {instructions.map((instruction, index) => (
                      <View key={index} className="flex-row mb-2">
                        <View 
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: colors.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 8,
                            marginTop: 2,
                          }}
                        >
                          <Text className="text-xs font-bold" style={{ color: '#FFFFFF' }}>
                            {index + 1}
                          </Text>
                        </View>
                        <Text 
                          className="flex-1 text-sm" 
                          style={{ color: colors.foreground, lineHeight: 20 }}
                        >
                          {instruction}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Key Form Cues */}
              {cachedData?.target && (
                <View className="flex-row flex-wrap mt-3">
                  {cachedData.target && (
                    <View 
                      className="px-3 py-1 rounded-full mr-2 mb-2"
                      style={{ backgroundColor: colors.success + '20' }}
                    >
                      <Text className="text-xs" style={{ color: colors.success }}>
                        Target: {cachedData.target}
                      </Text>
                    </View>
                  )}
                  {cachedData.equipment && (
                    <View 
                      className="px-3 py-1 rounded-full mr-2 mb-2"
                      style={{ backgroundColor: colors.primary + '20' }}
                    >
                      <Text className="text-xs" style={{ color: colors.primary }}>
                        {cachedData.equipment}
                      </Text>
                    </View>
                  )}
                  {cachedData.bodyPart && (
                    <View 
                      className="px-3 py-1 rounded-full mb-2"
                      style={{ backgroundColor: colors.warning + '20' }}
                    >
                      <Text className="text-xs" style={{ color: colors.warning }}>
                        {cachedData.bodyPart}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
