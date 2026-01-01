# GymTracker Documentation

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

### Warmup Tab

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

- **Cycle Start Date**: Set the date when your 8-week program begins
- **Whoop Integration**: Connect to your Whoop device for recovery/strain data (requires Whoop developer account)

---

## Today Tab (Workout)

The Today tab shows your scheduled workout for the current day.

**Starting a workout:**
1. Tap **Start Workout** to begin
2. The workout flows through three phases:
   - **Warm-up**: Timed exercises to prepare your body
   - **Main Workout**: Your strength exercises with weight tracking
   - **Cool-down**: Stretching and recovery exercises

**During the main workout:**
- Each exercise shows:
  - Exercise name and video button (if video URL is set)
  - Personal notes (coaching cues)
  - Last weight used as reference
  - Input fields for weight and reps for each set
  - Rest timer between sets
- Enter your weight for each set
- If you exceed your previous weight, you'll see a congratulations message!
- Tap **Complete Set** to move to the next set
- Rest timer automatically starts between sets

**Video Player:**
- Tap the video icon to view exercise demonstration
- Videos play inline with thumbnail preview
- Supports YouTube URLs

---

## AI Form Coach

The AI Form Coach uses on-device pose estimation to track your bodyweight exercises in real-time.

### Supported Exercises

| Exercise | Camera Position | Form Checks |
|----------|-----------------|-------------|
| **Push-up** | Side view | Depth, lockout, hip sag |
| **Pull-up** | Front view | Chin over bar, full extension, kipping |
| **Squat** | Side view | Depth, lockout, knee cave, forward lean |

### How to Use

1. From the Today tab, tap **AI Form Coach**
2. Select your exercise (Push-up, Pull-up, or Squat)
3. Review the tips for camera positioning
4. Tap **Start Tracking**
5. Grant camera permission when prompted
6. Position yourself in frame
7. Perform your reps - the AI will count automatically
8. Tap **Stop** when finished
9. Review your session summary with form score and feedback

### Camera Controls

- **Camera Switch Button** (top right): Toggle between front and back cameras for better angles
- **Form Guide Toggle** (figure icon): Show/hide the visual form guide overlay

### Visual Form Guides

When enabled, the form guide overlay shows:
- Stick figure animation of correct form
- Real-time feedback on your current position
- Tips for the current phase of the movement

### Form Scoring

- **Excellent (90-100)**: Near-perfect form
- **Good (75-89)**: Minor form issues
- **Fair (60-74)**: Some form corrections needed
- **Needs Work (<60)**: Focus on form improvement

### Form Flags Detected

| Flag | Description | Deduction |
|------|-------------|-----------|
| Partial ROM | Not reaching full range of motion | -20 |
| No Lockout | Not fully extending at top/bottom | -15 |
| Hip Sag | Core not engaged (push-ups) | -10 |
| Kipping | Excessive hip swing (pull-ups) | -10 |
| Knees Caving | Knees moving inward (squats) | -15 |
| Forward Lean | Excessive torso lean (squats) | -10 |

### Audio Feedback

The AI Form Coach provides real-time audio cues to help you track your workout without looking at the screen:

**Rep Counting:**
- Voice announces each completed rep ("1", "2", "3"...)

**Form Feedback:**
- "Go deeper" - Partial range of motion detected
- "Full extension" - Not locking out at top/bottom
- "Tighten core" - Hip sag detected (push-ups)
- "Control the swing" - Kipping detected (pull-ups)
- "Push knees out" - Knees caving in (squats)
- "Chest up" - Excessive forward lean (squats)
- "Heels down" - Heels rising (squats)

**Session Feedback:**
- Announces exercise name when starting
- Provides summary with total reps and grade when finished
- Gives encouragement every 3 consecutive good-form reps

**Toggle Audio:**
- Tap the speaker icon in the top bar to enable/disable audio
- Audio is enabled by default

### Tips for Best Results

- Ensure good lighting
- Place phone at a stable position
- Keep your full body in frame
- Wear fitted clothing for better detection
- Use side view for push-ups and squats
- Use front view for pull-ups
- Enable audio feedback for hands-free tracking

---

## Schedule Tab

The Schedule tab displays a calendar view of your entire 8-week program.

**Features:**
- Visual overview of all 8 weeks
- Days with workouts are highlighted
- Tap any day to see scheduled exercises
- Current day is marked
- Shows which cycle you're in

---

## History Tab

The History tab has two sections:

### Workouts Section

- View all completed workouts
- Filter by exercise to see progression
- Each workout shows:
  - Date and exercises performed
  - Sets, reps, and weights used
  - Duration

### Body Section

Track your physical measurements over time.

**To add a measurement:**
1. Tap **Add Measurement**
2. Enter your body weight
3. Enter measurements (all optional):
   - Chest
   - Waist
   - Hips
   - Left/Right Arm
   - Left/Right Thigh
4. Tap **Save**

**Progress Tracking:**
- Measurements show comparison to previous entry
- Green arrows indicate improvement
- Red arrows indicate areas to watch

---

## Whoop Integration

The app supports optional Whoop integration for recovery and strain data.

**Setup (requires Whoop developer account):**
1. Go to Admin → Settings → Whoop Integration
2. Follow the OAuth flow to connect your Whoop account
3. Once connected, view recovery score and strain data

**Demo Mode:**
- If not connected, the app shows simulated Whoop data for preview

---

## Data Storage

- All data is stored locally on your device using AsyncStorage
- No cloud sync or backup (data stays on your phone)
- Data persists across app restarts
- Uninstalling the app will delete all data

---

## Troubleshooting

**App not loading:**
- Ensure Expo Go is up to date
- Check your internet connection
- Try reloading the app in Expo Go

**Workout not showing:**
- Verify the cycle start date is set correctly
- Check that exercises are configured for today's day in the Program tab

**AI Form Coach issues:**
- Ensure camera permission is granted
- Check lighting conditions
- Position camera at correct angle for the exercise
- Try switching between front and back cameras

**Camera not showing:**
- Camera preview may not be available on web (demo mode will be active)
- On native devices, ensure camera permission is granted

---

## Version History

| Version | Features |
|---------|----------|
| 1.0 | Initial release with 8-week program, weight tracking, history |
| 1.1 | Added body measurements, warm-up/cool-down sections |
| 1.2 | Added AI Form Coach with push-ups and pull-ups |
| 1.3 | Added camera switching, visual form guides, squat tracking |
| 1.4 | Added audio cues for rep counting and real-time verbal form feedback |
