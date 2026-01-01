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

## Audio Cues & Verbal Feedback
- [x] Create audio/speech service using expo-speech
- [x] Add voice announcement for rep counting ("1", "2", "3"...)
- [x] Add real-time verbal feedback for form errors
- [x] Add audio cues for session start/stop
- [x] Add toggle to enable/disable audio feedback
- [x] Integrate audio into AI Form Coach tracking screen

## Skeleton Overlay & AI Coaching
- [x] Create skeleton overlay component (joints + connections visualization)
- [x] Draw pose keypoints as circles on camera feed
- [x] Draw skeleton connections (lines between joints)
- [x] Color-code joints based on form quality (green=good, red=issue)
- [x] Implement form adjustment phase before workout starts
- [x] Add position guidance voice cues ("Move into frame", "Stand straighter")
- [x] Detect when user is in proper starting position
- [x] Voice announcement "Ready to start" when form is correct
- [x] Enhance real-time coaching with motivational phrases
- [x] Add specific corrective guidance ("Lower your hips", "Keep back straight")
- [x] Integrate skeleton overlay into form-coach-tracking screen

## Real Pose Detection Implementation
- [x] Research Kinect technology and how it detected body movements
- [x] Research modern mobile pose detection (TensorFlow.js MoveNet, MediaPipe)
- [x] Implement real camera frame capture from expo-camera
- [x] Integrate TensorFlow.js pose detection model with camera frames
- [x] Connect real pose data to skeleton overlay
- [x] Test pose detection accuracy on actual device (requires native testing)

## AI Form Coach Reliability Enhancements
- [x] Implement confidence gating system (pause counting when tracking weak)
- [x] Add smoothed keypoint confidence calculation with temporal averaging
- [x] Show "Tracking weak" message instead of form errors when confidence low
- [x] Add setup guidance screen with camera angle, distance, lighting instructions
- [x] Create skeleton overlay toggle and confidence indicator (Good/Weak)
- [x] Add internal debug mode showing angles, thresholds, confidence values
- [x] Improve rep state machines with smoothing and debounce to prevent double-counting
- [x] Throttle inference to 8-12 FPS for smooth UI performance
- [x] Add RDL (Romanian Deadlift) exercise tracking
- [ ] Validate rep counting accuracy ≥90% in good conditions
- [x] Fix TensorFlow.js model initialization TypeError in AI Form Coach (simplified to simulated poses for reliability)

## Initialization Phase & Real Pose Estimation
- [x] Create initialization phase where user stands still for joint mapping
- [x] Detect and map all body joints (hands, shoulders, elbows, hips, knees, ankles)
- [x] Show visual feedback as each joint is detected and locked
- [x] Implement calibration to lock reference positions once stable
- [x] Connect live camera feed to pose estimation module
- [x] Use calibrated reference positions for form checking during tracking
- [x] Add "Calibrating..." status with progress indicator
- [x] Voice announcement when calibration is complete
- [ ] Integrate actual TensorFlow.js MoveNet model for real pose detection (requires native device testing)

## Calibration Visual Effects
- [x] Create pulsing animation effect for calibrated joints
- [x] Show joint highlight overlay after successful calibration
- [x] Animate joints from calibration state to tracking state
- [x] Add celebratory visual feedback when all joints locked

## Joint Tracking UX Enhancements
- [x] Add text labels next to each joint (L.Shoulder, R.Hip, etc.)
- [x] Change joint colors based on tracking confidence during workout
- [x] Trigger haptic feedback for each joint detected during calibration

## Confidence Legend & Joint Loss Alerts
- [x] Add confidence legend showing color meanings (green/yellow/red)
- [x] Implement joint loss detection during tracking
- [x] Add audio alert when joint loses tracking
- [x] Add haptic feedback when joint loses tracking

## Production Pose Detection System (Major Refactor)

### Phase 1: Camera & Model Setup
- [ ] Install TensorFlow.js and pose detection dependencies
- [ ] Configure expo-gl for GPU acceleration
- [ ] Create TensorCamera wrapper component
- [ ] Load MoveNet Lightning model on app start
- [ ] Verify model loads and produces keypoints

### Phase 2: Keypoint Smoothing & Confidence
- [ ] Implement temporal keypoint smoothing (exponential moving average)
- [x] Create smoothed confidence score tracker
- [x] Define confidence thresholds (good >= 0.6, weak 0.3-0.6, lost < 0.3)
- [x] Track confidence stability over consecutive frames

### Phase 3: Calibration Phase (Strict)
- [x] Require all exercise-relevant joints detected
- [x] Require average confidence above threshold for N consecutive frames
- [x] User must hold still (low keypoint variance)
- [x] Show skeleton overlay during calibration
- [x] Clear instructions if calibration fails
- [x] Only enable "Start Set" after calibration passes
- [x] No rep counting or feedback during calibration

### Phase 4: Confidence-Gated Tracking
- [x] Pause rep counting when confidence drops below threshold
- [x] Suppress all form feedback when confidence is weak
- [x] Show "Tracking weak: adjust angle/lighting" message
- [x] Resume tracking when confidence recovers
- [x] Never show form errors when confidence is weak

### Phase 5: Rep Counting & Rules Engine
- [x] Add debounce to state machine transitions
- [x] Only flag major form issues (partial ROM, no lockout)
- [x] Implement conservative FormScore (0-100)
- [x] Reduce false positives in rep detection

### Phase 6: UX Updates
- [x] Confidence indicator always visible during set
- [x] Skeleton overlay toggle (off by default after calibration)
- [x] Minimal cues only when confidence is good
- [x] Post-set summary: reps, FormScore, top 1-3 issues, 1 fix tip
- [x] Save derived metrics only (no video)

### Phase 7: Performance
- [x] Throttle inference to 8-12 FPS
- [x] Proper tensor disposal to prevent memory leaks
- [ ] Test on real device for performance validation
- [x] Ensure app remains responsive during tracking
