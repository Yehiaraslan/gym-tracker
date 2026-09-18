// Screenshot the post-onboarding landing (home tab) and a few main tabs on Expo web.
// Usage: node scripts/qa-landing-shots.cjs [baseUrl] [outDir]
const path = require('path');
const fs = require('fs');
const { chromium } = require('/home/yehiaopenclaw/.npm-global/lib/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8093';
const OUT = process.argv[3] || path.join(__dirname, '..', 'artifacts', 'landing-qa');
fs.mkdirSync(OUT, { recursive: true });

const PROFILE = {
  name: 'Yehia', dateOfBirth: '1985-01-01', profilePhotoUri: null, gender: 'male', heightCm: '174', weightKg: '80',
  heightUnit: 'cm', weightUnit: 'kg', fitnessGoal: 'muscle_gain', activityLevel: 3, experienceLevel: 'intermediate',
  focusMuscles: ['chest', 'back'], trainingDaysPerWeek: 4, equipment: 'full_gym', reminders: { enabled: false, times: {} },
  onboardingCompleted: true,
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((p) => {
    localStorage.setItem('@gym_user_profile', JSON.stringify(p));
    localStorage.setItem('@app_language', 'en');
  }, PROFILE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.route('**/api/auth/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 1, openId: 'qa', name: 'Yehia', email: null, loginMethod: 'guest', lastSignedIn: new Date().toISOString() } }) }));
  await page.route('**/api/**', (r) => (r.request().url().includes('/api/auth/me') ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })));

  const shots = [['/', 'home'], ['/coach', 'coach'], ['/analytics', 'analytics'], ['/more', 'more'], ['/login', 'login']];
  for (const [route, name] of shots) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'errors.txt'), errors.join('\n'));
  console.log(`done → ${OUT}; ${errors.length} page errors`);
})().catch((e) => { console.error(e); process.exit(1); });
