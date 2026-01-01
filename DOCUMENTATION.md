# GymTracker - User Documentation

## Overview

GymTracker is a personal gym workout tracking app designed for an 8-week cycling training program. The app runs on your Google Pixel phone using the Expo Go app and stores all data locally on your device.

---

## Getting Started

### Installation

1. **Install Expo Go** on your Google Pixel phone from the Google Play Store
2. **Scan the QR code** provided in the development environment to load the app
3. The app will open directly in Expo Go

### First-Time Setup

1. Go to the **Admin** tab
2. Set your **Cycle Start Date** in the Settings section (format: YYYY-MM-DD)
3. Add your exercises in the **Exercises** section
4. Configure your 8-week program in the **Program** section

---

## App Structure

The app has three main tabs:

| Tab | Purpose |
|-----|---------|
| **Today** | View and start today's workout |
| **History** | Review past workouts and weight progression |
| **Admin** | Configure exercises, program, and settings |

---

## Admin Panel

### Exercises Tab

This is where you add all the exercises you'll use in your program.

**To add an exercise:**
1. Tap the **+** button in the bottom right
2. Enter the **Exercise Name** (required)
3. Enter a **Video URL** (optional) - paste a YouTube or other video link
4. Set the **Default Rest Time** in seconds (default: 90)
5. Tap **Save**

**To edit an exercise:**
- Tap the pencil icon next to the exercise

**To delete an exercise:**
- Tap the trash icon next to the exercise

### Program Tab

This is where you configure your 8-week training program.

**To configure a day:**
1. Select the **Week** (1-8) using the number buttons
2. Select the **Day** (Mon-Sun) using the day buttons
3. Tap **Edit** to open the day editor
4. Select exercises from the horizontal list to add them
5. For each exercise, configure:
   - **Sets**: Number of sets
   - **Reps**: Target reps (e.g., "8-10" or "12")
   - **Rest**: Rest time in seconds
6. Tap **Save**

**Visual indicators:**
- A green dot appears under days that have exercises configured

### Settings Tab

**Cycle Start Date:**
- Enter the date your 8-week program begins (format: YYYY-MM-DD)
- This determines which week/day the app shows as "today"
- After 8 weeks, the cycle automatically repeats

**Statistics:**
- View total exercises, configured program days, and completed workouts

---

## Today Screen

The home screen shows:
- Current date
- Current cycle, week, and day in your program
- Week progress bar
- List of exercises scheduled for today
- Last weight used for each exercise (if available)
- **Start Workout** button

If no workout is scheduled, you'll see a "Rest Day" message.

---

## Active Workout

When you tap **Start Workout**, you enter the active workout mode.

### During a Workout

1. **Current Exercise** is displayed with:
   - Exercise name
   - Video link button (if configured)
   - Target reps
   - Last weight reference (if available)

2. **Enter your data:**
   - Weight in kg
   - Reps completed

3. **Tap "Complete Set"** to log the set

4. **Rest Timer** automatically starts between sets
   - Shows countdown
   - Tap "Skip Rest" to continue immediately
   - Haptic feedback when timer ends

5. **Progress bar** shows overall workout completion

### Personal Records (PR)

When you lift more weight than your previous best for an exercise:
- A celebration popup appears
- Shows how much you improved
- Haptic success feedback

### Completing a Workout

After all sets are done:
- Workout is automatically saved
- Success message appears
- Tap "Done" to return to home

### Canceling a Workout

- Tap the X button in the top left
- Confirm to cancel (progress will be lost)

---

## History Screen

### Workouts View

Shows all completed workouts sorted by date (newest first).

**Each workout card shows:**
- Date
- Cycle, week, and day
- Number of exercises and total sets

**Tap a workout to expand** and see:
- Each exercise performed
- Weight and reps for each set

### Exercises View

Shows all exercises with their weight history.

**Each exercise card shows:**
- Exercise name
- Number of workouts logged
- Best weight (PR) with trophy icon

**Tap an exercise to expand** and see:
- Weight history (last 10 entries)
- Date, weight, and reps for each entry
- Trophy icon marks your best weight

**Search:**
- Use the search bar to filter exercises by name

---

## 8-Week Cycle Logic

The app automatically calculates your position in the program:

| Days Since Start | Cycle | Week | Day |
|-----------------|-------|------|-----|
| 0-6 | 1 | 1 | 1-7 |
| 7-13 | 1 | 2 | 1-7 |
| ... | ... | ... | ... |
| 49-55 | 1 | 8 | 1-7 |
| 56-62 | 2 | 1 | 1-7 |

After 8 weeks (56 days), the cycle number increments and the week resets to 1. Your weight history is preserved across all cycles.

---

## Data Storage

All data is stored locally on your device using AsyncStorage:
- Exercises
- Program configuration
- Workout history
- Settings

**Data persists** even when you close the app or restart your phone.

**To backup your data:** Currently, data is device-local only. Consider taking screenshots of your history for backup.

---

## Tips for Best Experience

1. **Configure your full 8-week program** before starting to avoid gaps
2. **Add video URLs** for exercises you want to review form
3. **Set accurate rest times** for each exercise type
4. **Log every workout** to build accurate weight history
5. **Check the History tab** to track your progress over time

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App shows wrong day | Check your Cycle Start Date in Admin > Settings |
| No exercises showing | Configure the program in Admin > Program |
| Weight not saving | Make sure to tap "Complete Set" for each set |
| Rest timer not working | Ensure the app is in the foreground |

---

## Technical Details

- **Platform:** React Native with Expo SDK 54
- **Storage:** AsyncStorage (local device storage)
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Compatible with:** Android (Google Pixel and other devices)

---

## Quick Reference

### Adding Your First Exercise
Admin → Exercises → + → Enter name → Save

### Setting Up Week 1, Day 1
Admin → Program → Select Week 1 → Select Mon → Edit → Add exercises → Save

### Starting a Workout
Today → Start Workout → Enter weight → Complete Set → Repeat

### Viewing Progress
History → Exercises → Tap exercise → View weight history
