// showcase-shots.mjs — hackathon capture pass: seed-7 street at dusk with
// the cine grade on and the prebuilt franchise stands hydrated.
// Drives the live game headlessly (Playwright), pins time-of-day through
// the director layer (same trick as pf-shots), and writes PNGs to
// /tmp/showcase-shots/ for the <3 min demo video.
//
// Usage: node tools/showcase-shots.mjs [seed] [outDir]
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const ROOT = '/Users/udingethe/Dev/grunds';
const PORT = 8773;
const BASE = `http://127.0.0.1:${PORT}`;
const SEED = process.argv[2] || '7';
const OUT = process.argv[3] || '/tmp/showcase-shots';
const CONVEX = process.env.CONVEX_URL || 'https://striped-anaconda-746.convex.site';
mkdirSync(OUT, { recursive: true });

const server = spawn('node', ['tools/preview-local.mjs', String(PORT)], { cwd: ROOT });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server never came up')), 15000);
  server.stdout.on('data', d => { if (String(d).includes('serving web/')) { clearTimeout(t); res(); } });
});
console.log('preview up');

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-web-security'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(`${BASE}/?skipTutorial&seed=${SEED}&convex=${encodeURIComponent(CONVEX)}&cine=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#open:not([disabled])', { timeout: 90000 });
  await page.$eval('#open', el => el.click());
  for (let i = 0; i < 40; i++) {
    // The licence sign can trigger a ?world= reload — a navigation destroys
    // the execution context mid-evaluate. Treat it as "still transitioning".
    let st = null;
    try {
      st = await page.evaluate(() => ({ top: window.__grunds?.modals?.top?.() || null, phase: window.__grunds?.phase }));
    } catch { await page.waitForTimeout(1500); continue; }
    if (st.top === 'brief' || st.phase === 'trading') break;
    if (st.top === 'tutorial') await page.$eval('#tskip', el => el.click()).catch(() => {});
    else if (st.top === 'licence') await page.$eval('#lic-sign', el => el.click()).catch(() => {});
    else if (st.top === 'softintro') await page.evaluate(() => window.__grunds.beginWeek()).catch(() => {});
    await page.waitForTimeout(1200);
  }
  await page.$eval('#brief-open', el => el.click()).catch(() => {});
  await page.waitForFunction(() => window.__grunds.stats().phase === 'trading', { timeout: 60000 });
  await page.evaluate(() => window.__grunds.togglePause());
  await page.waitForTimeout(2500);

  // Let the franchise GLBs land — status poll already ran at boot; Tripo
  // models are ~2-4 MB each, give the loader room on swiftshader.
  await page.waitForTimeout(12000);

  const dusk = (tmin) => page.evaluate((t) => {
    const g = window.__grunds;
    g.director.add('showcaseDusk', () => { try { g.world.updateTimeOfDay(t); } catch {} });
  }, tmin);
  const day = () => page.evaluate(() => window.__grunds.director.remove('showcaseDusk'));

  const aim = ([target, r, theta, phi]) => page.evaluate(([target, r, theta, phi]) => {
    const g = window.__grunds;
    g.rig.beat = null;
    g.rig.target.set(target[0], target[1], target[2]);
    g.rig.r = r; g.rig.theta = theta; g.rig.phi = phi;
  }, [target, r, theta, phi]);

  const shots = [
    // name, target [x,y,z], r, theta, phi, timeMin (null = leave as-is)
    ['day-pitch', [5.5, 1.3, 15.6], 7.5, 0.15, 1.12, null],
    ['day-row', [0.5, 2.0, 15.0], 20, 0.05, 1.02, null],
    ['day-street', [-2, 1.5, 8], 18, 0, 1.05, null],
    ['day-counter', [-5.6, 1.1, -5.3], 7.5, 0, 1.15, null],
    ['dusk-pitch', [5.5, 1.3, 15.6], 8.5, 0.1, 1.1, 1150],
    ['dusk-row', [0.5, 2.2, 15.0], 22, 0.02, 1.0, 1150],
    ['dusk-street', [-2, 1.5, 8], 20, 0, 1.05, 1150],
    ['dusk-counter', [-5.6, 1.1, -5.3], 7.5, 0, 1.15, 1180],
    ['night-row', [0.5, 2.2, 15.0], 24, 0, 0.98, 1240],
    ['night-street', [-1, 1.6, 7], 22, 0.1, 1.0, 1240],
  ];
  let pinned = null;
  for (const [name, target, r, theta, phi, tmin] of shots) {
    if (tmin !== pinned) {
      if (tmin == null) await day(); else await dusk(tmin);
      pinned = tmin;
      await page.waitForTimeout(600);
    }
    await aim([target, r, theta, phi]);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('shot', name);
  }
  console.log('pageerrors:', errs.length ? errs : 'none');
} finally {
  await browser.close();
  server.kill();
}
