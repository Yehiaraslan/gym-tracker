# ExerciseDB API Research Notes

## Overview
ExerciseDB provides 1,300+ exercises with animated GIF demonstrations. The API requires a RapidAPI key.

## Key Endpoints

### Search by Name
```
GET https://exercisedb.p.rapidapi.com/exercises/name/{name}
```
- Returns exercises matching the name
- Response includes: id, name, bodyPart, target, equipment, instructions

### Get Exercise GIF
```
GET https://exercisedb.p.rapidapi.com/image?exerciseId={id}&resolution={180|360|720|1080}
```
- Returns animated GIF directly (not JSON)
- Content-Type: image/gif
- Can be used directly in <img> tags with API key as query param

## Authentication
- Query param: `?rapidapi-key=YOUR_API_KEY`
- OR Header: `X-RapidAPI-Key: YOUR_API_KEY`

## Pricing Tiers
- BASIC ($0/mo): 180px resolution only
- PRO ($11.99/mo): 180px and 360px
- ULTRA ($17.99/mo): All resolutions
- MEGA ($29.99/mo): All resolutions

## Implementation Plan
1. User enters exercise name (e.g., "bench press", "squat")
2. Search ExerciseDB by name to get exercise ID
3. Construct GIF URL: `https://exercisedb.p.rapidapi.com/image?exerciseId={id}&resolution=360&rapidapi-key={key}`
4. Display GIF in exercise settings

## Alternative: Pre-curated Videos
Since ExerciseDB requires a paid API key, we could also:
1. Use a curated list of free exercise GIFs from open sources
2. Embed YouTube videos (search for "proper form" videos)
3. Use static images with instructions

## Decision
For now, implement with ExerciseDB API (requires user to provide RapidAPI key) OR use curated free GIFs from open sources like:
- Musclewiki (has free exercise GIFs)
- JEFIT exercise database
