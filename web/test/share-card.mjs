// Headless test for Feature 4 — the stamped-print share card.
// shareCard.js draws on an injected 2D context, so a recording stub sees
// the whole composition: paper before pixels, pixels before the band, the
// rotated red stamp last. Plus the capture-rule and wiring regexes that
// keep doPhoto honest (postfx.render BEFORE the drawImage, seeded filename,
// the three share actions each degrading on their own).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (p) => readFileSync(join(ROOT, ...p.split('/')), 'utf8');

const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }

// recording 2D context — every call logs [method, fillStyle, strokeStyle, font, ...args]
function recCtx(w, h) {
  const ctx = { canvas: { width: w, height: h }, calls: [], fillStyle: '', strokeStyle: '', font: '', lineWidth: 0, textAlign: '', textBaseline: '' };
  for (const m of ['fillRect', 'strokeRect', 'beginPath', 'arc', 'fill', 'stroke', 'rect', 'clip', 'save', 'restore', 'translate', 'rotate', 'fillText', 'drawImage']) {
    ctx[m] = (...a) => { ctx.calls.push([m, ctx.fillStyle, ctx.strokeStyle, ctx.font, ...a]); };
  }
  return ctx;
}
const idx = (ctx, pred) => ctx.calls.findIndex((c) => pred(c));

const { cardLayout, captionLine, buildShareCard, CARD_W, CARD_H } = await import('../js/shareCard.js');
const { BASE_URL } = await import('../js/share.js');

// ============================================================
// 1) cardLayout — pure geometry
// ============================================================
{
  const L = cardLayout(CARD_W, CARD_H);
  check('layout at 1280×720', L.snap.w > 1100 && L.band > 100 && L.pad > 20 && L.pad < 40, JSON.stringify(L));
  check('snapshot sits inside the frame', L.snap.x > L.frame.x && L.snap.y > L.frame.y
    && L.snap.x + L.snap.w <= L.frame.x + L.frame.w && L.snap.y + L.snap.h <= L.frame.y + L.frame.h + 1);
  check('band below the snapshot, inside the frame', L.bandRect.y >= L.snap.y + L.snap.h
    && L.bandRect.y + L.bandRect.h <= CARD_H, `${L.bandRect.y}+${L.bandRect.h}`);
  check('stamp centred in the band, right of the text', L.stamp.cy > L.bandRect.y && L.stamp.cy < L.bandRect.y + L.bandRect.h
    && L.stamp.cx > CARD_W * 0.6, JSON.stringify(L.stamp));
  check('four brass corners', L.corners.length === 4);
  const S = cardLayout(640, 360);
  check('layout scales sanely', S.snap.w > 500 && S.snap.w < 640 && S.band > 50 && S.stamp.cy > S.bandRect.y, JSON.stringify({ w: S.snap.w, b: S.band }));
}

// ============================================================
// 2) captionLine
// ============================================================
{
  const cap = captionLine({ day: 3, seed: 7, stats: { till: 142.7, rep: 66.4, served: 312, balked: 18 } });
  check('caption carries the run', /Day 3\/5/.test(cap) && /£143/.test(cap) && /rep 66\/100/.test(cap)
    && /312 served/.test(cap) && /18 walked/.test(cap) && /seed 7/.test(cap), cap);
  const b = captionLine({ day: 5, seed: 7, stats: { served: 1200, balked: 4, till: 900, rep: 80 }, badge: { icon: '☕', title: 'Master Roaster' } });
  check('badge leads the caption', b.startsWith('☕ Master Roaster — '), b);
  check('missing stats never print NaN', !/NaN/.test(captionLine({ day: 1, seed: 2 })), captionLine({ day: 1, seed: 2 }));
}

// ============================================================
// 3) buildShareCard — the composition, call by call
// ============================================================
{
  let seedRng = 1;
  const rng = () => { seedRng = (seedRng * 1103515245 + 12345) % 2147483648; return seedRng / 2147483648; };
  const ctx = recCtx(CARD_W, CARD_H);
  const snapshot = { width: 1208, height: 562 };
  buildShareCard(ctx, {
    snapshot, seed: 7, day: 4, rng,
    badge: { icon: '⚖️', title: 'Debt Free' },
    stats: { till: 210, rep: 71, served: 540, balked: 20 },
  });
  const calls = ctx.calls;
  check('paper is the first paint', calls[0][0] === 'fillRect' && calls[0][1] === '#efe6d3', JSON.stringify(calls[0]));
  const grain = calls.filter(c => c[0] === 'fillRect' && c[1] === 'rgba(0,0,0,.035)');
  check('linen grain bakes 1600 specks', grain.length === 1600, String(grain.length));
  check('grain consumes the injected rng', (() => {
    let s = 1; const next = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const x0 = next() * CARD_W, y0 = next() * CARD_H;
    return Math.abs(grain[0][4] - x0) < 1e-9 && Math.abs(grain[0][5] - y0) < 1e-9;
  })(), 'grain not rng-driven');
  const iSnap = idx(ctx, c => c[0] === 'drawImage');
  const iBand = idx(ctx, c => c[0] === 'fillRect' && c[1] === 'rgba(23,19,16,.86)');
  check('snapshot painted BEFORE the band', iSnap > 0 && iBand > iSnap, `snap=${iSnap} band=${iBand}`);
  const iClip = idx(ctx, c => c[0] === 'clip');
  check('cover-crop clips the snapshot', iClip > 0 && iClip < iSnap && calls[iSnap][7] >= 1208 - 1, `clip=${iClip} dw=${calls[iSnap][7]}`);
  const texts = calls.filter(c => c[0] === 'fillText').map(c => c[4]);
  check('band speaks the run', texts.some(t => /GRUNDS — THE DISTRICT/.test(t))
    && texts.some(t => /⚖️ Debt Free/.test(t)) && texts.some(t => /Day 4\/5/.test(t)), texts.join('|'));
  check('URL invites the judge to the same seed', texts.some(t => t === BASE_URL + '?seed=7'), texts.join('|'));
  const iStampText = idx(ctx, c => c[0] === 'fillText' && /GRUNDS · SEED 7/.test(c[4]));
  const iRotate = idx(ctx, c => c[0] === 'rotate');
  const iStampRestore = ctx.calls.map(c => c[0]).lastIndexOf('restore');   // the crop restores first
  check('rubber stamp: rotated red, then undone', iRotate > iBand && iStampText > iRotate
    && (() => { const iRed = idx(ctx, c => c[0] === 'fillRect' && c[1] === 'rgba(208,64,58,.92)'); return iRed > iRotate && iRed < iStampRestore; })(),
    `rot=${iRotate} stamp=${iStampText} restore=${iStampRestore}`);
  check('stamp block closes its save/restore', iStampRestore > iStampText);
  check('no NaN in any printed text', !texts.some(t => String(t).includes('NaN')), texts.filter(t => String(t).includes('NaN')).join('|'));
}

// ============================================================
// 4) doPhoto wiring — capture rule, filename, three actions
// ============================================================
{
  const mainSrc = src('web/js/main.js');
  const fn = mainSrc.split('function doPhoto()')[1]?.split('// Konami')[0] || '';
  check('doPhoto exists', fn.length > 500, `${fn.length} chars`);
  const iRender = fn.indexOf('postfx.render(');
  const iDraw = fn.indexOf('.drawImage(');
  const iOld = fn.indexOf('renderer.render(scene');
  check('capture rule: postfx.render BEFORE drawImage', iRender >= 0 && iDraw > iRender, `render=${iRender} draw=${iDraw}`);
  check('raw renderer.render no longer cuts in', iOld === -1, 'still bypasses postfx');
  check('seeded filename', /grunds-day\$\{day \+ 1\}-seed\$\{SEED\}\.png/.test(fn), 'no seed in name');
  check('save / share / copy all wired', /pc-save/.test(fn) && /pc-share/.test(fn) && /pc-copy/.test(fn));
  check('Web Share Level 2 with X fallback', /navigator\.canShare\(\{ files:/.test(fn) && /openShareToX\(shareData\)/.test(fn));
  check('a cancelled share sheet is an answer, not a failure', /AbortError/.test(fn));
  check('copy degrades on its own', /clipboard\.writeText\(caption\)/.test(fn));
  check('dim persists until an action or 6 s', /setTimeout\(finish, 6000\)/.test(fn) && /row\.classList\.add\('show'\)/.test(fn));
  const html = src('web/index.html');
  check('index.html carries the action row', /id="photo-actions"/.test(html) && /#photo-actions\.show/.test(html)
    && /id="pc-save"/.test(html) && /id="pc-share"/.test(html) && /id="pc-copy"/.test(html));
}

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — share card: paper, pixels, band, stamp — and the photo row can hand it to the world');
