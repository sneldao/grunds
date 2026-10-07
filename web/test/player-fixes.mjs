// Player-experience fixes: drag threshold, dawn save, rush speed, restart path.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { dragExceeded, pinchRadius, DRAG_THRESHOLD_PX, cameraGestureTarget, stalePointerIds, mouseButtonsUp } from '../js/gestures.js';
import { saveWeek, loadWeek, clearWeek, resumeLabel, WEEK_SAVE_KEY } from '../js/weekSave.js';
import { rushSpeed, RUSH_SPEED } from '../js/paceNotice.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const mainSrc = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');
const index = readFileSync(join(ROOT, 'web/index.html'), 'utf8');

assert.equal(dragExceeded(3, 4), false, '5px is under the drag threshold');
assert.equal(dragExceeded(6, 0), true, '6px on one axis is a drag');
assert.equal(dragExceeded(5, 5), true, 'diagonal past the threshold is a drag');
assert.equal(DRAG_THRESHOLD_PX, 6);
assert.equal(pinchRadius(100, 200, 24), 12, 'spreading fingers zooms in');
assert.equal(pinchRadius(100, 50, 24), 34, 'pinch radius clamps at 34');
assert.equal(pinchRadius(0, 10, 24), 24, 'a zero span does not move the camera');

const view = { id: 'view', tagName: 'CANVAS', parentElement: { id: '', tagName: 'BODY', parentElement: null } };
assert.equal(cameraGestureTarget(view), true, 'the street view still orbits');
const hudBtn = { id: '', tagName: 'BUTTON', parentElement: { id: 'hud', tagName: 'DIV', parentElement: null } };
assert.equal(cameraGestureTarget(hudBtn), false, 'a HUD press is not a drag');
const shown = { id: 'brief', tagName: 'DIV', classList: { contains(c) { return c === 'modal' || c === 'show'; } }, parentElement: null };
assert.equal(cameraGestureTarget({ tagName: 'P', id: '', parentElement: shown }), false, 'an open card keeps the camera');
assert.equal(cameraGestureTarget({ tagName: 'BODY', id: '', parentElement: null }), true, 'the page itself can still orbit after a card');
assert.deepEqual(stalePointerIds([1, 7], { pointerType: 'mouse', pointerId: 1 }), [7], 'a new mouse press drops a stuck touch');
assert.deepEqual(stalePointerIds([1, 2], { pointerType: 'touch', pointerId: 3 }), [], 'a second finger is a real pinch');
assert.equal(mouseButtonsUp({ pointerType: 'mouse', type: 'pointermove', buttons: 0 }), true);
assert.equal(mouseButtonsUp({ pointerType: 'mouse', type: 'pointermove', buttons: 1 }), false);

const camSrc = readFileSync(join(ROOT, 'web/js/camera.js'), 'utf8');
assert.match(camSrc, /setPointerCapture/);
assert.match(camSrc, /addEventListener\('blur'/);
assert.match(camSrc, /release\(\)/);
assert.match(mainSrc, /rig\.blocked/);
assert.match(mainSrc, /view\.inert = false/);
assert.match(mainSrc, /SCHEDULE_LOAD_MS = 30000/);
assert.match(mainSrc, /AbortSignal\.timeout\(SCHEDULE_LOAD_MS\)/);
assert.match(mainSrc, /if \(attempt < 1\)/);
assert.doesNotMatch(mainSrc, /api\/schedule\.json',\s*\{\s*signal:\s*AbortSignal\.timeout\(12000\)/);

const mem = { m: new Map(), getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }, setItem(k, v) { this.m.set(k, String(v)); }, removeItem(k) { this.m.delete(k); } };
assert.equal(loadWeek(mem), null);
const saved = saveWeek(mem, { seed: 7, day: 3, exchange: { debt: 40 } });
assert.equal(saved.day, 3);
assert.equal(resumeLabel(loadWeek(mem)), 'resume day 3');
assert.equal(loadWeek(mem).exchange.debt, 40);
assert.equal(loadWeek(mem).v, 1);
clearWeek(mem);
assert.equal(mem.getItem(WEEK_SAVE_KEY), null);
assert.equal(loadWeek({ getItem() { return '{'; } }), null, 'a broken save reads as no week');
assert.equal(saveWeek(mem, { seed: 1 }), null, 'a save without a day is refused');

const drop = rushSpeed(840, 1200, false);
assert.equal(drop.speed, RUSH_SPEED);
assert.match(drop.notice, /5×/);
assert.match(drop.notice, /17:00/);
assert.equal(drop.blocked, true);
const held = rushSpeed(900, 1200, false);
assert.equal(held.speed, RUSH_SPEED);
assert.equal(held.notice, null, 'the explanation fires once, at 14:00');
const back = rushSpeed(1020, 1200, false);
assert.equal(back.speed, 1200);
assert.equal(back.restored, true);
assert.match(back.notice, /20×/);
assert.equal(rushSpeed(840, 1200, true).speed, 1200, 'headless keeps its speed');
assert.equal(rushSpeed(840, 300, false).speed, 300, '5× is not capped further');

assert.match(mainSrc, /coreOnly === true/);
assert.match(mainSrc, /function askRestart\(/);
assert.match(mainSrc, /function capturePreDawn\(/);
assert.match(mainSrc, /function resumeWeek\(/);
assert.match(mainSrc, /beforeunload/);
assert.match(index, /restart week/);
assert.match(index, /id="resume"/);
assert.match(index, /id="tillhint"/);
assert.match(index, /grundsBootFail/);
assert.doesNotMatch(mainSrc, /schedule missing — run: python3/);

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
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { if (v === undefined) v = !this._s.has(c); v ? this._s.add(c) : this._s.delete(c); return v; }, contains(c) { return this._s.has(c); } },
    appendChild(c) { c._parent = el; el.children.push(c); return c; },
    append(...cs) { for (const c of cs) el.appendChild(c); },
    prepend(c) { c._parent = el; el.children.unshift(c); },
    remove() {},
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {},
    setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; }, removeAttribute() {},
    matches() { return false; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; },
    getContext: () => anyProxy(),
    focus() {},
    get lastChild() { return el.children[el.children.length - 1] || null; },
    click() { if (el.onclick) el.onclick(); },
    onclick: null,
  };
  return el;
}
const registry = new Map();
globalThis.document = {
  getElementById: id => { if (!registry.has(id)) registry.set(id, makeEl()); return registry.get(id); },
  createElement: t => makeEl(t),
  createElementNS: () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} }),
  querySelectorAll: () => [],
  body: makeEl('body'),
};
globalThis.window = globalThis;
globalThis.__headless = true;
globalThis.__noGLB = true;
globalThis.innerWidth = 1280; globalThis.innerHeight = 800; globalThis.devicePixelRatio = 1;
globalThis.location = { search: '', href: 'http://local/' };
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = () => {};
globalThis.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(schedule) });
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
const _warn = console.warn;
console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _warn(...a); };

await import('../js/main.js');
await new Promise(r => setTimeout(r, 30));
const G = globalThis.__grunds;
registry.get('open').click();
await new Promise(r => setTimeout(r, 20));
assert.equal(G.phase, 'planning', 'boot lands in a plannable day');

G.reset(true);
assert.equal(G.phase, 'onboarding', 'an explicit core reset stops before the new dawn');
G.reset({ type: 'click' });
assert.equal(G.phase, 'planning', 'a click event is not coreOnly — day 1 is prepared');
assert.equal(G.stats().day, 1);

registry.get('reset').click();
assert.equal(registry.get('restart-ask').hidden, false, 'the restart button asks first');
assert.equal(G.phase, 'planning', 'asking does not abandon the day');
registry.get('restart-no').click();
assert.equal(registry.get('restart-ask').hidden, true);
registry.get('reset').click();
registry.get('restart-yes').click();
assert.equal(G.phase, 'planning');
assert.equal(G.stats().day, 1, 'confirming the restart lands on a working day 1');

console.log('player-fixes: drag, save, rush speed, restart path');
