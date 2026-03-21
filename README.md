<p align="center">
  <img src="assets/images/icon.png" alt="Banana Pro Gym" width="120" height="120" style="border-radius: 24px;" />
</p>

<h1 align="center">Banana Pro Gym</h1>

<p align="center">
  <strong>A hypertrophy-focused workout tracker built for serious lifters.</strong><br/>
  Structured programming, intelligent coaching, nutrition tracking, and WHOOP integration — all in one app.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-54-blue?logo=expo" alt="Expo SDK 54" />
  <img src="https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NativeWind-4-06B6D4?logo=tailwindcss" alt="NativeWind" />
  <img src="https://img.shields.io/badge/License-Private-red" alt="Private" />
</p>

---

## Overview

**Banana Pro Gym** is a comprehensive hypertrophy training companion designed for lifters who want structured, science-backed programming with real-time coaching feedback. Unlike generic fitness apps, it implements a periodized Upper/Lower 4-day split with mesocycle progression, RPE-based autoregulation, and an intelligent coach engine that adapts recommendations based on your recovery, sleep, and training data.

The app integrates with **WHOOP** for real-time recovery scoring, tracks **nutrition** with a UAE-localized food database (150+ entries), monitors **sleep quality**, logs **body measurements**, and provides **AI-powered insights** via ChatGPT integration. A gamification layer with XP, levels, and milestone badges keeps motivation high across training cycles.

---

## Features

### Training System

| Feature | Description |
|---------|-------------|
| **Structured Programming** | Upper/Lower 4-day split with 8-week mesocycles and progressive overload |
| **Exercise Library** | 30+ exercises with YouTube video tutorials, setup/execution steps, common mistakes, and pro tips |
| **Set Logging** | Log weight, reps, and RPE per set with automatic PR detection |
| **Rest Timer** | Configurable countdown timer between sets with haptic feedback |
| **Difficulty Ratings** | Rate exercise difficulty (easy/medium/hard) after each set for trend analysis |
| **Duration Exercises** | Support for time-based exercises (planks, holds) with start/stop timer |
| **Day Postponement** | Reschedule missed workout days instead of losing them from the weekly plan |

### Recovery and Health

| Feature | Description |
|---------|-------------|
| **WHOOP Integration** | Server-side OAuth with encrypted token storage, recovery scores, strain data, and heart rate |
| **Recovery Alerts** | Push notifications when recovery drops below 50% (12-hour cooldown) |
| **Rest Day Recommendations** | Personalized rest guidance based on recovery score, strain, and training history |
| **Sleep Tracking** | Log bedtime, wake time, quality rating, and sleep duration |
| **Weekly Recovery Chart** | 7-day recovery trend visualization with color-coded zones |

### Nutrition and Body

| Feature | Description |
|---------|-------------|
| **Nutrition Tracking** | Meal logging with macro breakdown (protein, carbs, fat, calories) |
| **UAE Food Database** | 150+ locally relevant food entries across 16 categories |
| **Body Measurements** | Track weight, chest, waist, arms, and other measurements over time |
| **Progress Photos** | Capture and store progress photos with before/after comparison slider |
| **PR Board** | Personal records with Epley 1RM formula and historical tracking |

### Intelligence

| Feature | Description |
|---------|-------------|
| **Coach Engine** | Rule-based coaching: weight trend analysis, sleep quality alerts, strength stall detection, deload recommendations |
| **AI Form Coach** | Camera-based rep counting for push-ups and pull-ups |
| **ChatGPT Insights** | Ask questions about your workout data, recovery trends, and get personalized recommendations |
| **Difficulty Analytics** | Per-exercise difficulty distribution, trend analysis, and improvement recommendations |

### Gamification

| Feature | Description |
|---------|-------------|
| **XP and Levels** | Earn XP for workouts, streaks, and achievements — progress from Beginner to Legend |
| **Streak Milestones** | Badges for 7, 30, and 100-day training streaks with celebration animations |
| **Milestone Rewards** | Unlock custom themes, premium exercise packs, and app features at milestones |
| **Achievement System** | Track and display unlocked achievements with haptic celebration feedback |

### Analytics

| Feature | Description |
|---------|-------------|
| **Analytics Dashboard** | Workout frequency, volume trends, personal records, and difficulty distribution |
| **Exercise Detail Screen** | Per-exercise stats, difficulty percentages, 5-attempt trends, and recommendations |
| **Missed Workout Tracking** | Dashboard badges for missed exercises with reschedule or skip options |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Expo SDK 54, React Native 0.81, React 19 |
| **Language** | TypeScript 5.9 |
| **Styling** | NativeWind 4 (Tailwind CSS for React Native) |
| **Navigation** | Expo Router 6 (file-based routing) |
| **Animation** | React Native Reanimated 4 |
| **Backend** | Express + tRPC |
| **Database** | MySQL (TiDB Cloud) + Drizzle ORM |
| **Auth** | Manus OAuth + WHOOP OAuth |
| **State** | React Context + AsyncStorage |
| **Testing** | Vitest |

---

## Project Structure

```
app/
  (tabs)/
    _layout.tsx          ← Tab bar configuration (5 tabs)
    index.tsx            ← Home screen with today's workout
    analytics.tsx        ← Analytics dashboard
    insights.tsx         ← ChatGPT AI insights
    admin.tsx            ← Settings, exercises, program management
  workout.tsx            ← Active workout session
  nutrition.tsx          ← Nutrition and meal tracking
  sleep.tsx              ← Sleep quality tracking
  pr-board.tsx           ← Personal records board
  exercise-library.tsx   ← Exercise browser with videos
  exercise-detail.tsx    ← Exercise stats and insights
  body-measurements.tsx  ← Weight and body measurements
  progress-gallery.tsx   ← Progress photos with comparison
  whoop.tsx              ← WHOOP connection management
  form-coach.tsx         ← AI form coaching (camera)

lib/
  types.ts               ← All TypeScript interfaces
  store.ts               ← AsyncStorage persistence layer
  gym-context.tsx         ← Global state management
  data/
    exercise-library.ts  ← 30+ exercises with tutorials
    training-program.ts  ← Upper/Lower 4-day split
    uae-food-database.json ← 150+ UAE food entries
  coach-engine.ts        ← Rule-based coaching logic
  xp-system.ts           ← XP/Level gamification
  streak-milestones.ts   ← Badge and milestone system
  milestone-rewards.ts   ← Unlockable rewards
  notification-service.ts ← Push notification system
  rest-recommendation.ts ← Recovery-based rest guidance
  day-postponement.ts    ← Missed workout rescheduling
  difficulty-analytics.ts ← Exercise difficulty analysis

server/
  routers.ts             ← tRPC API routes
  whoopService.ts        ← WHOOP API integration
  whoopCrypto.ts         ← Token encryption
  whoopDb.ts             ← WHOOP data persistence
  whoopStateDb.ts        ← OAuth CSRF protection

components/
  screen-container.tsx   ← SafeArea wrapper
  exercise-timer.tsx     ← Duration exercise timer
  weekly-recovery-chart.tsx ← 7-day recovery visualization
  difficulty-rating.tsx  ← Post-set difficulty selector
  missed-workouts-card.tsx ← Missed workout alerts
  milestone-celebration.tsx ← Badge unlock animation
  rewards-showcase.tsx   ← Unlocked rewards display
  progress-photo-slider.tsx ← Before/after comparison
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Expo Go app on your iOS/Android device

### Installation

```bash
# Clone the repository
git clone https://github.com/Yehiaraslan/gym-tracker.git
cd gym-tracker

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `WHOOP_CLIENT_ID` | WHOOP Developer API client ID | For WHOOP integration |
| `WHOOP_CLIENT_SECRET` | WHOOP Developer API client secret | For WHOOP integration |
| `WHOOP_REDIRECT_URI` | OAuth callback URL | For WHOOP integration |
| `DATABASE_URL` | MySQL connection string | For cloud sync |

### WHOOP Integration Setup

1. Create an app at [WHOOP Developer Portal](https://developer.whoop.com)
2. Set the redirect URI to your published API URL + `/whoop-callback`
3. Add your Client ID and Client Secret to the environment variables
4. Connect your WHOOP account from the Settings tab in the app

---

## Architecture

The app follows a **local-first** architecture. All workout data, nutrition logs, sleep records, and settings are stored in AsyncStorage on the device. The server backend handles:

- **User authentication** via Manus OAuth
- **WHOOP OAuth** with encrypted token storage and automatic refresh
- **Database sync** for cross-device data persistence (optional)
- **AI insights** via ChatGPT integration (requires OpenAI key)

The **Coach Engine** runs entirely on-device, analyzing your training data to provide real-time recommendations without requiring network access. It monitors weight trends, sleep patterns, strength plateaus, and recovery scores to suggest deloads, rest days, and training adjustments.

---

## License

This project is private and not licensed for public distribution.

---

<p align="center">
  <strong>Built with determination and bananas.</strong>
</p>
