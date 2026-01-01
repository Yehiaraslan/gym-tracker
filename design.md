# Gym Workout Tracker - Design Document

## Overview
A personal gym workout tracking app with an 8-week cycling program. The app allows configuration of exercises via an admin panel and tracks weight progression over time.

---

## Screen List

### 1. Home Screen (Today's Workout)
- Shows current day in the 8-week cycle
- Displays exercises scheduled for today
- Quick access to start workout
- Shows week/day indicator (e.g., "Week 3, Day 2")

### 2. Workout Screen
- Active workout interface
- Exercise list with sets/reps
- Weight input fields for each set
- Rest timer between exercises
- Video link button for each exercise
- Shows last weight used as reference
- Congratulations popup when exceeding previous weight

### 3. History Screen
- List of completed workouts by date
- Expandable to show exercise details
- Weight progression for each exercise
- Filter by exercise name

### 4. Admin Screen
- Tab-based navigation:
  - **Exercises Tab**: Add/edit/delete exercises with name, video URL
  - **Program Tab**: Configure 8-week program
  - **Day Mapping Tab**: Assign exercises to specific days

---

## Primary Content and Functionality

### Home Screen
- **Current Cycle Info**: Week number (1-8), Day number, Date
- **Today's Exercises Card**: List of exercises with sets/reps preview
- **Start Workout Button**: Large CTA to begin workout
- **Empty State**: Message when no workout scheduled for today

### Workout Screen
- **Exercise Cards**: 
  - Exercise name
  - Video link icon (opens URL)
  - Sets display (e.g., "Set 1 of 4")
  - Target reps display
  - Weight input field (numeric keyboard)
  - Previous weight reference badge
  - Rest timer (configurable per exercise)
- **Progress Indicator**: Shows completed exercises
- **Complete Workout Button**: Saves all data

### History Screen
- **Workout List**: Grouped by date
- **Exercise Details**: Expandable cards showing:
  - Exercise name
  - Weight used per set
  - Comparison to previous cycle
- **Search/Filter**: Find specific exercises

### Admin Screen
- **Exercises Management**:
  - Add exercise: name, default rest time, video URL
  - Edit existing exercises
  - Delete exercises
- **Program Configuration**:
  - 8 weeks × 7 days grid
  - Assign exercises to each day
  - Configure sets, reps per exercise per day
- **Day Mapping**:
  - Map program days to calendar dates
  - Set cycle start date

---

## Key User Flows

### Flow 1: Start Daily Workout
1. User opens app → Home screen shows today's workout
2. User taps "Start Workout"
3. First exercise appears with video link and weight input
4. User enters weight, completes sets
5. Rest timer starts automatically
6. Next exercise loads
7. Repeat until all exercises complete
8. "Workout Complete" screen with summary

### Flow 2: Track Weight Progress
1. User starts exercise
2. App shows "Last time: 50kg" reference
3. User enters "55kg"
4. App detects improvement → Shows congratulations animation
5. Weight saved to history

### Flow 3: Configure Program (Admin)
1. User navigates to Admin tab
2. Creates exercises with names and video URLs
3. Goes to Program tab
4. Selects Week 1, Day 1
5. Adds exercises with sets/reps
6. Repeats for all 8 weeks
7. Sets cycle start date

### Flow 4: View History
1. User taps History tab
2. Sees list of past workouts
3. Taps a workout to expand
4. Views weight used for each exercise
5. Can filter by exercise name

---

## Color Choices

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| primary | #FF6B35 | #FF8C5A | Accent, buttons, active states |
| background | #FFFFFF | #121212 | Screen backgrounds |
| surface | #F8F9FA | #1E1E1E | Cards, elevated surfaces |
| foreground | #1A1A1A | #FFFFFF | Primary text |
| muted | #6B7280 | #9CA3AF | Secondary text, labels |
| border | #E5E7EB | #2D2D2D | Dividers, card borders |
| success | #10B981 | #34D399 | PR achieved, completion |
| warning | #F59E0B | #FBBF24 | Rest timer, alerts |
| error | #EF4444 | #F87171 | Delete, errors |

**Brand Colors**:
- Primary Orange (#FF6B35): Energetic, fitness-focused
- Success Green (#10B981): Personal records, achievements

---

## Data Models

### Exercise
```typescript
{
  id: string;
  name: string;
  videoUrl: string;
  defaultRestSeconds: number;
  createdAt: number;
}
```

### ProgramDay
```typescript
{
  weekNumber: number; // 1-8
  dayNumber: number; // 1-7
  exercises: {
    exerciseId: string;
    sets: number;
    reps: string; // e.g., "8-10" or "12"
    restSeconds: number;
  }[];
}
```

### WorkoutLog
```typescript
{
  id: string;
  date: string; // ISO date
  cycleNumber: number;
  weekNumber: number;
  dayNumber: number;
  exercises: {
    exerciseId: string;
    sets: {
      setNumber: number;
      weight: number;
      reps: number;
      completedAt: number;
    }[];
  }[];
  completedAt: number;
}
```

### AppSettings
```typescript
{
  cycleStartDate: string; // ISO date
  currentCycle: number;
}
```

---

## Navigation Structure

```
Tab Bar:
├── Home (house icon)
├── History (clock icon)  
└── Admin (gear icon)

Modal Screens:
├── Active Workout
├── Exercise Video (WebView)
└── Add/Edit Exercise
```

---

## Rest Timer Behavior
- Starts automatically after completing a set
- Shows countdown with visual progress
- Plays haptic feedback when timer ends
- Can be skipped by user
- Configurable per exercise (default: 90 seconds)

---

## Congratulations Feature
- Triggers when weight exceeds previous best for same exercise
- Shows celebratory animation/modal
- Displays improvement amount (e.g., "+5kg PR!")
- Haptic success feedback
- Auto-dismisses after 2 seconds

---

## 8-Week Cycle Logic
- Cycle starts on configured date
- Each cycle is 8 weeks (56 days)
- After 8 weeks, cycle number increments
- History preserves all cycles for comparison
- Current day calculated from start date
