// Screenshot the coach ↔ trainee screens on Expo web with a mocked backend.
// Usage: node scripts/qa-coach-shots.cjs [baseUrl] [outDir]
// tRPC batch calls are answered per-procedure from FIXTURES so both views
// render populated states without a database.
const path = require('path');
const fs = require('fs');
const { chromium } = require('/home/yehiaopenclaw/.npm-global/lib/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8093';
const OUT = process.argv[3] || path.join(__dirname, '..', 'artifacts', 'coach-qa');
fs.mkdirSync(OUT, { recursive: true });

const PROFILE = {
  name: 'Yehia', dateOfBirth: '1985-01-01', profilePhotoUri: null, gender: 'male', heightCm: '174', weightKg: '80',
  heightUnit: 'cm', weightUnit: 'kg', fitnessGoal: 'muscle_gain', activityLevel: 3, experienceLevel: 'intermediate',
  focusMuscles: ['chest', 'back'], trainingDaysPerWeek: 4, equipment: 'full_gym', reminders: { enabled: false, times: {} },
  onboardingCompleted: true,
};
const COACH_USER = { id: 27, openId: 'acct-coach', name: 'Mohamad Yousry', email: 'coach@example.com', loginMethod: 'password', role: 'trainer', lastSignedIn: new Date().toISOString() };
const TRAINEE_USER = { id: 28, openId: 'acct-trainee', name: 'Yehia', email: 'yehia@example.com', loginMethod: 'password', role: 'user', lastSignedIn: new Date().toISOString() };

const now = Date.now();
const iso = (minsAgo) => new Date(now - minsAgo * 60000).toISOString();
const day = (d) => new Date(now - d * 86400000).toISOString().slice(0, 10);

const PLAN = {
  id: 'p1', trainerId: 27, traineeId: 28, coachName: 'Mohamad Yousry', status: 'active', createdAt: iso(3000), updatedAt: iso(3000),
  name: 'Lean Bulk — Phase 1', description: 'Upper/Lower, 4 days. Push the compounds.', durationWeeks: 6, notes: '',
  sessions: [
    { id: 'upper', name: 'Upper', exercises: [
      { name: 'Barbell Bench Press', sets: 4, repsMin: 6, repsMax: 8, restSeconds: 180, notes: '', muscleGroup: 'upper', bodyPart: 'Chest', category: 'compound' },
      { name: 'Chest-Supported DB Row', sets: 4, repsMin: 8, repsMax: 10, restSeconds: 150, notes: '', muscleGroup: 'upper', bodyPart: 'Back', category: 'compound' },
      { name: 'DB Overhead Press', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 120, notes: '', muscleGroup: 'upper', bodyPart: 'Shoulders', category: 'compound' },
      { name: 'DB Lateral Raise', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60, notes: '', muscleGroup: 'upper', bodyPart: 'Shoulders', category: 'isolation' },
    ] },
    { id: 'lower', name: 'Lower', exercises: [
      { name: 'Barbell Back Squat', sets: 4, repsMin: 6, repsMax: 8, restSeconds: 180, notes: '', muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound' },
      { name: 'Romanian Deadlift', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 150, notes: '', muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound' },
      { name: 'Leg Press', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 120, notes: '', muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound' },
    ] },
  ],
  weeklySchedule: { Sunday: 'upper', Monday: 'lower', Tuesday: 'rest', Wednesday: 'upper', Thursday: 'lower', Friday: 'rest', Saturday: 'rest' },
};
const MEAL = {
  id: 'm1', trainerId: 27, traineeId: 28, coachName: 'Mohamad Yousry', status: 'active', createdAt: iso(2000), updatedAt: iso(2000),
  name: 'Lean Bulk — 2,900 kcal', notes: '3L water daily. Swap rice ↔ potato freely.',
  trainingDay: { calories: 2900, protein: 180, carbs: 360, fat: 80 }, restDay: { calories: 2600, protein: 180, carbs: 285, fat: 80 },
  meals: [
    { mealNumber: 1, name: 'Breakfast', time: '08:00', notes: '', foods: [
      { foodName: 'Eggs (whole)', servingGrams: 150, calories: 215, protein: 19, carbs: 1, fat: 15 },
      { foodName: 'Oats', servingGrams: 80, calories: 300, protein: 10, carbs: 54, fat: 5 },
    ] },
    { mealNumber: 2, name: 'Lunch', time: '13:00', notes: '', foods: [
      { foodName: 'Chicken breast', servingGrams: 200, calories: 330, protein: 62, carbs: 0, fat: 7 },
      { foodName: 'Basmati rice (cooked)', servingGrams: 250, calories: 325, protein: 7, carbs: 70, fat: 1 },
    ] },
    { mealNumber: 3, name: 'Pre-workout', time: '18:00', notes: 'Light, no fat', foods: [
      { foodName: 'Banana', servingGrams: 120, calories: 107, protein: 1, carbs: 27, fat: 0 },
      { foodName: 'Whey protein', servingGrams: 30, calories: 120, protein: 24, carbs: 3, fat: 2 },
    ] },
    { mealNumber: 4, name: 'Dinner', time: '21:00', notes: '', foods: [
      { foodName: 'Salmon', servingGrams: 180, calories: 375, protein: 37, carbs: 0, fat: 24 },
      { foodName: 'Sweet potato', servingGrams: 250, calories: 215, protein: 4, carbs: 50, fat: 0 },
    ] },
  ],
};
const MESSAGES = [
  { id: 'a', senderId: 28, recipientId: 27, body: 'Coach, left knee felt tight on squats today. Kept it at 100kg.', createdAt: iso(180), readAt: iso(170) },
  { id: 'b', senderId: 27, recipientId: 28, body: 'Good call. This week swap back squat → leg press, same sets. Ice 10 min tonight.', createdAt: iso(120), readAt: iso(100) },
  { id: 'c', senderId: 28, recipientId: 27, body: 'Done 👍 Leg press felt great, 4×10 at 200kg.', createdAt: iso(30), readAt: null },
];
const ROSTER = [
  { linkId: 'l1', userId: 28, name: 'Yehia', email: 'yehia@example.com', photosShared: true, since: iso(40000), lastWorkoutDate: day(0), workoutsLast7: 3, unread: 1, workoutPlanName: 'Lean Bulk — Phase 1', mealPlanName: 'Lean Bulk — 2,900 kcal', plannedDaysPerWeek: 4, trainedToday: true, loggedNutritionToday: true, weightDelta30: -1.2, lastMessageAt: iso(30), attention: 'watch', attentionReason: 'unread' },
  { linkId: 'l2', userId: 29, name: 'Sara M.', email: 'sara@example.com', photosShared: false, since: iso(20000), lastWorkoutDate: day(1), workoutsLast7: 4, unread: 0, workoutPlanName: 'Fat Loss Circuit', mealPlanName: 'Cut — 1,800 kcal', plannedDaysPerWeek: 4, trainedToday: false, loggedNutritionToday: true, weightDelta30: -2.4, lastMessageAt: iso(3000), attention: 'ok', attentionReason: null },
  { linkId: 'l3', userId: 30, name: 'Omar K.', email: 'omar@example.com', photosShared: false, since: iso(5000), lastWorkoutDate: day(6), workoutsLast7: 0, unread: 2, workoutPlanName: null, mealPlanName: null, plannedDaysPerWeek: 0, trainedToday: false, loggedNutritionToday: false, weightDelta30: null, lastMessageAt: iso(600), attention: 'attention', attentionReason: 'no_plan' },
  { linkId: 'l4', userId: 31, name: 'Karim H.', email: 'karim@example.com', photosShared: false, since: iso(30000), lastWorkoutDate: day(8), workoutsLast7: 0, unread: 0, workoutPlanName: 'Strength 5x5', mealPlanName: 'Maintain — 2,400 kcal', plannedDaysPerWeek: 3, trainedToday: false, loggedNutritionToday: false, weightDelta30: 0.8, lastMessageAt: iso(9000), attention: 'attention', attentionReason: 'inactive' },
];
const PROGRESS = {
  trainee: { id: 28, name: 'Yehia', email: 'yehia@example.com', photosShared: true },
  workouts: [0, 2, 4, 6, 8, 11, 13, 15].map((d, i) => ({ id: 'w' + i, date: day(d), sessionType: i % 2 ? 'lower' : 'upper', completed: true, durationMinutes: 62, totalVolumeKg: 8400 + i * 120, exerciseCount: 7 })),
  workoutsLast7: 3, workoutsLast30: 12,
  bodyWeight: [28, 24, 21, 17, 14, 10, 7, 3, 0].map((d, i) => ({ date: day(d), weightKg: 78.4 + i * 0.3, bodyFatPercent: null })),
  nutrition: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ date: day(d), targetCalories: 2900, targetProtein: 180, calories: 2700 + (d * 97) % 400, protein: 165 + (d * 13) % 30, carbs: 320, fat: 78, mealCount: 4 })),
  personalRecords: [
    { exerciseName: 'Barbell Bench Press', weightKg: 100, reps: 5, date: day(3) },
    { exerciseName: 'Barbell Back Squat', weightKg: 130, reps: 5, date: day(9) },
    { exerciseName: 'Romanian Deadlift', weightKg: 120, reps: 8, date: day(16) },
  ],
  streak: { currentStreak: 5, bestStreak: 9, lastWorkoutDate: day(0) },
  activeWorkoutPlan: { id: 'p1', name: PLAN.name, createdAt: PLAN.createdAt },
  activeMealPlan: { id: 'm1', name: MEAL.name, createdAt: MEAL.createdAt },
  plannedDaysPerWeek: 4,
  weeklyWorkouts: [21, 14, 7, 0].map((d, i) => ({ weekStart: day(d + 3), count: [4, 3, 4, 3][i] })),
  workoutAdherencePct: 88, nutritionAdherencePct: 71, weightDelta30: -1.2,
  loggedNutritionToday: true, trainedToday: true, lastMessageAt: iso(30),
};
const NOTES = [
  { id: 'n1', traineeId: 28, body: 'Left knee — keep squat depth to parallel until pain-free 2 weeks.', createdAt: iso(2000) },
  { id: 'n2', traineeId: 28, body: 'Prefers morning sessions. Travelling 3–6 Oct.', createdAt: iso(8000) },
];
const THREADS = [
  { peerId: 28, peerName: 'Yehia', peerEmail: 'yehia@example.com', lastMessage: MESSAGES[2].body, lastAt: MESSAGES[2].createdAt, unread: 1 },
  { peerId: 30, peerName: 'Omar K.', peerEmail: 'omar@example.com', lastMessage: 'When does my plan start?', lastAt: iso(600), unread: 2 },
  { peerId: 29, peerName: 'Sara M.', peerEmail: 'sara@example.com', lastMessage: 'Thanks coach!', lastAt: iso(3000), unread: 0 },
];

const FIXTURES = {
  'coach.myPlans': { workoutPlan: PLAN, mealPlan: MEAL },
  'coach.thread': MESSAGES,
  'coach.threads': THREADS,
  'coach.unreadCount': 1,
  'coach.roster': ROSTER,
  'coach.traineeProgress': PROGRESS,
  'coach.traineePlans': { workoutPlan: PLAN, mealPlan: MEAL },
  'coach.sendMessage': MESSAGES[0],
  'coach.notes': NOTES,
  'coach.addNote': NOTES[0],
  'coach.broadcast': { sent: 4 },
  'trainerLink.myTrainers': [{ linkId: 'l1', userId: 27, name: 'Mohamad Yousry', email: 'coach@example.com', status: 'active', photosShared: true, since: iso(40000) }],
  'trainerLink.myTrainees': ROSTER,
  'trainerLink.createInvite': { code: 'MY7K2P9Q', expiresAt: iso(-7 * 1440) },
};

async function mockApi(page, user) {
  await page.route('**/api/auth/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) }));
  await page.route('**/api/trpc/**', (r) => {
    const url = new URL(r.request().url());
    const procs = url.pathname.split('/api/trpc/')[1].split(',');
    const isBatch = url.searchParams.get('batch') === '1';
    const results = procs.map((p) => {
      const fx = FIXTURES[p];
      if (fx === undefined) return { error: { json: { message: `no fixture for ${p}`, code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path: p } } } };
      return { result: { data: { json: fx } } };
    });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isBatch ? results : results[0]) });
  });
  await page.route('**/api/**', (r) => r.fallback());
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] });
  const errors = [];
  const shoot = async (ctx, route, name, after) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2500);
    if (after) await after(page);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
    await page.close();
  };

  // ── Trainee view ──
  for (const lang of ['en', 'ar']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(({ p, l, u }) => {
      localStorage.setItem('@gym_user_profile:' + u.openId, JSON.stringify(p));
      localStorage.setItem('@app_language', l);
      localStorage.setItem('manus-runtime-user-info', JSON.stringify(u));
    }, { p: PROFILE, l: lang, u: TRAINEE_USER });
    ctx.on('page', (page) => mockApi(page, TRAINEE_USER).catch(() => {}));
    const page0 = await ctx.newPage(); await mockApi(page0, TRAINEE_USER); await page0.close();
    await shoot(ctx, '/coach', `trainee-coach-${lang}`);
    if (lang === 'en') {
      await shoot(ctx, '/coach', 'trainee-coach-scrolled', async (p) => { await p.mouse.wheel(0, 900); await p.waitForTimeout(600); });
      // '/nutrition' on web resolves to the modal route, so reach the TAB by tapping it.
      await shoot(ctx, '/', 'trainee-nutrition', async (p) => { await p.getByText('Nutrition', { exact: true }).last().click(); await p.waitForTimeout(2500); await p.mouse.wheel(0, 380); await p.waitForTimeout(600); });
      await shoot(ctx, '/', 'trainee-home');
    }
    await ctx.close();
  }

  // ── Coach view ──
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(({ l, u }) => {
    localStorage.setItem('@app_language', l);
    localStorage.setItem('manus-runtime-user-info', JSON.stringify(u));
  }, { l: 'en', u: COACH_USER });
  ctx.on('page', (page) => mockApi(page, COACH_USER).catch(() => {}));
  await shoot(ctx, '/athletes', 'coach-athletes');
  await shoot(ctx, '/messages', 'coach-messages');
  await shoot(ctx, '/athlete/28?name=Yehia', 'coach-athlete-progress');
  await shoot(ctx, '/athlete/28?name=Yehia', 'coach-athlete-plan', async (p) => { await p.getByText('Plan', { exact: true }).first().click(); await p.waitForTimeout(500); });
  await shoot(ctx, '/athlete/28?name=Yehia', 'coach-athlete-meals', async (p) => { await p.getByText('Meals', { exact: true }).first().click(); await p.waitForTimeout(500); });
  await shoot(ctx, '/athlete/28?name=Yehia', 'coach-athlete-notes', async (p) => { await p.getByText('Notes', { exact: true }).first().click(); await p.waitForTimeout(500); });
  await shoot(ctx, '/athlete/28?name=Yehia', 'coach-athlete-nudge', async (p) => { await p.getByText('⚡', { exact: true }).first().click(); await p.waitForTimeout(500); });
  await shoot(ctx, '/athletes', 'coach-athletes-broadcast', async (p) => { await p.getByText(/Message everyone/).first().click(); await p.waitForTimeout(500); });
  await shoot(ctx, '/athletes', 'coach-athletes-filter', async (p) => { await p.getByText(/^Attention/).first().click(); await p.waitForTimeout(500); });
  await shoot(ctx, '/chat/28?name=Yehia', 'coach-chat');
  await shoot(ctx, '/plan-builder?traineeId=28&name=Yehia', 'coach-plan-builder');
  await shoot(ctx, '/meal-builder?traineeId=28&name=Yehia', 'coach-meal-builder');
  await shoot(ctx, '/more', 'coach-more');
  await ctx.close();

  // ── Coach view (Arabic) ──
  const ctxAr = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctxAr.addInitScript(({ l, u }) => {
    localStorage.setItem('@app_language', l);
    localStorage.setItem('manus-runtime-user-info', JSON.stringify(u));
  }, { l: 'ar', u: COACH_USER });
  ctxAr.on('page', (page) => mockApi(page, COACH_USER).catch(() => {}));
  await shoot(ctxAr, '/athletes', 'coach-athletes-ar');
  await shoot(ctxAr, '/athlete/28?name=Yehia', 'coach-athlete-progress-ar');
  await shoot(ctxAr, '/athlete/28?name=Yehia', 'coach-athlete-notes-ar', async (p) => { await p.getByText('ملاحظات', { exact: true }).first().click(); await p.waitForTimeout(500); });
  await shoot(ctxAr, '/messages', 'coach-messages-ar');
  await ctxAr.close();

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'errors.txt'), errors.join('\n'));
  console.log(`done → ${OUT}; ${errors.length} page errors`);
  if (errors.length) console.log(errors.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
