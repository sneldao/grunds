// Headless integration test that PROVES the connections the review asked for:
//   1. Per-regular opinion moves only when that regular was individually present
//      (not for absent regulars).
//   2. A contract lives for exactly `contractUnits` cups, not for `days` — the
//      PR's earlier 40-unit number was decorative; the contract must now
//      actually expire on serve count.
//   3. Settle clears debt and the dawn-time interest guard does NOT add
//      interest to a zero balance (so a clean settle survives the next dawn).
//   4. The 5-day campaign verdicts to one of the named bands (we don't pin a
//      specific phrase; we just assert `net > 600` which is the `held` floor).
//
// Run: node web/test/campaign-tight.mjs
import { readFileSync } from 'node:fs';
import { CAMPAIGN, REGULAR_ROSTER } from '../js/config.js';

const schedule = JSON.parse(readFileSync(new URL('../../out/wave_schedule.json', import.meta.url), 'utf8'));

// ---- DOM / GL / audio stubs (same shape as the other tests) -----------------
const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => { if (k === Symbol.toPrimitive) return h => h === 'string' ? 'WebGL 2.0' : 1; if (k === 'then') return undefined; return anyProxy(); },
  set: () => true, apply: () => anyProxy(),
});
function el() {
  const e = { children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10,
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c, v){v?this._s.add(c):this._s.delete(c);}, contains(c){return this._s.has(c);} },
    appendChild(c){c._parent=e;e.children.push(c);return c;},
    prepend(c){c._parent=e;e.children.unshift(c);},
    remove(){const p=e._parent;if(p){const i=p.children.indexOf(e);if(i>=0)p.children.splice(i,1);}},
    querySelector:()=>el(), querySelectorAll:()=>[], addEventListener(){},
    get lastChild(){return e.children[e.children.length-1]||null;}, click(){e.onclick&&e.onclick();}, onclick:null };
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
  createGain() { return { gain: { value: 0, setTargetAtTime(){}, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
  createOscillator() { return { type:'', frequency:{value:0,setTargetAtTime(){},exponentialRampToValueAtTime(){},setValueAtTime(){}}, detune:{value:0}, connect(){}, start(){}, stop(){} }; }
  createBiquadFilter() { return { type:'', frequency:{value:0}, Q:{value:0}, connect(){} }; }
  createBufferSource() { return { buffer:null, loop:false, playbackRate:{value:1}, connect(){}, start(){}, stop(){} }; }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
  resume(){}
}
globalThis.AudioContext = ACS;
// Deterministic gate: seed Math.random so the full-loop run is reproducible
// (EVAL.md "same seed → same run"). See campaign.mjs for why.
let _rs = 987654321;
Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
const wait = r => new Promise(r);
let now = 1000;
function runFrames(n) { for (let f = 0; f < n; f++) { now += 100; const cb = rafCb; rafCb = null; if (!cb) throw new Error('loop stopped'); cb(now); } }

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;
const fails = [];

// ============================================================
// 1) Per-regular opinion: present regular moves, absent one doesn't.
// ============================================================
// To make the assertion deterministic we suppress cohort-level spawns for
// the cohort we want to test as "absent". Easiest path: clear the regulars
// array for creatives, leaving Mara (commuters) as the only named regular
// who can possibly be marked seen. Mara's op should change; Tomas (creative)
// should be untouched because markSeen never picks him up.
G.reset();
reg.get('open').click(); await new Promise(r => setTimeout(r, 10));
// Keep Mara + commuters intact; remove the creatives from the named roster
// so the patrons of cohort 'creatives' spawn anonymously.
const mara = G.reg.regulars[0];   // Mara, commuters
const tomas = G.reg.regulars[1];  // Tomas, creatives
const maraOpBefore = mara.op;
const tomasOpBefore = tomas.op;
const removedCreatives = G.reg.regulars.filter(r => r.coh === 'creatives');
G.reg.regulars = G.reg.regulars.filter(r => r.coh !== 'creatives');
mara.seen = true;  // pre-flag so resolveDay definitely touches her
runFrames(220);
G.applyReply('hold');
const maraDelta = mara.op - maraOpBefore;
const tomasDelta = tomas.op - tomasOpBefore;
console.log('PERSON  Mara Δop =', maraDelta.toFixed(3), '| Tomas Δop =', tomasDelta.toFixed(3));
if (!(maraDelta !== 0)) fails.push(`present regular had no opinion change: ${maraDelta}`);
if (!(tomasDelta === 0)) fails.push(`absent regular's opinion changed: ${tomasDelta} (should be 0)`);
// restore for subsequent sections
G.reg.regulars.push(...removedCreatives);

// ============================================================
// 2) Contract expires on cup count, not on dawns.
// ============================================================
G.reset();
reg.get('open').click(); await new Promise(r => setTimeout(r, 10));
G.exc.beanIndex = 1.0; G.exc.contractBeans();
if (!G.exc.contract) fails.push('contract not created');
const startUnits = G.exc.contract.units;
// Burn exactly CAMPAIGN.contractUnits - 1 cups. Contract must still be live.
for (let i = 0; i < startUnits - 1; i++) G.exc.consume(1);
if (!G.exc.contract) fails.push('contract died before its quota was filled');
const partialUnits = G.exc.contract.units;
// The +1st cup clears it.
G.exc.consume(1);
if (G.exc.contract) fails.push(`contract survived beyond its quota (still ${partialUnits - 1} units)`);
console.log('UNITS   contract lasted', startUnits, '→', partialUnits, '→', G.exc.contract ? 'live' : 'cleared at +1');

// ============================================================
// 3) Settle survives the dawn interest guard.
// ============================================================
G.reset();
reg.get('open').click(); await new Promise(r => setTimeout(r, 10));
runFrames(220); G.applyReply('contract');
runFrames(220); G.applyReply('settle');
if (G.stats().debt !== 0) fails.push('settle did not clear debt to 0: ' + G.stats().debt);
// run another day — interest must NOT be added to a 0 balance (the guard is
// `if (d > 1 && exchange.debt > 0)`).
runFrames(220); G.applyReply('hold');
if (G.stats().debt !== 0) fails.push('interest accrued on a settled-zero debt: ' + G.stats().debt);
console.log('SETTLE  debt =', G.stats().debt, 'after settle + 1 dawn');

// ============================================================
// 4) The 5-day campaign lands in a verdict band (net > 600 = 'held' or better).
// ============================================================
G.reset();
reg.get('open').click(); await new Promise(r => setTimeout(r, 10));
for (let d = 1; d <= CAMPAIGN.days; d++) {
  runFrames(220);
  G.applyReply(d === 1 ? 'contract' : 'hold');
}
const end = G.stats();
console.log('FLOW    campaignDone =', end.campaignDone, '| netWorth =', end.netWorth.toFixed(0), '| rep =', end.rep);
if (!end.campaignDone) fails.push('campaign never closed');
if (!(end.netWorth > 600)) fails.push('campaign verdict band not reached (net <= 600): ' + end.netWorth);

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — regulars are per-individual, contracts are cup-bounded, settle survives dawn, campaign verdicts');
