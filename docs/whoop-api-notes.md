# WHOOP API Research Notes

## Overview
WHOOP provides OAuth 2.0 API for accessing user health data.

## Authentication
- OAuth 2.0 protocol
- Authorization URL: https://api.prod.whoop.com/oauth/oauth2/auth
- Token URL: https://api.prod.whoop.com/oauth/oauth2/token

## Relevant Scopes
- `read:workout` - Read workout data, including activity Strain and average heart rate
- `read:cycles` - Read cycles data, including day Strain and average heart rate
- `read:recovery` - Read Recovery data, including heart rate variability and resting heart rate
- `read:body_measurement` - Read body measurements including max heart rate

## Key Endpoints

### Cycle Data
GET /v1/cycle/{cycleId}
Returns:
- average_heart_rate
- max_heart_rate
- strain
- kilojoule

### Workout Data
GET /v1/activity/workout/{workoutId}
Returns:
- average_heart_rate
- max_heart_rate
- strain
- sport_id (activity type)
- start/end timestamps

## Limitations
- WHOOP API does NOT provide real-time heart rate streaming
- Heart rate data is aggregated (average, max) per workout/cycle
- No granular time-series heart rate data available through public API
- Requires OAuth app registration with WHOOP

## Alternative Approach
Since WHOOP doesn't provide real-time HR streaming or detailed time-series data:
1. After workout completion, fetch the workout data from WHOOP
2. Display average/max heart rate stats
3. For a "chart", we can show estimated zones based on avg/max HR
4. Or simulate a heart rate curve based on workout phases

## Implementation Plan
1. Add WHOOP OAuth client ID/secret fields in settings
2. Implement OAuth flow to get access token
3. After workout, fetch recent workout from WHOOP API
4. Display HR stats (avg, max) in workout summary
5. Create a simple visualization based on available data
