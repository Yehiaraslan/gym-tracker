# Whoop API Integration Research

## Summary
Whoop has a public Developer Platform with OAuth 2.0 API access.

## Available Scopes (Data Access)
- **read:recovery** - Recovery score, HRV, resting heart rate
- **read:cycles** - Day strain, average heart rate during cycle
- **read:sleep** - Sleep duration, start/end time
- **read:workout** - Activity type, accumulated strain
- **read:profile** - User profile information

## Integration Requirements
1. Create an App in Whoop Developer Dashboard
2. Obtain Client ID and Client Secret
3. Implement OAuth 2.0 flow
4. User must have a Whoop device and membership

## Implementation Plan
- Add Whoop OAuth login button
- Request read:recovery and read:workout scopes
- Display recovery score on home screen
- Optionally show strain data after workouts
