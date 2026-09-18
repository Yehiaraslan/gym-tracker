// Screenshot the schedule-first athlete Home (week + month, EN + AR) on Expo web,
// and verify tapping a day + Start navigates to /split-workout with that date.
// Usage: node scripts/qa-home-schedule-shots.cjs [baseUrl] [outDir]
const path = require('path');
const fs = require('fs');
const { chromium } = require('/home/yehiaopenclaw/.npm-global/lib/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8093';
const OUT = process.argv[3] || path.join(__dirname, '..', 'artifacts', 'home-schedule-qa');
fs.mkdirSync(OUT, { recursive: true });

const PROFILE = {
  name: 'Yehia', dateOfBirth: '1985-01-01', profilePhotoUri: null, gender: 'male', heightCm: '174', weightKg: '80',
  heightUnit: 'cm', weightUnit: 'kg', fitnessGoal: 'muscle_gain', activityLevel: 3, experienceLevel: 'intermediate',
  focusMuscles: ['chest', 'back'], trainingDaysPerWeek: 4, equipment: 'full_gym', reminders: { enabled: false, times: {} },
  onboardingCompleted: true,
};

function ds(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const today = new Date();
const twoAgo = new Date(today); twoAgo.setDate(today.getDate() - 2);
const WORKOUTS = [
  { id: 'qa1', date: ds(twoAgo), sessionType: 'upper-a', exercises: [], startTime: twoAgo.toISOString(), completed: true, durationMinutes: 50 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] });
  const results = [];
  for (const lang of ['en', 'ar']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(({ p, w, l }) => {
      localStorage.setItem('@gym_user_profile:qa', JSON.stringify(p));
      localStorage.setItem('@gym_tracker_split_workouts', JSON.stringify(w));
      localStorage.setItem('@app_language', l);
    }, { p: PROFILE, w: WORKOUTS, l: lang });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.route('**/api/auth/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 1, openId: 'qa', name: 'Yehia', email: null, loginMethod: 'guest', role: 'user', lastSignedIn: new Date().toISOString() } }) }));
    await page.route('**/api/**', (r) => (r.request().url().includes('/api/auth/me') ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })));

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT, `home-week-${lang}.png`) });

    // Month view
    await page.getByLabel('mode-month').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `home-month-${lang}.png`) });

    // Select another day in the month (tomorrow), verify the card switches
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    await page.getByLabel(ds(tomorrow)).first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `home-month-selected-${lang}.png`) });

    // Back to week, next week, then Today
    await page.getByLabel('mode-week').click();
    await page.waitForTimeout(400);
    await page.getByLabel('next').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `home-week-next-${lang}.png`) });
    await page.getByLabel('today').click();
    await page.waitForTimeout(400);

    // Start button → /split-workout?date=<selected>. Walk this week until a training day is found.
    let nav = 'no-training-day-found';
    let picked = null;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() - today.getDay() + i);
      await page.getByLabel(ds(d)).first().click();
      await page.waitForTimeout(400);
      const start = page.getByLabel('start-session');
      if (await start.count()) {
        picked = ds(d);
        await page.screenshot({ path: path.join(OUT, `home-training-day-${lang}.png`) });
        await start.first().click();
        await page.waitForTimeout(2500);
        nav = page.url();
        break;
      }
    }
    results.push({ lang, picked, nav, errors });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log(`done → ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
