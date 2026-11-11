// PBRgen pavement experiment screenshot pass — serve web/, boot the game
// per variant (base / ?pbr / ?pbr=wet), capture pavement close-ups day +
// dusk plus the default home framing.
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

const DUSK_MIN = 1240;

async function boot(page, extra) {
  await page.goto(`${BASE}/?skipTutorial&seed=7${extra ? '&' + extra : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
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
      // after a reload the flow restarts at #open — re-click if it's back
      const ready = await page.waitForFunction(() => { const b = document.querySelector('#open'); return b && !b.disabled; }, null, { timeout: 60000, polling: 1000 }).catch(() => null);
      if (ready) await page.$eval('#open', el => el.click()).catch(() => {});
    }
    await page.waitForTimeout(1200);
  }
  await page.$eval('#brief-open', el => el.click()).catch(() => {});
  await page.waitForFunction(() => window.__grunds.stats().phase === 'trading', { timeout: 120000 });
  await page.evaluate(() => window.__grunds.togglePause());
  await page.waitForTimeout(2500);
}

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

  for (const [variant, extra] of [['base', ''], ['pbr', 'pbr=1'], ['pbr-wet', 'pbr=wet']]) {
    await boot(page, extra);
    if (extra) await page.waitForTimeout(3000); // let the ?pbr maps land before shooting

    // default camera after boot, before any orbit override
    await page.screenshot({ path: `${OUT}/${variant}-home.png` });
    console.log('shot', `${variant}-home`);

    // rig.focus clamps r>=18, so close-ups drive the orbit state directly.
    // low grazing angle along the pavement
    await page.evaluate(() => {
      const g = window.__grunds;
      g.rig.beat = null;
      g.rig.target.set(-3.0, 0.3, 7.4);
      g.rig.r = 6; g.rig.theta = 0.4; g.rig.phi = 1.3;
    });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/${variant}-pave-low.png` });
    console.log('shot', `${variant}-pave-low`);

    // same framing at dusk — director layer re-pins the clock each frame
    await page.evaluate((t) => {
      const g = window.__grunds;
      g.director.add('pbrDusk', () => { try { g.world.updateTimeOfDay(t); } catch {} });
    }, DUSK_MIN);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/${variant}-pave-low-dusk.png` });
    console.log('shot', `${variant}-pave-low-dusk`);
    await page.evaluate(() => window.__grunds.director.remove('pbrDusk'));
  }
  console.log('pageerrors:', errs.length ? errs : 'none');
} finally {
  await browser.close();
  server.kill();
}
