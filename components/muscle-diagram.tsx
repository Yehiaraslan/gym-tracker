// ============================================================
// MUSCLE DIAGRAM — SVG body silhouette with highlighted muscles
// Front and back view, color-coded by muscle group
// ============================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Circle, G } from 'react-native-svg';

// Muscle group → color mapping
const MUSCLE_COLORS: Record<string, string> = {
  chest: '#FF6B6B',
  back: '#4FC3F7',
  shoulders: '#A78BFA',
  biceps: '#4ADE80',
  triceps: '#FB923C',
  legs: '#FBBF24',
  core: '#F472B6',
  'full-body': '#34D399',
  glutes: '#FBBF24',
  hamstrings: '#FBBF24',
  quads: '#FBBF24',
  calves: '#FBBF24',
  lats: '#4FC3F7',
  traps: '#4FC3F7',
  rhomboids: '#4FC3F7',
  forearms: '#4ADE80',
  deltoids: '#A78BFA',
};

// Map exercise muscle group to which body regions to highlight
// Returns { front: string[], back: string[] } — region IDs
const MUSCLE_REGIONS: Record<string, { front: string[]; back: string[] }> = {
  chest:       { front: ['chest-l', 'chest-r'], back: [] },
  back:        { front: [], back: ['lats-l', 'lats-r', 'traps', 'rhomboids'] },
  shoulders:   { front: ['delt-front-l', 'delt-front-r'], back: ['delt-back-l', 'delt-back-r', 'traps'] },
  biceps:      { front: ['bicep-l', 'bicep-r'], back: [] },
  triceps:     { front: [], back: ['tricep-l', 'tricep-r'] },
  legs:        { front: ['quad-l', 'quad-r'], back: ['hamstring-l', 'hamstring-r', 'glute-l', 'glute-r', 'calf-l', 'calf-r'] },
  core:        { front: ['abs'], back: [] },
  'full-body': { front: ['chest-l', 'chest-r', 'quad-l', 'quad-r', 'abs'], back: ['lats-l', 'lats-r', 'glute-l', 'glute-r'] },
};

// Simplified front-view body SVG paths (viewBox 0 0 80 160)
function FrontBodyPaths({ highlighted, color }: { highlighted: string[]; color: string }) {
  const h = (id: string) => highlighted.includes(id) ? color : '#333';
  const ha = (id: string) => highlighted.includes(id) ? 0.9 : 0.3;

  return (
    <Svg width={80} height={160} viewBox="0 0 80 160">
      {/* Head */}
      <Ellipse cx={40} cy={12} rx={10} ry={11} fill="#555" opacity={0.5} />
      {/* Neck */}
      <Path d="M35 22 Q40 26 45 22 L45 28 Q40 30 35 28 Z" fill="#555" opacity={0.4} />
      {/* Shoulders */}
      <Ellipse id="delt-front-l" cx={20} cy={36} rx={8} ry={6} fill={h('delt-front-l')} opacity={ha('delt-front-l')} />
      <Ellipse id="delt-front-r" cx={60} cy={36} rx={8} ry={6} fill={h('delt-front-r')} opacity={ha('delt-front-r')} />
      {/* Chest */}
      <Path id="chest-l" d="M28 30 Q35 28 38 35 Q35 44 28 44 Q22 40 22 34 Z" fill={h('chest-l')} opacity={ha('chest-l')} />
      <Path id="chest-r" d="M52 30 Q45 28 42 35 Q45 44 52 44 Q58 40 58 34 Z" fill={h('chest-r')} opacity={ha('chest-r')} />
      {/* Upper arms (biceps) */}
      <Path id="bicep-l" d="M16 36 Q12 38 11 48 Q14 52 18 50 Q20 42 20 36 Z" fill={h('bicep-l')} opacity={ha('bicep-l')} />
      <Path id="bicep-r" d="M64 36 Q68 38 69 48 Q66 52 62 50 Q60 42 60 36 Z" fill={h('bicep-r')} opacity={ha('bicep-r')} />
      {/* Forearms */}
      <Path d="M11 50 Q9 58 10 66 Q13 68 16 66 Q17 58 18 50 Z" fill="#444" opacity={0.3} />
      <Path d="M69 50 Q71 58 70 66 Q67 68 64 66 Q63 58 62 50 Z" fill="#444" opacity={0.3} />
      {/* Abs / core */}
      <Path id="abs" d="M33 44 Q40 42 47 44 L47 72 Q40 74 33 72 Z" fill={h('abs')} opacity={ha('abs')} />
      {/* Hip / obliques */}
      <Path d="M28 66 Q33 72 33 80 Q28 82 24 78 Q22 72 26 66 Z" fill="#444" opacity={0.25} />
      <Path d="M52 66 Q47 72 47 80 Q52 82 56 78 Q58 72 54 66 Z" fill="#444" opacity={0.25} />
      {/* Quads */}
      <Path id="quad-l" d="M28 80 Q33 80 35 90 Q34 106 30 110 Q24 108 23 96 Q22 86 26 80 Z" fill={h('quad-l')} opacity={ha('quad-l')} />
      <Path id="quad-r" d="M52 80 Q47 80 45 90 Q46 106 50 110 Q56 108 57 96 Q58 86 54 80 Z" fill={h('quad-r')} opacity={ha('quad-r')} />
      {/* Knees */}
      <Ellipse cx={30} cy={112} rx={7} ry={5} fill="#444" opacity={0.3} />
      <Ellipse cx={50} cy={112} rx={7} ry={5} fill="#444" opacity={0.3} />
      {/* Shins */}
      <Path d="M24 116 Q28 118 30 130 Q28 138 26 140 Q22 138 22 128 Z" fill="#444" opacity={0.25} />
      <Path d="M56 116 Q52 118 50 130 Q52 138 54 140 Q58 138 58 128 Z" fill="#444" opacity={0.25} />
      {/* Feet */}
      <Ellipse cx={27} cy={144} rx={8} ry={4} fill="#444" opacity={0.3} />
      <Ellipse cx={53} cy={144} rx={8} ry={4} fill="#444" opacity={0.3} />
    </Svg>
  );
}

// Simplified back-view body SVG paths (viewBox 0 0 80 160)
function BackBodyPaths({ highlighted, color }: { highlighted: string[]; color: string }) {
  const h = (id: string) => highlighted.includes(id) ? color : '#333';
  const ha = (id: string) => highlighted.includes(id) ? 0.9 : 0.3;

  return (
    <Svg width={80} height={160} viewBox="0 0 80 160">
      {/* Head */}
      <Ellipse cx={40} cy={12} rx={10} ry={11} fill="#555" opacity={0.5} />
      {/* Neck */}
      <Path d="M35 22 Q40 26 45 22 L45 28 Q40 30 35 28 Z" fill="#555" opacity={0.4} />
      {/* Traps */}
      <Path id="traps" d="M28 26 Q40 22 52 26 Q54 34 48 36 Q40 38 32 36 Q26 34 28 26 Z" fill={h('traps')} opacity={ha('traps')} />
      {/* Rear delts */}
      <Ellipse id="delt-back-l" cx={20} cy={36} rx={8} ry={6} fill={h('delt-back-l')} opacity={ha('delt-back-l')} />
      <Ellipse id="delt-back-r" cx={60} cy={36} rx={8} ry={6} fill={h('delt-back-r')} opacity={ha('delt-back-r')} />
      {/* Triceps */}
      <Path id="tricep-l" d="M16 36 Q12 38 11 48 Q14 52 18 50 Q20 42 20 36 Z" fill={h('tricep-l')} opacity={ha('tricep-l')} />
      <Path id="tricep-r" d="M64 36 Q68 38 69 48 Q66 52 62 50 Q60 42 60 36 Z" fill={h('tricep-r')} opacity={ha('tricep-r')} />
      {/* Forearms */}
      <Path d="M11 50 Q9 58 10 66 Q13 68 16 66 Q17 58 18 50 Z" fill="#444" opacity={0.3} />
      <Path d="M69 50 Q71 58 70 66 Q67 68 64 66 Q63 58 62 50 Z" fill="#444" opacity={0.3} />
      {/* Lats */}
      <Path id="lats-l" d="M26 36 Q22 44 22 56 Q24 64 30 66 Q34 60 34 50 Q34 40 30 36 Z" fill={h('lats-l')} opacity={ha('lats-l')} />
      <Path id="lats-r" d="M54 36 Q58 44 58 56 Q56 64 50 66 Q46 60 46 50 Q46 40 50 36 Z" fill={h('lats-r')} opacity={ha('lats-r')} />
      {/* Rhomboids / mid back */}
      <Path id="rhomboids" d="M32 36 Q40 34 48 36 L48 56 Q40 58 32 56 Z" fill={h('rhomboids')} opacity={ha('rhomboids')} />
      {/* Lower back */}
      <Path d="M32 58 Q40 56 48 58 L48 72 Q40 74 32 72 Z" fill="#444" opacity={0.25} />
      {/* Glutes */}
      <Path id="glute-l" d="M26 72 Q32 70 34 80 Q34 92 28 94 Q22 90 22 80 Q22 74 26 72 Z" fill={h('glute-l')} opacity={ha('glute-l')} />
      <Path id="glute-r" d="M54 72 Q48 70 46 80 Q46 92 52 94 Q58 90 58 80 Q58 74 54 72 Z" fill={h('glute-r')} opacity={ha('glute-r')} />
      {/* Hamstrings */}
      <Path id="hamstring-l" d="M24 94 Q28 94 30 104 Q30 114 26 116 Q22 114 22 104 Z" fill={h('hamstring-l')} opacity={ha('hamstring-l')} />
      <Path id="hamstring-r" d="M56 94 Q52 94 50 104 Q50 114 54 116 Q58 114 58 104 Z" fill={h('hamstring-r')} opacity={ha('hamstring-r')} />
      {/* Knees */}
      <Ellipse cx={27} cy={118} rx={6} ry={4} fill="#444" opacity={0.3} />
      <Ellipse cx={53} cy={118} rx={6} ry={4} fill="#444" opacity={0.3} />
      {/* Calves */}
      <Path id="calf-l" d="M23 120 Q27 122 28 134 Q26 140 24 140 Q21 138 21 128 Z" fill={h('calf-l')} opacity={ha('calf-l')} />
      <Path id="calf-r" d="M57 120 Q53 122 52 134 Q54 140 56 140 Q59 138 59 128 Z" fill={h('calf-r')} opacity={ha('calf-r')} />
      {/* Feet */}
      <Ellipse cx={27} cy={144} rx={8} ry={4} fill="#444" opacity={0.3} />
      <Ellipse cx={53} cy={144} rx={8} ry={4} fill="#444" opacity={0.3} />
    </Svg>
  );
}

interface MuscleDiagramProps {
  muscleGroup: string;
  size?: 'sm' | 'md' | 'lg';
}

export function MuscleDiagram({ muscleGroup, size = 'md' }: MuscleDiagramProps) {
  const regions = MUSCLE_REGIONS[muscleGroup] ?? { front: [], back: [] };
  const color = MUSCLE_COLORS[muscleGroup] ?? '#FF6B6B';
  const svgW = size === 'sm' ? 56 : size === 'lg' ? 72 : 64;
  const svgH = size === 'sm' ? 112 : size === 'lg' ? 144 : 128;
  const hasFront = regions.front.length > 0;
  const hasBack = regions.back.length > 0;

  return (
    <View style={styles.container}>
      {hasFront && (
        <View style={styles.view}>
          <Svg width={svgW} height={svgH} viewBox="0 0 80 160">
            <FrontBodyPaths highlighted={regions.front} color={color} />
          </Svg>
          <Text style={[styles.label, { color: '#888' }]}>Front</Text>
        </View>
      )}
      {hasBack && (
        <View style={styles.view}>
          <Svg width={svgW} height={svgH} viewBox="0 0 80 160">
            <BackBodyPaths highlighted={regions.back} color={color} />
          </Svg>
          <Text style={[styles.label, { color: '#888' }]}>Back</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  view: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
