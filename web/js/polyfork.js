// polyfork.js — vendored Polyfork GLBs (web/assets/polyfork/) with
// albedo-zone tinting, night-glow extraction, and named-pivot discovery.
//
// Polyfork GLBs are single-material, flat-shaded, vertex-coloured
// (COLOR_0). Every colour knob's authored albedo is recorded in
// polyforkManifest.js, so we can:
//   - tint: rewrite the verts of a named zone to a palette token
//     (PF_TINT below / per-call opts.tint);
//   - night: split a zone's triangles out into an unlit overlay mesh whose
//     opacity world.js drives off the street/pendant factors — the
//     albedo-match recipe Polyfork documents for its `night` blocks;
//   - pivots: find rigged nodes (portafilter-a, tap-lever…) by name for
//     animation hooks.
//
// Assets are vendored by tools/vendor-polyfork.mjs. Load path matches
// loader.js: relative 'polyfork/<id>.glb' resolves under assets/.
//
// Geometry is only cloned when a zone actually needs editing, and only on
// that instance — cloneTemplate shares geometry, so editing in place would
// bleed into every other copy of the file.

import * as THREE from '../vendor/three.module.js';
import { PF_MANIFEST } from './polyforkManifest.js';

// Per-asset palette moves (zone knob -> grunds token). Kept minimal: the
// Modern Cafe kit's defaults already sit in the brass/cream/oak family, so
// most entries tune outliers rather than repaint whole models.
export const PF_TINT = {
  'espresso-machine-a2db84': { cheek: '#4a3423' },              // walnut cheeks
  'pastry-display-case-8bcce5': { trim: '#4a3423', plinth: '#2a2c34' }, // walnut trim, ink plinth
  'bistro-chair-7c354d': { linen: '#7fb3b0' },                  // teal seat linen
  'market-stall-94937d': { stripeA: '#c9a227', stripeB: '#f6efe0' },  // brass & cream awning
  'newsstand-6dfd65': { green: '#3d5243' },                     // ok-ink shell
  'globe-lamp-346cb6': { iron: '#3d5243' },                     // ok-ink post
  'shop-coffee-roaster-c6a2b5': { shell: '#d0603b' },           // terracotta body
};

const EPS = 0.02;

function hexVecs(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const srgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const lin = new THREE.Color(hex);
  return { srgb, linear: [lin.r, lin.g, lin.b] };
}

function readColors(geom) {
  const a = geom.getAttribute('color');
  if (!a) return null;
  const item = a.itemSize;
  const out = new Float32Array(a.count * item);
  if (a.array instanceof Float32Array) out.set(a.array);
  else for (let i = 0; i < a.count * item; i++) out[i] = a.array[i] / (a.normalized ? 255 : 1);
  return { arr: out, item };
}

function near(r, g, b, v) {
  return Math.abs(r - v[0]) < EPS && Math.abs(g - v[1]) < EPS && Math.abs(b - v[2]) < EPS;
}

// Zone plan: night zones first so their verts classify to the glow zone
// even where an albedo collides with an ordinary zone.
function buildPlan(entry, tint, hasNight) {
  const zones = entry.zones || {};
  const night = hasNight ? entry.night || {} : {};
  const plan = [];
  for (const [name, n] of Object.entries(night)) {
    const src = n.albedo || zones[name];
    if (!src) continue;
    plan.push({ name, src, night: { color: n.color, intensity: n.intensity ?? 0.8 } });
  }
  for (const [name, src] of Object.entries(zones)) {
    if (plan.some((p) => p.name === name && p.night)) continue;
    plan.push({ name, src });
  }
  for (const p of plan) {
    const v = hexVecs(p.src);
    p.srcSrgb = v.srgb; p.srcLin = v.linear;
    if (tint[p.name]) { const d = hexVecs(tint[p.name]); p.dstSrgb = d.srgb; p.dstLin = d.linear; }
  }
  return plan;
}

function processMesh(mesh, plan) {
  const geom = mesh.geometry;
  const col = readColors(geom);
  if (!col) return;
  const { arr, item } = col;
  const count = arr.length / item;

  // Which colour space did the generator write? Match the plan's best-known
  // zone both ways and take the representation with more hits.
  let linHits = 0, srgbHits = 0;
  const probe = plan[0];
  if (probe) {
    for (let i = 0; i < count; i++) {
      const r = arr[i * item], g = arr[i * item + 1], b = arr[i * item + 2];
      if (near(r, g, b, probe.srcLin)) linHits++;
      if (near(r, g, b, probe.srcSrgb)) srgbHits++;
    }
  }
  const useLin = linHits >= srgbHits;
  for (const p of plan) { p.srcV = useLin ? p.srcLin : p.srcSrgb; p.dstV = useLin ? p.dstLin : p.dstSrgb; }

  // Classify verts.
  const zoneOf = new Int16Array(count).fill(-1);
  for (let i = 0; i < count; i++) {
    const r = arr[i * item], g = arr[i * item + 1], b = arr[i * item + 2];
    for (let z = 0; z < plan.length; z++) {
      if (near(r, g, b, plan[z].srcV)) { zoneOf[i] = z; break; }
    }
  }

  // Partition triangles: night zones -> per-zone glow meshes, rest -> base.
  const idx = geom.getIndex();
  const triCount = idx ? idx.count / 3 : count / 3;
  const baseIdx = [];
  const glowIdx = plan.map(() => []);
  let anyGlow = false;
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3;
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    const za = zoneOf[a], zb = zoneOf[b], zc = zoneOf[c];
    if (za >= 0 && za === zb && zb === zc && plan[za].night) {
      glowIdx[za].push(a, b, c); anyGlow = true;
    } else baseIdx.push(a, b, c);
  }

  // Base geometry: cloned only when we actually changed something.
  let baseGeom = geom;
  const tinted = plan.some((p) => p.dstV);
  if (anyGlow || tinted) {
    baseGeom = geom.clone();
    if (anyGlow) baseGeom.setIndex(baseIdx);
    if (tinted) {
      const tarr = new Float32Array(arr);
      for (let i = 0; i < count; i++) {
        const z = zoneOf[i];
        if (z >= 0 && plan[z].dstV) {
          tarr[i * item] = plan[z].dstV[0];
          tarr[i * item + 1] = plan[z].dstV[1];
          tarr[i * item + 2] = plan[z].dstV[2];
        }
      }
      baseGeom.setAttribute('color', new THREE.BufferAttribute(tarr, item));
    }
    mesh.geometry = baseGeom;
  }

  // Glow overlays: children of the mesh (same local space as its verts),
  // unlit basic material whose opacity the day/night driver owns.
  const glows = [];
  if (anyGlow) {
    for (let z = 0; z < plan.length; z++) {
      if (!glowIdx[z].length) continue;
      const gGeom = geom.clone();
      gGeom.setIndex(glowIdx[z]);
      const n = plan[z].night;
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(n.color), transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const gm = new THREE.Mesh(gGeom, mat);
      gm.castShadow = false; gm.receiveShadow = false;
      gm.renderOrder = 4;
      gm.userData.pfGlow = true;
      mesh.add(gm);
      glows.push({ mat, intensity: n.intensity });
    }
  }
  return glows;
}

// Box-normalize an arbitrary GLB to a target world height and ground it at
// its current x/z (same contract as districtGen.fitToSlot).
export function fitPFHeight(inst, height) {
  const slot = inst.position.clone();
  inst.position.set(0, 0, 0);
  inst.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inst);
  if (box.isEmpty()) { inst.position.copy(slot); return inst; }
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 0.001) inst.scale.multiplyScalar(height / size.y);
  inst.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(inst);
  const c = box2.getCenter(new THREE.Vector3());
  inst.position.set(slot.x - c.x, -box2.min.y + slot.y, slot.z - c.z);
  return inst;
}

// Load a vendored Polyfork asset through the shared GLBLoader instance.
//   opts: position, rotationY, scale  — passed to loadGLB as-is
//         height                      — box-normalize to this world height
//         tint                        — {zoneName: hex} overrides on top of PF_TINT
//         night                       — 'street' | 'pend' | false (default 'street')
// Returns the instance with userData.pfId / pfParts / pfNight attached.
export async function loadPF(glb, id, opts = {}) {
  const inst = await glb.loadGLB(`polyfork/${id}.glb`, opts);
  const entry = PF_MANIFEST[id];
  if (!entry || inst.userData.placeholder) return inst;
  inst.userData.pfId = id;

  const tint = Object.assign({}, PF_TINT[id], opts.tint);
  const hasNight = Object.keys(entry.night || {}).length && opts.night !== false;
  if (Object.keys(tint).length || hasNight) {
    const plan = buildPlan(entry, tint, hasNight);
    const glows = [];
    // Collect first: processMesh adds glow children — traverse() would visit
    // nodes added mid-walk and recurse on them forever.
    const targets = [];
    inst.traverse((m) => {
      if (m.isMesh && !m.userData.pfGlow && m.geometry?.getAttribute('color')) targets.push(m);
    });
    for (const m of targets) {
      const g = processMesh(m, plan);
      if (g) glows.push(...g);
    }
    if (hasNight && glows.length) {
      const driver = opts.night || 'street';
      inst.userData.pfNight = glows.map((g) => ({ mat: g.mat, driver, intensity: g.intensity }));
    }
  }

  if (entry.pivots?.length) {
    inst.userData.pfParts = {};
    for (const n of entry.pivots) {
      const o = inst.getObjectByName(n);
      if (o) inst.userData.pfParts[n] = o;
    }
  }
  if (opts.height) fitPFHeight(inst, opts.height);
  return inst;
}
