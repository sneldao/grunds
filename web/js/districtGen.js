// districtGen.js — the Generative District boot (Tripothon S1, Tier A).
//
// Fire-and-forget: reads the district kit for SEED from the Convex bridge,
// and every "success" slot cross-fades into the street on arrival (the
// loader's existing fade — no pop). "missing" slots trigger one ensure()
// so the first player on a seed grows it for everyone. "processing" slots
// are re-polled while the district is young. Headless/no-GL/no-Convex all
// no-op — the classic procedural district is the floor, never the ceiling.
//
// Placement: additive street furniture only (cart, stall, lantern, planter,
// sign) — never replaces existing geometry, so a bad generation can at
// worst look weird, never break the scene. Generated GLBs are arbitrarily
// sized, so each slot normalizes to a target height and grounds to y=0.

import * as THREE from '../vendor/three.module.js';
import { GLBLoader } from './loader.js';
import { baseUrl } from './convexSync.js';

// Slot → street position (pavement band z≈5.6–7.6, clear of the café door
// at z≈8 x -5..0 and the ticker post at x 13.6) + target height in metres.
export const SLOTS = {
  lantern: { position: [-15.2, 0, 5.7], rotationY: 0.15, height: 2.3 },
  planter: { position: [-12.4, 0, 6.9], rotationY: 0.4, height: 0.95 },
  stall: { position: [-10.2, 0, 7.0], rotationY: 0.25, height: 2.4 },
  sign: { position: [2.0, 0, 5.6], rotationY: -0.1, height: 1.5 },
  cart: { position: [8.6, 0, 7.0], rotationY: -0.3, height: 1.35 },
};

const MAX_POLLS = 8; // ~4 min at 30 s — a young district; older ones hit the cache

// ?classicDistrict (also ?noDistrict / ?nogen) opts out of generation
// entirely and plays the hand-built procedural street. The completeness
// guarantee made testable: a judge, a flaky network, or an offline demo can
// always fall back to the district that never needs a provider call. Pure so
// the gate is testable without a DOM.
export function districtOptOut(search) {
  return /(^|[?&])(classicDistrict|noDistrict|nogen)($|[=&])/.test(search || '');
}

// Fit a loaded GLB to the slot's target height and ground it (arbitrary
// generator scale/origin → box-normalize to min.y = 0).
function fitToSlot(inst, height) {
  const box = new THREE.Box3().setFromObject(inst);
  if (box.isEmpty() || !isFinite(box.max.y - box.min.y)) return;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  if (size.y > 0.001) inst.scale.multiplyScalar(height / size.y);
  const box2 = new THREE.Box3().setFromObject(inst);
  const center2 = new THREE.Vector3();
  box2.getCenter(center2);
  inst.position.x -= center2.x;
  inst.position.z -= center2.z;
  inst.position.y -= box2.min.y; // ground to y=0 (position was set pre-fit)
}

export function initDistrictGen({ scene, seed, classic }) {
  const state = { live: false, placed: 0, total: Object.keys(SLOTS).length, seed, classic: !!classic };
  if (classic) return state; // explicit opt-out — the procedural street carries the demo
  if (typeof globalThis !== 'undefined' && (globalThis.__headless || globalThis.__noGLB)) return state;
  const base = (baseUrl() || '').replace(/\/$/, '');
  if (!base || !scene) return state;
  const glb = GLBLoader();
  const placed = new Set();

  async function placeSlot(slot, modelUrl) {
    if (placed.has(slot)) return;
    placed.add(slot);
    const s = SLOTS[slot];
    try {
      const inst = await glb.loadGLB(modelUrl, {
        position: s.position,
        rotationY: s.rotationY,
      });
      if (inst?.userData?.placeholder) return; // failed GLB — stay classic
      fitToSlot(inst, s.height);
      scene.add(inst);
      state.placed++;
      if (state.onPlaced) state.onPlaced(slot, inst);
    } catch {
      /* one bad asset never blocks the street */
    }
  }

  async function tick(attempt) {
    let data;
    try {
      const r = await fetch(`${base}/district/kit?seed=${seed}`);
      if (!r.ok) return;
      data = await r.json();
    } catch {
      return; // network blip — classic district carries on
    }
    const slots = data?.slots ?? {};
    let pending = false;
    let missing = [];
    for (const [slot, s] of Object.entries(slots)) {
      if (!SLOTS[slot] || placed.has(slot)) continue;
      if (s.status === 'success' && s.modelUrl) {
        placeSlot(slot, s.modelUrl);
      } else if (s.status === 'processing') {
        pending = true;
      } else if (s.status === 'missing') {
        missing.push(slot);
      }
      // "failed" stays failed — classic stand-in is the design, not a bug
    }
    if (missing.length && !state.ensured) {
      state.ensured = true;
      fetch(`${base}/district/ensure?seed=${seed}`, { method: 'POST' }).catch(() => {});
    }
    state.live = true;
    state.known = Object.keys(slots).length;
    if (pending && attempt < MAX_POLLS) {
      setTimeout(() => tick(attempt + 1), 30000);
    }
  }

  state.known = 0;
  tick(1);
  return state;
}
