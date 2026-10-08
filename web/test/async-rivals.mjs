// Async rivals — the seed-scoped ghost week. A real player's ledger paces
// the Glasshouse: visible defectors draw from the pace credit first, the
// remainder is their street's own demand served off-camera (ghostServed).
// No ghost → synthetic Sam, exactly as before. Self-reported tallies, not
// server-replayed anti-cheat.
//
// Run: node web/test/async-rivals.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
const patrons = readFileSync(join(ROOT, 'js/patrons.js'), 'utf8');
const sync = readFileSync(join(ROOT, 'js/convexSync.js'), 'utf8');
const http = readFileSync(join(ROOT, '../convex/http.ts'), 'utf8');
const schema = readFileSync(join(ROOT, '../convex/schema.ts'), 'utf8');
const rivals = readFileSync(join(ROOT, '../convex/rivals.ts'), 'utf8');

// --- file shape: the pipe is wired end to end ---
test('async-rivals: schema carries a seed-scoped ledger', () => {
  assert.match(schema, /rivalWeeks: defineTable\(\{/);
  assert.match(schema, /seed: v\.number\(\)/);
  assert.match(schema, /by_seed/);
  assert.match(schema, /weekServed: v\.number\(\)/);
  assert.match(schema, /playerName: v\.string\(\)/);
});

test('async-rivals: backend upserts by (seed, owner) and ranks opponents', () => {
  assert.match(rivals, /publishRivalDay = mutation/);
  assert.match(rivals, /rivalFor = query/);
  assert.match(rivals, /r\.owner !== args\.owner/, 'rivalFor must exclude the caller');
  assert.match(rivals, /days\.sort/, 'day ledger stays ordered');
});

test('async-rivals: http routes exist', () => {
  assert.match(http, /path: "\/sync\/rival", method: "GET"/);
  assert.match(http, /path: "\/sync\/rivalDay", method: "POST"/);
});

test('async-rivals: client fetches and publishes fire-and-forget', () => {
  assert.match(sync, /function rival\(seed\)/);
  assert.match(sync, /\/sync\/rival\?seed=/);
  assert.match(sync, /function publishRivalDay\(payload\)/);
  assert.match(sync, /\/sync\/rivalDay/);
  assert.match(sync, /owner: ownerName\(\)/, 'publish stamps the stand owner');
});

test('async-rivals: main binds pace per day and counts ambient cups', () => {
  assert.match(main, /patrons\.ghostPace = ghostPaceFor\(d\)/);
  assert.match(main, /rivalDayCups\(\)/);
  assert.match(main, /sync\.publishRivalDay\(\{/);
  assert.match(main, /status: day >= CAMPAIGN\.days \? 'done' : 'open'/);
});

test('async-rivals: patrons pace-credit splits visible vs ambient', () => {
  assert.match(patrons, /this\.ghostPace \|\| 0\.5 \* speedMul/);
  assert.match(patrons, /this\.ghostServed \+= ambient/);
  assert.match(patrons, /ghostPace = 0/, 'reset clears the bound pace');
});

// --- behavioral: a bound ghost races you on their real numbers ---
const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => { if (k === Symbol.toPrimitive) return h => h === 'string' ? 'WebGL 2.0' : 1; if (k === 'then') return undefined; return anyProxy(); },
  set: () => true, apply: () => anyProxy(),
});
function el() {
  const e = {
    children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10, value: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = e; e.children.push(c); return c; },
    append(...cs) { for (const c of cs) e.appendChild(c); },
    prepend(c) { c._parent = e; e.children.unshift(c); },
    remove() { const p = e._parent; if (p) { const i = p.children.indexOf(e); if (i >= 0) p.children.splice(i, 1); } },
    querySelector: () => el(), querySelectorAll: () => [], addEventListener() {},
    setAttribute(k, v) { (e._attrs = e._attrs || {})[k] = String(v); },
    getAttribute(k) { return e._attrs && e._attrs[k]; },
    removeAttribute(k) { if (e._attrs) delete e._attrs[k]; },
    focus() {},
    getContext: () => anyProxy(),
    get lastChild() { return e.children[e.children.length - 1] || null; },
    click() { e.onclick && e.onclick(); }, onclick: null,
  };
  return e;
}
const reg = new Map();
const cs = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });
globalThis.document = {
  getElementById: id => { if (!reg.has(id)) reg.set(id, el()); return reg.get(id); },
  createElement: t => t === 'canvas' ? cs() : el(),
  createElementNS: () => cs(),
  querySelectorAll: () => [],
  body: el(),
};
globalThis.window = globalThis; globalThis.__headless = true;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
globalThis.location = { search: '?speed=1200' }; globalThis.addEventListener = () => {};
let rafCb = null; globalThis.requestAnimationFrame = cb => { rafCb = cb; };
const schedule = JSON.parse(readFileSync(new URL('../../out/wave_schedule.json', import.meta.url), 'utf8'));
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
const _w = console.warn; console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };
const _e = console.error; console.error = (...a) => { if (!String(a[0]).startsWith('THREE.')) _e(...a); };
class ACS {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, detune: { value: 0, setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
  resume() {}
}
globalThis.AudioContext = ACS;
let _rs = 123456789;
Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };

let now = 1000;
function pump(max = 420) {
  for (let f = 0; f < max; f++) {
    if (G.phase === 'review' || G.phase === 'finale') return;
    now += 100;
    const cb = rafCb; rafCb = null;
    if (!cb) throw new Error('loop stopped');
    cb(now);
    const off = reg.get('offer');
    if (off && off.classList.contains('show')) reg.get('offer-no').click();
  }
}

try {
  await import('../js/main.js');
  await new Promise(r => setTimeout(r, 40));
} catch (e) { console.log('BOOT FAIL', e && e.stack); process.exit(1); }
const G = globalThis.__grunds;
try {
  reg.get('open').click();
  await new Promise(r => setTimeout(r, 20));
} catch (e) { console.log('OPEN FAIL', e && e.stack); process.exit(1); }

const GHOST = {
  owner: 'stand-maya', standName: 'CART SEVEN', playerName: 'Maya',
  days: [{ day: 1, served: 300, till: 1200, rep: 55 }],
  weekServed: 300, netWorth: 800, reputation: 55, status: 'done',
};

test('async-rivals: bound ghost takes the rival-barista name', () => {
  G.setRivalGhost(GHOST);
  assert.equal(G.stats().rivalBarista, 'Maya');
});

test('async-rivals: ghost pace lands ≈ the ledger day total', () => {
  // 300 cups over a 900-minute day ≈ 0.333 cups/tick — all of it ambient
  // unless defectors drain the credit pool first.
  const r = G.commitDayPlan();
  assert.ok(r && r.ok, 'commit failed ' + JSON.stringify(r));
  pump(420);
  const s = G.stats();
  // Pace binds per tick: expected = ledger pace × ticks actually traded
  // (the evening call can close a day before DAY_END, so scale by dayMin).
  const ticks = Math.min(s.dayMin, 1260) - 360;
  const expected = GHOST.days[0].served * ticks / 900;
  assert.ok(s.ghostServed > 50, `ambient cups should accrue, got ${s.ghostServed}`);
  assert.ok(s.rivalCups >= s.ghostServed, 'rivalCups includes ambient');
  assert.ok(s.rivalCups >= expected * 0.85 && s.rivalCups <= expected * 1.15,
    `rival day total ≈ ${expected.toFixed(0)} (${s.dayMin}min), got ${s.rivalCups}`);
});

test('async-rivals: clearing the ghost restores synthetic Sam', () => {
  G.setRivalGhost(null);
  assert.equal(G.stats().rivalBarista, 'Sam');
  G.reset();
  const r = G.commitDayPlan();
  assert.ok(r && r.ok, 'commit failed ' + JSON.stringify(r));
  pump(420);
  const s = G.stats();
  assert.equal(s.ghostServed, 0, 'no ambient cups without a ghost');
});
