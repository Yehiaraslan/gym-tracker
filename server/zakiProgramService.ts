// ============================================================
// ZAKI PROGRAM GENERATION SERVICE
// Uses the LLM to generate fully custom training programs
// based on the user's profile, training history, weaknesses,
// and specific preferences.
// ============================================================
import { invokeLLM } from './_core/llm';

// ── Types ────────────────────────────────────────────────────

export interface ZakiProgramExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  notes: string;
  muscleGroup: 'upper' | 'lower' | 'core';
  bodyPart: string;
  category: 'compound' | 'isolation';
}

export interface ZakiProgramSession {
  id: string;
  name: string;
  color: string;
  exercises: ZakiProgramExercise[];
}

export interface ZakiGeneratedProgram {
  name: string;
  description: string;
  durationWeeks: number;
  daysPerWeek: number;
  sessions: ZakiProgramSession[];
  weeklySchedule: Record<string, string>;
  nutritionTargets: {
    training: { calories: number; protein: number; fat: number; carbs: number };
    rest: { calories: number; protein: number; fat: number; carbs: number };
  };
  zakiNotes: string;
}

export interface ProgramGenerationInput {
  goal: string;
  experience: string;
  equipment: string;
  daysPerWeek: number;
  weakPoints: string;
  injuryHistory: string;
  preferredExercises: string;
  avoidedExercises: string;
  recentPRs: string;
  bodyWeightKg: number;
  heightCm: number;
  age: number;
  recentWorkoutHistory: string;
  // Refinement loop fields
  refinementFeedback?: string;   // User's feedback on the previous version
  previousProgramJson?: string;  // JSON of the previously generated program
  refinementRound?: number;      // Which iteration this is (1, 2, 3...)
}

// ── Color Pool ───────────────────────────────────────────────

const SESSION_COLORS = [
  '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981',
  '#F59E0B', '#EF4444', '#EC4899', '#14B8A6',
];

// ── System Prompt ────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Zaki, an elite strength & conditioning coach AI embedded in a gym tracking app. You design custom training programs that are scientifically grounded, progressive, and tailored to the individual.

PROGRAM DESIGN PRINCIPLES:
1. Every exercise selection must be justified by the user's goal, equipment, and weak points
2. Compound movements first, isolation work after — always
3. Progressive overload built in: rep ranges allow for progression (e.g., 8-10 reps, then increase weight)
4. Rest periods match intensity: heavy compounds = 120-180s, isolation = 60-90s
5. Weak points get extra volume — if user says "lagging chest", add an extra chest exercise
6. Injury history is non-negotiable — never prescribe exercises that stress injured areas
7. Nutrition targets must support the goal: muscle gain = slight surplus, fat loss = moderate deficit
8. Program name should be specific and motivating (e.g., "Yehia's Hypertrophy Surge 4x/Week")

OUTPUT FORMAT: Return valid JSON only. No markdown, no explanation outside the JSON.`;

// ── Generator ────────────────────────────────────────────────

export async function generateZakiProgram(input: ProgramGenerationInput): Promise<ZakiGeneratedProgram> {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const userPrompt = `Design a complete ${input.daysPerWeek}-day/week training program for this athlete:

ATHLETE PROFILE:
- Goal: ${input.goal.replace('_', ' ')}
- Experience: ${input.experience}
- Equipment: ${input.equipment.replace('_', ' ')}
- Body weight: ${input.bodyWeightKg}kg | Height: ${input.heightCm}cm | Age: ${input.age}
- Days available per week: ${input.daysPerWeek}

WEAK POINTS (give these extra volume): ${input.weakPoints || 'None specified'}
INJURY HISTORY (avoid stressing these): ${input.injuryHistory || 'None'}
PREFERRED EXERCISES: ${input.preferredExercises || 'No preference'}
EXERCISES TO AVOID: ${input.avoidedExercises || 'None'}

RECENT TRAINING HISTORY:
${input.recentWorkoutHistory || 'No history available — treat as fresh start'}

RECENT PRs:
${input.recentPRs || 'No PRs recorded yet'}
${input.refinementFeedback ? `
--- REFINEMENT REQUEST (Round ${input.refinementRound ?? 1}) ---
The user has already seen a generated program and wants these changes applied:
"${input.refinementFeedback}"

PREVIOUS PROGRAM (for reference — apply the requested changes to this):
${input.previousProgramJson || 'Not provided'}

IMPORTANT: Keep everything the same EXCEPT what the user explicitly asked to change. Preserve exercise names, sets/reps, and structure unless the feedback specifically targets them.` : ''}

Return a JSON object with this exact structure:
{
  "name": "Program name (specific, motivating)",
  "description": "2-sentence description of the program philosophy",
  "durationWeeks": 4,
  "daysPerWeek": ${input.daysPerWeek},
  "sessions": [
    {
      "id": "session-id-lowercase-hyphenated",
      "name": "Session Display Name",
      "color": "#HEX",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "repsMin": 8,
          "repsMax": 12,
          "restSeconds": 120,
          "notes": "Coaching cue",
          "muscleGroup": "upper",
          "bodyPart": "Chest",
          "category": "compound"
        }
      ]
    }
  ],
  "weeklySchedule": {
    "Sunday": "session-id or rest",
    "Monday": "session-id or rest",
    "Tuesday": "session-id or rest",
    "Wednesday": "session-id or rest",
    "Thursday": "session-id or rest",
    "Friday": "session-id or rest",
    "Saturday": "session-id or rest"
  },
  "nutritionTargets": {
    "training": { "calories": 2800, "protein": 180, "fat": 80, "carbs": 320 },
    "rest": { "calories": 2400, "protein": 180, "fat": 70, "carbs": 250 }
  },
  "zakiNotes": "2-3 sentences of Zaki's personal coaching notes for this athlete"
}

RULES:
- Each session must have 5-8 exercises
- Use the exact days array: ${days.join(', ')}
- Colors for sessions: use these hex codes in order: ${SESSION_COLORS.slice(0, input.daysPerWeek).join(', ')}
- Nutrition targets based on body weight (protein = ~2g/kg for muscle gain, ~1.8g/kg for fat loss)
- muscleGroup must be exactly "upper", "lower", or "core"
- category must be exactly "compound" or "isolation"`;

  const response = await invokeLLM({
    messages: [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== 'string') {
    throw new Error('Invalid LLM response: missing content in choices[0].message.content');
  }
  const parsed = JSON.parse(raw) as ZakiGeneratedProgram;

  // Validate and sanitize
  if (!parsed.sessions || !Array.isArray(parsed.sessions)) {
    throw new Error('Invalid program structure: missing sessions array');
  }
  if (!parsed.weeklySchedule || typeof parsed.weeklySchedule !== 'object') {
    throw new Error('Invalid program structure: missing weeklySchedule');
  }

  return parsed;
}
