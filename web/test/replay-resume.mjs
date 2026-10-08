// Resume-fidelity gate: a week resumed from the dawn save replays the same
// draws as an uninterrupted one. replay-campaign proves seed + inputs →
// campaign; this proves seed + inputs + dawn save → the same campaign from
// the resume boundary onward. If the save drops sim state the resumed run
// diverges — this test names the day it does.
//
// Two child processes share the replay-campaign stub harness:
//   --donor <seed> <cosmetic>   plays the scripted week with a working
//                               localStorage, recording each dawn save.
//   --resume <seed> <cosmetic> <saveFile>   boots with that save already in
//                               localStorage, clicks #resume, and plays the
//                               same scripted inputs from save.day onward.
// Parent compares the donor's day-N+ ledgers to the resumed run's.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SELF = fileURLToPath(import.meta.url);

function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

async function child(seed, cosmeticSeed, saveFile = null) {
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
  Math.random = cosmetic;
  const canvas = () => ({ ...element('canvas'), width: 480, height: 72, getContext: () => proxy() });
  const store = new Map();
  if (saveFile) store.set('grunds.week', readFileSync(saveFile, 'utf8'));
  globalThis.document = {
    body: element('body'), activeElement: null,
    getElementById(id) { if (!registry.has(id)) registry.set(id, element('div', id)); return registry.get(id); },
    createElement: tag => tag === 'canvas' ? canvas() : element(tag), createElementNS: () => canvas(), querySelectorAll: () => [],
  };
  Object.assign(globalThis, {
    window: globalThis, __headless: true, innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
    location: { search: `?speed=1200&seed=${seed}`, hostname: 'localhost', origin: 'http://localhost' },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: k => { store.delete(k); },
    },
    addEventListener() {}, requestAnimationFrame: cb => { raf = cb; },
    fetch: async () => ({ ok: true, json: async () => schedule }), AudioContext: AudioStub,
  });
  await import('../js/main.js');
  await new Promise(resolve => setImmediate(resolve));
  const game = globalThis.__grunds;

  // Levers evaluate once per sim tick — see replay-campaign.mjs for why.
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
  const saves = {};
  let crash = null;
  try {
    // Resume mode: the save is already in localStorage; the #resume button
    // runs resumeWeek() → applySavedWeek → prepareDay(save.day) → 'planning'.
    if (saveFile) document.getElementById('resume').click();
    else document.getElementById('open').click();
    const startDay = game.stats().day || 1;
    for (let day = startDay; day <= CAMPAIGN.days; day++) {
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
        const cb = raf; raf = null; now += 100; cb(now);
      }
      const s = game.stats(), receipt = game.lastDayReceipt || {};
      days.push({
        day, phase: game.phase, hedge, event: s.event,
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
      // prepareDay(day+1) → capturePreDawn wrote the next dawn's save.
      const snap = store.get('grunds.week');
      if (snap) saves[JSON.parse(snap).day] = snap;
      if (game.phase === 'finale') break;
    }
  } catch (err) {
    crash = String(err && err.stack || err);
  }
  const end = game.stats();
  out(JSON.stringify({
    seed, days, saves,
    end: { phase: game.phase, day: end.day, netWorth: r2(end.netWorth), debt: r2(end.debt), rep: end.rep, cRev: r2(end.cRev), cCost: r2(end.cCost), cOps: r2(end.cOps), settledPaid: r2(end.settledPaid), campaignDone: end.campaignDone },
    strays: [...strays].map(([where, n]) => `${n}x ${where}`), uuidDraws, crash,
  }) + '\n');
}

if (process.argv[2] === '--donor') {
  await child(Number(process.argv[3]), Number(process.argv[4]));
  process.exit(0);
} else if (process.argv[2] === '--resume') {
  await child(Number(process.argv[3]), Number(process.argv[4]), process.argv[5]);
  process.exit(0);
} else {
  const { default: test } = await import('node:test');
  const run = (mode, seed, cosmeticSeed, extra) => JSON.parse(execFileSync(process.execPath,
    [SELF, mode, String(seed), String(cosmeticSeed), ...(extra ? [extra] : [])],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));

  const A = run('--donor', 7, 1);

  test('resume: dawn saves exist for every entered day', () => {
    assert.equal(A.crash, null, A.crash);
    for (const d of [2, 3, 4, 5]) {
      assert.ok(A.saves[d], `no dawn save captured for day ${d}`);
      assert.equal(JSON.parse(A.saves[d]).day, d);
      assert.ok(JSON.parse(A.saves[d]).streams, `day-${d} save is missing stream positions`);
    }
  });

  for (const resumeDay of [2, 3, 4]) {
    test(`resume: day-${resumeDay} dawn save replays the rest of the week identically`, () => {
      const f = join(tmpdir(), `grunds-resume-${process.pid}-${resumeDay}.json`);
      writeFileSync(f, A.saves[resumeDay]);
      let R;
      try { R = run('--resume', 7, 1, f); } finally { try { unlinkSync(f); } catch {} }
      assert.equal(R.crash, null, R.crash);
      const expected = A.days.filter(d => d.day >= resumeDay);
      assert.equal(R.days.length, expected.length,
        `resumed run played ${R.days.length} days, expected ${expected.length} from day ${resumeDay}`);
      assert.deepEqual(R.days, expected,
        `day-${resumeDay} resume diverged from the uninterrupted campaign`);
      assert.deepEqual(R.end, A.end);
    });
  }

  test('resume: no bare Math.random on the resume path', () => {
    assert.deepEqual(A.strays, [], 'Math.random reached from:\n' + A.strays.join('\n'));
  });
}
