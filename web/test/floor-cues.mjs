import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CUE_MS, FLOOR_CUES, shouldTeachOpening, cueSchedule, advanceElapsed,
  briefCueCopy, priceCueBrief, pastryCueBrief, wireCueBrief, wireTapeLine, pastryTodayLine,
} from '../js/floorCues.js';
import { DRINKS } from '../js/menu.js';
import { ECON } from '../js/config.js';
import { TOOL_IDS } from '../js/curriculum.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0;
const ok = (cond, name) => { if (!cond) { console.error('FAIL', name); process.exitCode = 1; } else pass++; };

ok(FLOOR_CUES.map(c => c.id).join(',') === 'price,pastry,wire', 'three beats, in order');
ok(FLOOR_CUES.length * CUE_MS <= 60000, 'the sequence fits the opening minute');
ok(shouldTeachOpening({ wantTutorial: true, unlockAll: false, veteran: false }), 'new player is taught');
ok(!shouldTeachOpening({ wantTutorial: false, unlockAll: false, veteran: false }), 'skipTutorial is not taught');
ok(!shouldTeachOpening({ wantTutorial: true, unlockAll: true, veteran: false }), 'unlocked curriculum is not taught');
ok(!shouldTeachOpening({ wantTutorial: true, unlockAll: false, veteran: true }), 'a veteran is not taught');

ok(cueSchedule(0).cue.id === 'price' && !cueSchedule(0).done, 't = 0 is the price');
ok(cueSchedule(CUE_MS - 1).cue.id === 'price', 'price holds until the boundary');
ok(cueSchedule(CUE_MS).cue.id === 'pastry', 'the case is second');
ok(cueSchedule(CUE_MS * 2).cue.id === 'wire', 'the wire is third');
ok(cueSchedule(CUE_MS * 3).done && cueSchedule(CUE_MS * 3).cue === null, 'after the third beat the tips are done');
ok(advanceElapsed(100) === CUE_MS && advanceElapsed(CUE_MS + 5) === CUE_MS * 2, 'next jumps a whole beat');

const price = priceCueBrief();
ok(price.includes(`£${DRINKS.matcha.base.toFixed(2)}`) && price.includes(`£${ECON.matchaDeal.toFixed(2)}`), 'price cue names the board and the deal');
ok(price.includes(`£${DRINKS.espresso.base.toFixed(2)}`) && price.includes('20p'), 'price cue names the other drinks and the step');
const pastry = pastryCueBrief();
ok(/full case, half, or skip/.test(pastry) && /One in four leaves/.test(pastry), 'pastry cue names the bake and the empty case');
ok(!/croissants, already in the cabinet/.test(pastry), 'pastry cue omits a count when the case is empty');
ok(pastryCueBrief(12).startsWith('Today’s case is 12 croissants, already in the cabinet.'), 'pastry cue leads with today’s case');
ok(pastryTodayLine(0) === '' && pastryTodayLine(12).includes('12 croissants'), 'today’s case count only when there is one');
const quiet = wireCueBrief({ beanIndex: 1, eventHead: '' });
ok(/morning wire is the bean market/.test(quiet) && /Beans are 1\.00/.test(quiet) && /frost or a drought/.test(quiet), 'a quiet morning still explains a shock');
const frost = wireCueBrief({ beanIndex: 1.4, eventHead: 'FROST ON MINAS GERAIS' });
ok(frost.startsWith('FROST ON MINAS GERAIS.'), frost);
ok(wireTapeLine({ beanIndex: 1.4, eventHead: 'FROST ON MINAS GERAIS' }) === 'morning wire · beans 1.40 · FROST ON MINAS GERAIS', wireTapeLine({ beanIndex: 1.4, eventHead: 'FROST ON MINAS GERAIS' }));
const lines = briefCueCopy({ beanIndex: 1, eventHead: '', onOrder: 8 });
ok(lines.map(l => l.kicker).join('|') === 'What to price|The pastry case|The morning wire', lines.map(l => l.kicker).join('|'));
ok(lines[1].text.includes('8 croissants, already in the cabinet'), 'the brief pastry line carries today’s count');

const html = readFileSync(join(ROOT, 'web/index.html'), 'utf8');
const main = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
ok(html.includes('id="floorcue"') && html.includes('id="brief-cues"') && html.includes('skip tips'), 'the page has the tip and the brief lines');
ok(main.includes('syncFloorCues') && main.includes("urlParams.has('skipTutorial')"), 'the floor clock is wired and skipTutorial still exists');
ok(main.includes('An empty case still sells the drink. One in four leaves, and the room notices.'), 'the pastry rule on the brief is unchanged');

console.log(`floor-cues pure: ${pass} pass`);

// ---- headless floor: tips follow the clock, skip still clears them ----
const schedule = JSON.parse(readFileSync(join(ROOT, 'out/wave_schedule.json'), 'utf8'));
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
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, v) { if (v === undefined) this._s.has(c) ? this._s.delete(c) : this._s.add(c); else if (v) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
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
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }; }
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
  }
}
const fails = [];
function check(name, cond, detail) {
  if (cond) console.log('  PASS', name);
  else fails.push(`${name}: ${detail || 'failed'}`);
}
const byId = id => registry.get(id);
function findId(el, id) {
  if (!el) return null;
  if (el.id === id) return el;
  for (const c of el.children || []) {
    const hit = findId(c, id);
    if (hit) return hit;
  }
  return null;
}
const deepText = el => {
  if (!el) return '';
  let t = el.textContent || '';
  for (const c of el.children || []) t += '\n' + deepText(c);
  return t;
};

await import('../js/main.js');
await new Promise(r => setTimeout(r, 40));
const G = globalThis.__grunds;
byId('open').click();
await new Promise(r => setTimeout(r, 10));

check('headless boot does not teach', byId('floorcue').hidden === true && G.floorCues.finished() === false, `hidden=${byId('floorcue').hidden}`);

G.testState({ tutorial: true, curriculum: true, softOpening: false, openingGuidance: false });
G.renderBrief();
{
  const host = byId('brief-cues');
  const text = deepText(host);
  check('first brief names the three calls', host.hidden === false && /What to price/.test(text) && /The pastry case/.test(text) && /The morning wire/.test(text), text.slice(0, 240));
  check('brief pastry line names today’s case', /croissants, already in the cabinet/.test(text), text.slice(0, 400));
  check('brief price line uses the live board and the deal', text.includes(`£${DRINKS.matcha.base.toFixed(2)}`) && text.includes(`£${ECON.matchaDeal.toFixed(2)}`), text);
  const pastryRow = findId(byId('brief-prep'), 'brief-pastry');
  check('brief spots the menu and the case', byId('brief-menu').classList.contains('cue-spot') && pastryRow && pastryRow.classList.contains('cue-spot'));
  check('today’s croissant count sits on the case row', pastryRow && /croissants, already in the cabinet/.test(deepText(pastryRow)), deepText(pastryRow).slice(0, 180));
}

const opened = G.commitDayPlan();
check('day opens without a forced plan', opened && opened.ok === true, JSON.stringify(opened));
runFrames(1);
check('first tip is the price, and it does not pause', byId('floorcue').hidden === false && /chalkboard is the price/.test(byId('floorcue-body').textContent) && G.paused === false, byId('floorcue-body').textContent);
check('the price tip spots the 2 key', byId('reprice').classList.contains('cue-spot'));
check('progress reads 1 of 3', /1 of 3/.test(byId('floorcue-kicker').textContent), byId('floorcue-kicker').textContent);

byId('floorcue-next').click();
check('next moves to the pastry case', /glass case/.test(byId('floorcue-body').textContent) && /2 of 3/.test(byId('floorcue-kicker').textContent), byId('floorcue-body').textContent);
check('the price spot steps off', !byId('reprice').classList.contains('cue-spot'));

G.floorCues.advance();
check('the following beat is the morning wire', /ticker on the street/.test(byId('floorcue-body').textContent) && document.body.classList.contains('cue-wire'), byId('floorcue-body').textContent);
check('the tape names the wire while that tip is up', byId('tape').style.display === 'block' && /morning wire/.test(byId('tape').textContent || ''), byId('tape').textContent);

G.floorCues.advance();
check('the beat after the wire clears the tips', byId('floorcue').hidden === true && G.floorCues.finished() === true && !document.body.classList.contains('cue-wire'));

G.reset();
await new Promise(r => setTimeout(r, 20));
G.testState({ tutorial: true, curriculum: true, softOpening: false, openingGuidance: false });
check('a fresh run arms the tips again', G.commitDayPlan().ok === true);
runFrames(1);
check('skip tips hides them and leaves the café running', (() => { byId('floorcue-skip').click(); return byId('floorcue').hidden === true && G.floorCues.finished() === true && G.paused === false && G.phase === 'trading'; })(), `phase=${G.phase} paused=${G.paused}`);

G.reset();
await new Promise(r => setTimeout(r, 20));
G.testState({ tutorial: true, curriculum: true, softOpening: false, openingGuidance: false });
G.commitDayPlan();
runFrames(1);
G.coach.begin(true);
G.coach.skip();
check('skip guidance clears the opening tips', byId('floorcue').hidden === true && G.floorCues.finished() === true, `hidden=${byId('floorcue').hidden} finished=${G.floorCues.finished()}`);

G.reset();
await new Promise(r => setTimeout(r, 20));
G.testState({ tutorial: false, curriculum: true, softOpening: false, openingGuidance: false });
G.renderBrief();
G.commitDayPlan();
runFrames(4);
check('skipTutorial shows neither the brief lines nor the tips', byId('brief-cues').hidden === true && byId('floorcue').hidden === true && G.floorCues.finished() === false, `briefHidden=${byId('brief-cues').hidden} tipHidden=${byId('floorcue').hidden}`);

G.reset();
await new Promise(r => setTimeout(r, 20));
G.testState({ tutorial: true, curriculum: true, curriculumIntroduced: [...TOOL_IDS], softOpening: false, openingGuidance: false });
G.renderBrief();
G.commitDayPlan();
runFrames(3);
check('a veteran who already met every tool is not retutored', byId('brief-cues').hidden === true && byId('floorcue').hidden === true, `brief=${byId('brief-cues').hidden} tip=${byId('floorcue').hidden}`);

G.reset();
await new Promise(r => setTimeout(r, 20));
G.testState({ tutorial: true, curriculum: true, curriculumIntroduced: null, softOpening: false, openingGuidance: false });
G.commitDayPlan();
runFrames(1);
check('price tip is up before Ruth’s card', byId('floorcue').hidden === false && /1 of 3/.test(byId('floorcue-kicker').textContent), byId('floorcue-kicker').textContent);
const beforeHold = G.floorCues.run();
G.coach.begin(true);
runFrames(1);
check('Ruth’s card hides the tip', byId('coach').hidden === false && byId('floorcue').hidden === true && byId('floorcue-body').textContent === '', `coach=${byId('coach').hidden} tip=${byId('floorcue').hidden}`);
for (let i = 0; i < 40; i++) {
  now += 20000;
  const cb = rafCb; rafCb = null;
  if (cb) cb(now);
}
const held = G.floorCues.run();
check('the cue clock waits while the card is open', byId('floorcue').hidden === true && beforeHold && held && held.elapsed === beforeHold.elapsed && held.index === beforeHold.index && G.floorCues.finished() === false, JSON.stringify({ before: beforeHold, held }));
G.coach.hide();
runFrames(1);
check('dismissing the card resumes on the price', byId('floorcue').hidden === false && /chalkboard is the price/.test(byId('floorcue-body').textContent) && /1 of 3/.test(byId('floorcue-kicker').textContent), `${byId('floorcue-kicker').textContent} ${byId('floorcue-body').textContent}`);

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('floor-cues: pass');
