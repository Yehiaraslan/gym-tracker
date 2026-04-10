// Exercise definition
export type BodyPart = 'Legs' | 'Arms' | 'Chest' | 'Back' | 'Shoulders' | 'Core' | 'Cardio' | 'Other';
export type ExerciseType = 'reps' | 'duration';
export type DifficultyRating = 'easy' | 'medium' | 'hard';

export interface Exercise {
  id: string;
  name: string;
  videoUrl: string;
  videoId?: string; // YouTube video ID (11-char string, used for in-app player)
  defaultRestSeconds: number;
  defaultReps: string; // e.g., "8-10" or "12" (for reps-based exercises)
  defaultDuration?: number; // seconds (for duration-based exercises)
  exerciseType: ExerciseType; // 'reps' or 'duration'
  bodyPart: BodyPart; // Categorization by body part
  notes: string; // Personal notes like "pause 2 sec", "lift heavy"
  createdAt: number;
}

// Exercise configuration for a specific day
export interface DayExercise {
  exerciseId: string;
  sets: number;
  reps?: string; // e.g., "8-10" or "12" (for reps-based exercises)
  duration?: number; // seconds (for duration-based exercises)
  restSeconds: number;
  order: number;
}

// Program day configuration
export interface ProgramDay {
  weekNumber: number; // 1-8
  dayNumber: number; // 1-7 (1=Monday, 7=Sunday)
  exercises: DayExercise[];
  isRestDay: boolean;
}

// Individual set log
export interface SetLog {
  setNumber: number;
  weight: number;
  reps: number;
  completedAt: number;
}

// Exercise log within a workout
export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  sets: SetLog[];
  difficulty?: DifficultyRating; // easy/medium/hard rating
  notes?: string; // User notes about the exercise
}

// Complete workout log
export interface WorkoutLog {
  id: string;
  date: string; // ISO date string
  cycleNumber: number;
  weekNumber: number;
  dayNumber: number;
  exercises: ExerciseLog[];
  startedAt: number;
  completedAt: number | null;
  isCompleted: boolean;
}

// Body measurement entry
export interface BodyMeasurement {
  id: string;
  date: string; // ISO date string
  weight?: number; // kg
  chest?: number; // cm
  waist?: number; // cm
  hips?: number; // cm
  leftArm?: number; // cm
  rightArm?: number; // cm
  leftThigh?: number; // cm
  rightThigh?: number; // cm
  notes?: string;
  createdAt: number;
}

// Warm-up/Cool-down exercise
export interface WarmupCooldownExercise {
  id: string;
  name: string;
  duration: number; // seconds
  videoUrl?: string;
  notes?: string;
  order: number;
}

// Warm-up/Cool-down configuration
export interface WarmupCooldownConfig {
  warmupExercises: WarmupCooldownExercise[];
  cooldownExercises: WarmupCooldownExercise[];
}

// Session types for structured training
export type SessionType = 'upper-a' | 'lower-a' | 'upper-b' | 'lower-b' | 'rest';

// Exercise library entry (detailed exercise info with video)
export interface ExerciseLibraryEntry {
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string;
  category: 'compound' | 'isolation' | 'cardio';
  videoId: string; // YouTube video ID
  videoTitle: string;
  setup: string[];
  execution: string[];
  commonMistakes: { mistake: string; fix: string }[];
  breathing: string;
  proTip: string;
  muscleGroup: 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'core' | 'full-body';
}

// Exercise target for training program
export interface ExerciseTarget {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  notes: string;
  muscleGroup: 'upper' | 'lower';
}

// Nutrition types
export interface FoodEntry {
  id: string;
  mealNumber: 1 | 2 | 3 | 4 | 5;
  foodName: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  servingGrams: number;
  timestamp: string;
}

export interface DailyNutrition {
  date: string;
  isTrainingDay: boolean;
  meals: FoodEntry[];
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  supplementsChecked: SupplementCheck[];
}

export interface SupplementCheck {
  name: string;
  dose: string;
  timing: string;
  taken: boolean;
}

// Sleep tracking
export interface SleepEntry {
  id: string;
  date: string;
  bedtime: string; // HH:MM
  wakeTime: string; // HH:MM
  durationHours: number;
  qualityRating: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

// Weight tracking
export interface WeightEntry {
  id: string;
  date: string;
  weight: number; // kg
  weightKg?: number; // legacy alias
  bodyFatPercent?: number;
  chest?: number; // cm
  waist?: number; // cm
  arms?: number; // cm
  thighs?: number; // cm
  notes?: string;
}

// Mesocycle tracking
export interface Mesocycle {
  id: string;
  startDate: string;
  currentWeek: number; // 1-5
  totalWeeks: number; // 5
  isDeload: boolean;
}

// Coach recommendation
export interface CoachRecommendation {
  id: string;
  date: string;
  type: 'nutrition' | 'training' | 'recovery' | 'overload';
  message: string;
  actionable: string;
  priority: 'high' | 'medium' | 'low';
  dismissed: boolean;
}

// XP and Level system
export type PlayerLevel = 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced' | 'Elite' | 'Legend';

export interface XPState {
  totalXP: number;
  level: PlayerLevel;
  workoutsCompleted: number;
  perfectWeeks: number;
  prsHit: number;
}

// Personal Record
export interface PersonalRecord {
  exerciseName: string;
  weightKg: number;
  reps: number;
  estimated1RM: number;
  date: string;
  sessionType: SessionType;
}

// App settings
export interface AppSettings {
  cycleStartDate: string; // ISO date string
  currentCycle: number;
  rapidApiKey?: string; // RapidAPI key for ExerciseDB API
  openAiKey?: string; // OpenAI API key for ChatGPT integration
  notificationsEnabled?: boolean; // Push notifications enabled
}

// Store state
export interface GymStore {
  exercises: Exercise[];
  programDays: ProgramDay[];
  workoutLogs: WorkoutLog[];
  bodyMeasurements: BodyMeasurement[];
  warmupCooldown: WarmupCooldownConfig;
  settings: AppSettings;
  // New fields from hypertrophy-tracker
  nutritionLogs: DailyNutrition[];
  sleepEntries: SleepEntry[];
  weightEntries: WeightEntry[];
  mesocycle: Mesocycle;
  coachRecommendations: CoachRecommendation[];
  xpState: XPState;
  personalRecords: PersonalRecord[];
}

// Current workout state (not persisted)
export interface ActiveWorkout {
  workoutLog: WorkoutLog;
  currentExerciseIndex: number;
  currentSetIndex: number;
  isResting: boolean;
  restTimeRemaining: number;
}

// Helper to generate unique IDs
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Get day name from number
export function getDayName(dayNumber: number): string {
  const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayNumber] || '';
}

// Calculate current cycle info from start date
export function calculateCycleInfo(startDate: string): { cycle: number; week: number; day: number } {
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { cycle: 1, week: 1, day: 1 };
  }
  
  const totalWeeks = Math.floor(diffDays / 7);
  const cycle = Math.floor(totalWeeks / 8) + 1;
  const weekInCycle = (totalWeeks % 8) + 1;
  const dayInWeek = (diffDays % 7) + 1; // 1-7
  
  return { cycle, week: weekInCycle, day: dayInWeek };
}

// Format date for display
export function formatDate(dateString: string): string {
  // Parse date parts to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}
