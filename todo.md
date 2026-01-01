# Project TODO

## Core Features
- [x] App branding (logo, colors, app name)
- [x] Tab navigation (Home, History, Admin)
- [x] Data models and AsyncStorage persistence

## Admin Panel
- [x] Exercises management (add/edit/delete)
- [x] Exercise video URL support
- [x] 8-week program configuration
- [x] Day mapping (assign exercises to days)
- [x] Rest time configuration per exercise

## Workout Features
- [x] Home screen showing today's workout
- [x] Active workout interface
- [x] Weight input for each set
- [x] Rest timer between exercises
- [x] Video link button for exercises
- [x] Last weight reference display
- [x] Congratulations feature when exceeding previous weight
- [x] Save workout to history

## History Features
- [x] History tab with past workouts
- [x] Weight progression display
- [x] Filter/search by exercise

## Cycle Management
- [x] 8-week cycle calculation
- [x] Cycle start date configuration
- [x] Auto-repeat after 8 weeks
- [x] Cycle number tracking

## New Feature Requests
- [x] Add default reps field to exercise definition
- [x] Add personal notes field to exercises (e.g., "pause 2 sec", "lift heavy")
- [x] Video player with thumbnail during workout
- [x] Calendar view for 8-week workout schedule
- [x] Whoop integration (demo mode + OAuth setup guide)

## Body Measurements & Warm-up/Cool-down Features
- [x] Body weight tracking with date entries
- [x] Body measurements (chest, waist, arms, legs, etc.)
- [x] Measurements history view in History tab
- [x] Progress tracking for body measurements (comparison with previous)
- [x] Warm-up section before main workout
- [x] Cool-down section after main workout
- [x] Admin configuration for warm-up exercises
- [x] Admin configuration for cool-down exercises

## AI Form Coach Feature (MVP)
- [x] Research and set up TensorFlow.js pose estimation for React Native
- [x] Integrate expo-camera for live video feed
- [x] Implement pose detection with throttled inference
- [x] Create exercise selection screen (Push-up / Pull-up)
- [x] Implement push-up rep counting algorithm
- [x] Implement pull-up rep counting algorithm
- [x] Add form scoring (0-100) based on pose analysis
- [x] Detect basic form flags (partial ROM, no lockout)
- [x] Build live tracking UI with rep counter and confidence
- [x] Create post-set summary card
- [x] Add graceful fallback for low confidence
- [x] Optimize performance (throttled inference at ~5 FPS)
- [x] Add AI Form Coach entry point in app navigation

## Bug Fixes
- [x] Fix "invalid hook call" error in AI Form Coach tracking screen
- [x] Fix camera view not rendering after permission granted on native devices

## AI Form Coach Enhancements
- [x] Add camera switching between front and back cameras
- [x] Create visual form guide overlay for push-ups
- [x] Create visual form guide overlay for pull-ups
- [x] Create visual form guide overlay for squats
- [x] Add squat exercise type to pose detection
- [x] Implement squat rep counting algorithm
- [x] Add squat form scoring and feedback
- [x] Update exercise selection screen with squats option
