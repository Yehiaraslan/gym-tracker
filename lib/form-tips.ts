// ============================================================
// FORM TIPS — Lightweight in-workout coaching tips
// (Form Coach tracking screen has been removed; these tips
//  remain available as contextual hints inside workout.tsx)
// ============================================================

export type TipCategory = 'breathing' | 'posture' | 'tempo' | 'mindmuscle' | 'safety' | 'general';

export interface FormTip {
  id: string;
  tip: string;
  category: TipCategory;
  exerciseKeywords?: string[];
}

const TIPS: FormTip[] = [
  { id: 't1', tip: 'Exhale on the exertion phase, inhale on the return.', category: 'breathing' },
  { id: 't2', tip: 'Keep your core braced throughout every rep.', category: 'posture' },
  { id: 't3', tip: 'Control the eccentric — 2-3 seconds down.', category: 'tempo' },
  { id: 't4', tip: 'Squeeze the target muscle at the top of each rep.', category: 'mindmuscle' },
  { id: 't5', tip: 'Never sacrifice form for weight — drop the load if needed.', category: 'safety' },
  { id: 't6', tip: 'Stay hydrated — sip water between sets.', category: 'general' },
  { id: 't7', tip: 'Keep your chest up and shoulders back during pressing movements.', category: 'posture', exerciseKeywords: ['press', 'bench', 'push'] },
  { id: 't8', tip: 'Drive through your heels on lower-body movements.', category: 'posture', exerciseKeywords: ['squat', 'leg press', 'deadlift'] },
  { id: 't9', tip: 'Retract your scapula before pulling movements.', category: 'posture', exerciseKeywords: ['row', 'pull', 'lat'] },
  { id: 't10', tip: 'Use a full range of motion to maximise muscle stimulus.', category: 'tempo' },
];

export function getRandomTip(exerciseName?: string): FormTip {
  const name = (exerciseName ?? '').toLowerCase();
  const relevant = name
    ? TIPS.filter(t => t.exerciseKeywords?.some(kw => name.includes(kw)))
    : [];
  const pool = relevant.length > 0 ? relevant : TIPS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getCategoryEmoji(category: TipCategory): string {
  const map: Record<TipCategory, string> = {
    breathing: '🌬️',
    posture: '🧍',
    tempo: '⏱️',
    mindmuscle: '🧠',
    safety: '⚠️',
    general: '💡',
  };
  return map[category] ?? '💡';
}

export function getCategoryLabel(category: TipCategory): string {
  const map: Record<TipCategory, string> = {
    breathing: 'Breathing',
    posture: 'Posture',
    tempo: 'Tempo',
    mindmuscle: 'Mind-Muscle',
    safety: 'Safety',
    general: 'General',
  };
  return map[category] ?? 'Tip';
}
