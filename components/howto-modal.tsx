/**
 * Exercise how-to modal: animated demo (start/end photos flipped on a timer,
 * which reads as motion) + numbered form instructions from free-exercise-db.
 */
import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getExerciseHowto, HowtoData } from '@/lib/exercise-howto';

type Props = {
  exerciseName: string | null; // null = hidden
  onClose: () => void;
};

export function HowtoModal({ exerciseName, onClose }: Props) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HowtoData | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!exerciseName) return;
    setLoading(true);
    setData(null);
    setFrame(0);
    getExerciseHowto(exerciseName)
      .then(setData)
      .catch(() => setData({ found: false }))
      .finally(() => setLoading(false));
  }, [exerciseName]);

  // Flip between the start/end demo photos to suggest the movement
  useEffect(() => {
    if (!data?.found || !data.images || data.images.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 900);
    return () => clearInterval(t);
  }, [data]);

  const visible = exerciseName !== null;
  const showMismatch =
    data?.found && data.matchedName &&
    data.matchedName.trim().toLowerCase() !== (exerciseName ?? '').trim().toLowerCase();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: colors.surface }]}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.foreground }]} numberOfLines={2}>
                {exerciseName}
              </Text>
              {showMismatch ? (
                <Text style={[s.subtitle, { color: colors.muted }]}>
                  Demo: {data?.matchedName}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <Text style={[s.closeText, { color: colors.foreground }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[s.loadingText, { color: colors.muted }]}>Finding demo…</Text>
            </View>
          ) : data?.found ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {data.images && data.images.length > 0 ? (
                <View style={s.imageWrap}>
                  <Image
                    source={{ uri: data.images[Math.min(frame, data.images.length - 1)] }}
                    style={s.image}
                    resizeMode="contain"
                  />
                </View>
              ) : null}
              <View style={s.chips}>
                {(data.primaryMuscles ?? []).slice(0, 3).map((m) => (
                  <View key={m} style={[s.chip, { backgroundColor: colors.background }]}>
                    <Text style={[s.chipText, { color: colors.primary }]}>{m}</Text>
                  </View>
                ))}
                {data.equipment ? (
                  <View style={[s.chip, { backgroundColor: colors.background }]}>
                    <Text style={[s.chipText, { color: colors.muted }]}>{data.equipment}</Text>
                  </View>
                ) : null}
              </View>
              {(data.instructions ?? []).map((step, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={[s.stepNum, { backgroundColor: colors.primary }]}>
                    <Text style={s.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[s.stepText, { color: colors.foreground }]}>{step}</Text>
                </View>
              ))}
              <View style={{ height: 24 }} />
            </ScrollView>
          ) : (
            <View style={s.center}>
              <Text style={{ fontSize: 40 }}>🤷</Text>
              <Text style={[s.loadingText, { color: colors.muted, textAlign: 'center' }]}>
                No demo found for this exercise yet.{'\n'}Ask Zaki in the Coach tab for form cues.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 6 },
  closeText: { fontSize: 18, fontWeight: '700' },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, lineHeight: 20 },
  imageWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  image: { width: '100%', height: 240 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: '#000', fontSize: 12, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
