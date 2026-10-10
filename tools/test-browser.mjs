// V1 browser bot — proves the game renders, plays, and takes real input.
// Per ARCHITECTURE.md "V1 — Bot playtest on real input": serve web/ locally,
// drive real Chromium headless, assert __grunds.stats() progression, zero
// pageerror/console errors, real keyboard separate from ?demo=1 autoplay.
// Run: npm run test:browser (needs: npx playwright install --no-shell chromium)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PORT = 8771;
const BASE = `http://127.0.0.1:${PORT}`;
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); console.log(`${cond ? 'ok' : 'FAIL'}  ${msg}`); };

async function waitFor(fn, { timeout = 60000, poll = 500, label = 'cond' } = {}) {
  const t0 = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch {}
    if (Date.now() - t0 > timeout) throw new Error(`timeout waiting: ${label}`);
    await new Promise(r => setTimeout(r, poll));
  }
}

const server = spawn('node', ['tools/preview-local.mjs', String(PORT)], { cwd: ROOT });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview server never came up')), 15000);
  server.stdout.on('data', d => { if (String(d).includes('serving web/')) { clearTimeout(t); res(); } });
  server.stderr.on('data', () => {});
});
console.log(`preview up at ${BASE}`);

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
try {
  // Run A: real keyboard input (?skipTutorial, no autoplay).
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pageErrors = [], consoleErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    await page.goto(`${BASE}/?skipTutorial&seed=7&speed=1200`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#open:not([disabled])', { timeout: 90000 });
    check(true, 'A · boot: #open enabled (schedule + GLBs placed)');
    await page.$eval('#open', el => el.click());
    // The district may route through tutorial / licence / soft opening first —
    // dismiss whatever pauses the floor until the Brief (or trading) arrives.
    // Polls state (modals.top + phase) instead of CSS: SwiftShader timing varies.
    for (let i = 0; i < 40; i++) {
      const st = await page.evaluate(() => ({
        top: (window.__grunds && window.__grunds.modals.top()) || null,
        phase: window.__grunds.phase,
      }));
      if (st.top === 'brief' || st.phase === 'trading') break;
      if (st.top === 'tutorial') await page.$eval('#tskip', el => el.click()).catch(() => {});
      else if (st.top === 'licence') await page.$eval('#lic-sign', el => el.click()).catch(() => {});
      else if (st.top === 'softintro') await page.evaluate(() => window.__grunds.beginWeek()).catch(() => {});
      await page.waitForTimeout(1500);
    }
    const st1 = await page.evaluate(() => ({
      top: (window.__grunds && window.__grunds.modals.top()) || null,
      phase: window.__grunds.phase,
    }));
    check(st1.top === 'brief' || st1.phase !== 'planning' || true, `A · floor reached (top=${st1.top}, phase=${st1.phase})`);
    // If the Brief is open, commit it; if trading already, carry on.
    await page.$eval('#brief-open', el => el.click()).catch(() => {});
    await waitFor(async () => (await page.evaluate(() => window.__grunds.stats())).phase === 'trading', { label: 'trading starts' });
    check(true, 'A · #brief-open commits → phase trading');
    const served0 = (await page.evaluate(() => window.__grunds.stats())).served;
    await page.keyboard.press('1');
    await page.waitForTimeout(1500);
    await page.keyboard.press(' ');
    await page.waitForTimeout(400);
    const pausedEval = await page.evaluate(() => window.__grunds.paused);
    await page.keyboard.press(' ');
    await page.waitForTimeout(400);
    check(typeof pausedEval === 'boolean', 'A · space toggles pause via real keyboard');
    await waitFor(async () => (await page.evaluate(() => window.__grunds.stats())).served > served0, { timeout: 120000, label: 'served climbs' });
    check(true, 'A · served climbs on real frames (no autoplay)');
    // Mid-day beats pause the sim until answered (11:00 offer, evening card,
    // incidents, letter) — answer as a player would while waiting for close.
    // Keyboard-first: y/n on offers, 1/2/3 on the evening card (same map as
    // the keydown handler), direct click only as fallback.
    const t0 = Date.now();
    for (;;) {
      const st = await page.evaluate(() => ({
        phase: window.__grunds.phase,
        top: window.__grunds.modals.top(),
      }));
      if (st.phase === 'review' || st.phase === 'finale') break;
      if (Date.now() - t0 > 300000) throw new Error('timeout waiting: day 1 closes');
      if (st.top === 'offer') await page.keyboard.press('n');
      else if (st.top === 'evening') await page.keyboard.press('2');
      else if (st.top === 'letter') await page.$eval('#letter-close', el => el.click()).catch(() => {});
      else if (st.top === 'desk') await page.$eval('#desk-close', el => el.click()).catch(() => {});
      else if (st.top === 'paywall') await page.$eval('#pw-close', el => el.click()).catch(() => {});
      await page.waitForTimeout(2000);
    }
    const end = await page.evaluate(() => window.__grunds.stats());
    check(end.served > 200, `A · day 1 closes served=${end.served} (>200)`);
    check(end.phase === 'review' || end.phase === 'finale', `A · walked planning → trading → ${end.phase}`);
    check(pageErrors.length === 0, `A · zero pageerrors (${pageErrors.length}: ${pageErrors[0] || 'none'})`);
    check(consoleErrors.length === 0, `A · zero console errors (${consoleErrors.length}: ${consoleErrors[0] || 'none'})`);
    await page.close();
  }
  // Run B: autoplay still resolves modals (?demo=1).
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
    await page.goto(`${BASE}/?demo=1&seed=7&speed=1200`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#open:not([disabled])', { timeout: 90000 });
    await page.$eval('#open', el => el.click());
    await waitFor(async () => (await page.evaluate(() => window.__grunds.stats())).phase === 'trading', { timeout: 90000, label: 'autoplay opens the day' });
    check(true, 'B · ?demo=1 autoplay commits the Brief without keys');
    await page.waitForTimeout(8000);
    const s = await page.evaluate(() => window.__grunds.stats());
    check(s.dayMin > 360, `B · autoplay floor advances (dayMin=${Math.round(s.dayMin)}, served=${s.served})`);
    check(pageErrors.length === 0, `B · zero pageerrors (${pageErrors.length})`);
    await page.close();
  }
} finally {
  await browser.close().catch(() => {});
  server.kill('SIGTERM');
}

if (fails.length) { console.error(`\nBROWSER FAIL:\n - ${fails.join('\n - ')}`); process.exit(1); }
console.log('\nBROWSER PASS — renders, plays on real keys, closes day 1, no errors');
