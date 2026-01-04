/**
 * Form Tips Service
 * 
 * Provides exercise-specific form tips to display during rest periods
 * to help users reinforce proper technique.
 */

export interface FormTip {
  id: string;
  tip: string;
  category: 'breathing' | 'posture' | 'movement' | 'safety' | 'performance';
}

// Generic tips that apply to most exercises
const GENERIC_TIPS: FormTip[] = [
  { id: 'g1', tip: 'Control the negative (lowering) phase - don\'t let gravity do the work', category: 'movement' },
  { id: 'g2', tip: 'Breathe out during exertion, breathe in during the easier phase', category: 'breathing' },
  { id: 'g3', tip: 'Keep your core engaged throughout the movement', category: 'posture' },
  { id: 'g4', tip: 'Focus on the muscle you\'re working - mind-muscle connection matters', category: 'performance' },
  { id: 'g5', tip: 'Don\'t rush - quality reps beat fast reps', category: 'movement' },
  { id: 'g6', tip: 'If form breaks down, reduce the weight', category: 'safety' },
  { id: 'g7', tip: 'Full range of motion builds more muscle than partial reps', category: 'movement' },
  { id: 'g8', tip: 'Stay hydrated between sets', category: 'performance' },
  { id: 'g9', tip: 'Maintain neutral spine position when possible', category: 'posture' },
  { id: 'g10', tip: 'Squeeze at the top of the movement for maximum contraction', category: 'movement' },
];

// Exercise-specific tips mapped by exercise name keywords
const EXERCISE_TIPS: Record<string, FormTip[]> = {
  // Chest exercises
  'bench press': [
    { id: 'bp1', tip: 'Keep your shoulder blades pinched together throughout', category: 'posture' },
    { id: 'bp2', tip: 'Lower the bar to your mid-chest, not your neck', category: 'movement' },
    { id: 'bp3', tip: 'Drive your feet into the floor for stability', category: 'posture' },
    { id: 'bp4', tip: 'Keep your wrists straight - don\'t let them bend back', category: 'safety' },
    { id: 'bp5', tip: 'Maintain a slight arch in your lower back', category: 'posture' },
  ],
  'push up': [
    { id: 'pu1', tip: 'Keep your body in a straight line from head to heels', category: 'posture' },
    { id: 'pu2', tip: 'Hands slightly wider than shoulder-width apart', category: 'posture' },
    { id: 'pu3', tip: 'Lower until your chest nearly touches the ground', category: 'movement' },
    { id: 'pu4', tip: 'Don\'t let your hips sag or pike up', category: 'posture' },
    { id: 'pu5', tip: 'Tuck your elbows at about 45 degrees, not flared out', category: 'safety' },
  ],
  'dumbbell fly': [
    { id: 'df1', tip: 'Keep a slight bend in your elbows throughout', category: 'safety' },
    { id: 'df2', tip: 'Lower until you feel a stretch in your chest', category: 'movement' },
    { id: 'df3', tip: 'Squeeze your chest at the top like hugging a tree', category: 'movement' },
  ],
  
  // Back exercises
  'pull up': [
    { id: 'pup1', tip: 'Initiate the movement by pulling your shoulder blades down', category: 'movement' },
    { id: 'pup2', tip: 'Pull your chest toward the bar, not just your chin', category: 'movement' },
    { id: 'pup3', tip: 'Control the descent - no dropping', category: 'movement' },
    { id: 'pup4', tip: 'Avoid swinging or kipping unless intentional', category: 'safety' },
    { id: 'pup5', tip: 'Engage your lats before you start pulling', category: 'movement' },
  ],
  'row': [
    { id: 'r1', tip: 'Pull your elbow back, not just your hand', category: 'movement' },
    { id: 'r2', tip: 'Squeeze your shoulder blade at the top', category: 'movement' },
    { id: 'r3', tip: 'Keep your back flat, don\'t round it', category: 'posture' },
    { id: 'r4', tip: 'Don\'t use momentum - control the weight', category: 'movement' },
  ],
  'lat pulldown': [
    { id: 'lp1', tip: 'Pull the bar to your upper chest, not behind your neck', category: 'safety' },
    { id: 'lp2', tip: 'Lean back slightly and stick your chest out', category: 'posture' },
    { id: 'lp3', tip: 'Focus on pulling with your elbows, not your hands', category: 'movement' },
  ],
  'deadlift': [
    { id: 'dl1', tip: 'Keep the bar close to your body throughout', category: 'movement' },
    { id: 'dl2', tip: 'Push through your heels, not your toes', category: 'movement' },
    { id: 'dl3', tip: 'Brace your core before each rep', category: 'safety' },
    { id: 'dl4', tip: 'Don\'t round your lower back - keep it neutral', category: 'safety' },
    { id: 'dl5', tip: 'Lock out by squeezing your glutes at the top', category: 'movement' },
  ],
  
  // Shoulder exercises
  'shoulder press': [
    { id: 'sp1', tip: 'Don\'t arch your back excessively', category: 'safety' },
    { id: 'sp2', tip: 'Press straight up, not forward', category: 'movement' },
    { id: 'sp3', tip: 'Lower to ear level, not below', category: 'movement' },
  ],
  'lateral raise': [
    { id: 'lr1', tip: 'Lead with your elbows, not your hands', category: 'movement' },
    { id: 'lr2', tip: 'Stop at shoulder height - no higher', category: 'movement' },
    { id: 'lr3', tip: 'Slight bend in elbows, thumbs slightly down', category: 'posture' },
    { id: 'lr4', tip: 'Don\'t swing the weights - use controlled movement', category: 'movement' },
  ],
  
  // Leg exercises
  'squat': [
    { id: 'sq1', tip: 'Keep your knees tracking over your toes', category: 'safety' },
    { id: 'sq2', tip: 'Go at least to parallel - thighs parallel to floor', category: 'movement' },
    { id: 'sq3', tip: 'Keep your chest up and core braced', category: 'posture' },
    { id: 'sq4', tip: 'Push through your whole foot, not just toes', category: 'movement' },
    { id: 'sq5', tip: 'Don\'t let your knees cave inward', category: 'safety' },
  ],
  'lunge': [
    { id: 'lu1', tip: 'Keep your front knee behind your toes', category: 'safety' },
    { id: 'lu2', tip: 'Lower straight down, not forward', category: 'movement' },
    { id: 'lu3', tip: 'Keep your torso upright', category: 'posture' },
    { id: 'lu4', tip: 'Push through your front heel to stand', category: 'movement' },
  ],
  'leg press': [
    { id: 'lgp1', tip: 'Don\'t lock out your knees at the top', category: 'safety' },
    { id: 'lgp2', tip: 'Keep your lower back pressed against the pad', category: 'safety' },
    { id: 'lgp3', tip: 'Lower until your thighs are at 90 degrees', category: 'movement' },
  ],
  'leg curl': [
    { id: 'lc1', tip: 'Don\'t lift your hips off the pad', category: 'posture' },
    { id: 'lc2', tip: 'Squeeze your hamstrings at the top', category: 'movement' },
    { id: 'lc3', tip: 'Control the weight on the way down', category: 'movement' },
  ],
  'leg extension': [
    { id: 'le1', tip: 'Don\'t use momentum - lift with control', category: 'movement' },
    { id: 'le2', tip: 'Squeeze your quads at the top', category: 'movement' },
    { id: 'le3', tip: 'Keep your back against the pad', category: 'posture' },
  ],
  'calf raise': [
    { id: 'cr1', tip: 'Get a full stretch at the bottom', category: 'movement' },
    { id: 'cr2', tip: 'Pause and squeeze at the top', category: 'movement' },
    { id: 'cr3', tip: 'Don\'t bounce - use controlled movement', category: 'movement' },
  ],
  
  // Arm exercises
  'bicep curl': [
    { id: 'bc1', tip: 'Keep your elbows pinned to your sides', category: 'posture' },
    { id: 'bc2', tip: 'Don\'t swing your body - isolate the biceps', category: 'movement' },
    { id: 'bc3', tip: 'Squeeze at the top, control the descent', category: 'movement' },
    { id: 'bc4', tip: 'Full extension at the bottom for complete range', category: 'movement' },
  ],
  'tricep': [
    { id: 'tr1', tip: 'Keep your elbows stationary', category: 'posture' },
    { id: 'tr2', tip: 'Fully extend your arms for complete contraction', category: 'movement' },
    { id: 'tr3', tip: 'Don\'t let your elbows flare out', category: 'posture' },
  ],
  'dip': [
    { id: 'dip1', tip: 'Lean forward slightly for chest, stay upright for triceps', category: 'movement' },
    { id: 'dip2', tip: 'Lower until your upper arms are parallel to floor', category: 'movement' },
    { id: 'dip3', tip: 'Don\'t go too deep if you have shoulder issues', category: 'safety' },
  ],
  
  // Core exercises
  'plank': [
    { id: 'pl1', tip: 'Keep your body in a straight line', category: 'posture' },
    { id: 'pl2', tip: 'Don\'t let your hips sag or pike up', category: 'posture' },
    { id: 'pl3', tip: 'Squeeze your glutes and brace your core', category: 'movement' },
    { id: 'pl4', tip: 'Breathe steadily - don\'t hold your breath', category: 'breathing' },
  ],
  'crunch': [
    { id: 'cru1', tip: 'Don\'t pull on your neck - hands light behind head', category: 'safety' },
    { id: 'cru2', tip: 'Lift your shoulder blades off the ground', category: 'movement' },
    { id: 'cru3', tip: 'Exhale as you crunch up', category: 'breathing' },
  ],
  'ab': [
    { id: 'ab1', tip: 'Focus on contracting your abs, not hip flexors', category: 'movement' },
    { id: 'ab2', tip: 'Keep your lower back pressed to the floor', category: 'posture' },
    { id: 'ab3', tip: 'Breathe out during the contraction', category: 'breathing' },
  ],
};

/**
 * Get form tips for a specific exercise
 */
export function getTipsForExercise(exerciseName: string): FormTip[] {
  const normalizedName = exerciseName.toLowerCase();
  
  // Find matching exercise-specific tips
  const matchingTips: FormTip[] = [];
  
  for (const [keyword, tips] of Object.entries(EXERCISE_TIPS)) {
    if (normalizedName.includes(keyword) || keyword.includes(normalizedName)) {
      matchingTips.push(...tips);
    }
  }
  
  // If no specific tips found, return generic tips
  if (matchingTips.length === 0) {
    return GENERIC_TIPS;
  }
  
  // Combine with some generic tips
  return [...matchingTips, ...GENERIC_TIPS.slice(0, 3)];
}

/**
 * Get a random tip for an exercise
 */
export function getRandomTip(exerciseName: string): FormTip {
  const tips = getTipsForExercise(exerciseName);
  const randomIndex = Math.floor(Math.random() * tips.length);
  return tips[randomIndex];
}

/**
 * Get multiple random tips for an exercise (no duplicates)
 */
export function getRandomTips(exerciseName: string, count: number): FormTip[] {
  const tips = getTipsForExercise(exerciseName);
  const shuffled = [...tips].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, tips.length));
}

/**
 * Get tips by category
 */
export function getTipsByCategory(exerciseName: string, category: FormTip['category']): FormTip[] {
  const tips = getTipsForExercise(exerciseName);
  return tips.filter(tip => tip.category === category);
}

/**
 * Get category emoji for display
 */
export function getCategoryEmoji(category: FormTip['category']): string {
  switch (category) {
    case 'breathing': return '🌬️';
    case 'posture': return '🧍';
    case 'movement': return '💪';
    case 'safety': return '⚠️';
    case 'performance': return '🎯';
    default: return '💡';
  }
}

/**
 * Get category label for display
 */
export function getCategoryLabel(category: FormTip['category']): string {
  switch (category) {
    case 'breathing': return 'Breathing';
    case 'posture': return 'Posture';
    case 'movement': return 'Movement';
    case 'safety': return 'Safety';
    case 'performance': return 'Performance';
    default: return 'Tip';
  }
}
