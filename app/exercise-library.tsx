import { useState, useMemo } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { EXERCISE_LIBRARY } from '@/lib/data/exercise-library';
import type { ExerciseLibraryEntry } from '@/lib/types';
import * as Haptics from 'expo-haptics';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Forearms'];

export default function ExerciseLibraryScreen() {
  const router = useRouter();
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredExercises = useMemo(() => {
    return EXERCISE_LIBRARY.filter(ex => {
      const matchesSearch = searchQuery.length === 0 ||
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.primaryMuscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesMuscle = selectedMuscle === 'All' ||
        ex.primaryMuscles.includes(selectedMuscle) ||
        ex.secondaryMuscles.includes(selectedMuscle);
      return matchesSearch && matchesMuscle;
    });
  }, [searchQuery, selectedMuscle]);

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 8 }}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: '700', flex: 1 }}>
          Exercise Library
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{filteredExercises.length} exercises</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search exercises..."
          placeholderTextColor={colors.muted}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            color: colors.foreground,
            fontSize: 16,
          }}
        />
      </View>

      {/* Muscle Group Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6, marginBottom: 12 }}
      >
        {MUSCLE_GROUPS.map(muscle => (
          <TouchableOpacity
            key={muscle}
            onPress={() => {
              setSelectedMuscle(muscle);
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: selectedMuscle === muscle ? colors.primary : colors.surface,
            }}
          >
            <Text style={{
              color: selectedMuscle === muscle ? '#fff' : colors.muted,
              fontSize: 13,
              fontWeight: selectedMuscle === muscle ? '600' : '400',
            }}>
              {muscle}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Exercise List */}
      <FlatList
        data={filteredExercises}
        keyExtractor={item => item.name}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.name;
          return (
            <TouchableOpacity
              onPress={() => {
                setExpandedId(isExpanded ? null : item.name);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
              }}
            >
              {/* Exercise Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600' }}>
                    {item.name}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {item.primaryMuscles.map(m => (
                      <View key={m} style={{
                        backgroundColor: colors.primary + '20',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}>
                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>{m}</Text>
                      </View>
                    ))}
                    {item.secondaryMuscles.map(m => (
                      <View key={m} style={{
                        backgroundColor: colors.border,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>{m}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={{ color: colors.muted, fontSize: 18 }}>
                  {isExpanded ? '▼' : '▶'}
                </Text>
              </View>

              {/* Expanded Details */}
              {isExpanded && (
                <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
                  {/* Equipment */}
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Equipment</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, marginBottom: 12 }}>
                    {item.equipment}
                  </Text>

                  {/* Setup */}
                  {item.setup && item.setup.length > 0 && (
                    <>
                      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Setup</Text>
                      {item.setup.map((step, i) => (
                        <Text key={i} style={{ color: colors.foreground, fontSize: 13, marginBottom: 2, paddingLeft: 8 }}>
                          {i + 1}. {step}
                        </Text>
                      ))}
                      <View style={{ height: 12 }} />
                    </>
                  )}

                  {/* Execution */}
                  {item.execution && item.execution.length > 0 && (
                    <>
                      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Execution</Text>
                      {item.execution.map((step, i) => (
                        <Text key={i} style={{ color: colors.foreground, fontSize: 13, marginBottom: 2, paddingLeft: 8 }}>
                          {i + 1}. {step}
                        </Text>
                      ))}
                      <View style={{ height: 12 }} />
                    </>
                  )}

                  {/* Common Mistakes */}
                  {item.commonMistakes && item.commonMistakes.length > 0 && (
                    <>
                      <Text style={{ color: colors.error, fontSize: 12, marginBottom: 4 }}>Common Mistakes</Text>
                      {item.commonMistakes.map((m: { mistake: string; fix: string }, i: number) => (
                        <Text key={i} style={{ color: colors.foreground, fontSize: 13, marginBottom: 2, paddingLeft: 8 }}>
                          ⚠ {m.mistake} — {m.fix}
                        </Text>
                      ))}
                      <View style={{ height: 12 }} />
                    </>
                  )}

                  {/* Pro Tip */}
                  {item.proTip && (
                    <>
                      <Text style={{ color: colors.success, fontSize: 12, marginBottom: 4 }}>Pro Tip</Text>
                      <Text style={{ color: colors.foreground, fontSize: 13, marginBottom: 12, paddingLeft: 8 }}>
                        ✓ {item.proTip}
                      </Text>
                    </>
                  )}

                  {/* YouTube Link */}
                  {item.videoId && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${item.videoId}`)}
                      style={{
                        backgroundColor: '#FF0000',
                        borderRadius: 10,
                        padding: 12,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                        ▶ Watch Tutorial on YouTube
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>
            No exercises found
          </Text>
        }
      />
    </ScreenContainer>
  );
}
