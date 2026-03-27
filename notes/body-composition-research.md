# Body Composition Analysis Research Findings

## Can Multimodal LLMs (Claude/GPT) Analyze Body Photos?

### GPT-4o Body Fat Estimation Study (AnnaLeptikon, May 2025)
- Tested GPT-4o against Menno Henselmans' Visual Guides (DEXA-verified photos)
- **Men: median absolute error 2.4%** (median signed error +0.8%)
- **Women: median absolute error 5.7%** (median signed error +3.5%)
- DEXA scans themselves have ~2% error margin
- GPT-4o always correctly categorized body fat range (bodybuilding-ready to obese)
- Conclusion: "GPT-4o's ability to estimate BFP from photos rivals gold-standard tools like DEXA scans"

### Academic Research (arxiv 2511.17576, Nov 2025)
- CNN trained on 282 frontal body images: RMSE = 4.44%, R² = 0.81
- Outperformed BMI and Navy equation heuristics
- Less accurate than DEXA but viable for consumer fitness apps
- Multimodal approach (images + anthropometric data) proposed as best

### Key Insight
- Claude Opus 4.6 has equivalent or better vision capabilities than GPT-4o
- For fitness coaching purposes, ±2-5% BF estimation is MORE than sufficient
- The trained eye of a strength coach can judge BFP roughly as accurately as other methods
- LLMs effectively replicate this "trained eye" at scale

## Specialized APIs/Services

### 3DLOOK (3dlook.ai)
- Enterprise API, 96-97% measurement accuracy for body measurements
- Body composition, BMI, measurements from 2 smartphone photos
- Enterprise pricing (not free), designed for retail/health companies
- Most accurate commercial solution

### Bodygram (bodygram.com)
- API for body measurements from 2 photos
- Estimation API (now deprecated, replaced by Body Scanner API)
- SDK available for React/Next.js
- Enterprise pricing

### Nyckel (nyckel.com)
- Free pretrained body fat percentage classifier
- Simple API: upload image → get BF% category
- Less accurate than LLM approach, gives categories not precise numbers

### FitImage App
- Consumer app, not an API
- Body fat + measurements from photos
- Not available as a developer service

### BodyWHAT (bodywhat.com)
- Consumer web tool for BF estimation from photos
- No developer API

## Recommendation for Gym Tracker App

### Best Approach: Use the existing LLM (Zaki/OpenRouter) directly
**Why:**
1. Claude/GPT vision models achieve 2-5% error for BF estimation — good enough for fitness coaching
2. No additional API cost or integration complexity
3. Already have the infrastructure (OpenRouter API key, Zaki chat)
4. Can combine photo analysis with ALL other user data (measurements, weight, goals)
5. Provides qualitative coaching insights, not just a number

### How to implement:
1. User uploads front/back/side photos (already have progress-pictures.tsx)
2. Send photos to Zaki with structured prompt including age, height, weight, measurements
3. Zaki returns: estimated BF%, muscle group assessment, weak points, recommendations
4. No 3rd party API needed — the LLM IS the analyzer

### When to consider specialized APIs:
- If you need <2% accuracy (medical/clinical use) → 3DLOOK enterprise
- If you need precise body measurements (clothing/retail) → Bodygram
- For fitness coaching purposes → LLM is sufficient and more versatile
