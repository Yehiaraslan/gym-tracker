// ============================================================
// EXERCISE LIBRARY — Phy-style with colored icon circles,
// muscle group filter chips, and exercise detail cards
// ============================================================
import { useState, useMemo } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { EXERCISE_LIBRARY } from '@/lib/data/exercise-library';
import * as Haptics from 'expo-haptics';
import { MuscleDiagram } from '@/components/muscle-diagram';

// ── Muscle group config ──────────────────────────────────────
const MUSCLE_CONFIG: Record<string, { color: string; icon: string }> = {
  chest:       { color: '#FF6B6B', icon: '🏋️' },
  back:        { color: '#4FC3F7', icon: '🔙' },
  shoulders:   { color: '#A78BFA', icon: '💪' },
  biceps:      { color: '#4ADE80', icon: '💪' },
  triceps:     { color: '#FB923C', icon: '💪' },
  legs:        { color: '#FBBF24', icon: '🦵' },
  core:        { color: '#F472B6', icon: '⚡' },
  'full-body': { color: '#34D399', icon: '🔥' },
};

const FILTER_GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core'];

function getMuscleColor(muscleGroup: string): string {
  return MUSCLE_CONFIG[muscleGroup]?.color ?? '#888';
}
function getMuscleIcon(muscleGroup: string): string {
  return MUSCLE_CONFIG[muscleGroup]?.icon ?? '💪';
}

function MuscleIconCircle({ muscleGroup, size = 44 }: { muscleGroup: string; size?: number }) {
  const color = getMuscleColor(muscleGroup);
  const icon = getMuscleIcon(muscleGroup);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: color + '55',
    }}>
      <Text style={{ fontSize: size * 0.42 }}>{icon}</Text>
    </View>
  );
}

export default function ExerciseLibraryScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredExercises = useMemo(() => {
    return EXERCISE_LIBRARY.filter(ex => {
      const matchesSearch = searchQuery.length === 0 ||
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.primaryMuscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = selectedFilter === 'All' ||
        (ex.muscleGroup ?? '').toLowerCase() === selectedFilter.toLowerCase() ||
        ex.primaryMuscles.some(m => m.toLowerCase().includes(selectedFilter.toLowerCase()));
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, selectedFilter]);

  const { surface: surf, foreground: fg, muted: mut, primary: pri, border: bord, error, success } = colors;

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: fg }]}>Exercise Library</Text>
        <Text style={[s.count, { color: mut }]}>{filteredExercises.length} exercises</Text>
      </View>

      {/* Search bar */}
      <View style={[s.searchBar, { backgroundColor: surf }]}>
        <Text style={{ color: mut, marginRight: 8, fontSize: 16 }}>🔍</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search exercises..."
          placeholderTextColor={mut}
          style={[s.searchInput, { color: fg }]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ color: mut, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Muscle group filter chips */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {FILTER_GROUPS.map(group => {
          const isActive = selectedFilter === group;
          const chipColor = MUSCLE_CONFIG[group.toLowerCase()]?.color ?? pri;
          return (
            <TouchableOpacity
              key={group}
              style={[s.chip, {
                backgroundColor: isActive ? chipColor : surf,
                borderColor: isActive ? chipColor : bord,
              }]}
              onPress={() => {
                setSelectedFilter(group);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={[s.chipText, { color: isActive ? '#fff' : mut }]}>{group}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Exercise list */}
      <FlatList
        data={filteredExercises}
        keyExtractor={item => item.name}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.name;
          const muscleGroup = item.muscleGroup ?? 'chest';
          const color = getMuscleColor(muscleGroup);
          return (
            <TouchableOpacity
              style={[s.card, {
                backgroundColor: surf,
                borderColor: isExpanded ? color + '55' : bord,
                borderWidth: isExpanded ? 1 : 0.5,
              }]}
              onPress={() => {
                setExpandedId(isExpanded ? null : item.name);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.85}
            >
              {/* Card header */}
              <View style={s.cardHeader}>
                <MuscleIconCircle muscleGroup={muscleGroup} />
                <View style={s.cardInfo}>
                  <Text style={[s.cardName, { color: fg }]}>{item.name}</Text>
                  <Text style={[s.cardMuscles, { color: mut }]}>
                    {item.primaryMuscles[0]}
                    {item.primaryMuscles.length > 1 ? `, ${item.primaryMuscles[1]}` : ''}
                  </Text>
                  <View style={s.cardTags}>
                    <View style={[s.tag, { backgroundColor: color + '22' }]}>
                      <Text style={[s.tagText, { color }]}>{muscleGroup}</Text>
                    </View>
                    <View style={[s.tag, {
                      backgroundColor: item.category === 'compound' ? '#4FC3F7' + '22' : '#A78BFA' + '22',
                    }]}>
                      <Text style={[s.tagText, {
                        color: item.category === 'compound' ? '#4FC3F7' : '#A78BFA',
                      }]}>{item.category}</Text>
                    </View>
                  </View>
                </View>
                <Text style={[s.chevron, { color: mut }]}>{isExpanded ? '▼' : '›'}</Text>
              </View>

              {/* Expanded details */}
              {isExpanded && (
                <View style={[s.expanded, { borderTopColor: bord }]}>
                  {/* Muscle anatomy diagram */}
                  <View style={[s.section, { alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: bord, marginBottom: 14 }]}>
                    <Text style={[s.sectionTitle, { color: mut, marginBottom: 8 }]}>MUSCLES TARGETED</Text>
                    <MuscleDiagram muscleGroup={muscleGroup} size="md" />
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: mut }]}>Equipment</Text>
                    <Text style={[s.detailValue, { color: fg }]}>{item.equipment}</Text>
                  </View>
                  {item.setup && item.setup.length > 0 && (
                    <View style={s.section}>
                      <Text style={[s.sectionTitle, { color: mut }]}>SETUP</Text>
                      {item.setup.map((step, i) => (
                        <Text key={i} style={[s.stepText, { color: fg }]}>{i + 1}. {step}</Text>
                      ))}
                    </View>
                  )}
                  {item.execution && item.execution.length > 0 && (
                    <View style={s.section}>
                      <Text style={[s.sectionTitle, { color: mut }]}>EXECUTION</Text>
                      {item.execution.map((step, i) => (
                        <Text key={i} style={[s.stepText, { color: fg }]}>{i + 1}. {step}</Text>
                      ))}
                    </View>
                  )}
                  {item.commonMistakes && item.commonMistakes.length > 0 && (
                    <View style={s.section}>
                      <Text style={[s.sectionTitle, { color: error }]}>COMMON MISTAKES</Text>
                      {item.commonMistakes.map((m: { mistake: string; fix: string }, i: number) => (
                        <Text key={i} style={[s.stepText, { color: fg }]}>⚠ {m.mistake} — {m.fix}</Text>
                      ))}
                    </View>
                  )}
                  {item.proTip && (
                    <View style={[s.proTip, { backgroundColor: success + '11', borderColor: success + '33' }]}>
                      <Text style={[s.proTipText, { color: success }]}>✓ {item.proTip}</Text>
                    </View>
                  )}
                  {item.videoId && (
                    <TouchableOpacity
                      style={s.youtubeBtn}
                      onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${item.videoId}`)}
                    >
                      <Text style={s.youtubeBtnText}>▶  Watch Tutorial on YouTube</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={[s.empty, { color: mut }]}>No exercises found</Text>
        }
      />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  count: { fontSize: 13 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 16 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, minHeight: 38, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  card: { borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardMuscles: { fontSize: 13, marginBottom: 6 },
  cardTags: { flexDirection: 'row', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontWeight: '600' },
  chevron: { fontSize: 20 },
  expanded: { borderTopWidth: 0.5, padding: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  detailLabel: { fontSize: 12, fontWeight: '600' },
  detailValue: { fontSize: 13 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  stepText: { fontSize: 13, lineHeight: 20, marginBottom: 3 },
  proTip: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  proTipText: { fontSize: 13, lineHeight: 18 },
  youtubeBtn: { backgroundColor: '#FF0000', borderRadius: 10, padding: 12, alignItems: 'center' },
  youtubeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
