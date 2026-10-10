import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stockDisplayCount, setStockVisibility, ingredientDisplay } from '../js/floorStock.js';
import { PAL } from '../js/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const THREE = await import('../vendor/three.module.js');
const worldSrc = readFileSync(join(ROOT, 'web/js/world.js'), 'utf8');
const mainSrc = readFileSync(join(ROOT, 'web/js/main.js'), 'utf8');

test('stockDisplayCount maps fill levels to slots', () => {
  assert.equal(stockDisplayCount(100, 100), 6);
  assert.equal(stockDisplayCount(50, 100), 3);
  assert.equal(stockDisplayCount(1, 100), 1);
  assert.equal(stockDisplayCount(0, 100), 0);
  assert.equal(stockDisplayCount(200, 100), 6);
  for (const bad of [-5, null, undefined, NaN, Infinity, '50', '10'])
    assert.equal(stockDisplayCount(bad, 100), 0, JSON.stringify(bad));
  assert.equal(stockDisplayCount(2.9, 10), 2);
  assert.equal(stockDisplayCount(10, 10, 2.9), 2);
  assert.equal(stockDisplayCount(5, 0), 1);
  assert.equal(stockDisplayCount(5, undefined), 1);
  assert.equal(stockDisplayCount(5, 'x'), 1);
  assert.equal(stockDisplayCount(5, 10, 0), 0);
  assert.equal(stockDisplayCount(5, 10, -1), 0);
  assert.equal(stockDisplayCount(5, 10, Infinity), 0);
  assert.equal(stockDisplayCount(5, 10, '6'), 0);
});

test('setStockVisibility toggles real groups and returns the count', () => {
  const groups = Array.from({ length: 6 }, () => new THREE.Group());
  assert.equal(setStockVisibility(groups, 50, 100), 3);
  assert.deepEqual(groups.map(g => g.visible), [true, true, true, false, false, false]);
  assert.equal(setStockVisibility(groups, 0, 100), 0);
  assert.ok(groups.every(g => g.visible === false));
  assert.equal(setStockVisibility(groups, 100, 100), 6);
  assert.ok(groups.every(g => g.visible === true));
});

test('late-attached meshes stay hidden under a hidden slot', () => {
  const groups = Array.from({ length: 6 }, () => new THREE.Group());
  setStockVisibility(groups, 0, 100);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  groups[0].add(mesh);
  assert.equal(groups[0].visible, false);
  assert.equal(groups[0].children.length, 1);
  setStockVisibility(groups, 0, 100);
  setStockVisibility(groups, 0, 100);
  assert.equal(groups.length, 6);
  assert.equal(groups[0].children.length, 1);
  assert.equal(groups[0].visible, false);
});

test('world.js wires pastry slots as GLB parents on W', () => {
  const i = worldSrc.indexOf('pastrySlots');
  const seg = worldSrc.slice(i, worldSrc.indexOf('W._pastrySlots'));
  assert.ok(seg.includes(`place(slot, 'croissant.glb'`));
  assert.ok(seg.includes(`place(slot, 'cake.glb'`));
  assert.ok(worldSrc.includes(`import { setStockVisibility, ingredientDisplay } from './floorStock.js';`));
  assert.ok(worldSrc.includes('W._pastrySlots = pastrySlots'));
  assert.ok(worldSrc.includes('W.setPastryStock'));
});

test('main.js feeds the live stock and capacity into the setter', () => {
  const start = mainSrc.indexOf('function updateHUD()');
  const gate = mainSrc.indexOf('lastHudText < 200', start);
  assert.ok(start >= 0 && gate > start);
  const seg = mainSrc.slice(start, gate);
  assert.ok(seg.includes('if (started) world.setPastryStock?.(ctx.pastryStock, pastryCaseCap)'));
  const day = mainSrc.indexOf('ctx.pastryStock = pastryOnOrder;');
  assert.ok(mainSrc.slice(day, day + 90).includes('pastryCaseCap = pastryOnOrder'));
  assert.ok(seg.includes('world.setIngredients?.('));
  for (const token of ['ctx.milkStock', 'milkDelivery', 'lotState.entry(lotState.house)?.stock', 'ctx.batchUnits', 'ECON.batchUnits', 'ctx.batchReservedUntil > dayMin', "phase === 'trading' && !closed"])
    assert.ok(seg.includes(token), token);
});

test('real built world owns six pastry slots driven by setPastryStock', async () => {
  const schedule = JSON.parse(readFileSync(join(ROOT, 'out', 'wave_schedule.json'), 'utf8'));
  const anyProxy = () => new Proxy(function () {}, {
    get: (t, k) => { if (k === Symbol.toPrimitive) return h => h === 'string' ? 'WebGL 2.0' : 1; if (k === 'then') return undefined; return anyProxy(); },
    set: () => true, apply: () => anyProxy(),
  });
  const el = () => {
    const e = { children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', disabled: false, offsetWidth: 10,
      classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c, v){v?this._s.add(c):this._s.delete(c);}, contains(c){return this._s.has(c);} },
      appendChild(c){c._parent=e;e.children.push(c);return c;},
      prepend(c){c._parent=e;e.children.unshift(c);},
      remove(){const p=e._parent;if(p){const i=p.children.indexOf(e);if(i>=0)p.children.splice(i,1);}},
      querySelector:()=>el(), querySelectorAll:()=>[], addEventListener(){},
      get lastChild(){return e.children[e.children.length-1]||null;}, click(){e.onclick&&e.onclick();}, onclick:null };
    return e;
  };
  const reg = new Map();
  const cs = () => ({ width: 0, height: 0, getContext: () => anyProxy(), style: {}, addEventListener() {} });
  globalThis.document = { getElementById: id => { if (!reg.has(id)) reg.set(id, el()); return reg.get(id); }, createElement: t => t === 'canvas' ? cs() : el(), createElementNS: () => cs(), querySelectorAll: () => [], body: el() };
  globalThis.window = globalThis; globalThis.__headless = true; globalThis.__noGLB = true;
  globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
  globalThis.location = { search: '', hostname: 'localhost', origin: 'http://localhost' };
  globalThis.addEventListener = () => {};
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.requestAnimationFrame = () => {};
  globalThis.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(schedule) });
  class ACS {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
    createGain() { return { gain: { value: 0, setTargetAtTime(){}, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){}, disconnect(){} }; }
    createOscillator() { return { type:'', frequency:{value:0,setTargetAtTime(){},exponentialRampToValueAtTime(){},setValueAtTime(){}}, detune:{value:0}, connect(){}, start(){}, stop(){} }; }
    createBiquadFilter() { return { type:'', frequency:{value:0}, Q:{value:0}, connect(){}, disconnect(){} }; }
    createBufferSource() { return { buffer:null, loop:false, playbackRate:{value:1}, connect(){}, disconnect(){}, start(){}, stop(){} }; }
    createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
    resume(){}
  }
  globalThis.AudioContext = ACS;
  const _w = console.warn; console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) _w(...a); };
  const _e = console.error; console.error = (...a) => { if (!String(a[0]).startsWith('THREE.')) _e(...a); };
  await import('../js/main.js?floorstock=1');
  await new Promise(r => setImmediate(r));
  const world = globalThis.__grunds.world;
  const slots = world._pastrySlots;
  assert.equal(slots.length, 6);
  assert.ok(slots.every(s => s instanceof THREE.Group));
  await new Promise(r => setImmediate(r));
  for (const s of slots) assert.ok(s.children.length >= 1 && s.children[0].parent === s);
  assert.equal(typeof world.setPastryStock, 'function');
  assert.equal(world.setPastryStock(50, 100), 3);
  assert.deepEqual(slots.map(s => s.visible), [true, true, true, false, false, false]);
  assert.equal(world.setPastryStock(0, 100), 0);
  assert.ok(slots.every(s => s.visible === false));

  const ing = world._ingredientSlots;
  assert.equal(ing.milk.length, 2); assert.equal(ing.beans.length, 2); assert.equal(ing.batch.length, 3);
  const islots = [...ing.milk, ...ing.beans, ...ing.batch];
  assert.ok(islots.every(s => s instanceof THREE.Group && s.visible === false));
  const counts = world.setIngredients({ milkStock: 400, milkDelivery: 400, houseStock: 200, batchUnits: 20, batchCapacity: 40 });
  assert.deepEqual(counts, { milk: 2, beans: 2, batch: 2, reserved: false });
  assert.ok(ing.milk.every(s => s.visible) && ing.beans.every(s => s.visible));
  assert.deepEqual(ing.batch.map(s => s.visible), [true, true, false]);
  assert.equal(world._batchTray.visible, true);
  assert.equal(world._batchTray.material.color.getHex(), PAL.matcha);
  world.setIngredients({ batchUnits: 20, batchCapacity: 40, batchReserved: true });
  assert.equal(world._batchTray.material.color.getHex(), PAL.brass);
  world.setIngredients({});
  assert.ok(islots.every(s => !s.visible) && world._batchTray.visible === false);
});

test('ingredientDisplay maps stocks to fixed slot counts', () => {
  assert.deepEqual(ingredientDisplay({ milkStock: 400, milkDelivery: 400, houseStock: 200, batchUnits: 20, batchCapacity: 40 }),
    { milk: 2, beans: 2, batch: 2, reserved: false });
  assert.deepEqual(ingredientDisplay({ milkStock: 100, milkDelivery: 400, houseStock: 60, batchUnits: 5, batchCapacity: 40 }),
    { milk: 1, beans: 1, batch: 1, reserved: false });
  assert.deepEqual(ingredientDisplay({}), { milk: 0, beans: 0, batch: 0, reserved: false });
  assert.deepEqual(ingredientDisplay({ houseStock: 149, batchUnits: 40, batchCapacity: 40, batchReserved: true }),
    { milk: 0, beans: 1, batch: 3, reserved: true });
  assert.equal(ingredientDisplay({ houseStock: 150 }).beans, 2);
  assert.equal(ingredientDisplay({ houseStock: 151.9 }).beans, 2);
  for (const bad of [0, -1, null, undefined, NaN, Infinity, '300'])
    assert.equal(ingredientDisplay({ houseStock: bad }).beans, 0, String(bad));
  assert.equal(ingredientDisplay({ batchUnits: 0, batchReserved: true }).reserved, false);
  assert.equal(ingredientDisplay({ milkStock: 500, milkDelivery: 0 }).milk, 1);
  assert.equal(ingredientDisplay({ batchUnits: 40, batchCapacity: 0 }).batch, 1);
});

test('fitStockProp fits a prop into its slot in local space', async () => {
  const { fitStockProp } = await import('../js/world.js');
  const scene = new THREE.Group();
  const parent = new THREE.Group();
  parent.position.set(10, 5, -7); parent.rotation.y = Math.PI / 4;
  parent.visible = false;
  scene.add(parent);
  const mk = () => {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
    mesh.position.set(1, 2, 3); mesh.castShadow = true;
    g.add(mesh);
    return { g, mesh };
  };
  const { g, mesh } = mk();
  parent.add(g);
  scene.updateMatrixWorld(true);
  assert.equal(fitStockProp(g, 0.28), g);
  assert.equal(g.parent, parent);
  assert.equal(parent.visible, false);
  assert.equal(mesh.castShadow, false);
  scene.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g);
  assert.ok(Math.abs(bb.getSize(new THREE.Vector3()).y - 0.28) < 1e-6);
  assert.ok(Math.abs(bb.min.y - 5) < 1e-6);
  const c = bb.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(c.x - 10) < 1e-6 && Math.abs(c.z + 7) < 1e-6);
  assert.equal(g.children.length, 1);
  fitStockProp(g, 0.28);
  scene.updateMatrixWorld(true);
  const bb2 = new THREE.Box3().setFromObject(g);
  assert.ok(Math.abs(bb2.getSize(new THREE.Vector3()).y - 0.28) < 1e-6);
  assert.equal(g.children.length, 1);

  const late = mk();
  const slot = new THREE.Group();
  slot.position.set(-5.8, 1.106, -5.94); slot.visible = false;
  scene.add(slot);
  scene.updateMatrixWorld(true);
  slot.add(late.g);
  fitStockProp(late.g, 0.28);
  scene.updateMatrixWorld(true);
  const bb3 = new THREE.Box3().setFromObject(late.g);
  const c3 = bb3.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(c3.x + 5.8) < 1e-6 && Math.abs(c3.z + 5.94) < 1e-6);
  assert.ok(Math.abs(bb3.min.y - 1.106) < 1e-6);
  assert.equal(slot.visible, false);
});

test('ingredient GLBs exist, parse, and stay under the file budget', () => {
  let total = 0;
  for (const n of ['carton.glb', 'bag.glb']) {
    const buf = readFileSync(fileURLToPath(new URL(`../assets/${n}`, import.meta.url)));
    total += buf.length;
    assert.equal(buf.readUInt32LE(0), 0x46546C67, `${n} magic`);
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
    assert.ok(json.meshes.length >= 1);
    const tris = json.meshes.flatMap(m => m.primitives)
      .reduce((t, p) => t + (p.indices != null ? Math.floor(json.accessors[p.indices].count / 3) : 0), 0);
    assert.ok(tris > 0 && tris < 5000, `${n} tris ${tris}`);
  }
  assert.ok(total < 100 * 1024, `carton+bag ${total}`);
});
