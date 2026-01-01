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
4. Configure warm-up and cool-down routines in the **Warmup** section
5. Configure your 8-week program in the **Program** section

---

## App Structure

The app has four main tabs:

| Tab | Purpose |
|-----|---------|
| **Today** | View and start today's workout |
| **Schedule** | View 8-week calendar with all workouts |
| **History** | Review past workouts, weight progression, and body measurements |
| **Admin** | Configure exercises, warm-up/cool-down, program, and settings |

---

## Admin Panel

### Exercises Tab

This is where you add all the exercises you'll use in your program.

**To add an exercise:**
1. Tap the **+** button in the bottom right
2. Enter the **Exercise Name** (required)
3. Enter **Default Reps** (e.g., "8-12" or "10")
4. Enter a **Video URL** (optional) - paste a YouTube link for exercise demonstration
5. Set the **Default Rest Time** in seconds (default: 90)
6. Add **Personal Notes** (optional) - coaching cues like "pause 2 sec at bottom" or "lift heavy"
7. Tap **Save**

**To edit an exercise:**
- Tap the pencil icon next to the exercise

**To delete an exercise:**
- Tap the trash icon next to the exercise

### Warmup Tab (NEW)

This is where you configure your warm-up and cool-down routines that run before and after every workout.

**Warm-up Section (🔥):**
- Exercises to prepare your body before the main workout
- Each exercise has a name, duration timer, optional video URL, and notes
- Examples: Jumping Jacks, Arm Circles, Leg Swings, Light Cardio

**Cool-down Section (❄️):**
- Exercises to help your body recover after the main workout
- Each exercise has a name, duration timer, optional video URL, and notes
- Examples: Stretching, Foam Rolling, Deep Breathing

**To add a warm-up/cool-down exercise:**
1. Select the **Warm-up** or **Cool-down** tab
2. Tap the **+** button
3. Enter the **Exercise Name** (required)
4. Set the **Duration** in seconds (default: 30)
5. Add a **Video URL** (optional) for demonstration
6. Add **Notes** (optional) for instructions
7. Tap **Save**

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

**Whoop Integration:**
- Tap to access Whoop device connection settings
- Connect your Whoop to see recovery, strain, and sleep data

---

## Schedule Screen (Calendar View)

The Schedule tab provides a visual calendar view of your entire 8-week program.

### Features

**Cycle Overview:**
- Total workout days across all 8 weeks
- Total exercises configured

**Week Selector:**
- Horizontal scroll through weeks 1-8
- Shows number of workout days per week
- Green dot indicates current week

**Weekly Calendar Grid:**
- Visual representation of each day
- Dumbbell icon = workout day
- "Rest" = no workout scheduled
- Current day highlighted

**Day Details:**
- Tap any day to see workout details
- Shows all exercises with sets, reps, and rest times
- Displays personal notes for each exercise

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

When you tap **Start Workout**, you enter the active workout mode with three phases:

### Phase 1: Warm-up (🔥)

If you have warm-up exercises configured:
1. Each warm-up exercise is shown one at a time
2. **Video player** displays if a video URL is configured
3. **Timer** shows the exercise duration
4. Tap **Start Timer** to begin countdown
5. Tap **Done** when finished, or **Skip** to move on
6. Tap **Skip All** to skip the entire warm-up phase

### Phase 2: Main Workout

#### Video Player

If an exercise has a video URL configured:
- A thumbnail preview appears at the top
- Tap to open the full video player
- Watch the exercise demonstration while working out
- Play/pause controls available

#### Personal Notes Display

If an exercise has notes configured:
- A highlighted "Coach Notes" section appears
- Shows your custom cues (e.g., "pause 2 sec", "lift heavy")
- Helps maintain proper form and technique

#### During the Main Workout

1. **Current Exercise** is displayed with:
   - Exercise name
   - Video player (if configured)
   - Personal notes (if configured)
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

#### Personal Records (PR)
When you lift more weight than your previous best for an exercise:
- A celebration popup appears
- Shows how much you improved
- Haptic success feedback

### Phase 3: Cool-down (❄️)

If you have cool-down exercises configured:
1. Each cool-down exercise is shown one at a time
2. **Video player** displays if a video URL is configured
3. **Timer** shows the exercise duration
4. Tap **Start Timer** to begin countdown
5. Tap **Done** when finished, or **Skip** to move on
6. Tap **Skip All** to finish the workout immediately

### Completing a Workout

After all phases are done:
- Workout is automatically saved
- Success message appears
- Tap "Done" to return to home

### Canceling a Workout

- Tap the X button in the top left
- Confirm to cancel (progress will be lost)

---

## History Screen

The History screen now has three views:

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

### Body View (NEW)

Track your body weight and measurements over time.

**Body Weight:**
- Log your weight with date
- View weight history
- See change from previous entry

**Body Measurements:**
- Track multiple body parts: Chest, Waist, Hips, Left Arm, Right Arm, Left Thigh, Right Thigh
- Log measurements with date
- View measurement history
- See progress compared to previous entries

**To add a body weight entry:**
1. Go to History → Body tab
2. Tap **+ Add Weight**
3. Enter your weight in kg
4. Tap **Save**

**To add body measurements:**
1. Go to History → Body tab
2. Tap **+ Add Measurements**
3. Enter measurements for each body part (in cm)
4. Tap **Save**

---

## Whoop Integration

Access via Admin → Settings → Whoop Integration

### Features

**Connection Status:**
- Shows whether Whoop is connected
- Last sync timestamp

**Recovery Metrics (when connected):**
- **Recovery Score** - How recovered your body is (0-100%)
- **Day Strain** - Cardiovascular load for the day
- **Sleep Performance** - Quality of last night's sleep

**Demo Mode:**
- Try the feature with sample data before connecting
- Useful for previewing the interface

**Full Integration:**
- Requires creating an app at developer.whoop.com
- OAuth authentication flow
- Real-time data sync from your Whoop device

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
- Warm-up and cool-down routines
- Body measurements
- Settings
- Whoop connection data

**Data persists** even when you close the app or restart your phone.

**To backup your data:** Currently, data is device-local only. Consider taking screenshots of your history for backup.

---

## Tips for Best Experience

1. **Configure your full 8-week program** before starting to avoid gaps
2. **Set up warm-up and cool-down routines** for proper preparation and recovery
3. **Add video URLs** for exercises you want to review form (YouTube links work best)
4. **Add personal notes** with coaching cues for proper technique
5. **Set accurate rest times** for each exercise type
6. **Log every workout** to build accurate weight history
7. **Track body measurements weekly** to see physical progress
8. **Use the Schedule tab** to plan ahead and see your full program
9. **Check the History tab** to track your progress over time
10. **Connect Whoop** (if you have one) to optimize training based on recovery

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App shows wrong day | Check your Cycle Start Date in Admin > Settings |
| No exercises showing | Configure the program in Admin > Program |
| Weight not saving | Make sure to tap "Complete Set" for each set |
| Rest timer not working | Ensure the app is in the foreground |
| Video not playing | Check that the YouTube URL is correct |
| Whoop not connecting | Ensure you've set up OAuth credentials |
| Warm-up not showing | Add warm-up exercises in Admin > Warmup tab |
| Body measurements not saving | Ensure you tap Save after entering values |

---

## Technical Details

- **Platform:** React Native with Expo SDK 54
- **Storage:** AsyncStorage (local device storage)
- **Video Player:** YouTube iframe integration
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Compatible with:** Android (Google Pixel and other devices)

---

## Quick Reference

### Adding Your First Exercise
Admin → Exercises → + → Enter name, reps, video URL, notes → Save

### Setting Up Warm-up Routine
Admin → Warmup → Warm-up tab → + → Enter name, duration, video URL → Save

### Setting Up Cool-down Routine
Admin → Warmup → Cool-down tab → + → Enter name, duration, video URL → Save

### Setting Up Week 1, Day 1
Admin → Program → Select Week 1 → Select Mon → Edit → Add exercises → Save

### Starting a Workout
Today → Start Workout → Complete Warm-up → Main Workout → Cool-down → Done

### Tracking Body Measurements
History → Body tab → + Add Weight or + Add Measurements → Enter values → Save

### Viewing Your Schedule
Schedule → Select week → Tap day → View workout details

### Viewing Progress
History → Exercises → Tap exercise → View weight history

### Connecting Whoop
Admin → Settings → Whoop Integration → Connect or Try Demo Mode
