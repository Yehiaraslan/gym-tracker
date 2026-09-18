// Walk the onboarding flow on Expo web and screenshot every step, EN then AR.
// Usage: node scripts/qa-onboarding-shots.cjs [baseUrl] [outDir]
// Auth is mocked (route /api/auth/me) so the AuthGate lets us into /onboarding.
const path = require('path');
const fs = require('fs');
const { chromium } = require('/home/yehiaopenclaw/.npm-global/lib/node_modules/playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8093';
const OUT = process.argv[3] || path.join(__dirname, '..', 'artifacts', 'onboarding-qa');
fs.mkdirSync(OUT, { recursive: true });

const STEPS = ['language', 'gender', 'goal', 'activity', 'experience', 'height', 'weight', 'age', 'focus', 'frequency', 'equipment', 'reminders', 'name', 'summary'];
// what to tap before pressing Continue, per language
const PICK = {
  en: { gender: 'Male', goal: 'Build muscle', activity: 'Walking only', experience: 'Intermediate', equipment: 'Full gym' },
  ar: { gender: 'ذكر', goal: 'بناء العضلات', activity: 'المشي فقط', experience: 'متوسط', equipment: 'جيم متكامل' },
};
const NEXT = /^(Continue|Finish|متابعة|إنهاء)$/;

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] });
  const errors = [];
  for (const lang of ['en', 'ar']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[${lang}] pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${lang}] console: ${m.text().slice(0, 300)}`); });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 1, openId: 'qa', name: 'QA', email: null, loginMethod: 'guest', lastSignedIn: new Date().toISOString() } }) }),
    );
    // registered last = checked first; fall back to the /me handler above for that path
    await page.route('**/api/**', (route) => (route.request().url().includes('/api/auth/me') ? route.fallback() : route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })));
    await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);

    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];
      if (step === 'language' && lang === 'ar') {
        await page.getByText('العربية', { exact: true }).first().click();
        await page.waitForTimeout(400);
      }
      const pick = PICK[lang][step];
      if (pick) {
        await page.getByText(pick, { exact: true }).first().click();
        await page.waitForTimeout(300);
      }
      if (step === 'name') {
        await page.locator('input').first().fill(lang === 'ar' ? 'يحيى' : 'Yehia');
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `${lang}-${String(i + 1).padStart(2, '0')}-${step}.png`) });
      if (i < STEPS.length - 1) {
        await page.getByText(NEXT).last().click();
        await page.waitForTimeout(600);
      }
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'errors.txt'), errors.join('\n'));
  console.log(`done → ${OUT}; ${errors.length} browser errors`);
})().catch((e) => { console.error(e); process.exit(1); });
