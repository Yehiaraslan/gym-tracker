// ============================================================
// AI COACHING SERVICE — Server-side LLM inference pipeline
// Data aggregation → Prompt engineering → LLM inference → Structured recommendations
// ============================================================
import { invokeLLM } from './_core/llm';

// ── Response Types ───────────────────────────────────────────

export interface DailyCoachingMessage {
  greeting: string; // e.g. "Good morning, Yehia"
  headline: string; // One-line summary of today's focus
  bodyText: string; // 2-3 sentences of personalized coaching
  todayFocus: string; // e.g. "Push heavier on bench", "Recovery day — stay light"
  intensityAdvice: 'push_hard' | 'moderate' | 'go_light' | 'rest';
  nutritionTip: string; // One actionable nutrition tip
  recoveryNote: string; // Recovery-related insight
  motivationalClose: string; // One-liner to end on
}

export interface WorkoutAdjustment {
  exerciseName: string;
  adjustmentType: 'weight_increase' | 'weight_decrease' | 'deload' | 'substitute' | 'add_set' | 'remove_set';
  reason: string;
  suggestion: string; // e.g. "Increase to 82.5kg" or "Replace with Incline DB Press"
  confidence: 'high' | 'medium' | 'low';
}

export interface NutritionInsight {
  category: 'calorie_deficit' | 'calorie_surplus' | 'protein_low' | 'protein_good' | 'meal_timing' | 'hydration' | 'general';
  title: string;
  detail: string;
  actionable: string;
  priority: 'high' | 'medium' | 'low';
}

export interface WeeklyDigest {
  weekSummary: string;
  strengthHighlights: string[];
  areasToImprove: string[];
  nextWeekPlan: string;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface AICoachingResponse {
  dailyMessage: DailyCoachingMessage;
  workoutAdjustments: WorkoutAdjustment[];
  nutritionInsights: NutritionInsight[];
  weeklyDigest: WeeklyDigest | null;
}

// ── System Prompt ────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite strength & conditioning coach AI embedded in a gym tracking app. Your name is Coach. You coach Yehia, a dedicated lifter following an Upper/Lower 4-day split (Upper A, Lower A, Upper B, Lower B) with a 5-week mesocycle (4 progressive + 1 deload).

CORE PRINCIPLES:
1. Every recommendation MUST be grounded in the actual data provided — never guess or use generic advice
2. Be direct, specific, and actionable — "Increase bench to 82.5kg next session" not "try to lift more"
3. Respect recovery signals — if WHOOP shows red zone or low HRV, prioritize recovery over progression
4. Track progressive overload — the primary goal is strength gain through systematic weight/rep increases
5. Nutrition must support training — protein targets are non-negotiable for hypertrophy

COACHING STYLE:
- Speak like a knowledgeable training partner, not a textbook
- Be encouraging but honest — call out missed sessions or poor nutrition without being harsh
- Use data to back every claim — reference specific numbers, dates, and trends
- Keep messages concise — athletes don't read essays between sets

EXERCISE SUBSTITUTION RULES:
- Only suggest substitutes that target the same primary muscle group
- Prefer compound movements over isolation when substituting compounds
- Consider fatigue and recovery when suggesting alternatives
- Common substitutions: Bench→Incline DB Press, Squat→Leg Press, Deadlift→RDL, OHP→Landmine Press

WEIGHT PROGRESSION RULES:
- Increase weight when all sets hit the top of rep range for 2 consecutive sessions
- Decrease weight if failing to hit minimum reps for 2 consecutive sessions
- Deload = reduce to 60% of working weight during deload week
- Micro-load (1.25kg) for isolation exercises, standard load (2.5kg) for compounds

NUTRITION ANALYSIS:
- Target: 3000kcal training days, 2750kcal rest days
- Protein: minimum 180g daily (non-negotiable)
- Flag if protein is consistently below 150g
- Note meal timing relative to training window`;

// ── Inference Functions ──────────────────────────────────────

export async function generateDailyCoaching(
  userContext: string,
): Promise<AICoachingResponse> {
  const prompt = `Based on the following training data, provide your daily coaching analysis.

${userContext}

Respond with a JSON object matching this exact structure:
{
  "dailyMessage": {
    "greeting": "string - personalized greeting",
    "headline": "string - one-line summary of today's focus",
    "bodyText": "string - 2-3 sentences of personalized coaching based on recent data",
    "todayFocus": "string - specific instruction for today's session",
    "intensityAdvice": "push_hard|moderate|go_light|rest",
    "nutritionTip": "string - one actionable nutrition tip based on recent intake",
    "recoveryNote": "string - recovery insight based on WHOOP or training load",
    "motivationalClose": "string - one-liner to end on"
  },
  "workoutAdjustments": [
    {
      "exerciseName": "string",
      "adjustmentType": "weight_increase|weight_decrease|deload|substitute|add_set|remove_set",
      "reason": "string - data-driven reason",
      "suggestion": "string - specific actionable suggestion",
      "confidence": "high|medium|low"
    }
  ],
  "nutritionInsights": [
    {
      "category": "calorie_deficit|calorie_surplus|protein_low|protein_good|meal_timing|hydration|general",
      "title": "string - short title",
      "detail": "string - explanation with numbers",
      "actionable": "string - what to do about it",
      "priority": "high|medium|low"
    }
  ],
  "weeklyDigest": null
}

IMPORTANT: 
- workoutAdjustments should contain 2-5 specific exercise recommendations based on recent performance
- nutritionInsights should contain 1-3 insights based on recent nutrition data
- If today is a rest day, workoutAdjustments should focus on tomorrow's session preparation
- All numbers must reference actual data from the snapshot, not made-up values
- weeklyDigest should be null unless it's the end of the week (Saturday/Sunday)`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty LLM response');
    }
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
    const parsed = JSON.parse(content) as AICoachingResponse;
    return validateAndSanitize(parsed);
  } catch (error) {
    console.error('[AI Coach] LLM inference failed:', error);
    return getFallbackResponse();
  }
}

export async function generateWeeklyDigest(
  userContext: string,
): Promise<WeeklyDigest> {
  const prompt = `Based on the following training data, provide a weekly performance digest.

${userContext}

Respond with a JSON object:
{
  "weekSummary": "string - 2-3 sentence overview of the week",
  "strengthHighlights": ["string - specific PRs or improvements with numbers"],
  "areasToImprove": ["string - specific areas needing attention with data"],
  "nextWeekPlan": "string - what to focus on next week",
  "overallGrade": "A|B|C|D|F"
}

Grade criteria:
A = Hit all sessions, nutrition on point, progressive overload achieved
B = Missed 1 session or minor nutrition gaps, still progressing
C = Missed 2+ sessions or significant nutrition issues
D = Inconsistent training and nutrition
F = Barely trained this week`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error('Empty response');
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
    return JSON.parse(content) as WeeklyDigest;
  } catch (error) {
    console.error('[AI Coach] Weekly digest failed:', error);
    return {
      weekSummary: 'Unable to generate weekly digest. Keep training consistently!',
      strengthHighlights: ['Data insufficient for analysis'],
      areasToImprove: ['Log more workouts for better insights'],
      nextWeekPlan: 'Follow your program and track everything.',
      overallGrade: 'C',
    };
  }
}

export async function generateExerciseSubstitution(
  exerciseName: string,
  reason: string,
  userContext: string,
): Promise<{ substitutes: { name: string; reason: string; muscleMatch: number }[] }> {
  const prompt = `The user wants to substitute "${exerciseName}" because: "${reason}".

${userContext}

Suggest 3 alternative exercises. Respond with JSON:
{
  "substitutes": [
    {
      "name": "string - exercise name",
      "reason": "string - why this is a good substitute",
      "muscleMatch": number (0-100, how well it matches the original muscle targets)
    }
  ]
}

Rules:
- Substitutes must target the same primary muscle group
- Prefer exercises that are in the user's existing program or common gym equipment
- Consider the user's training history when suggesting alternatives`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error('Empty response');
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
    return JSON.parse(content);
  } catch (error) {
    console.error('[AI Coach] Substitution failed:', error);
    return { substitutes: [] };
  }
}

// ── Post-Workout Analysis ────────────────────────────────────

export async function generatePostWorkoutAnalysis(
  workoutSummary: string,
  userContext: string,
): Promise<{
  summary: string;
  highlights: string[];
  improvements: string[];
  nextSessionTip: string;
}> {
  const prompt = `Analyze this just-completed workout:

${workoutSummary}

Full training context:
${userContext}

Respond with JSON:
{
  "summary": "string - 1-2 sentence workout summary",
  "highlights": ["string - what went well (with specific numbers)"],
  "improvements": ["string - what could be better next time"],
  "nextSessionTip": "string - one specific tip for the next session"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error('Empty response');
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
    return JSON.parse(content);
  } catch (error) {
    console.error('[AI Coach] Post-workout analysis failed:', error);
    return {
      summary: 'Workout completed! Great effort.',
      highlights: ['Session logged successfully'],
      improvements: ['Track all sets for better analysis'],
      nextSessionTip: 'Stay consistent with your program.',
    };
  }
}

// ── Session Debrief ────────────────────────────────────────

export interface SessionDebriefResult {
  patternSummary: string;
  physicalPatterns: string[];
  mentalPatterns: string[];
  coachRecommendation: string;
  watchOut: string;
}

export async function generateSessionDebrief(
  sessionNotesContext: string,
  userContext: string,
): Promise<SessionDebriefResult> {
  const prompt = `Analyze the session notes from the last 3 workouts and identify patterns in how the athlete feels physically and mentally.

Session notes and workout data:
${sessionNotesContext}

Full training context:
${userContext}

Look for recurring themes: pain/tightness, energy levels, motivation, specific exercises that feel good or bad, sleep quality mentions, stress mentions, etc.

Respond with JSON:
{
  "patternSummary": "string - 2-3 sentence synthesis of what you observe across the sessions",
  "physicalPatterns": ["string - specific physical sensation pattern with frequency"],
  "mentalPatterns": ["string - mental/energy pattern"],
  "coachRecommendation": "string - one concrete, specific action to take based on these patterns",
  "watchOut": "string - one thing to monitor or be cautious about going forward"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });
    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error('Empty response');
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
    return JSON.parse(content) as SessionDebriefResult;
  } catch (error) {
    console.error('[AI Coach] Session debrief failed:', error);
    return {
      patternSummary: 'Not enough session notes to identify patterns yet. Add notes after each workout to unlock pattern analysis.',
      physicalPatterns: [],
      mentalPatterns: [],
      coachRecommendation: 'Start adding notes after each workout — even a single sentence helps identify patterns over time.',
      watchOut: 'Log at least 3 sessions with notes to get meaningful pattern analysis.',
    };
  }
}

// ── Validation & Fallback ────────────────────────────────────

function validateAndSanitize(data: AICoachingResponse): AICoachingResponse {
  // Ensure all required fields exist with sensible defaults
  if (!data.dailyMessage) {
    data.dailyMessage = getFallbackResponse().dailyMessage;
  }
  if (!Array.isArray(data.workoutAdjustments)) {
    data.workoutAdjustments = [];
  }
  if (!Array.isArray(data.nutritionInsights)) {
    data.nutritionInsights = [];
  }
  // Validate intensity advice
  const validIntensities = ['push_hard', 'moderate', 'go_light', 'rest'] as const;
  if (!validIntensities.includes(data.dailyMessage.intensityAdvice as any)) {
    data.dailyMessage.intensityAdvice = 'moderate';
  }
  return data;
}

function getFallbackResponse(): AICoachingResponse {
  return {
    dailyMessage: {
      greeting: 'Hey Yehia',
      headline: 'Ready to train today',
      bodyText: 'Your AI coach is warming up. Log a few more workouts and meals so I can give you personalized insights based on your actual performance data.',
      todayFocus: 'Follow your program and track every set.',
      intensityAdvice: 'moderate',
      nutritionTip: 'Hit your 180g protein target — it\'s the foundation of recovery.',
      recoveryNote: 'Listen to your body. If something feels off, it\'s okay to adjust.',
      motivationalClose: 'Consistency beats intensity. Show up.',
    },
    workoutAdjustments: [],
    nutritionInsights: [],
    weeklyDigest: null,
  };
}
