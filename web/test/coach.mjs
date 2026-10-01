import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ECON } from '../js/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schedule = JSON.parse(readFileSync(join(ROOT, 'out', 'wave_schedule.json'), 'utf8'));

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
    tag, tagName: String(tag).toUpperCase(), children: [], style: {}, dataset: {}, textContent: '', innerHTML: '',
    disabled: false, hidden: false, offsetWidth: 10, offsetHeight: 10, value: '', open: false,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = el; el.children.push(c); return c; },
    append(...cs) { for (const c of cs) el.appendChild(c); },
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
    getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; },
    getContext: () => anyProxy(),
    focus() {},
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
  createElement: t => t === 'canvas' ? canvasStub() : makeEl(t),
  createElementNS: () => canvasStub(),
  querySelectorAll: () => [],
  body: makeEl('body'),
};
globalThis.window = globalThis; globalThis.__headless = true;
globalThis.innerWidth = 1280; globalThis.innerHeight = 800; globalThis.devicePixelRatio = 1;
globalThis.location = { search: '?speed=1200' }; globalThis.addEventListener = () => {};
let rafCb = null; globalThis.requestAnimationFrame = cb => { rafCb = cb; };
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(schedule) });
globalThis.matchMedia = () => ({ matches: false });
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
class ACS {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime(){}, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime(){}, exponentialRampToValueAtTime(){}, setValueAtTime(){} }, detune: { value: 0 }, connect(){}, start(){}, stop(){} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect(){} }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect(){}, start(){}, stop(){} }; }
  resume() {}
}
globalThis.AudioContext = ACS; globalThis.webkitAudioContext = ACS;
let _rs = 42; Math.random = () => { _rs = (_rs * 1664525 + 1013904223) >>> 0; return _rs / 4294967296; };
const _w = console.warn, _e = console.error;
console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };
console.error = (...a) => { if (!String(a[0]).startsWith('THREE.')) _e(...a); };

let now = 1000;
function runFrames(n) {
  for (let f = 0; f < n; f++) {
    now += 100; const cb = rafCb; rafCb = null; if (!cb) return;
    cb(now);
    const off = registry.get('offer');
    if (off && off.classList.contains('show')) registry.get('offer-no')?.click();
    const ev = registry.get('evening');
    if (ev && ev.classList.contains('show')) registry.get('evening-close')?.click();
  }
}
const fails = [];
function check(name, cond, detail) {
  if (cond) console.log('  PASS', name);
  else fails.push(`${name}: ${detail || 'failed'}`);
}
function coachButtons() { return (registry.get('coach-actions').children || []).filter(c => c.tagName === 'BUTTON'); }
function coachText() { return registry.get('coach-body').innerHTML || registry.get('coach-body').textContent || ''; }

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;

registry.get('open').click();
await new Promise(r => setTimeout(r, 10));
check('headless boot: no coach state', G.coach.state() === null);
check('headless boot: coach card stays hidden', registry.get('coach').hidden === true);

G.coach.begin(true);
check('begin under the Brief prepares state without showing a card', G.coach.state() !== null && registry.get('coach').hidden === true, `state=${JSON.stringify(G.coach.state())} hidden=${registry.get('coach').hidden}`);
check('start card does not pause the floor', G.paused === true, 'planning pause holds anyway');

const committed = G.commitDayPlan();
check('commit accepted', committed && committed.ok === true, JSON.stringify(committed));
runFrames(1);
check('intro card reveals once the brief closes', registry.get('coach').hidden === false && /Ruth has the bar/.test(coachText()), coachText().slice(0, 120));
check('intro card offers skip guidance', coachButtons().some(b => b.textContent === 'skip guidance'), JSON.stringify(coachButtons().map(b => b.textContent)));
check('intro card is a paper block, not a modal', !registry.get('coach').classList.contains('modal'), 'must not open a modal');
G.doPrebatch();
check('morning batch bought, £40 only', G.stats().batchUnits === ECON.batchUnits && Math.abs(G.stats().batchSpend - ECON.batchCost) < 1e-9,
  `units=${G.stats().batchUnits} spend=${G.stats().batchSpend}`);
check('invalid mid-morning presses charge nothing', (() => { const b = G.stats().batchSpend; G.doPrebatch(); G.doReprice(); return G.stats().batchSpend === b && G.stats().batchUnits === ECON.batchUnits; })(), 'reserved re-press or reprice-after-batch must be refused');

runFrames(90);
check('coach paused the floor at the wave', G.paused === true && G.stats().dayMin >= 840 && G.stats().dayMin < 970, `dayMin=${G.stats().dayMin} paused=${G.paused}`);
check('pause lands BEFORE the first 14:00 serve — 40 cups still sealed', G.stats().dayMin === 840 && G.stats().batchUnits === 40, `dayMin=${G.stats().dayMin} units=${G.stats().batchUnits}`);
check('HUD clock already reads 14:00 through the pause', /14:00/.test(registry.get('clock').textContent || registry.get('clock').innerHTML || ''), registry.get('clock').textContent);
check('wave card is mechanical, not cheerleading', /batch cup uses less bar time/i.test(coachText()), coachText());

G.togglePause();
check('user Space resumes AND takes ownership from the coach', G.paused === false, 'still paused');
G.togglePause();
check('user pause holds', G.paused === true, 'expected paused');
coachButtons().find(b => /watch my plan/i.test(b.textContent))?.click();
check('dismissed card cannot release a user-owned pause', G.paused === true, 'card stomped a user pause');
G.togglePause();
check('user resumes', G.paused === false, 'still paused');

let drained = false;
for (let i = 0; i < 300 && !drained; i++) { runFrames(2); drained = G.stats().batchUnits <= 8 && G.stats().dayMin < 960; }
check('batch actually drained to the low mark mid-wave', drained, `units=${G.stats().batchUnits} dayMin=${G.stats().dayMin}`);
if (drained) {
  runFrames(3);
  check('low stock pauses once', G.paused === true, `paused=${G.paused} units=${G.stats().batchUnits}`);
  const topBtn = coachButtons().find(b => /top up/i.test(b.textContent));
  check('top-up button is the real £40 top-up', !!topBtn && /£40/.test(topBtn.textContent), coachButtons().map(b => b.textContent).join('|'));
  const unitsBefore = G.stats().batchUnits, spendBefore = G.stats().batchSpend;
  const opsBefore = (G.reg?.regulars || []).map(r => r.op);
  if (topBtn) topBtn.click();
  check('top-up bought real cups for £40 and resumed',
    G.stats().batchUnits === unitsBefore + ECON.batchUnits && Math.abs(G.stats().batchSpend - spendBefore - ECON.batchCost) < 1e-9 && G.paused === false,
    `units ${unitsBefore} → ${G.stats().batchUnits} spend ${spendBefore} → ${G.stats().batchSpend} paused=${G.paused}`);
  const opsAfter = (G.reg?.regulars || []).map(r => r.op);
  check('wave top-up leaves every roster opinion untouched',
    opsBefore.length === opsAfter.length && opsBefore.every((o, i) => o === opsAfter[i]),
    `ops ${JSON.stringify(opsBefore)} → ${JSON.stringify(opsAfter)}`);
}

G.togglePause();
check('user-owned pause set', G.paused === true, 'expected paused');
G.coach.skip();
check('skip cannot release a user-owned pause', G.paused === true, 'skip stomped the user pause');
check('skip marks the coach skipped', G.coach.state() && G.coach.state().skipped === true, JSON.stringify(G.coach.state()));
G.togglePause();
check('user resumes after skip', G.paused === false, 'still paused');

runFrames(400);
let guard = 0;
while (G.phase === 'trading' && guard++ < 40) runFrames(40);
check('day 1 closed into review', G.phase === 'review', 'phase=' + G.phase);
G.continueFromReview();
await new Promise(r => setTimeout(r, 10));
check('day 2 has no coach', G.coach.state() === null && registry.get('coach').hidden === true, `state=${JSON.stringify(G.coach.state())}`);

const committed3 = G.commitDayPlan();
check('day 2 commit accepted', committed3 && committed3.ok === true, JSON.stringify(committed3));
let lateReady = false;
for (let i = 0; i < 300 && !lateReady; i++) { runFrames(4); lateReady = G.stats().dayMin >= 725 && G.phase === 'trading' && !G.paused; }
check('reached the post-noon window for the late-switch check', lateReady, `dayMin=${G.stats().dayMin} phase=${G.phase} paused=${G.paused}`);
if (lateReady) {
  const spendBefore = G.stats().batchSpend;
  G.doPrebatch();
  check('first post-noon press charges exactly £40 + £4.20',
    Math.abs(G.stats().batchSpend - spendBefore - (ECON.batchCost + 4.2)) < 1e-9 && G.stats().batchUnits === ECON.batchUnits,
    `spend ${spendBefore} → ${G.stats().batchSpend} units=${G.stats().batchUnits}`);
}

G.reset();
await new Promise(r => setTimeout(r, 5400));
check('reset clears the coach', G.coach.state() === null && registry.get('coach').hidden === true, `state=${JSON.stringify(G.coach.state())}`);

registry.get('open').click();
await new Promise(r => setTimeout(r, 200));
runFrames(2);
check('reopened run is back in planning', G.phase === 'planning', 'phase=' + G.phase);
G.renderBrief();
const prepWrap = registry.get('brief-prep');
const repricePill = (prepWrap.children || []).find(b => b.dataset && b.dataset.prep === 'reprice');
check('reprice pill exists on the new brief', !!repricePill, 'brief-prep pill missing');
if (repricePill) repricePill.click();
const committed2 = G.commitDayPlan();
check('discount commit accepted', committed2 && committed2.ok === true, JSON.stringify(committed2));
runFrames(2);
const goalHtml = registry.get('goal').innerHTML || registry.get('goal').textContent || '';
check('deal actually repriced the board', /deal holds/.test(goalHtml) && /4\.20/.test(goalHtml), goalHtml);
G.coach.begin(true);
runFrames(90);
check('discount pause lands before the first 14:00 serve too', G.paused === true && G.stats().dayMin === 840, `dayMin=${G.stats().dayMin} paused=${G.paused}`);
check('discount wave card pauses and speaks honestly',
  G.paused === true && /queue-abandonment/i.test(coachText()) && !/they wait/i.test(coachText()),
  `paused=${G.paused} text=${coachText().slice(0, 120)}`);
check('discount card never offers a top-up', !coachButtons().some(b => /top up/i.test(b.textContent)), coachButtons().map(b => b.textContent).join('|'));
coachButtons().find(b => /watch my plan/i.test(b.textContent))?.click();
check('discount watch resumes', G.paused === false, 'still paused');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — coach: honest copy, owned pauses, real levers, dies with the day');
