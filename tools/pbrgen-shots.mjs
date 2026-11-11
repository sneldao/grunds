// Wet-street screenshot pass — serve web/, boot once (seed 7, no flags),
// capture the pavement dry, then setRain(0.9) and capture the wet look.
// Pins the orbit every frame via a director layer so the rig can't snap back.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const ROOT = '/Users/udingethe/Dev/grunds';
const PORT = 8774;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = '/tmp/pbrgen-shots';
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

  await page.goto(`${BASE}/?skipTutorial&seed=7`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => { const b = document.querySelector('#open'); return b && !b.disabled; }, null, { timeout: 300000, polling: 1000 });
  await page.$eval('#open', el => el.click());
  for (let i = 0; i < 60; i++) {
    try {
      const st = await page.evaluate(() => ({ top: window.__grunds?.modals?.top?.() || null, phase: window.__grunds?.phase }));
      if (st.top === 'brief' || st.phase === 'trading') break;
      if (st.top === 'tutorial') await page.$eval('#tskip', el => el.click()).catch(() => {});
      else if (st.top === 'licence') await page.$eval('#lic-sign', el => el.click()).catch(() => {});
      else if (st.top === 'softintro') await page.evaluate(() => window.__grunds.beginWeek()).catch(() => {});
    } catch (e) {
      // navigation/reload mid-boot — wait for the new context and retry
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      const ready = await page.waitForFunction(() => { const b = document.querySelector('#open'); return b && !b.disabled; }, null, { timeout: 60000, polling: 1000 }).catch(() => null);
      if (ready) await page.$eval('#open', el => el.click()).catch(() => {});
    }
    await page.waitForTimeout(1200);
  }
  await page.$eval('#brief-open', el => el.click()).catch(() => {});
  await page.waitForFunction(() => window.__grunds.stats().phase === 'trading', { timeout: 120000 });
  await page.evaluate(() => window.__grunds.togglePause());
  // wait for the opening crane to hand the camera back to play mode
  await page.waitForFunction(() => window.__grunds.rig.mode === 'play', null, { timeout: 120000, polling: 1000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // dry, default home framing
  await page.screenshot({ path: `${OUT}/dry-home.png` });
  console.log('shot dry-home');

  // rig.focus clamps r>=18; pin the orbit state directly every frame.
  await page.evaluate(() => {
    const g = window.__grunds;
    g.director.add('pbrPin', () => {
      const r = g.rig;
      r.beat = null; r.mode = 'play'; r.lastUser = performance.now();
      r.target.set(-3.0, 0.2, 7.6); r.r = 4.2; r.theta = 0.5; r.phi = 1.36;
    });
  });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/dry-close.png` });
  console.log('shot dry-close');

  // rain on — scalar wet look lands first, maps lazy-load behind it
  await page.evaluate(() => window.__grunds.world.setRain(0.9));
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${OUT}/wet-close.png` });
  console.log('shot wet-close');

  // release the pin, back to home framing, still wet
  await page.evaluate(() => {
    const g = window.__grunds;
    g.director.remove('pbrPin');
    g.rig.lastUser = 0;
  });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${OUT}/wet-home.png` });
  console.log('shot wet-home');

  console.log('pageerrors:', errs.length ? errs : 'none');
} finally {
  await browser.close();
  server.kill();
}
