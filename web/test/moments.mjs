// In-day moments + quiet auto-pace — headless drive of the real triggers:
// returning regular, regular at the counter, line building, Sam defection,
// once-per-day, priority order, 45-minute expiry, greet wiring, no pauses,
// and pace-on/off economic identity.
// Run: node web/test/moments.mjs   (from the repo root)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ECON } from '../js/config.js';
import { CAST_PROFILES } from '../js/cast.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schedule = JSON.parse(readFileSync(join(ROOT, 'out', 'wave_schedule.json'), 'utf8'));
function deepText(el) {
  if (!el) return '';
  let t = el.textContent || '';
  for (const c of el.children || []) t += deepText(c);
  return t;
}

const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => {
    if (k === Symbol.toPrimitive) return hint => hint === 'string' ? 'WebGL 2.0' : 1;
    if (k === 'then') return undefined;
    return anyProxy();
  },
  set: () => true,
  apply: () => anyProxy(),
});

function makeEl(tag = 'div') {
  const el = {
    tag, tagName: String(tag).toUpperCase(), children: [], style: {}, dataset: {}, innerHTML: '',
    disabled: false, offsetWidth: 10, value: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = el; el.children.push(c); return c; },
    append(...cs) { for (const c of cs) el.appendChild(typeof c === 'string' ? { tagName: '#text', textContent: c, children: [] } : c); },
    replaceChildren(...cs) { el.children.length = 0; el.append(...cs); },
    prepend(c) { c._parent = el; el.children.unshift(c); },
    remove() { const pr = el._parent; if (pr) { const i = pr.children.indexOf(el); if (i >= 0) pr.children.splice(i, 1); } },
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {},
    setAttribute(k, v) { (el._attrs = el._attrs || {})[k] = String(v); },
    getAttribute(k) { return el._attrs && el._attrs[k]; },
    hasAttribute(k) { return !!(el._attrs && k in el._attrs); },
    removeAttribute(k) { if (el._attrs) delete el._attrs[k]; },
    matches() { return false; },
    getContext: () => anyProxy(),
    focus() {},
    get lastChild() { return el.children[el.children.length - 1] || null; },
    click() { el.onclick && el.onclick(); },
    onclick: null,
  };
  let text = '';
  Object.defineProperty(el, 'textContent', { enumerable: true, get: () => text, set: v => { text = String(v ?? ''); el.children.length = 0; } });
  return el;
}
const registry = new Map();
const canvasStub = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });

globalThis.document = {
  getElementById: id => { if (!registry.has(id)) registry.set(id, makeEl()); return registry.get(id); },
  createElement: tag => tag === 'canvas' ? canvasStub() : makeEl(tag),
  createElementNS: () => canvasStub(),
  querySelectorAll: () => [],
  body: makeEl('body'),
};
globalThis.window = globalThis;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
globalThis.devicePixelRatio = 1;
globalThis.location = { search: '?speed=300' };
globalThis.addEventListener = () => {};
let rafCb = null;
globalThis.requestAnimationFrame = cb => { rafCb = cb; };
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
class AudioContextStub {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  createBufferSource() { return { buffer: null, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  resume() {}
}
globalThis.AudioContext = AudioContextStub;
globalThis.__headless = true;
let _rs = 424242;
const lcg = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
Math.random = lcg;
const _w = console.warn, _e = console.error;
console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };
console.error = (...a) => { if (!String(a[0]).startsWith('THREE.')) _e(...a); };

let now = 1000, frameCount = 0;
function runFrames(n) {
  for (let f = 0; f < n; f++) {
    now += 100; frameCount++;
    const cb = rafCb; rafCb = null;
    if (!cb) throw new Error('loop stopped');
    cb(now);
    const off = registry.get('offer');
    if (off && off.classList.contains('show')) registry.get('offer-no').click();
  }
}
const runTo = (min, cap = 1400) => { let g = 0; while (G.phase === 'trading' && G.stats().dayMin < min && g++ < cap) runFrames(1); };

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;
const fails = [];
const near = (a, b, eps = 0.001) => Math.abs(a - b) < eps;
const momentEl = () => registry.get('moment');
const momentBody = () => deepText(registry.get('moment-body'));
const momentButtons = () => (registry.get('moment-actions').children || []).filter(c => c.tagName === 'BUTTON');
const clickBtn = label => {
  const b = momentButtons().find(x => x.textContent === label || x.textContent.startsWith(label));
  if (!b) return false;
  b.click();
  return true;
};
const momentVisible = () => momentEl() && momentEl().hidden === false;

// boot → day-1 planning → trading, moments + pace enabled
registry.get('open').click();
await new Promise(r => setTimeout(r, 10));
G.testState({ moments: true, pace: true, openingGuidance: false });
if (!G.stageDayPlan({ hedge: 'hold' })) fails.push('day-1 staging rejected');
if (!G.commitDayPlan().ok) fails.push('day-1 commit failed');
if (G.phase !== 'trading') fails.push(`expected trading, got ${G.phase}`);

// ---- pace: quiet dawn runs faster than the clock --------------------------
// moments off for the measurement so a card can't gate the quiet window;
// a fast bar keeps the queue under the quiet threshold.
{
  G.testState({ moments: false });
  G.patrons.staffMul = 8;
  runFrames(3);   // flush any modal that paused the clock on boot frames
  const startMin = G.stats().dayMin;
  const f0 = frameCount;
  runFrames(4);   // ~400ms wall at quiet 20× ≈ 100+ game-minutes
  const quietTicks = G.stats().dayMin - startMin;
  const quietFrames = frameCount - f0;
  if (quietTicks <= 0) fails.push('no ticks advanced during quiet morning');
  if (registry.get('paceflag').hidden !== false) fails.push('paceflag never showed during the quiet morning');
  G.testState({ moments: true });
  G.moment.block('line');   // keep the morning line card from outranking the counter moment
  globalThis.__quietRate = quietTicks / quietFrames;
}

// ---- moment 2: regular at the counter -------------------------------------
// staffMul stays high so the line moment can't outrank it this morning.
{
  let tries = 0;
  while (G.phase === 'trading' && G.stats().dayMin < 628 && G.moment.active() !== 'counter' && tries++ < 900) { runFrames(1); }
  if (G.moment.active() !== 'counter') fails.push(`counter moment never fired (dayMin ${G.stats().dayMin}, active ${G.moment.active()}, pending ${JSON.stringify(G.moment.pending())}, done ${G.moment.done()}, coachHidden ${registry.get('coach').hidden}, seenQ ${G.patrons.counterQ.filter(p => p.regularIdx >= 0).length})`);
  else {
    const txt = momentBody();
    const m = txt.match(/^(\w+) is at the counter\. (.*)$/s);
    if (!m) fails.push(`counter moment copy wrong: "${txt}"`);
    else {
      const name = m[1];
      if (!CAST_PROFILES[name]) fails.push(`counter moment named a non-cast regular: ${name}`);
      else if (m[2] !== CAST_PROFILES[name].wants) fails.push(`counter wants line wrong: "${m[2]}" vs "${CAST_PROFILES[name].wants}"`);
      const r = G.reg.regulars.find(x => x.name === name);
      const opBefore = r ? r.op : null;
      if (!clickBtn('Say hello')) fails.push('counter moment missing Say hello');
      else {
        const opAfter = r ? r.op : null;
        if (opBefore == null || !near(opAfter, Math.min(1, opBefore + 0.06))) fails.push(`Say hello op delta wrong: ${opBefore} -> ${opAfter}`);
        if (momentVisible()) fails.push('moment did not hide after Say hello');
        if (G.paused) fails.push('moment action paused the clock');
      }
      // once per day: a second present regular must not re-fire it
      let more = 0;
      while (G.phase === 'trading' && G.stats().dayMin < 620 && more++ < 400 && G.moment.active() === null) runFrames(1);
      if (G.moment.active() === 'counter') fails.push('counter moment fired twice in one day');
    }
  }
}

// ---- busy-window pace check: a queued moment closes the quiet gate --------
// The line card is the long-queue decision point — once pending or visible it
// keeps the clock at base rate.
{
  runTo(725);
  G.moment.unblock('line');
  G.patrons.staffMul = 0.02;
  let tries = 0;
  while (G.phase === 'trading' && !G.moment.pending().some(m => m.type === 'line') && G.moment.active() !== 'line' && G.stats().dayMin < 838 && tries++ < 900) runFrames(1);
  if (!G.moment.pending().some(m => m.type === 'line') && G.moment.active() !== 'line')
    fails.push(`line moment never queued for the busy-window check (queue ${G.stats().queue}, dayMin ${G.stats().dayMin})`);
  const busyMin = G.stats().dayMin;
  runFrames(4);
  const busyRate = (G.stats().dayMin - busyMin) / 4;
  if (!(globalThis.__quietRate > busyRate))
    fails.push(`quiet pace did not out-tick the moment-gated window (${globalThis.__quietRate} vs ${busyRate})`);
  if (registry.get('paceflag').hidden === false)
    fails.push('paceflag stayed on while a line moment was pending/visible');
  if (momentVisible()) clickBtn('Ride it out');
  G.patrons.staffMul = 1;
}

// close out the day → day 2 (Mara walked out day 1 → away → returning day 3)
G.reg.noteWalkout(0, { day: 1, outcome: 'balked' });
runTo(1261, 2400);
if (G.phase !== 'review') fails.push(`day 1 did not close, phase ${G.phase}`);
for (let d = 2; d <= 2; d++) {
  if (!G.continueFromReview()) fails.push('day-2 continue rejected');
  G.stageDayPlan({ hedge: 'hold' });
  if (!G.stageCellar({ lot: 'cerrado', topup: 'restock' })) fails.push('day-2 cellar staging rejected');
  if (!G.commitDayPlan().ok) fails.push('day-2 commit failed');
  if (G.reg.regulars[0].absence !== 'away') fails.push(`Mara should be away day 2, got ${G.reg.regulars[0].absence}`);
  runTo(1261, 2400);
}
if (!G.continueFromReview()) fails.push('day-3 continue rejected');
if (G.reg.regulars[0].absence !== 'returning') fails.push(`Mara should be returning day 3, got ${G.reg.regulars[0].absence}`);

// ---- day 3: priority + pending expiry --------------------------------------
// coach card busy → moments queue. Stack returning (1), sam (4), line (3).
{
  G.stageDayPlan({ hedge: 'hold' });
  G.stageCellar({ lot: 'cerrado', topup: 'restock' });
  if (!G.commitDayPlan().ok) fails.push('day-3 commit failed');
  const coachEl = registry.get('coach');
  coachEl.hidden = false;   // hold the corner — moments queue instead of showing
  const pending = () => G.moment.pending();
  const hasPend = (t, since = -1) => pending().some(m => m.type === t && m.at >= since);
  // pending TTL is 45 game-minutes, so the triggers have to land close
  // together: hold the line card, wait out the returning regular's arrival,
  // then force the defect and release the line inside the same window.
  G.moment.block('line');
  G.patrons.staffMul = 0.02;
  let tries = 0;
  while (G.phase === 'trading' && G.stats().dayMin < 780 && !hasPend('returning') && tries++ < 2400) runFrames(1);
  const retAt = (pending().find(m => m.type === 'returning') || {}).at ?? G.stats().dayMin;
  const doneNow = new Set(G.moment.done());
  const samR = G.reg.regulars.find(r => r.name !== 'Mara' && !doneNow.has(`sam:${r.name}`));
  if (!samR) fails.push('no non-Mara roster regular for the sam defection');
  else {
    samR.seen = false; samR._spawned = false; samR.absence = 'present';
    if (!G.patrons.free.length) {
      const drop = G.patrons.counterQ.find(x => x.regularIdx < 0);
      if (drop) { G.patrons.counterQ.splice(G.patrons.counterQ.indexOf(drop), 1); G.patrons._despawn(drop); }
    }
    const oldOnly = G.patrons.markSeenOnly, oldTruce = G.patrons.truceCeasefire;
    let samP = null;
    try {
      G.patrons.markSeenOnly = new Set([samR.name]); G.patrons.truceCeasefire = true;
      samP = G.patrons.spawn(samR.coh, 'counter', true);
    } finally {
      G.patrons.markSeenOnly = oldOnly; G.patrons.truceCeasefire = oldTruce;
    }
    if (!samP || samP.regularIdx < 0) fails.push('sam defector spawn did not attach the roster regular');
    else {
      samP.drink = 'matcha'; samP.wantsMatcha = true; samP.state = 'inQueue'; samP.queueRef = 'counter'; samP.waitMin = 99;
      if (!G.patrons.counterQ.includes(samP)) G.patrons.counterQ.push(samP);
      // the mass stall can fill Sam's queue to the defect cap — keep some room
      while (G.patrons.rivalQ.length > 38) G.patrons.rivalQ.splice(0, 8);
      const oldCap = G.patrons.capacityMult, oldRand = G.patrons.random, realRand = Math.random;
      try {
        G.patrons.capacityMult = 0; Math.random = () => 0.01; G.patrons.random = () => 0.01;
        runFrames(1);
      } finally {
        G.patrons.capacityMult = oldCap; Math.random = realRand; G.patrons.random = oldRand;
      }
      tries = 0;
      while (G.phase === 'trading' && !hasPend('sam', retAt - 1) && tries++ < 30) runFrames(1);
    }
  }
  G.moment.unblock('line');
  tries = 0;
  while (G.phase === 'trading' && G.stats().dayMin < 839 && !hasPend('line', retAt - 1) && tries++ < 600) runFrames(1);
  if (!['returning', 'sam', 'line'].every(t => hasPend(t, retAt - 1)))
    fails.push(`day-3 stack incomplete (pending ${JSON.stringify(pending())}, queue ${G.stats().queue}, dayMin ${G.stats().dayMin}, retAt ${retAt})`);
  G.patrons.staffMul = 1;
  coachEl.hidden = true;
  const seen = [];
  for (let i = 0; i < 10 && !seen.includes('line'); i++) {
    let t2 = 0;
    while (G.phase === 'trading' && !momentVisible() && t2++ < 60) runFrames(1);
    if (!momentVisible()) break;
    const type = G.moment.active();
    seen.push(type);
    if (type === 'returning') {
      const rm = momentBody().match(/^(\w+) is back\. Giving you another chance after (walking out yesterday|trying Glasshouse|a rough patch)\.$/);
      const rr = rm && G.reg.regulars.find(x => x.name === rm[1]);
      const lastWalk = rr && [...(rr.events || [])].reverse().find(e => e.outcome === 'balked' || e.outcome === 'defected');
      const whyOk = rm && (rm[2] === 'a rough patch' ? !lastWalk
        : rm[2] === 'walking out yesterday' ? lastWalk && (lastWalk.outcome === 'balked' || lastWalk.outcome === 'defected')
        : lastWalk && lastWalk.outcome === 'defected');
      if (!rm || !rr || rr.absence !== 'returning' || !whyOk)
        fails.push(`returning moment copy wrong: "${momentBody()}"`);
    }
    if (type === 'sam') {
      const sm = momentBody().match(/^(\w+) crossed to Glasshouse\. Sam’s line was shorter\.$/);
      if (!sm || !G.reg.regulars.some(r => r.name === sm[1])) fails.push(`sam moment copy wrong: "${momentBody()}"`);
    }
    if (type === 'line') {
      const lt = momentBody();
      if (!/^The line is getting long\. \d+ waiting — people may leave once it passes five\.$/.test(lt))
        fails.push(`day-3 line copy wrong: "${lt}"`);
      const cut = momentButtons().find(x => x.textContent.startsWith('Cut matcha to '));
      if (cut) {
        const tillBefore = G.stats().till;
        const m = cut.textContent.match(/· £([\d.]+) \+ regulars lose warmth/);
        const expectCost = m ? +m[1] : 0;
        cut.click();
        if (!G.patrons.repriced) fails.push('day-3 line cut did not call doReprice');
        if (Math.abs((tillBefore - G.stats().till) - expectCost) > 0.01)
          fails.push(`day-3 reprice charge ${tillBefore - G.stats().till} != label cost ${expectCost}`);
        continue;
      }
    }
    clickBtn('Leave it') || clickBtn('Got it') || clickBtn('Ride it out') || clickBtn('Say hello');
  }
  if (seen[0] !== 'returning') fails.push(`priority: expected returning first, got ${seen[0]}`);
  if (seen[1] !== 'sam') fails.push(`priority: expected sam second, got ${seen[1]}`);
  const li = seen.indexOf('line');
  if (li < 2 || !seen.slice(1, li).every(s => s === 'sam')) fails.push(`priority: line should follow returning+sam(s), got ${seen.join(',')}`);
  if (momentVisible()) fails.push('a moment stayed visible after its button');

  // drain: dismiss everything still queued so later days start clean
  for (let i = 0; i < 20; i++) {
    let t2 = 0;
    while (G.phase === 'trading' && !momentVisible() && t2++ < 60) runFrames(1);
    if (!momentVisible()) break;
    clickBtn('Leave it') || clickBtn('Got it') || clickBtn('Ride it out') || clickBtn('Say hello');
  }
}
runTo(1261, 2400);
if (G.phase !== 'review') fails.push(`day 3 did not close, phase ${G.phase}`);

// ---- day 4: active expiry — a shown card auto-hides after 45 game-min ------
{
  if (!G.continueFromReview()) fails.push('day-4 continue rejected');
  G.stageDayPlan({ hedge: 'hold' });
  G.stageCellar({ lot: 'cerrado', topup: 'restock' });
  if (!G.commitDayPlan().ok) fails.push('day-4 commit failed');
  G.patrons.staffMul = 0.02;
  let tries = 0;
  while (G.phase === 'trading' && G.moment.active() !== 'line' && tries++ < 1200) runFrames(1);
  if (G.moment.active() !== 'line') fails.push('day-4 line moment never fired for the expiry check');
  else {
    const shownMin = G.stats().dayMin;
    let g = 0;
    while (G.phase === 'trading' && G.stats().dayMin - shownMin < 46 && g++ < 300) runFrames(1);
    if (momentVisible()) fails.push('moment did not auto-hide after 45 game-minutes');
  }
  G.patrons.staffMul = 1;
  runTo(1261, 2400);
  if (G.phase !== 'review') fails.push(`day 4 did not close, phase ${G.phase}`);
}

// ---- day 5: pending expiry — a card queued under a busy coach dies unshown --
{
  if (!G.continueFromReview()) fails.push('day-5 continue rejected');
  G.stageDayPlan({ hedge: 'hold' });
  G.stageCellar({ lot: 'cerrado', topup: 'restock' });
  if (!G.commitDayPlan().ok) fails.push('day-5 commit failed');
  const coachEl = registry.get('coach');
  coachEl.hidden = false;   // hold the corner
  G.patrons.staffMul = 0.02;
  let tries = 0;
  while (G.phase === 'trading' && !G.moment.pending().some(m => m.type === 'line') && tries++ < 1200) runFrames(1);
  if (!G.moment.pending().some(m => m.type === 'line')) fails.push('day-5 line moment never queued behind the coach card');
  else {
    const at = G.stats().dayMin;
    let g = 0;
    while (G.phase === 'trading' && G.stats().dayMin - at < 46 && g++ < 300) runFrames(1);
    coachEl.hidden = true;
    runFrames(10);
    if (G.moment.active() === 'line' || G.moment.pending().some(m => m.type === 'line'))
      fails.push('an expired pending line moment still surfaced after 45 game-minutes');
  }
  G.patrons.staffMul = 1;
}

// ---- pace identity: same day, same seed, pace on vs off --------------------
async function runDay1(withPace) {
  _rs = 424242;                    // reseed before reset() consumes its own draws
  Math.random = lcg;
  G.reset();
  await new Promise(r => setTimeout(r, 5400));
  Math.random = () => 0.1;         // constant stream → frame-rate-independent draws
  G.patrons.random = () => 0.1;
  if (G.phase !== 'planning') fails.push(`identity run expected planning after reset, got ${G.phase}`);
  G.testState({ moments: false, pace: withPace, moveTick: true, openingGuidance: false });
  G.stageDayPlan({ hedge: 'hold' });
  const c = G.commitDayPlan();
  if (!c.ok) fails.push(`identity run (${withPace ? 'pace' : 'base'}) commit failed`);
  const f0 = frameCount;
  let guard = 0;
  while (G.phase === 'trading' && guard++ < 3000) runFrames(1);
  const frames = frameCount - f0;
  const s = G.stats(), rc = G.lastDayReceipt;
  return { frames, served: s.served, balked: s.balked, till: s.till, netToday: rc ? rc.netToday : null, dayMin: s.dayMin };
}
const on = await runDay1(true);
const off = await runDay1(false);
if (on.served !== off.served || on.balked !== off.balked || Math.abs(on.till - off.till) > 1e-9 || Math.abs((on.netToday || 0) - (off.netToday || 0)) > 1e-9)
  fails.push(`pace changed the day: on=${JSON.stringify(on)} off=${JSON.stringify(off)}`);
if (!(on.frames <= off.frames)) fails.push(`pace-on used more frames (${on.frames}) than pace-off (${off.frames})`);

Math.random = lcg;

if (fails.length) { console.error('moments FAIL:'); for (const f of fails) console.error(' -', f); process.exit(1); }
console.log(`moments: all pass (${fails.length} fails)`);
