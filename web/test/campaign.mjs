// Headless campaign integration test — proves the Gamble ⟶ Floor ⟶ next day
// connection end-to-end (no browser, no GL). Run: node web/test/campaign.mjs
import { readFileSync } from 'node:fs';
import { CAMPAIGN } from '../js/config.js';

const schedule = JSON.parse(readFileSync(new URL('../../out/wave_schedule.json', import.meta.url), 'utf8'));

const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => { if (k === Symbol.toPrimitive) return h => h === 'string' ? 'WebGL 2.0' : 1; if (k === 'then') return undefined; return anyProxy(); },
  set: () => true, apply: () => anyProxy(),
});
function el() {
  const e = { children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = e; e.children.push(c); return c; },
    prepend(c) { c._parent = e; e.children.unshift(c); },
    remove() { const p = e._parent; if (p) { const i = p.children.indexOf(e); if (i >= 0) p.children.splice(i, 1); } },
    querySelector: () => el(), querySelectorAll: () => [], addEventListener() {},
    get lastChild() { return e.children[e.children.length - 1] || null; }, click() { e.onclick && e.onclick(); }, onclick: null };
  return e;
}
const reg = new Map();
const cs = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });
globalThis.document = { getElementById: id => { if (!reg.has(id)) reg.set(id, el()); return reg.get(id); }, createElement: t => t === 'canvas' ? cs() : el(), createElementNS: () => cs(), querySelectorAll: () => [], body: el() };
globalThis.window = globalThis; globalThis.__headless = true;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
globalThis.location = { search: '?speed=1200' }; globalThis.addEventListener = () => {};
let rafCb = null; globalThis.requestAnimationFrame = cb => { rafCb = cb; };
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
const _w = console.warn; console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };
const _e = console.error; console.error = (...a) => { if (!String(a[0]).startsWith('THREE.')) _e(...a); };
class ACS {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
  resume() {}
}
globalThis.AudioContext = ACS;
// Deterministic gate: seed Math.random so the full-loop run is reproducible
// (EVAL.md "same seed → same run"). The sim draws spawn jitter, matcha
// cravings, and balks from Math.random; unseeded, rail-adjacent assertions
// flake ~1 run in 5.
let _rs = 123456789;
Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
const wait = r => new Promise(r);

let now = 1000;
function runFrames(n) { for (let f = 0; f < n; f++) { now += 100; const cb = rafCb; rafCb = null; if (!cb) throw new Error('loop stopped'); cb(now); } }

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;
const fails = [];

// === CONNECTION 1: a frost hits the spot; contracting first wins ===
reg.get('open').click(); await new Promise(r => setTimeout(r, 10));
G.exc.beanIndex = 1.8; G.exc.contract = null;          // HOLD through the spike
runFrames(220);
const A = G.stats(), netHold = A.till - A.cogs;

G.reset(); await new Promise(r => setTimeout(r, 10));
G.exc.beanIndex = 1.0; G.exc.contractBeans();          // CONTRACT at 1.0 before the spike (+£22 debt)
G.exc.beanIndex = 1.8;                                 // then frost hits the spot
runFrames(220);
const B = G.stats(), netContract = B.till - B.cogs - B.debt;
console.log('HEDGE  hold net', netHold.toFixed(0), '| contract net', netContract.toFixed(0),
  '| cogs', A.cogs.toFixed(0) + '→' + B.cogs.toFixed(0), '| cups', (A.served + A.servedRetail) + '/' + (B.served + B.servedRetail));
if (!(netContract > netHold)) fails.push(`hedge failed: contract ${netContract.toFixed(0)} not > hold ${netHold.toFixed(0)}`);
if (!(B.cogs < A.cogs * 0.7)) fails.push(`locked cost not cheaper: ${B.cogs.toFixed(0)} vs ${A.cogs.toFixed(0)}`);

// === CONNECTION 2: the 5-day campaign + the debt clock ===
G.reset(); await new Promise(r => setTimeout(r, 10));
reg.get('open').click(); await new Promise(r => setTimeout(r, 10));
for (let d = 1; d <= CAMPAIGN.days; d++) {
  runFrames(220);
  const s = G.stats();
  if (s.day !== d) fails.push(`flow: expected day ${d}, got ${s.day}`);
  if (s.cogs <= 0) fails.push(`day ${d}: no COGS — cost not wired`);
  G.applyReply(d === 1 ? 'contract' : 'hold');
}
const end = G.stats();
console.log('FLOW   5 days done | final debt', end.debt.toFixed(0), '| netWorth', end.netWorth.toFixed(0));
if (!end.campaignDone) fails.push('campaign never closed');
// Smoke check only: this only proves the interest clock advanced at dawn.
// The rigorous "interest does not accrue on a settled-zero balance" check
// lives in campaign-tight.mjs.
if (!(end.debt > CAMPAIGN.contractFee)) fails.push('debt interest never accrued: ' + end.debt);

// === CONNECTION 3: settle clears the debt ===
G.reset(); await new Promise(r => setTimeout(r, 10));
reg.get('open').click(); await new Promise(r => setTimeout(r, 10));
runFrames(220); G.applyReply('contract');
runFrames(220); G.applyReply('settle');
if (G.stats().debt !== 0) fails.push('settle did not clear debt: ' + G.stats().debt);
console.log('SETTLE debt cleared =', G.stats().debt);

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — campaign connected: hedge proved, 5-day flow ran, debt clock ticks, settle clears');
