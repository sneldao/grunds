// V0 replay gate: a campaign is a pure function of seed + player inputs.
//
// Each run is a fresh Node process that imports the real main.js headless
// (same stub harness as balance-policies.mjs: a parameterized frame clock —
// 100ms by default, driven differently in the frame-invariance test — fixed
// performance.now / Date.now, UI timers disabled) and plays the full
// CAMPAIGN.days week with one fixed script of inputs: menu prices, pastry
// cut, cellar restock, a day-1 light contract, the prep/reprice levers at
// fixed queue thresholds, every offer declined.
//
// The input script is evaluated once per sim tick, not per frame: lever
// conditions like 'queue >= 6' are functions of sim state, so polling them
// per frame would make the script itself frame-rate dependent — a 37ms
// clock would click the batch lever on different sim-minutes than a 100ms
// clock. Modal dismissals are the exception and stay in the frame pump,
// gated on paused: a modal freezes the sim clock, so clicking it at any
// frame is the same input at the same frozen sim-minute.
//
// Math.random is never seeded here. While the module boots it returns a
// throwaway cosmetic stream whose seed differs between the two same-seed
// runs (so boot-time cosmetic noise provably cannot leak into the sim).
// From the moment the player opens the day it THROWS — and records the
// caller, because main.js wraps many paths in try/catch that would swallow
// a bare throw. The only caller allowed through is three.js's
// MathUtils.generateUUID (Object3D ids for meshes spawned mid-day); it gets
// the same varying cosmetic stream, so object ids cannot steer the sim either.
//
// Covered: the whole main.js day loop (tick → patrons.step/tick, exchange
// dawn/events, demand, regulars, walk-ins, street demand, floor coin-tosses,
// FX bubbles, closeDay ledger, week continuation) plus frame-rate invariance
// — the same campaign is replayed under 100ms, 50ms and 37ms frame clocks
// and must produce identical outcomes. Not covered: save/resume across a
// reload, Convex sync, Tripo/GLB asset loads, Linkup and any network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);

function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

async function child(seed, cosmeticSeed, frameMs = 100) {
  const { CAMPAIGN } = await import('../js/config.js');
  const schedule = JSON.parse(readFileSync(new URL('../../out/wave_schedule.json', import.meta.url), 'utf8'));
  const out = process.stdout.write.bind(process.stdout);
  console.log = console.debug = console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  globalThis.setTimeout = () => 0;
  globalThis.setInterval = () => 0;
  const proxy = () => new Proxy(function () {}, {
    get: (_, k) => k === Symbol.toPrimitive ? hint => hint === 'string' ? 'WebGL 2.0' : 1 : k === 'then' ? undefined : proxy(),
    set: () => true, apply: () => proxy(),
  });
  function element(tag = 'div', id = '') {
    let text = '', html = '';
    const e = {
      tagName: tag.toUpperCase(), id, children: [], style: {}, dataset: {}, attrs: {}, disabled: false, value: '', offsetWidth: 10, isConnected: true,
      classList: { values: new Set(), add(c) { this.values.add(c); }, remove(c) { this.values.delete(c); }, contains(c) { return this.values.has(c); }, toggle(c, yes) { yes ? this.values.add(c) : this.values.delete(c); } },
      appendChild(c) { c.parentElement = e; e.children.push(c); return c; },
      append(...cs) { cs.forEach(c => typeof c === 'object' && e.appendChild(c)); },
      prepend(c) { c.parentElement = e; e.children.unshift(c); },
      remove() { e.isConnected = false; if (e.parentElement) e.parentElement.children = e.parentElement.children.filter(c => c !== e); },
      querySelector: () => element(), querySelectorAll: () => [], addEventListener() {},
      setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute(k) { return e.attrs[k]; }, hasAttribute(k) { return k in e.attrs; }, removeAttribute(k) { delete e.attrs[k]; },
      focus() { document.activeElement = e; },
      click() { if (!e.disabled && e.onclick) return e.onclick(); },
      get lastChild() { return e.children.at(-1) || null; },
      get textContent() { return text; }, set textContent(v) { text = String(v); e.children = []; },
      get innerHTML() { return html; }, set innerHTML(v) { html = String(v); e.children = []; },
    };
    return e;
  }
  class AudioStub {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
    createGain() { return proxy(); }
    createOscillator() { return proxy(); }
    createBiquadFilter() { return proxy(); }
    createBufferSource() { return proxy(); }
    createBuffer(_, length) { return { getChannelData: () => new Float32Array(length) }; }
    resume() {}
  }
  const registry = new Map();
  let raf = null, now = 0;
  globalThis.performance = { now: () => now };
  Date.now = () => 1790000000000 + now;
  const cosmetic = lcg(cosmeticSeed);
  Math.random = cosmetic;   // boot only: textures, mist, stars, ticker grain
  const canvas = () => ({ ...element('canvas'), width: 480, height: 72, getContext: () => proxy() });
  globalThis.document = {
    body: element('body'), activeElement: null,
    getElementById(id) { if (!registry.has(id)) registry.set(id, element('div', id)); return registry.get(id); },
    createElement: tag => tag === 'canvas' ? canvas() : element(tag), createElementNS: () => canvas(), querySelectorAll: () => [],
  };
  Object.assign(globalThis, {
    window: globalThis, __headless: true, innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
    location: { search: `?speed=1200&seed=${seed}`, hostname: 'localhost', origin: 'http://localhost' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {}, requestAnimationFrame: cb => { raf = cb; },
    fetch: async () => ({ ok: true, json: async () => schedule }), AudioContext: AudioStub,
  });
  await import('../js/main.js');
  await new Promise(resolve => setImmediate(resolve));
  const game = globalThis.__grunds;

  // Levers fire once per sim tick — see the header note. patrons.tick only
  // runs while trading and unpaused, which is exactly when lever presses
  // are legal inputs anyway. We call doPrebatch/doReprice directly rather
  // than clicking the DOM buttons: the buttons' disabled flag is refreshed
  // per frame in updateHUD, so it lags sim state by up to a frame — a lag
  // that differs by frame clock and would re-couple the script to RAF.
  // The lever functions re-check availability against live sim state
  // themselves, so calling them is frame-rate safe.
  const origPatronsTick = game.patrons.tick.bind(game.patrons);
  game.patrons.tick = (dm, c) => {
    const ev = origPatronsTick(dm, c);
    if (!game.paused) {
      const s = game.stats();
      if (s.queue >= 6 && s.dayMin < 960) game.doPrebatch();
      if (s.queue >= 12 && s.dayMin >= 800) game.doReprice();
    }
    return ev;
  };

  // From here on the sim path owns the clock: bare Math.random is a bug.
  const strays = new Map();
  let uuidDraws = 0;
  Math.random = function sentinel() {
    const stack = new Error().stack || '';
    if (/generateUUID/.test(stack)) { uuidDraws++; return cosmetic(); }
    const where = stack.split('\n').slice(2, 5).map(l => l.trim().replace(/^at /, '').replace(/\?[^:)]*/, '')).join(' <- ');
    strays.set(where, (strays.get(where) || 0) + 1);
    throw new Error('Math.random called on the sim path: ' + where);
  };

  const r2 = x => Math.round(x * 1e6) / 1e6;
  const days = [];
  let crash = null;
  try {
  document.getElementById('open').click();
  for (let day = 1; day <= CAMPAIGN.days; day++) {
    if (game.phase !== 'planning') break;
    if (day === 1) {
      game.stageMenu({ prices: { latte: 3.6, flat: 3.4 }, offered: { mocha: false } });
    }
    game.stagePastryCut(0.5);
    game.stageCellar({ topup: 'restock' });
    const before = game.stats();
    const hedge = day === 1 ? 'contract_light' : before.debt > 0 ? 'settle' : 'hold';
    game.stageDayPlan({ hedge, staffing: 'work', marketing: { sample: day === 2, sponsor: false } });
    let res = await game.commitDayPlan();
    if (!res.ok && hedge !== 'hold') { game.stageDayPlan({ hedge: 'hold', staffing: 'work', marketing: {} }); res = await game.commitDayPlan(); }
    assert.equal(res.ok, true, JSON.stringify(res));
    let frames = 0;
    while (game.phase === 'trading' && frames++ < 1000) {
      if (game.paused && game.modals.top() === 'offer') document.getElementById('offer-no').click();
      const cb = raf; raf = null; now += frameMs; cb(now);
    }
    const s = game.stats(), receipt = game.lastDayReceipt || {};
    days.push({
      day, phase: game.phase, frames, hedge, event: s.event,
      till: r2(s.till), cogs: r2(s.cogs), served: s.served, servedRetail: s.servedRetail, balked: s.balked,
      defections: s.defections, rivalServed: s.rivalServed, rivalChoices: s.rivalChoices, peakQueue: s.peakQueue,
      waveServed: s.waveServed, waveBalked: s.waveBalked, turnaways: s.turnaways, emergencyCups: s.emergencyCups,
      pastrySpend: r2(s.pastrySpend), pastryWaste: s.pastryWaste, caseRevenue: r2(s.caseRevenue), milkBalked: s.milkBalked,
      ops: Object.fromEntries(Object.entries(s.ops || {}).map(([k, v]) => [k, r2(v)])),
      netToday: r2(receipt.netToday ?? NaN), operatingNet: r2(receipt.operatingNet ?? NaN),
      debt: r2(s.debt), rep: s.rep, satisfaction: r2(s.satisfaction), awareness: r2(s.awareness),
      index: r2(s.index), hedgeSavings: r2(s.hedgeSavings), staffCondition: r2(s.staffCondition),
    });
    if (game.phase !== 'review') break;
    game.continueFromReview();
    if (game.phase === 'finale') break;
  }
  } catch (err) {
    crash = String(err && err.message || err);
  }
  const end = game.stats();
  out(JSON.stringify({
    seed, days,
    end: { phase: game.phase, day: end.day, netWorth: r2(end.netWorth), debt: r2(end.debt), rep: end.rep, cRev: r2(end.cRev), cCost: r2(end.cCost), cOps: r2(end.cOps), settledPaid: r2(end.settledPaid), campaignDone: end.campaignDone },
    strays: [...strays].map(([where, n]) => `${n}x ${where}`), uuidDraws, crash,
  }) + '\n');
}

if (process.argv[2] === '--replay') {
  await child(Number(process.argv[3]), Number(process.argv[4]), Number(process.argv[5] || 100));
  process.exit(0);
} else {
  const { default: test } = await import('node:test');
  const run = (seed, cosmeticSeed, frameMs) => JSON.parse(execFileSync(process.execPath,
    [SELF, '--replay', String(seed), String(cosmeticSeed), String(frameMs || 100)],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  const A = run(7, 1);
  const B = run(7, 0xC0FFEE);
  const C = run(8, 1);
  const F50 = run(7, 1, 50);
  const F37 = run(7, 1, 37);

  test('replay: campaign plays out to the finale under the sentinel', () => {
    const { days } = A;
    assert.equal(A.crash, null, A.crash);
    assert.equal(A.end.phase, 'finale', `campaign stopped in ${A.end.phase} on day ${A.end.day}`);
    assert.ok(days.length >= 3, `expected a multi-day run, got ${days.length} day(s)`);
    for (const d of days) {
      assert.ok(d.served > 0, `day ${d.day} served nobody`);
      assert.ok(Number.isFinite(d.netToday), `day ${d.day} has no ledger net`);
    }
    assert.ok(A.uuidDraws > 0, 'expected three.js uuid draws mid-day (patron meshes), proving the sentinel was live');
  });

  test('replay: no bare Math.random on the sim path', () => {
    assert.deepEqual(A.strays, [], 'Math.random reached from:\n' + A.strays.join('\n'));
    assert.deepEqual(B.strays, []);
    assert.deepEqual(C.strays, []);
    assert.deepEqual(F50.strays, []);
    assert.deepEqual(F37.strays, []);
  });

  test('replay: same seed + same inputs → identical till, served, balked, defections, ledger', () => {
    assert.deepEqual(B.days, A.days);
    assert.deepEqual(B.end, A.end);
  });

  test('replay: the campaign is identical at 50ms and 37ms frame clocks (fixed-step invariance)', () => {
    assert.equal(F50.crash, null, F50.crash);
    assert.equal(F37.crash, null, F37.crash);
    // `frames` legitimately differs across clocks — it measures how many RAF
    // turns the day took, which is the very thing being varied. Everything
    // else — every per-day ledger and the campaign end — must be identical.
    const strip = r => ({ days: r.days.map(({ frames, ...d }) => d), end: r.end });
    assert.deepEqual(strip(F50), strip(A));
    assert.deepEqual(strip(F37), strip(A));
  });

  test('replay: a different seed produces a different campaign', () => {
    const sig = r => r.days.map(d => [d.till, d.served, d.balked, d.defections]);
    assert.notDeepEqual(sig(C), sig(A));
  });
}
