// demo-video.mjs — the submission demo, two takes + marker-cut assembly.
//
//   Take 1 "prompt":  fresh profile — the prompt-intro IS the front door.
//                     Type a stand, build it, the world reloads.
//   Take 2 "session": one continuous run through the story — licence,
//                     brief, floor, rush, a REAL dusk (evening trade held
//                     open — the sky shader follows dayMin, so no pinning),
//                     night, day 2, the wire desk. Each shot's start is
//                     console-stamped; ffmpeg cuts on the stamps.
//
// Usage:  node tools/demo-video.mjs [seed] [outDir]
// Env:    DEMO_W / DEMO_H (default 1280×720), CONVEX_URL, NO_FFMPEG=1,
//         DEMO_PROMPT (default 'a tiny late-night ramen counter'),
//         ONLY=prompt|session to run just one take.
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync, renameSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.DEMO_PORT || 8781);
const BASE = `http://127.0.0.1:${PORT}`;
const SEED = process.argv[2] || '7';
const OUT = process.argv[3] || 'out/demo';
const RAW = join(OUT, 'raw');
const CONVEX = process.env.CONVEX_URL || 'https://striped-anaconda-746.convex.site';
const W = Number(process.env.DEMO_W || 1280);
const H = Number(process.env.DEMO_H || 720);
const PROMPT = process.env.DEMO_PROMPT || 'a tiny late-night ramen counter';
const ONLY = process.env.ONLY || '';
mkdirSync(RAW, { recursive: true });

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
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: RAW, size: { width: W, height: H } },
});

const errs = [];
let t0 = 0;                       // wall-clock when the page was created — MARK offsets are relative
const marks = [];                 // {name, at} — seconds into the take
function hook(page) {
  t0 = Date.now();
  page.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
}
const mark = (name) => { const at = (Date.now() - t0) / 1000; marks.push({ name, at }); console.log(`MARK ${name} @${at.toFixed(1)}s`); };

const poll = (page) => page.evaluate(() => ({
  top: window.__grunds?.modals?.top?.() || null,
  phase: window.__grunds?.stats?.().phase || null,
  day: window.__grunds?.stats?.().day || 0,
  dayMin: window.__grunds?.stats?.().dayMin || 0,
  queue: window.__grunds?.stats?.().queue || 0,
})).catch(() => null);

const click = (page, sel) => page.$eval(sel, el => el.click()).catch(() => {});
const setSpeed = (page, s) => page.$eval(`#speeds button[data-s="${s}"]`, el => el.click()).catch(() => {});
const dismissMoment = (page) => page.$eval('#moment:not([hidden]) #moment-actions button:last-child', el => el.click()).catch(() => {});

const aim = (page, target, r, theta, phi) => page.evaluate(([t, r, th, p]) => {
  const g = window.__grunds; g.rig.beat = null;
  g.rig.target.set(t[0], t[1], t[2]); g.rig.r = r; g.rig.theta = th; g.rig.phi = p;
}, [target, r, theta, phi]);

const sweep = (page, to, ms) => page.evaluate(async ([to, ms]) => {
  const g = window.__grunds; g.rig.beat = null;
  const t0 = performance.now(), lerp = (a, b, k) => a + (b - a) * k;
  const T = g.rig.target, [fx, fy, fz] = [T.x, T.y, T.z], [fr, ft, fp] = [g.rig.r, g.rig.theta, g.rig.phi];
  await new Promise(done => {
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms), e = k * k * (3 - 2 * k);
      T.set(lerp(fx, to.target[0], e), lerp(fy, to.target[1], e), lerp(fz, to.target[2], e));
      g.rig.r = lerp(fr, to.r, e); g.rig.theta = lerp(ft, to.theta, e); g.rig.phi = lerp(fp, to.phi, e);
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
}, [to, ms]);

// Click through modal layers until the wanted state — handles tutorial,
// licence, softintro, letter, evening (holds the line to keep trading),
// review, planning. Times out soft: returns what it last saw.
async function settle(page, { until = 'brief', max = 60, tick = 1100 } = {}) {
  let st = null;
  for (let i = 0; i < max; i++) {
    st = await poll(page);
    if (st) {
      if (until === 'brief' && (st.top === 'brief' || st.phase === 'trading')) return st;
      if (until === 'trading' && st.phase === 'trading' && !st.top) return st;
      if (until === 'day2' && st.phase === 'trading' && st.day >= 2) return st;
      if (until === 'evening' && st.top === 'evening') return st;
      if (until === 'night' && st.phase === 'trading' && st.dayMin >= 1230) return st;
      if (st.top === 'tutorial') await click(page, '#tskip');
      else if (st.top === 'licence') await click(page, '#lic-sign');
      else if (st.top === 'softintro') await page.evaluate(() => window.__grunds.beginWeek()).catch(() => {});
      else if (st.top === 'letter') await click(page, '#letter-close');
      else if (st.top === 'evening') await click(page, '#evening-close');
      else if (st.phase === 'review') await page.evaluate(() => window.__grunds.continueFromReview()).catch(() => {});
      else if (st.phase === 'planning') await page.evaluate(() => window.__grunds.commitDayPlan()).catch(() => {});
      else if (until === 'day2' && st.phase === 'trading' && st.day < 2)
        await page.evaluate(() => window.__grunds.resolveEvening()).catch(() => {});
      else await dismissMoment(page);
    }
    await page.waitForTimeout(tick);
  }
  return st;
}

const base = (extra = '') => `${BASE}/?skipTutorial&seed=${SEED}&convex=${encodeURIComponent(CONVEX)}&cine=1${extra}`;
const videos = [];

async function take(name, fn) {
  const page = await ctx.newPage();
  hook(page);
  marks.length = 0;
  try { await fn(page); } catch (e) { errs.push(`${name}: ${String(e).slice(0, 300)}`); }
  writeFileSync(join(RAW, `${name}.marks.json`), JSON.stringify(marks, null, 1));
  await page.close();
  const dest = join(RAW, `${name}.webm`);
  try { renameSync(await page.video().path(), dest); } catch {}
  console.log('take', name, '→', dest);
  videos.push(name);
}

try {
  // ---- take 1 · type a stand — it becomes a world -----------------------------
  if (!ONLY || ONLY === 'prompt') await take('01-prompt', async (page) => {
    await page.goto(base(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#prompt-intro:not([hidden])', { timeout: 240000 });
    await page.waitForTimeout(2500);
    mark('intro');
    const input = await page.$('#prompt-intro-input');
    if (input) {
      await input.click({ clickCount: 3 }).catch(() => {});
      await page.keyboard.type(PROMPT, { delay: 55 });
      await page.waitForTimeout(900);
    }
    mark('build');
    await click(page, '#prompt-intro-go');
    await page.waitForURL(u => u.searchParams.has('prompt'), { timeout: 30000 }).catch(() => {});
    mark('building');
    await page.waitForTimeout(12000);        // let the reload visibly start
  });

  // ---- take 2 · the session ----------------------------------------------------
  if (!ONLY || ONLY === 'session') await take('02-session', async (page) => {
    await page.goto(base(`&prompt=${encodeURIComponent(PROMPT)}&world=${encodeURIComponent(PROMPT)}`),
      { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#open:not([disabled]), #resume:not([hidden])', { timeout: 300000 });
    mark('title');
    await page.waitForTimeout(1200);
    const res = await page.$eval('#resume', el => !el.hidden).catch(() => false);
    if (res) await click(page, '#resume'); else await click(page, '#open');
    // licence → sign → brief
    const lic = await page.waitForSelector('#licence.show', { timeout: 30000 }).catch(() => null);
    if (lic) { mark('licence'); await page.waitForTimeout(3500); await click(page, '#lic-sign'); }
    await settle(page, { until: 'brief' });
    mark('brief');
    await page.waitForTimeout(8000);                       // judges read the brief
    await click(page, '#brief-open');
    await settle(page, { until: 'trading', max: 30 });
    // floor — counter, drift to street
    await dismissMoment(page);
    mark('floor');
    await aim(page, [-5.6, 1.1, -5.3], 7.5, 0, 1.15);
    await page.waitForTimeout(3000);
    await sweep(page, { target: [-2, 1.5, 8], r: 16, theta: 0.1, phi: 1.05 }, 8000);
    await page.waitForTimeout(2000);
    // rush — 5× on the queue
    mark('rush');
    await setSpeed(page, 300);
    await dismissMoment(page);
    await aim(page, [-5.6, 1.1, -5.3], 8.5, -0.15, 1.12);
    await page.waitForTimeout(9000);
    // evening — hold the line and let the REAL sky dim (sky.update follows
    // dayMin; a director pin can't reach it, so the day plays into night)
    mark('closing-time');
    await setSpeed(page, 1200);
    await settle(page, { until: 'evening', max: 90 });
    mark('evening-card');
    await page.waitForTimeout(4500);                       // let judges read THE EVENING
    await click(page, '#evening-hold');
    await setSpeed(page, 1200);
    // film the dim: poll dayMin, pull speed to 60 for the take
    for (const [shot, tmin, aimSpec] of [
      ['dusk', 1150, [[0.5, 2.2, 15.0], 22, 0.02, 1.0]],
      ['night', 1235, [[-1, 1.6, 7], 22, 0.1, 1.0]],
    ]) {
      for (let i = 0; i < 120; i++) {
        const st = await poll(page);
        if (!st || st.top === 'evening' || st.phase !== 'trading' || st.dayMin >= tmin) break;
        await page.waitForTimeout(700);
      }
      await setSpeed(page, 60);
      await dismissMoment(page);
      mark(shot);
      await aim(page, ...aimSpec);
      await page.waitForTimeout(9000);
      await setSpeed(page, 1200);
    }
    // day 2 → the wire desk
    await settle(page, { until: 'day2', max: 90 });
    mark('day2');
    const hasWire = await page.$eval('#wirebtn', el => el.style.display !== 'none').catch(() => false);
    if (hasWire) {
      await click(page, '#wirebtn');
      await page.waitForSelector('#desk.show', { timeout: 20000 }).catch(() => {});
      mark('desk');
      await page.waitForTimeout(9000);
      await click(page, '#desk .d-close');
    }
    // the stand your words built — on the Row, day 2
    mark('stand');
    await dismissMoment(page);
    await aim(page, [5.5, 1.3, 15.6], 7.5, 0.15, 1.12);
    await page.waitForTimeout(8000);
  });
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
}
console.log('pageerrors:', errs.length ? errs : 'none');

// ---- assemble ------------------------------------------------------------------
// Cut windows: each MARK holds `hold` seconds unless the next mark cuts it.
if (process.env.NO_FFMPEG) { console.log('NO_FFMPEG — takes + marks in', RAW); process.exit(0); }
const HOLD = { intro: 10, build: 4, building: 6, title: 2, licence: 5, brief: 9, floor: 15, rush: 11, 'closing-time': 2, 'evening-card': 7, dusk: 10, night: 9, day2: 2, desk: 10, stand: 9 };
const CAPTION = {
  intro: 'type a stand — it becomes a world',
  building: 'the district builds it',
  licence: 'sign the week',
  brief: 'the morning brief — your street, shaped by AI',
  floor: 'the floor — the crowd your words pulled',
  rush: 'the rush — five times speed',
  'evening-card': 'the day closes — one call to make',
  dusk: 'dusk over the Row',
  night: 'night on the street you described',
  desk: 'the wire — crawled, read by an LLM, served by Convex',
  stand: 'the stand your words built',
};
const FONT = ['/System/Library/Fonts/Supplemental/Georgia.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'].find(existsSync);

function cutWindows() {
  const segs = [];
  for (const name of videos) {
    const file = join(RAW, `${name}.webm`);
    const mFile = join(RAW, `${name}.marks.json`);
    if (!existsSync(file) || !existsSync(mFile)) continue;
    const ms = JSON.parse(readFileSync(mFile, 'utf8'));
    const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
    ms.forEach((m, i) => {
      const end = Math.min(dur, (ms[i + 1]?.at ?? dur), m.at + (HOLD[m.name] ?? 8));
      if (end - m.at < 1.2 || !(m.name in HOLD)) return;
      segs.push({ file, name: m.name, from: m.at, to: end });
    });
  }
  return segs;
}

const segs = cutWindows();
console.log('cuts:', segs.map(s => `${s.name} ${s.from.toFixed(1)}–${s.to.toFixed(1)}`).join(' · '));
const out = join(OUT, 'demo.mp4');
try {
  const inputs = segs.flatMap((s, i) => ['-ss', String(s.from), '-to', String(s.to), '-i', s.file]);
  const parts = segs.map((s, i) => {
    const cap = (CAPTION[s.name] || '').replace(/[':]/g, ' ');
    const dt = FONT ? `drawtext=fontfile='${FONT}':text='${cap}':fontsize=26:fontcolor=0xEFE6D3@0.85:shadowcolor=black@0.6:shadowx=1:shadowy=1:x=36:y=h-54:enable='between(t,0.3,${Math.min(7, s.to - s.from - 0.5).toFixed(1)})'` : 'null';
    return `[${i}:v]${dt},scale=${W}:${H},setsar=1[v${i}]`;
  });
  const filter = parts.join(';') + ';' + segs.map((_, i) => `[v${i}]`).join('') + `concat=n=${segs.length}:v=1:a=0[v]`;
  execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('video →', out);
} catch (e) {
  console.log('assemble failed — takes still in', RAW, String(e).slice(0, 400));
}
