// Headless test for the kit arrival celebration (districtGen.onGrown +
// kitArrival.js). Proves: the grown signal fires exactly once, only when the
// kit actually completes; the beat lands the cart, strikes the lights AFTER
// the day/night overwrite, toasts once, and cleans its layer up. Reduced
// motion keeps the moment, drops the motion.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from '../vendor/three.module.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- DOM / network stubs (district.mjs shape) ------------------------------------
function el() {
  return { style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10,
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,v){v?this._s.add(c):this._s.delete(c);}, contains(c){return this._s.has(c);} },
    appendChild(){}, append(){}, addEventListener(){}, click(){} };
}
globalThis.document = { getElementById: () => el(), createElement: () => el(), createElementNS: () => el(), querySelectorAll: () => [], body: el() };
globalThis.window = globalThis;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.location = { search: '?convex=http://x', hostname: 'convex.test', origin: 'http://x' };

const fails = [];
function check(name, cond, detail) { if (!cond) fails.push(`${name}: ${detail || 'failed'}`); else console.log('  PASS', name); }

// queue-controlled timers: the 30 s poll is a test step, not a wait
const realSetTimeout = globalThis.setTimeout.bind(globalThis);
let timerQ = [];
globalThis.setTimeout = (fn) => { timerQ.push(fn); return 1; };
async function settle(rounds = 10) {
  for (let i = 0; i < rounds; i++) {
    const q = timerQ.splice(0);
    for (const fn of q) await fn();
    await new Promise((r) => realSetTimeout(r, 0));   // drain microtasks (placeSlot)
  }
}

globalThis.__headless = false; globalThis.__noGLB = false;
const { initDistrictGen, SLOTS } = await import('../js/districtGen.js');

const fakeLoader = { async loadGLB() { const o = new THREE.Object3D(); o.userData = {}; return o; } };
const slotList = Object.keys(SLOTS);
const kit = (statuses) => ({ slots: Object.fromEntries(slotList.map((s, i) => [s, { status: statuses[i], modelUrl: statuses[i] === 'success' ? 'http://x/' + s + '.glb' : null }])) });

// ---- 1) processing kit grows under the polls; grown fires exactly once ------------
let responses = [
  kit(['processing', 'processing', 'processing', 'processing', 'processing']),
  kit(['success', 'success', 'success', 'success', 'success']),
];
globalThis.fetch = async (u) => {
  if (String(u).includes('ensure')) return { ok: true, json: async () => ({}) };
  const next = responses.length > 1 ? responses.shift() : responses[0];
  return { ok: true, json: async () => next };
};
const scene = { add(){} };
let grown = 0;
const st = initDistrictGen({ scene, seed: 7, classic: false, loader: fakeLoader });
st.onGrown = () => { grown++; };
await settle(6);
check('full kit → grown fires', grown === 1, `grown=${grown}`);
check('grownSlots carry every placed model', st.grownSlots.length === 5 && st.grownSlots.every(s => s.inst), `${st.grownSlots.length}`);
check('grown flag visible on state', st.grown === true, 'flag missing');
await settle(6);   // the fixed final response keeps being re-polled
check('onGrown fires exactly once', grown === 1, `grown=${grown}`);

// ---- 2) failed/missing stand-ins never block what landed ---------------------------
responses = [kit(['success', 'failed', 'success', 'success', 'success'])];
const st2 = initDistrictGen({ scene, seed: 11, classic: false, loader: fakeLoader });
let grown2 = 0; st2.onGrown = () => grown2++;
await settle(4);
check('failed stand-in does not block grown', grown2 === 1, `grown=${grown2}`);
responses = [kit(['success', 'failed', 'success', 'missing', 'processing'])];
const st3 = initDistrictGen({ scene, seed: 12, classic: false, loader: fakeLoader });
let grown3 = 0; st3.onGrown = () => grown3++;
await settle(4);
check('one processing slot → not grown yet', grown3 === 0 && st3.grown === false, `grown=${grown3}`);

// ---- 3) classic / headless never grow ----------------------------------------------
const stC = initDistrictGen({ scene, seed: 7, classic: true });
check('classic has no grown path', stC.grown === undefined && stC.live === false, 'classic leaked');
globalThis.__headless = true;
const stH = initDistrictGen({ scene, seed: 7, loader: fakeLoader });
check('headless has no grown path', stH.grown === undefined, 'headless leaked');
globalThis.__headless = false;

// ---- 4) the beat itself --------------------------------------------------------------
const { buildKitBeat } = await import('../js/kitArrival.js');
const world = {
  lights: { pendants: [{ intensity: 1 }] },
  bulbMats: [{ emissiveIntensity: 1 }],
  lampMats: [{ emissiveIntensity: 1 }],
  lampGlows: [{ opacity: 0.3 }],
};
const spy = { toasts: 0, fanfares: 0, layers: new Map() };
const director = { add: (id, fn) => spy.layers.set(id, fn), remove: (id) => spy.layers.delete(id) };
const audioStub = { waveFanfare: () => spy.fanfares++ };
const fxStub = { toast: () => spy.toasts++ };

const cartInst = new THREE.Object3D();
cartInst.position.set(8.6, 0, 7.0);
const slots = [
  { slot: 'cart', inst: cartInst },
  { slot: 'lantern', inst: new THREE.Object3D() },
  { slot: 'planter', inst: new THREE.Object3D() },
  { slot: 'stall', inst: new THREE.Object3D() },
  { slot: 'sign', inst: new THREE.Object3D() },
];

const beat = buildKitBeat({ world, audio: audioStub, fx: fxStub, director, headless: false });
check('beat is idle before start', beat.isActive === false, 'active pre-start');
beat.start(slots, 42);
check('cart teleported down the street to roll in', cartInst.position.x > 20, `x=${cartInst.position.x}`);
check('glow layer registered with the director', spy.layers.has('kitGlow'), 'no layer');
let now = performance.now();
let sawPulse = false;
for (let i = 0; i < 500; i++) {
  now += 16;
  world.lights.pendants[0].intensity = 1;                       // the day/night rewrite
  spy.layers.has('kitGlow') && spy.layers.get('kitGlow')({ now, dt: 0.016, vitality: 1 });
  if (world.lights.pendants[0].intensity > 1.5) sawPulse = true;
  beat.update(0.016, now);
}
check('lanterns pulse via the director layer after the rewrite', sawPulse, 'never lit');
check('cart landed back on its mark', Math.abs(cartInst.position.x - 8.6) < 0.01, `x=${cartInst.position.x}`);
check('toast + fanfare fired once at landing', spy.toasts === 1 && spy.fanfares === 1, `toasts=${spy.toasts} fanfares=${spy.fanfares}`);
check('beat over: layer removed, inactive again', !spy.layers.has('kitGlow') && beat.isActive === false, 'leaked layer');

// reduced motion: the moment without the motion
const cart2 = new THREE.Object3D(); cart2.position.set(8.6, 0, 7.0);
spy.toasts = 0; spy.fanfares = 0;
const beat2 = buildKitBeat({ world, audio: audioStub, fx: fxStub, director, reducedMotion: true, headless: false });
beat2.start([{ slot: 'cart', inst: cart2 }], 7);
check('reduced motion never moves the cart', cart2.position.x === 8.6, `x=${cart2.position.x}`);
check('reduced motion still toasts + fanfare', spy.toasts === 1 && spy.fanfares === 1, `t=${spy.toasts} f=${spy.fanfares}`);

// headless: total no-op
const cart3 = new THREE.Object3D(); cart3.position.set(8.6, 0, 0);
const beat3 = buildKitBeat({ world, audio: audioStub, fx: fxStub, director, headless: true });
beat3.start([{ slot: 'cart', inst: cart3 }], 7);
check('headless beat moves nothing and says nothing', cart3.position.x === 8.6 && spy.toasts === 1 /* only beat2's */, 'leaked');
globalThis.setTimeout = realSetTimeout;

// ---- 5) main.js policy: celebrate only what grows during play ----------------------
const mainSrc = readFileSync(join(ROOT, 'web', 'js', 'main.js'), 'utf8');
check('main.js keeps the district handle', /const district = initDistrictGen/.test(mainSrc), 'handle dropped again');
check('kitPendingAtOpen gates the celebration', /if \(d === 1\) kitPendingAtOpen = !district\.grown/.test(mainSrc) && /if \(kitPendingAtOpen\) kitBeat\.start/.test(mainSrc), 'policy missing');
check('beat updates every frame after the director', /director\.update\([\s\S]{0,120}kitBeat\.update\(dt, now\)/.test(mainSrc), 'not in loop');
check('halo stands down while the beat owns the floor', /busy: kitBeat\.isActive/.test(mainSrc), 'not wired');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — kit arrival: grown fires once for a real completion; the beat lands, lights strike post-rewrite, reduced motion keeps the moment');
