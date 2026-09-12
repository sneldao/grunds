// Headless smoke test — runs the whole day in Node with stubbed DOM/GL/audio.
// Usage: node web/test/smoke.mjs   (from the repo root, schedule at out/wave_schedule.json)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schedule = JSON.parse(readFileSync(join(ROOT, 'out', 'wave_schedule.json'), 'utf8'));

// ---- permissive proxy: pretends to be any GL/2D object ------------------------
const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => {
    if (k === Symbol.toPrimitive) return hint => hint === 'string' ? 'WebGL 2.0' : 1;
    if (k === 'then') return undefined;
    return anyProxy();
  },
  set: () => true,
  apply: () => anyProxy(),
});

// ---- DOM stubs ------------------------------------------------------------------
function makeEl(tag = 'div') {
  const el = {
    tag, children: [], style: {}, dataset: {}, textContent: '', innerHTML: '',
    disabled: false, offsetWidth: 10,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = el; el.children.push(c); return c; },
    prepend(c) { c._parent = el; el.children.unshift(c); },
    remove() { const pr = el._parent; if (pr) { const i = pr.children.indexOf(el); if (i >= 0) pr.children.splice(i, 1); } },
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {},
    get lastChild() { return el.children[el.children.length - 1] || null; },
    click() { el.onclick && el.onclick(); },
    onclick: null,
  };
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
globalThis.location = { search: '' };
globalThis.addEventListener = () => {};
let rafCb = null;
globalThis.requestAnimationFrame = cb => { rafCb = cb; };
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });

// WebAudio stub
class AudioContextStub {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  resume() {}
}
globalThis.AudioContext = AudioContextStub;

globalThis.__headless = true;
// Deterministic gate: seed Math.random so the full-loop run is reproducible
// (EVAL.md "same seed → same run"). See campaign.mjs for why.
let _rs = 555555555;
Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
// silence THREE's warnings about the fake GL context (they are 99% of runtime)
const _warn = console.warn, _err = console.error;
console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _warn(...a); };
console.error = (...a) => { if (!String(a[0]).startsWith('THREE.')) _err(...a); };

// ---- run the day -------------------------------------------------------------------
async function runDay({ levers = false, query = '', frames = 950, step = 16.7 } = {}) {
  registry.clear();
  globalThis.location = { search: query };
  await import('../js/main.js?run=' + Math.random());
  const open = registry.get('open');
  if (open.disabled) throw new Error('open button still disabled — schedule fetch failed?');
  open.click();   // gesture: starts audio + crane + clock
  let batched = false;
  let now = 1000;
  for (let f = 0; f < frames; f++) {
    now += step;
    const cb = rafCb; rafCb = null;
    if (!cb) throw new Error('render loop stopped re-registering');
    cb(now);
    if (f % 300 === 0) console.error(`  …frame ${f} clock=${registry.get('clock').textContent}`);
    if (levers && registry.get('clock').textContent >= '12:30') {
      if (!batched) { batched = true; registry.get('reprice').click(); }
      const pb = registry.get('prebatch');
      if (!pb.disabled) pb.click();   // keep the batch topped up through the wave
    }
  }
  return {
    clock: registry.get('clock').textContent,
    till: registry.get('till').textContent,
    receipt: registry.get('receipt').classList.contains('show'),
    verdict: registry.get('r-verdict').textContent,
    stats: globalThis.__grunds.stats(),
  };
}

const t0 = Date.now();
const A = await runDay({ query: '?speed=1200' });                    // cold bar, no levers
const B = await runDay({ levers: true, query: '?speed=1200' });      // the read → pre-batch + reprice
// 1x covers the cinematic street walk-in path (dt clamps at 0.1s, so ~2700 frames for a day)
const C = await runDay({ query: '?speed=60', frames: 2900, step: 100 });   // dt clamps at 0.1s → 0.33 min/frame

console.log('A (cold bar)  :', JSON.stringify(A.stats));
console.log('  verdict     :', A.verdict);
console.log('B (read+lever):', JSON.stringify(B.stats));
console.log('C (1x walk-in) :', JSON.stringify(C.stats));
console.log('  verdict     :', B.verdict);

const fails = [];
if (A.clock !== '21:00') fails.push(`A: clock should close at 21:00, got ${A.clock}`);
if (!A.receipt) fails.push('A: closing receipt never shown');
if (A.stats.served < 200) fails.push(`A: too few served (${A.stats.served}) — spawn/service broken`);
if (A.stats.peakQueue < 12) fails.push(`A: queue never built (peak ${A.stats.peakQueue}) — the scramble is missing`);
if (A.stats.balked < 1) fails.push('A: nobody balked on a cold bar — balk logic broken');
if (A.stats.defections < 1) fails.push('A: nobody crossed to the rival — defection broken');
if (!(B.stats.waveBalked <= A.stats.waveBalked)) fails.push('B: pre-batch should not increase wave balks');
if (!(B.stats.served >= A.stats.served)) fails.push('B: levers should serve at least as many patrons');
if (B.stats.balked >= A.stats.balked) fails.push(`B: levers should cut balks (${B.stats.balked} !< ${A.stats.balked})`);
if (C.clock !== '21:00') fails.push(`C: 1x day should close at 21:00, got ${C.clock}`);
if (C.stats.served < 200) fails.push(`C: 1x served too few (${C.stats.served})`);
if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`\nPASS — two full days simulated headless in ${Date.now() - t0}ms; lever payoff verified (balks ${A.stats.balked} → ${B.stats.balked})`);
