/**
 * Browser-level smoke E2E for PHYSX LAB (Playwright, headless chromium).
 *
 * Covers (spec §22C): application startup, navigation to every module,
 * main simulation visibility, core controls changing the model, resize
 * behavior, mobile navigation, no uncaught console errors during normal
 * use, no failed essential assets, reload persistence of local preferences,
 * and a valid production build being served.
 *
 * Run: node e2e/smoke.mjs   (expects `vite preview` on :4173)
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE ?? 'http://localhost:4173';

const ROUTES = [
  '#/',
  '#/library',
  '#/math-review/radians',
  '#/math-review/sinusoids',
  '#/math-review/units',
  '#/math-review/notation',
  '#/math-review/calculus',
  '#/oscillatory-motion/spring',
  '#/oscillatory-motion/shm',
  '#/oscillatory-motion/energy',
  '#/oscillatory-motion/circular',
  '#/oscillatory-motion/review',
  '#/wave-motion/pulse',
  '#/wave-motion/travelling',
  '#/wave-motion/string-speed',
  '#/wave-motion/power',
  '#/wave-motion/review',
  '#/interference/superposition',
  '#/interference/standing',
  '#/interference/harmonics',
  '#/interference/review',
  '#/ray-optics/reflection',
  '#/ray-optics/refraction',
  '#/ray-optics/tir',
  '#/ray-optics/review',
  '#/image-formation/flat',
  '#/image-formation/spherical',
  '#/image-formation/review',
  '#/formulas',
  '#/experiments',
  '#/revision',
  '#/settings',
  '#/no-such-page',
];

const IGNORED_CONSOLE = [
  'Automatic fallback to software WebGL',
  'SwiftShader',
  'GroupMarkerNotSet',
  'favicon.ico',
];

let failures = 0;
const log = (...a) => console.log(...a);
function check(name, ok, detail = '') {
  if (ok) log(`  ✓ ${name}`);
  else {
    failures++;
    log(`  ✗ ${name} ${detail}`);
  }
}

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text();
    if (!IGNORED_CONSOLE.some((s) => text.includes(s))) consoleErrors.push(text);
  }
});
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('requestfailed', (req) => {
  const url = req.url();
  if (!url.includes('favicon')) failedRequests.push(`${url} — ${req.failure()?.errorText}`);
});

log('1) Startup');
await page.goto(BASE, { waitUntil: 'networkidle' });
check('brand visible', await page.locator('.brand-name').isVisible());
check('hero heading', (await page.locator('h1').first().textContent())?.includes('See the equations'));
check('module cards', (await page.locator('.module-card').count()) === 6);

log('2) Route sweep (every module, tool and 404)');
for (const route of ROUTES) {
  await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
  const shellOk = await page.locator('.brand-name').isVisible();
  if (!shellOk) check(`route ${route}`, false, 'app shell missing');
}
check(`all ${ROUTES.length} routes rendered shell`, failures === 0);
await page.goto(`${BASE}/#/no-such-page`, { waitUntil: 'networkidle' });
check('404 page', await page.getByText('Page not found').isVisible());

log('3) Spring–mass lab: real 3D or honest fallback, live controls');
await page.goto(`${BASE}/#/oscillatory-motion/spring`, { waitUntil: 'networkidle' });
const scene3d = page.locator('.scene-3d canvas');
const fallback = page.getByText('3D graphics are not available');
const has3D = await scene3d.count().catch(() => 0);
check('simulation scene present (3D canvas or fallback)', (has3D > 0) || (await fallback.count()) > 0);

const tCard = page.locator('.measure', { hasText: 'Period T' }).locator('.m-value');
const tBefore = (await tCard.textContent()) ?? '';
await page.getByRole('slider', { name: /Spring constant slider/ }).fill('80');
await page.waitForTimeout(120);
const tAfter = (await tCard.textContent()) ?? '';
check('k change updates period readout (model-driven)', tBefore !== tAfter, `${tBefore} → ${tAfter}`);
check('period value matches 2π√(m/k) ≈ 0.497 s', tAfter.includes('0.49'), tAfter);

const timer = page.getByRole('timer');
await page.getByLabel('Play simulation').click();
await page.waitForTimeout(700);
const t1 = await timer.textContent();
await page.getByLabel('Pause simulation').click();
const t2 = await timer.textContent();
await page.waitForTimeout(300);
const t3 = await timer.textContent();
check('play advances simulation time', t1 !== '0.00 s', `t=${t1}`);
check('pause freezes simulation time', t2 === t3, `${t2} vs ${t3}`);
await page.getByLabel('Reset simulation time to zero').click();
check('reset returns time to zero', (await timer.textContent()) === '0.00 s');

log('4) Preset loads real state');
await page.getByRole('button', { name: 'Stiff spring (high k)' }).click();
await page.waitForTimeout(200);
const massVal = await page.getByRole('slider', { name: /Mass slider/ }).inputValue();
const kVal = await page.getByRole('slider', { name: /Spring constant slider/ }).inputValue();
check('preset set m = 0.3 kg, k = 120 N/m', massVal === '0.3' && kVal === '120', `m=${massVal}, k=${kVal}`);
const tPreset = await tCard.textContent();
check('preset period matches 2π√(0.3/120) ≈ 0.314 s', (tPreset ?? '').includes('0.31'), tPreset ?? '');

log('5) Spherical mirror: singular case handled honestly');
await page.goto(`${BASE}/#/image-formation/spherical`, { waitUntil: 'networkidle' });
await page.getByRole('slider', { name: /Object distance slider/ }).fill('0.3');
await page.waitForTimeout(150);
check('image-at-infinity explanation shown', await page.getByText(/Limiting case — object at the focal point/i).isVisible());
const bodyText = await page.locator('body').textContent();
check('no NaN/undefined leaked into UI', !/NaN|undefined/.test(bodyText ?? ''));

log('6) Refraction: Snell result visible');
await page.goto(`${BASE}/#/ray-optics/refraction`, { waitUntil: 'networkidle' });
const theta2 = await page.locator('.measure', { hasText: 'θ₂ (from normal)' }).locator('.m-value').textContent();
check('θ₂ computed for air→glass 40° ≈ 25.37°', (theta2 ?? '').includes('25.3'), theta2 ?? '');

log('7) Save → reload persistence (localStorage)');
await page.goto(`${BASE}/#/oscillatory-motion/spring`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Save' }).first().click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: /Save configuration/ }).click();
await page.waitForTimeout(150);
await page.goto(`${BASE}/#/experiments`, { waitUntil: 'networkidle' });
check('saved experiment listed after navigation', (await page.getByText('Spring–mass oscillator').count()) > 0);
await page.reload({ waitUntil: 'networkidle' });
check('saved experiment survives reload', (await page.getByText('Spring–mass oscillator').count()) > 0);
await page.getByRole('button', { name: /Open in lab/ }).first().click();
await page.waitForTimeout(400);
check('open-in-lab navigates to the module', page.url().includes('#/oscillatory-motion/spring'));

log('8) Settings persistence across reload');
await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Light/ }).click();
await page.waitForTimeout(100);
check('light theme applied', (await page.locator('html').getAttribute('data-theme')) === 'light');
await page.reload({ waitUntil: 'networkidle' });
check('theme persists after reload', (await page.locator('html').getAttribute('data-theme')) === 'light');
await page.getByRole('button', { name: /Dark laboratory/ }).click();

log('9) Mobile viewport (360×800): navigation drawer + stacked layout');
await page.setViewportSize({ width: 360, height: 800 });
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
check('sidebar hidden on mobile', !(await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().left >= 0)));
await page.getByLabel('Open navigation menu').click();
await page.waitForTimeout(250);
check('drawer opens', await page.locator('.sidebar.open').isVisible());
await page.locator('.sidebar a[href="#/wave-motion"]').click();
await page.waitForTimeout(600);
await page.locator('.section-tab', { hasText: 'Travelling wave' }).click();
await page.waitForTimeout(600);
check('mobile navigation reaches travelling-wave lab', await page.getByText('Constraint mode').isVisible());
check('drawer closed after navigation', (await page.locator('.sidebar.open').count()) === 0);

log('10) Tablet + desktop viewports render lab grid');
for (const [w, h] of [[768, 1024], [1920, 1080]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(200);
  const sceneW = await page.locator('.scene-wrap').first().evaluate((el) => el.getBoundingClientRect().width);
  check(`${w}×${h}: scene visible (width ${Math.round(sceneW)})`, sceneW > 200);
}

log('11) Console hygiene');
check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
check('no failed essential requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

await browser.close();
log('');
if (failures === 0) {
  log(`E2E PASSED — all checks green (${ROUTES.length} routes swept).`);
  process.exit(0);
} else {
  log(`E2E FAILED — ${failures} check(s) failed.`);
  process.exit(1);
}
