// Scratch screenshot pass for the polyfork pilot — serve web/, drive the
// camera + clock, capture street/interior/night frames.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const ROOT = '/Users/udingethe/Dev/grunds';
const PORT = 8772;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = '/tmp/pf-shots';
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
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  page.on('framenavigated', f => { if (f === page.mainFrame()) errs.push('nav: ' + f.url().slice(0, 140)); });
  await page.goto(`${BASE}/?skipTutorial&seed=${process.env.PF_SEED || '7'}&${process.env.PF_EXTRA || 'district=polyfork'}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#open:not([disabled])', { timeout: 90000 });
  await page.$eval('#open', el => el.click());
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => ({ top: window.__grunds?.modals?.top?.() || null, phase: window.__grunds?.phase }));
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

  // rig.focus clamps r>=18, so close-ups drive the orbit state directly.
  const shots = [
    // name, target [x,y,z], r, theta, phi, forceTmin
    ['day-bar', [-5.6, 1.1, -5.3], 7.5, 0, 1.15, null],
    ['day-leftwall', [-7.7, 1.0, -2.3], 7, 0.7, 1.1, null],
    ['day-pavement', [0.5, 0.6, 6.8], 9, 0, 1.2, null],
    ['day-stallwest', [-15.8, 1.2, 7.1], 9, 0, 1.15, null],
    ['day-newseast', [13.6, 1.2, 7.6], 10, 0, 1.15, null],
    ['dusk-street', [-2, 1.5, 8], 20, 0, 1.05, 1240],
    ['dusk-counter', [-5.6, 1.1, -5.3], 7.5, 0, 1.15, 1240],
    ['far-west', [-17.5, 3.5, 18.5], 14, 0, 1.0, null],
  ];
  let duskOn = false;
  for (const [name, target, r, theta, phi, tmin] of shots) {
    if (tmin && !duskOn) {
      await page.evaluate((t) => {
        const g = window.__grunds;
        g.director.add('pfDusk', () => { try { g.world.updateTimeOfDay(t); } catch {} });
      }, tmin);
      duskOn = true;
      await page.waitForTimeout(400);
    } else if (!tmin && duskOn) {
      await page.evaluate(() => window.__grunds.director.remove('pfDusk'));
      duskOn = false;
      await page.waitForTimeout(400);
    }
    await page.evaluate(([target, r, theta, phi]) => {
      const g = window.__grunds;
      g.rig.beat = null;
      g.rig.target.set(target[0], target[1], target[2]);
      g.rig.r = r; g.rig.theta = theta; g.rig.phi = phi;
    }, [target, r, theta, phi]);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('shot', name);
  }
  console.log('pageerrors:', errs.length ? errs : 'none');
} finally {
  await browser.close();
  server.kill();
}
