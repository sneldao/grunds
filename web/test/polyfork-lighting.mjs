import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from '../vendor/three.module.js';
import { loadPF, registerPFNight } from '../js/polyfork.js';
import { initDistrictGen } from '../js/districtGen.js';
import { initFranchise } from '../js/franchise.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'assets/polyfork/manifest.json'), 'utf8'));

const NIGHT_ID = 'street-lamp-136745';
const NIGHT_ZONE = 'lens';
const NIGHT_ALBEDO = manifest[NIGHT_ID].night[NIGHT_ZONE].albedo;
assert.ok(NIGHT_ALBEDO, 'fixture asset lost its night albedo');

const firstNightAlbedo = (id) => {
  const e = manifest[id] || {};
  for (const [zone, n] of Object.entries(e.night || {})) {
    const albedo = n.albedo || e.zones?.[zone];
    if (albedo) return albedo;
  }
  return null;
};

function nightGeometry(albedo) {
  const glow = new THREE.Color(albedo);
  const flat = new THREE.Color('#808080');
  const pos = new Float32Array([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    2, 0, 0, 3, 0, 0, 2, 1, 0,
  ]);
  const col = new Float32Array([
    glow.r, glow.g, glow.b, glow.r, glow.g, glow.b, glow.r, glow.g, glow.b,
    flat.r, flat.g, flat.b, flat.r, flat.g, flat.b, flat.r, flat.g, flat.b,
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function fakeGroup(url) {
  const id = /polyfork\/([^.]+)\.glb/.exec(url || '')?.[1];
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(nightGeometry(firstNightAlbedo(id) || '#808080'), new THREE.MeshStandardMaterial());
  group.add(mesh);
  return group;
}

const fakeLoader = () => ({ loadGLB: async (url) => fakeGroup(url) });
const sceneOf = () => ({ added: [], add(g) { this.added.push(g); } });
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
const allRegistered = (insts, entries) => insts.every(
  (inst) => (inst.userData.pfNight || []).every((e) => entries.includes(e)),
);

test('night triangles stay in the opaque base and overlay a dimmable glow', async () => {
  const inst = await loadPF(fakeLoader(), NIGHT_ID, { night: 'street' });
  const mesh = inst.children[0];
  const base = mesh.geometry.getIndex();
  assert.equal(base.count, 6, 'both triangles keep their opaque surface');
  assert.equal(mesh.material.transparent, false, 'base stays opaque');

  const glow = mesh.children.find(c => c.userData.pfGlow);
  assert.ok(glow, 'no glow overlay mesh');
  assert.equal(glow.geometry.getIndex().count, 3, 'only the albedo-matched triangle glows');
  assert.equal(glow.material.transparent, true);
  assert.equal(glow.material.opacity, 0, 'glow starts dark — the day/night driver owns it');
  assert.equal(glow.material.polygonOffset, true, 'coplanar overlay needs the offset');
  assert.equal(glow.material.polygonOffsetFactor, -1);
  assert.equal(glow.material.polygonOffsetUnits, -1);

  assert.equal(inst.userData.pfNight.length, 1);
  assert.equal(inst.userData.pfNight[0].mat, glow.material);
});

test('registerPFNight is idempotent and the registered mats drive night->0', async () => {
  const inst = await loadPF(fakeLoader(), NIGHT_ID, { night: 'street' });
  const entries = [];
  registerPFNight(entries, inst);
  registerPFNight(entries, inst);
  assert.equal(entries.length, 1, 're-registering the same instance must not duplicate');
  for (const e of entries) e.mat.opacity = 0.9;
  for (const e of entries) e.mat.opacity = 0;
  const mesh = inst.children[0];
  assert.equal(mesh.geometry.getIndex().count, 6, 'base surface is untouched by the night drive');
  registerPFNight(entries, { userData: {} });
  registerPFNight(entries, null);
  assert.equal(entries.length, 1, 'instances without pfNight register nothing');
});

test('district onPlaced fires for every seeded slot and registers pfNight', async () => {
  const placed = [];
  const entries = [];
  const scene = sceneOf();
  const state = initDistrictGen({
    scene, seed: 7, polyfork: true, loader: fakeLoader(),
    onPlaced: (slot, inst) => { placed.push(slot); registerPFNight(entries, inst); },
  });
  await flush();
  assert.equal(state.live, true);
  assert.equal(placed.length, 6, `expected all six slots, got ${placed}`);
  assert.equal(scene.added.length, 6);
  assert.ok(allRegistered(scene.added, entries), 'a placed prop missed night registration');
});

test('district placeholders never reach onPlaced', async () => {
  const placed = [];
  const scene = sceneOf();
  const state = initDistrictGen({
    scene, seed: 7, polyfork: true,
    loader: { loadGLB: async () => ({ userData: { placeholder: true } }) },
    onPlaced: (slot) => placed.push(slot),
  });
  await flush();
  assert.equal(placed.length, 0);
  assert.equal(state.placed, 0);
  assert.equal(scene.added.length, 0);
});

test('franchise describe registers pfNight through onPlaced', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const placed = [];
  const entries = [];
  const scene = sceneOf();
  const fr = initFranchise({
    scene, seed: 7, polyfork: true, loader: fakeLoader(),
    onPlaced: (inst) => { placed.push(inst); registerPFNight(entries, inst); },
  });
  await flush();
  const res = await fr.describe('14', 'a coffee kiosk for the corner', 3, 'draw', 'Test');
  assert.equal(res.status, 'success');
  assert.equal(placed.length, 1, 'described stand landed through onPlaced');
  assert.equal(scene.added.length, 1);
  assert.ok(allRegistered(scene.added, entries));
});

test('franchise hydration registers stands that were always there', async () => {
  globalThis.localStorage = {
    getItem: (k) => k === 'grunds-pf-stands-7'
      ? JSON.stringify({ '11': { pfId: 'market-stall-94937d', prompt: 'market', day: 3, purpose: 'community', byline: 'R' } })
      : null,
    setItem() {}, removeItem() {},
  };
  const placed = [];
  const arrived = [];
  const scene = sceneOf();
  initFranchise({
    scene, seed: 7, polyfork: true, loader: fakeLoader(),
    onPlaced: (inst) => placed.push(inst),
    onArrived: (inst, def, ls) => arrived.push(def.id),
  });
  await flush();
  assert.equal(placed.length, 1, 'hydrated stand registered through onPlaced');
  assert.equal(arrived.length, 0, 'hydration never toasts — but still registers');
  assert.equal(scene.added.length, 1);
});

test('franchise placeholders never register', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const placed = [];
  const scene = sceneOf();
  const fr = initFranchise({
    scene, seed: 7, polyfork: true,
    loader: { loadGLB: async () => ({ userData: { placeholder: true } }) },
    onPlaced: (inst) => placed.push(inst),
  });
  await flush();
  const res = await fr.describe('14', 'a coffee kiosk for the corner', 3);
  assert.notEqual(res.status, 'success');
  assert.equal(placed.length, 0);
  assert.equal(scene.added.length, 0);
});
