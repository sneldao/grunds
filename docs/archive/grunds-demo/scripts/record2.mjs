// Records the Sep-19 delight beats: idle halo, stamped share card,
// and the letter round-trip (post → reply lands → flag/knock/envelope).
// Clip f drives a real inbound through the legacy shared-secret webhook —
// pass AGENTMAIL_WEBHOOK_SECRET in the env (npx convex env get …).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://striped-anaconda-746.convex.site';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'capture', 'video');
mkdirSync(OUT, { recursive: true });
const VIEW = { width: 1920, height: 1080 };
const dwell = (page, ms) => page.waitForTimeout(ms);
const click = (page, sel) => page.$eval(sel, el => el.click());
const shown = (page, sel, ms = 20000) => page.waitForSelector(sel + '.show', { timeout: ms }).then(() => true).catch(() => false);
const t0 = Date.now();
const log = (m) => console.log(`  +${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);

const SHOTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'capture', 'shots');
mkdirSync(SHOTS, { recursive: true });

async function clip(name, url, fn) {
  log(`clip ${name} — launching`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: VIEW },
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#open:not([disabled])', { timeout: 90000 });
    log('open enabled — GLBs placed');
    await fn(page);
    // DOM screenshot of the final state — survives a hung video teardown
    await page.screenshot({ path: join(SHOTS, `${name}-end.png`) }).catch(() => {});
  } catch (e) {
    console.error(`clip ${name} error:`, e.message);
  }
  // video finalize can hang on a saturated encode — never let it eat the run
  await Promise.race([ctx.close(), new Promise(r => setTimeout(r, 25000))]).catch(() => {});
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {});
  try { process.kill(browser.process()?.pid ?? 0, 'SIGKILL'); } catch {}
  log(`recorded ${name}`);
}

async function autoAnswer(page, seconds) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    if (await page.$('#offer.show')) {
      log('offer appeared — declining');
      await dwell(page, 1800);
      await click(page, '#offer-no').catch(() => {});
    }
    if (await page.$('#letter.show')) { log('letter up'); return 'letter'; }
    await dwell(page, 300);
  }
  return null;
}

// Shared: get past the dawn brief onto a live floor.
async function openFloor(page) {
  await dwell(page, 1200);
  await click(page, '#open'); log('clicked open');
  await shown(page, '#brief', 25000); log('brief up');
  await dwell(page, 2500);
  await click(page, '#brief-open'); log('day opened');
  await dwell(page, 1500);
}

const only = process.argv[2];

// ── Clip D: idle on the floor → brass halo + goal strip agree ────────────
if (!only || only === 'd') await clip('d-halo', `${BASE}/?skipTutorial`, async (page) => {
  await openFloor(page);
  log('idling — waiting for the halo');
  const end = Date.now() + 14000;
  while (Date.now() < end) {                     // offers would eat the idle
    if (await page.$('#offer.show')) await click(page, '#offer-no').catch(() => {});
    await dwell(page, 400);
  }
});

// ── Clip E: photo mode → stamped share card + action row ──────────────────
if (!only || only === 'e') await clip('e-photo-card', `${BASE}/?skipTutorial`, async (page) => {
  await openFloor(page);
  await dwell(page, 2500);                        // let the floor breathe
  await page.keyboard.press('p'); log('photo mode');
  await shown(page, '#photo-actions', 8000); log('card baked — action row up');
  await dwell(page, 4500);                        // admire the golden hour
  try {
    const dl = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      click(page, '#pc-save'),
    ]);
    await dl[0].saveAs(join(SHOTS, '..', 'assets', 'share-card.png'));
    log('share card saved → capture/assets/share-card.png');
  } catch { log('save path did not download — caption will carry it'); }
  await dwell(page, 1200);
});

// ── Clip F: the day → letter → post → the reply arrives as theater ────────
if (!only || only === 'f') await clip('f-letter-theater', `${BASE}/?skipTutorial&speed=1200`, async (page) => {
  await dwell(page, 1200);
  await click(page, '#open'); log('clicked open');
  await shown(page, '#brief', 25000); log('brief up');
  await dwell(page, 2500);
  await click(page, '#brief-actions button[data-id="hold"]').catch(() => {});
  await dwell(page, 900);
  await click(page, '#brief-open'); log('day opened at 20x');
  await autoAnswer(page, 45);
  await shown(page, '#letter', 30000); log('letter up');
  await dwell(page, 4000);
  const mailOn = await page.$eval('#letter-mail', el => el.style.display !== 'none').catch(() => false);
  if (!mailOn) { log('mail row not live — bailing'); return; }
  await click(page, '#letter-mail-addr');
  await page.type('#letter-mail-addr', 'excitedinstrument809@agentmail.to', { delay: 55 });
  await dwell(page, 800);
  await click(page, '#letter-mail-btn'); log('letter posted');
  await dwell(page, 2500);

  const campaignId = await page.evaluate(() => { try { return localStorage.getItem('grunds.campaignId'); } catch { return null; } });
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (campaignId && secret) {
    const r = await fetch(`${BASE}/agentmail/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
      body: JSON.stringify({ campaignId, subject: 'RE: the beans', body: 'hold — ride the spot with me' }),
    }).catch(() => null);
    log(`inbound reply fired → ${r ? r.status : 'fetch failed'}`);
  } else {
    log(`no campaignId/secret (campaignId=${campaignId}) — theater will not fire`);
  }
  log('watching for the reply — flag, knock, envelope');
  for (let i = 0; i < 4; i++) {
    await dwell(page, 3500);
    await page.screenshot({ path: join(SHOTS, `f-theater-${i}.png`) }).catch(() => {});
  }
});

console.log('done →', OUT);
