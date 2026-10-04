// Phase 3 — Drink menu: margins, orders, bands, 86 board.
// Verifies the pure menu math (menu.js), the cohort mix, and every menu
// wiring point (spawn orders, tick points, ticket prices, Brief section).
//
// Imports menu.js directly — no DOM, no GL. Wiring is file-shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  DRINKS, DRINK_IDS, COHORT_ORDERS, PRICE_STEP, PRICE_BAND,
  basePrices, clampPrice, menuPrice, rollDrink, deliveryQty, waveMilkEstimate,
  priceDivert, eightySixedShare,
} from '../js/menu.js';
import { ECON } from '../js/config.js';
import { buildAutopsy } from '../js/autopsy.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const main = readFileSync(resolve(root, 'web/js/main.js'), 'utf8');
const patrons = readFileSync(resolve(root, 'web/js/patrons.js'), 'utf8');
const html = readFileSync(resolve(root, 'web/index.html'), 'utf8');

// (1) Catalog: four drinks, sane margins, slowest = matcha
test('Phase 3 · menu holds 4 drinks with margins over bean cost', () => {
  assert.deepEqual([...DRINK_IDS].sort(), ['espresso', 'filter', 'flatwhite', 'matcha']);
  for (const id of DRINK_IDS) {
    assert.ok(DRINKS[id].base > 1.30, `${id} must clear the £1.30 bean baseline`);
  }
  assert.ok(DRINKS.espresso.points < DRINKS.flatwhite.points);
  assert.ok(DRINKS.flatwhite.points < DRINKS.filter.points);
  assert.ok(DRINKS.filter.points < DRINKS.matcha.points);
  assert.equal(DRINKS.flatwhite.milk, true);
  assert.equal(DRINKS.matcha.milk, true);
  assert.equal(DRINKS.espresso.milk, false);
  assert.equal(DRINKS.filter.milk, false);
});

// (2) Cohort mix keeps the matcha wave alive (≈20–30%, near legacy 35%)
test('Phase 3 · cohort orders keep matcha at wave strength', () => {
  let matcha = 0, total = 0;
  for (const [coh, weights] of Object.entries(COHORT_ORDERS)) {
    if (coh === 'rival') continue;
    const t = Object.values(weights).reduce((s, w) => s + w, 0);
    matcha += weights.matcha ?? 0;
    total += t;
  }
  const share = matcha / total;
  assert.ok(share >= 0.2 && share <= 0.3, `matcha share ${share} must read as a wave`);
});

// (3) rollDrink honors the 86 board, deterministic on rng
test('Phase 3 · rollDrink respects 86s and seeds', () => {
  const rng = () => 0.99;
  for (let i = 0; i < 50; i++) {
    assert.notEqual(rollDrink('creatives', { filter: false }, rng), 'filter');
  }
  // all 86'd except matcha → matcha (always offered, always pourable)
  assert.equal(rollDrink('elders', { espresso: false, flatwhite: false, filter: false }, rng), 'matcha');
  const a = rollDrink('tourists', null, () => 0.1);
  const b = rollDrink('tourists', null, () => 0.1);
  assert.equal(a, b);
});

// (4) Price bands: ±£1.00, cent-rounded
test('Phase 3 · clampPrice holds the band', () => {
  assert.equal(PRICE_STEP, 0.20);
  assert.equal(PRICE_BAND, 1.00);
  assert.equal(clampPrice('espresso', 9.99), 4.20);
  assert.equal(clampPrice('espresso', 0), 2.20);
  assert.equal(clampPrice('flatwhite', 3.65), 3.65);
  assert.deepEqual(basePrices(), { espresso: 3.20, flatwhite: 3.60, filter: 3.00, matcha: 4.80 });
  assert.equal(menuPrice('filter', { filter: 3.40 }), 3.40);
  assert.equal(menuPrice('filter', {}), 3.00);
});

// (5) Spawn orders by cohort, wantsMatcha stays consistent
test('Phase 3 · spawn rolls cohort drinks; wantsMatcha follows the drink', () => {
  assert.match(patrons, /rollDrink\(cohort, offered, this\.random\)/);
  assert.match(patrons, /rollDrink\(cohort, this\.menuOffered, this\.random\)|rollDrink\(cohort, offered, this\.random\)/);
  assert.match(patrons, /drink, wantsMatcha: drink === 'matcha'/);
  assert.match(patrons, /menuOffered = null/);
});

// (5b) Board cause-and-effect: price deltas divert, 86s turn away
test('Phase 3 · board prices divert demand; 86s turn away with a reason', () => {
  assert.match(patrons, /priceDivert\(/);
  assert.match(patrons, /eightySixedShare\(/);
  assert.match(patrons, /boardWalk/);
  assert.match(patrons, /turnaway/);
  // the numbers: base prices divert exactly 0 (default stream untouched),
  // +£1 diverts hard, −£1 lures back capped, 86s turn away about half.
  assert.equal(priceDivert(0, ECON), 0);
  assert.ok(priceDivert(1, ECON) >= 0.25, `+£1 should divert hard (got ${priceDivert(1, ECON)})`);
  const lure = priceDivert(-1, ECON);
  assert.ok(lure < 0 && lure >= -0.15, `−£1 should lure back capped (got ${lure})`);
  const share = eightySixedShare(ECON);
  assert.ok(share > 0.3 && share < 0.7, `86 share should gut but not empty (got ${share})`);
  const lines = buildAutopsy([{ day: 1, turnaways: 4, balked: 0, defections: 0, netToday: 1 }]);
  assert.ok(lines.some(l => l === "4 left at the board (their drink was 86'd)"), lines.join(' | '));
});

// (6) Tick spends drink points; milk gates milky orders (legacy-safe:
// ctx objects without milk fields behave exactly as before)
test('Phase 3 · bar spends drink points; dry milk balks milky cups', () => {
  assert.match(patrons, /DRINKS\[dk\]\?\.points \?\? ECON\.prepOther/);
  assert.match(patrons, /DRINKS\[dk\]\?\.milk && ctx\.milkStock != null && ctx\.milkStock <= 0/);
  assert.match(patrons, /ctx\.milkOut = true/);
  assert.match(patrons, /ctx\.milky = \(ctx\.milky \|\| 0\) \+ 1/);
});

// (7) Tickets: matcha at the board, rest at menu prices, register too
test('Phase 3 · tickets price by drink; register honors the menu', () => {
  assert.match(patrons, /ctx\.menuPrices\?\.?\[dk\] \?\? ECON\.other/);
  assert.match(patrons, /ctx\.menuPrices\?\.?\[rdk\] \?\? ECON\.other/);
  // the reprice lever is untouched: key 2 still cuts matcha mid-day
  assert.match(main, /cut matcha to/);
  assert.match(main, /function doReprice/);
});

// (8) Brief menu section: steppers, 86 toggles, matcha always on
test('Phase 3 · day-1 milk sizes from the wave sheet, scale-free', () => {
  const waves = [{ spawns: [{ q: 100 }, { q: 50 }] }, { spawns: [{ q: 200 }] }];
  // 350 × 0.3 × 0.65 × 0.5 × 1.1 ≈ 37.5 → 40, floored to the 120 minimum
  assert.equal(waveMilkEstimate(waves, 0.3, 0.65), 120);
  // a real rush sheet scales: 4000 × 0.3 × 1.0 × 0.5 × 1.1 = 660
  const rush = [{ spawns: [{ q: 4000 }] }];
  assert.equal(waveMilkEstimate(rush, 0.3, 1.0), 660);
  assert.equal(waveMilkEstimate([], 0.3, 0.65), 120);   // floor holds empty
  assert.ok(waveMilkEstimate(rush, 3, 3) <= 4000);      // ceiling holds rush
});

// (9) Brief menu section: steppers, 86 toggles, matcha always on
test('Phase 3 · Brief stages prices + 86 board; commit applies', () => {
  const idx = main.indexOf('function renderMenuSection');
  assert.ok(idx > 0, 'renderMenuSection must be defined');
  const body = main.slice(idx, idx + 3500);
  assert.match(body, /brief-86-\$\{id\}/);
  assert.match(body, /clampPrice\(id, stagedMenu\.prices\[id\] [-+] 0\.20\)/);
  assert.match(body, /always on/);
  assert.match(main, /function applyMenu/);
  assert.match(main, /Object\.assign\(menuPrices, stagedMenu\.prices\)/);
  assert.match(main, /renderMenuSection\(\);/);
  assert.match(html, /id="brief-menu"/);
  // headless lever: stageMenu mirrors the Brief without DOM
  assert.match(main, /stageMenu\(\{ prices, offered \}/);
});

// (10) Loseable day 1, easy-by-default. A fair board keeps a profitable day.
// Gouging to the top of the band walks a real crowd to Glasshouse (fewer
// cups, not a mix shuffle). 86ing the priced drinks turns loyalists away
// at the board — named on the toast, the receipt, and the autopsy — and
// cuts take-home. Runs the live sim headless: no DOM, no GL.
test('Phase 3 · loseable day 1: gouge or gut the menu and the day bleeds', { timeout: 60_000 }, async () => {
  const { readFileSync } = await import('node:fs');
  const schedule = JSON.parse(readFileSync(new URL('../../out/wave_schedule.json', import.meta.url), 'utf8'));
  const anyProxy = () => new Proxy(function () {}, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return hint => hint === 'string' ? 'WebGL 2.0' : 1;
      if (k === 'then') return undefined;
      return anyProxy();
    },
    set: () => true,
    apply: () => anyProxy(),
  });
  function el() {
    const e = {
      children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10,
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
        toggle(c, v) { if (v === undefined) v = !this._s.has(c); v ? this._s.add(c) : this._s.delete(c); return v; },
        contains(c) { return this._s.has(c); },
      },
      appendChild(c) { c._parent = e; e.children.push(c); return c; },
      append(...cs) { for (const c of cs) e.appendChild(c); },
      prepend(c) { c._parent = e; e.children.unshift(c); return c; },
      remove() { const p = e._parent; if (p) { const i = p.children.indexOf(e); if (i >= 0) p.children.splice(i, 1); } },
      querySelector: () => el(), querySelectorAll: () => [], addEventListener() {},
      get lastChild() { return e.children[e.children.length - 1] || null; },
      click() { e.onclick && e.onclick(); }, onclick: null,
    };
    return e;
  }
  const reg = new Map();
  const canvas = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });
  globalThis.document = {
    getElementById: id => { if (!reg.has(id)) reg.set(id, el()); return reg.get(id); },
    createElement: t => t === 'canvas' ? canvas() : el(),
    createElementNS: () => canvas(),
    querySelectorAll: () => [],
    body: el(),
  };
  globalThis.window = globalThis;
  globalThis.__headless = true;
  globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
  globalThis.location = { search: '?speed=1200' };
  globalThis.addEventListener = () => {};
  let rafCb = null;
  globalThis.requestAnimationFrame = cb => { rafCb = cb; };
  globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
  class AudioContextStub {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
    createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
    createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
    createBuffer(_c, len) { return { getChannelData: () => new Float32Array(len) }; }
    resume() {}
  }
  globalThis.AudioContext = AudioContextStub;
  let seed = 0;
  const reseed = () => { seed = 123456789; };
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const log = console.log, warn = console.warn, err = console.error, debug = console.debug;
  console.log = (...a) => { const s = String(a[0] ?? ''); if (s.startsWith('GRUNDS') || s.startsWith('[grunds:analytics]')) return; log(...a); };
  console.debug = () => {};
  console.warn = (...a) => { const s = String(a[0] ?? ''); if (s.startsWith('THREE.') || s.startsWith('RevenueCat')) return; warn(...a); };
  console.error = (...a) => { const s = String(a[0] ?? ''); if (s.startsWith('THREE.') || s.startsWith('RevenueCat')) return; err(...a); };

  let now = 1000;
  const frame = () => {
    now += 100;
    const cb = rafCb; rafCb = null;
    if (!cb) throw new Error('render loop stopped');
    cb(now);
    const off = reg.get('offer');
    if (off && off.classList.contains('show')) reg.get('offer-no').click();
  };

  try {
  await import('../js/main.js');
  await new Promise(r => setTimeout(r, 30));
  const G = globalThis.__grunds;
  const toasts = [];
  const feed = document.getElementById('feed');
  const prepend = feed.prepend.bind(feed);
  feed.prepend = (node) => { toasts.push(node.textContent); return prepend(node); };

  function play(stage) {
    reseed();
    G.reset();
    reseed();
    const staged = stage ? G.stageMenu(stage) : null;
    if (stage) assert.equal(staged, true);
    const committed = G.commitDayPlan();
    assert.equal(committed && committed.ok, true, JSON.stringify(committed));
    let guard = 0;
    while (G.phase !== 'review' && guard++ < 400) frame();
    assert.equal(G.phase, 'review', `day did not close (${G.phase} after ${guard} frames)`);
    const stats = G.stats();
    const receipt = G.lastDayReceipt;
    return {
      stats,
      netToday: receipt.netToday,
      lessons: receipt.lessons || [],
      lines: receipt.lines || [],
      served: stats.served + stats.servedRetail,
    };
  }

  const fair = play(null);
  const gouge = play({ prices: { espresso: 9, flatwhite: 9, filter: 9 } });
  const beforeGut = toasts.length;
  const gut = play({ offered: { espresso: false, flatwhite: false, filter: false } });

  assert.ok(fair.netToday > 0, `a fair board should keep day 1 (net ${fair.netToday})`);
  assert.equal(fair.stats.turnaways, 0);
  assert.equal(fair.stats.rivalTurnaways, 0);

  // +£1 is inside the band (clamped). It does not empty the till — the
  // remaining cups pay more — but it walks a real crowd to Glasshouse
  // and serves fewer cups. That is diversion, not a drink-mix shuffle.
  assert.equal(gouge.stats.turnaways, 0);
  assert.ok(gouge.stats.rivalChoices > fair.stats.rivalChoices * 1.5,
    `gouge should divert to Glasshouse (${gouge.stats.rivalChoices} vs ${fair.stats.rivalChoices})`);
  assert.ok(gouge.served < fair.served,
    `gouge should serve fewer cups (${gouge.served} vs ${fair.served})`);

  // 86ing the priced drinks turns loyalists away with a reason and cuts
  // the take-home. The receipt, the toast, and the autopsy all name it.
  assert.ok(gut.stats.turnaways > 400, `gut should turn a crowd away (got ${gut.stats.turnaways})`);
  assert.equal(gut.stats.turnaways, gut.stats.rivalTurnaways);
  assert.ok(gut.served < fair.served * 0.85, `gut should lose real sales (${gut.served} vs ${fair.served})`);
  assert.ok(gut.netToday < fair.netToday * 0.7, `gut should bleed take-home (${gut.netToday} vs ${fair.netToday})`);
  assert.ok(gut.stats.rep < fair.stats.rep, `gut should cost reputation (${gut.stats.rep} vs ${fair.stats.rep})`);
  assert.ok(gut.lessons.some(l => /read the board and left/.test(l) && /Espresso/.test(l) && /Flat white/.test(l) && /Filter/.test(l)),
    gut.lessons.join(' | '));
  assert.ok(gut.lines.some(row => row[0] === 'left at the board' && /Espresso/.test(row[1])),
    JSON.stringify(gut.lines.filter(row => /board|menu/i.test(row[0]))));
  assert.ok(toasts.slice(beforeGut).some(t => /read the board and left/.test(t)), toasts.slice(beforeGut).join(' | '));
  } finally {
    console.log = log; console.warn = warn; console.error = err; console.debug = debug;
  }
});
