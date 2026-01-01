// Exercise definition
export interface Exercise {
  id: string;
  name: string;
  videoUrl: string;
  defaultRestSeconds: number;
  defaultReps: string; // e.g., "8-10" or "12"
  notes: string; // Personal notes like "pause 2 sec", "lift heavy"
  createdAt: number;
}

// Exercise configuration for a specific day
export interface DayExercise {
  exerciseId: string;
  sets: number;
  reps: string; // e.g., "8-10" or "12"
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

// App settings
export interface AppSettings {
  cycleStartDate: string; // ISO date string
  currentCycle: number;
  rapidApiKey?: string; // RapidAPI key for ExerciseDB API
}

// Store state
export interface GymStore {
  exercises: Exercise[];
  programDays: ProgramDay[];
  workoutLogs: WorkoutLog[];
  bodyMeasurements: BodyMeasurement[];
  warmupCooldown: WarmupCooldownConfig;
  settings: AppSettings;
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
