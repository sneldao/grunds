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
const rival = readFileSync(resolve(root, 'web/js/rival.js'), 'utf8');
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
  assert.match(patrons, /rollDrink\(cohort, this\.menuOffered, this\.random/);
  assert.match(patrons, /rollDrink\(cohort, this\.menuOffered, this\.random, this\._orderPrices\(\)\)/);
  assert.match(patrons, /drink, wantsMatcha: drink === 'matcha'/);
  assert.match(patrons, /menuOffered = null/);
});

// (5b) Board cause-and-effect: price deltas divert, 86s turn away
test('Phase 3 · board prices divert demand; 86s turn away with a reason', () => {
  assert.match(rival, /priceDivert\(boardDelta/);
  assert.match(patrons, /boardDelta/);
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
  const lines = buildAutopsy([{ day: 1, turnaways: 4, balked: 6, defections: 0, netToday: 1 }]);
  assert.ok(lines.some(l => l === "4 left at the board (their drink was 86'd)"), lines.join(' | '));
  assert.ok(lines.some(l => l === '2 walked (queue beat them)'), lines.join(' | '));
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
  // Slice to the top-level close brace — a fixed char window silently drops
  // pins when the function grows (the cue-spot rows did just that).
  const end = main.indexOf('\n}\n', idx);
  const body = main.slice(idx, end > 0 ? end : idx + 3500);
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

// (10) Loseable day 1, easy-by-default: a gouged/gutted menu loses real
// revenue AND walks real patrons (not just mix-shift), while a fair board
// keeps the day. Runs the live sim headless — no DOM, no GL.
test('Phase 3 · loseable day 1: gouge or gut the menu and the day bleeds', async () => {
  const anyProxy = () => new Proxy(function () {}, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return h => h === 'string' ? 'WebGL 2.0' : 1;
      if (k === 'then') return undefined;
      return anyProxy();
    },
    set: () => true, apply: () => anyProxy(),
  });
  const mkEl = () => {
    const e = {
      children: [], style: {}, dataset: {}, textContent: '', innerHTML: '',
      disabled: false, offsetWidth: 10,
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      appendChild(c) { c._parent = e; e.children.push(c); return c; },
      append(...cs) { for (const c of cs) e.appendChild(c); },
      prepend(c) { c._parent = e; e.children.unshift(c); },
      remove() { const p = e._parent; if (p) { const i = p.children.indexOf(e); if (i >= 0) p.children.splice(i, 1); } },
      querySelector: () => mkEl(), querySelectorAll: () => [], addEventListener() {},
      get lastChild() { return e.children[e.children.length - 1] || null; },
      click() { e.onclick && e.onclick(); }, onclick: null,
    };
    return e;
  };
  const reg = new Map();
  const cs = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });
  globalThis.document = {
    getElementById: id => { if (!reg.has(id)) reg.set(id, mkEl()); return reg.get(id); },
    createElement: t => t === 'canvas' ? cs() : mkEl(),
    createElementNS: () => cs(),
    querySelectorAll: () => [], body: mkEl(),
  };
  globalThis.window = globalThis; globalThis.__headless = true;
  globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
  globalThis.location = { search: '?speed=1200' };
  globalThis.addEventListener = () => {};
  let rafCb = null; globalThis.requestAnimationFrame = cb => { rafCb = cb; };
  const schedule = JSON.parse(readFileSync(resolve(root, 'out/wave_schedule.json'), 'utf8'));
  globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
  globalThis.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
    createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
    createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
    createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
    resume() {}
  };
  let _rs = 0;
  Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
  const toasts = [];
  const feed = document.getElementById('feed');
  const _feedPrepend = feed.prepend.bind(feed);
  feed.prepend = (node) => { toasts.push(node.textContent); return _feedPrepend(node); };

  await import('../js/main.js');
  await new Promise(r => setTimeout(r, 40));
  const G = globalThis.__grunds;
  reg.get('open').click();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(G.phase, 'planning', `expected planning, got ${G.phase}`);

  const p0 = { ...G.patrons.menuPrices }, o0 = { ...G.patrons.menuOffered };
  assert.equal(G.stageMenu({ prices: { espresso: 4.20, bogus: 1 }, offered: { filter: false } }), false);
  assert.equal(G.stageMenu({ prices: { flatwhite: NaN } }), false);
  assert.equal(G.stageMenu({ offered: { matcha: false } }), false);
  assert.deepEqual({ ...G.patrons.menuPrices }, p0, 'invalid stageMenu mutated prices');
  assert.deepEqual({ ...G.patrons.menuOffered }, o0, 'invalid stageMenu mutated the 86 board');

  let now = 1000;
  const runFrames = (n) => {
    for (let f = 0; f < n; f++) {
      now += 100; const cb = rafCb; rafCb = null;
      if (!cb) break;
      cb(now);
      const off = reg.get('offer');
      if (off && off.classList.contains('show')) reg.get('offer-no').click();
    }
  };
  const runDay = async (stage) => {
    _rs = 424242;
    if (stage) assert.equal(G.stageMenu(stage), true, 'stageMenu rejected a valid stage');
    const cr = G.commitDayPlan();
    assert.ok(cr && cr.ok, 'commit failed: ' + JSON.stringify(cr));
    runFrames(260);
    return G.stats();
  };

  const fair = await runDay(null);
  const fairHeads = G.patrons.walkins.heads.map(h => ({ pid: h.pid, visits: h.visits, events: [...(h.events || [])] }));
  await G.reset(); await new Promise(r => setTimeout(r, 10));

  const gouge = await runDay({ prices: { espresso: 4.20, flatwhite: 4.60, filter: 4.00 } });
  await G.reset(); await new Promise(r => setTimeout(r, 10));

  const beforeGut = toasts.length;
  const gutted = await runDay({ offered: { espresso: false, flatwhite: false, filter: false } });
  const guttedHeads = G.patrons.walkins.heads;
  const balkedHeads = guttedHeads.filter(h => (h.events || []).some(e => e.outcome === 'balked'));
  const gutReceipt = G.lastDayReceipt;
  const gutRows = G.world.windowMenuRows;
  G.world.setMatchaPrice('3.90', true);
  const struckRows = G.world.windowMenuRows;
  await G.reset(); await new Promise(r => setTimeout(r, 10));

  const replay = await runDay(null);
  const replayHeads = G.patrons.walkins.heads.map(h => ({ pid: h.pid, visits: h.visits, events: [...(h.events || [])] }));

  assert.ok(fair.served > 0, `fair day served ${fair.served}`);
  assert.equal(fair.turnaways, 0, 'fair board should have zero board turnaways');
  for (const k of ['served', 'balked', 'turnaways', 'rivalChoices', 'defections']) {
    assert.equal(replay[k], fair[k], `seeded replay drifted on ${k}: ${fair[k]} → ${replay[k]}`);
  }
  assert.deepEqual(replayHeads, fairHeads, 'seeded replay drifted on walk-in identities');

  assert.ok(gouge.served - gouge.rivalChoices < fair.served - fair.rivalChoices,
    `gouge kept ${gouge.served - gouge.rivalChoices} !< fair ${fair.served - fair.rivalChoices}`);
  assert.ok(gouge.rivalChoices > fair.rivalChoices, `gouge rivalChoices ${gouge.rivalChoices} !> fair ${fair.rivalChoices}`);
  assert.ok(gouge.balked > fair.balked, `gouge balked ${gouge.balked} !> fair ${fair.balked}`);

  assert.ok(gutted.turnaways > 0, 'gutted board produced no board turnaways');
  assert.ok(gutted.served < fair.served, `gutted served ${gutted.served} !< fair ${fair.served}`);
  assert.ok(gutted.cRev < fair.cRev, `gutted revenue ${gutted.cRev} !< fair ${fair.cRev}`);
  assert.ok(toasts.slice(beforeGut).some(t => /read the board and left/.test(t)), 'board turnaway produced no named toast');
  assert.ok(gutReceipt.lines.some(row => row[0] === 'left at the board' && /Espresso|Flat white|Filter/.test(row[1])),
    'receipt lost the board-walk row: ' + JSON.stringify(gutReceipt.lines.filter(r => /board|menu/i.test(r[0]))));
  assert.ok(gutReceipt.lessons.some(l => /read the board and left/.test(l) && /Espresso/.test(l)),
    'lessons did not name the 86\'d drinks: ' + gutReceipt.lessons.join(' | '));
  assert.equal(gutRows.find(r => r.id === 'espresso').offered, false, 'window menu missed the staged 86');
  assert.equal(struckRows.find(r => r.id === 'matcha').price, '3.90', 'window matcha deal not reflected');
  assert.equal(struckRows.find(r => r.id === 'espresso').offered, false, 'matcha reprice revived the 86 board');

  assert.ok(balkedHeads.length <= Math.max(0, gutted.balked - gutted.turnaways),
    `turnaways wrote identity records: ${balkedHeads.length} balked heads vs ${gutted.balked - gutted.turnaways} real queue balks`);
});
