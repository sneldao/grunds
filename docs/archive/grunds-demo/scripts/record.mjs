// Records the live game through the demo's sponsor-loop beats.
// Each clip = one browser context = one .webm in capture/video/.
// The game is deterministic-seeded; ?speed=1200 time-lapses the day.
// #open stays disabled until schedule + GLBs load — wait for it or the click is a no-op.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://striped-anaconda-746.convex.site';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'capture', 'video');
mkdirSync(OUT, { recursive: true });
const VIEW = { width: 1920, height: 1080 };
const dwell = (page, ms) => page.waitForTimeout(ms);
// Animating overlays make playwright's actionability wait flaky — click direct.
const click = (page, sel) => page.$eval(sel, el => el.click());
const shown = (page, sel, ms = 20000) => page.waitForSelector(sel + '.show', { timeout: ms }).then(() => true).catch(() => false);
const t0 = Date.now();
const log = (m) => console.log(`  +${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);

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
  } catch (e) {
    console.error(`clip ${name} error:`, e.message);
  }
  // video finalize can hang on a saturated encode — never let it eat the run
  await Promise.race([ctx.close(), new Promise(r => setTimeout(r, 25000))]).catch(() => {});
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 8000))]).catch(() => {});
  try { process.kill(browser.process()?.pid ?? 0, 'SIGKILL'); } catch {}
  log(`recorded ${name}`);
}

// Poll for pausing beats (offer/letter) — dwell so they read, then answer.
async function autoAnswer(page, seconds) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    if (await page.$('#offer.show')) {
      log('offer appeared — holding, then declining');
      await dwell(page, 1800);
      await click(page, '#offer-no').catch(() => {});
    }
    if (await page.$('#letter.show')) { log('letter up'); return 'letter'; }
    await dwell(page, 300);
  }
  return null;
}

const only = process.argv[2];

// ── Clip A: licence → tutorial → dawn Brief → hedge → floor ───────────────
if (!only || only === 'a') await clip('a-onboard-brief', BASE, async (page) => {
  await dwell(page, 1500);
  await click(page, '#open'); log('clicked open');
  if (await shown(page, '#licence', 12000)) {
    log('licence up — signing');
    await dwell(page, 1200);
    await click(page, '#lic-name');
    await page.type('#lic-name', 'Ada', { delay: 140 });
    await dwell(page, 400);
    await click(page, '#lic-stand');
    await page.type('#lic-stand', 'ADA CUP', { delay: 110 });
    await dwell(page, 700);
    await click(page, '#lic-roles button:nth-child(2)');        // the manager
    await dwell(page, 600);
    await click(page, '#lic-bgs button:nth-child(4)');          // a market regular
    await dwell(page, 900);
    await click(page, '#lic-sign'); log('signed');
  }
  if (await shown(page, '#tutorial', 12000)) {
    log('tutorial up');
    await dwell(page, 2600);                                    // WATCH THE CLOCK, ADA
    await click(page, '#tskip'); log('tutorial skipped');
  }
  await shown(page, '#brief', 25000); log('brief up — reading wire');
  await dwell(page, 4500);                                      // read the wire
  await click(page, '#brief-actions button[data-id="standard"]').catch(() => {});
  await dwell(page, 1200);
  await click(page, '#brief-open'); log('day opened');
  await dwell(page, 2500);                                      // floor wakes at 1x
  await click(page, '#speeds button[data-s="1200"]').catch(() => {});
  await autoAnswer(page, 14);                                   // the day, timelapsed
});

// ── Clip B: dawn → whole day → receipt → letter → post it ─────────────────
if (!only || only === 'b') await clip('b-day-letter-post', `${BASE}/?skipTutorial&speed=1200`, async (page) => {
  await dwell(page, 1200);
  await click(page, '#open'); log('clicked open');
  await shown(page, '#brief', 25000); log('brief up');
  await dwell(page, 3000);
  await click(page, '#brief-actions button[data-id="hold"]').catch(() => {});
  await dwell(page, 900);
  await click(page, '#brief-open'); log('day opened at 20x');
  await autoAnswer(page, 45);                                   // run the full day
  await shown(page, '#letter', 30000); log('letter up');
  await dwell(page, 4000);                                      // read the letter
  const mailOn = await page.$eval('#letter-mail', el => el.style.display !== 'none').catch(() => false);
  if (mailOn) {
    await click(page, '#letter-mail-addr');
    await page.type('#letter-mail-addr', 'excitedinstrument809@agentmail.to', { delay: 55 });
    await dwell(page, 800);
    await click(page, '#letter-mail-btn'); log('letter posted');
    await dwell(page, 3500);                                    // "posted ✓" + toast
  }
});

// ── Clip C: the wire desk close-up (sponsors visible) ─────────────────────
if (!only || only === 'c') await clip('c-wire-desk', `${BASE}/?skipTutorial`, async (page) => {
  await dwell(page, 1200);
  await click(page, '#open'); log('clicked open');
  await shown(page, '#brief', 25000); log('brief up');
  await dwell(page, 2500);
  const deskVisible = await page.$eval('#brief-desklink', el => el.style.display !== 'none').catch(() => false);
  if (deskVisible) { await click(page, '#brief-desklink'); log('desk opened from brief'); await dwell(page, 6000); }
  else {
    await click(page, '#brief-open').catch(() => {});
    await dwell(page, 1500);
    await click(page, '#wirebtn').catch(() => {});
    log('desk opened from floor'); await dwell(page, 6000);
  }
});

console.log('done →', OUT);
