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
import { seeded } from './exchange.js';
import { loadPF } from './polyfork.js';

// Slot → street position (pavement band z≈5.6–7.6, clear of the café door
// at z≈8 x -5..0 and the ticker post at x 13.6) + target height in metres.
export const SLOTS = {
  lantern: { position: [-15.2, 0, 5.7], rotationY: 0.15, height: 2.3 },
  planter: { position: [-12.4, 0, 6.9], rotationY: 0.4, height: 0.95 },
  stall: { position: [-10.2, 0, 7.0], rotationY: 0.25, height: 2.4 },
  sign: { position: [2.0, 0, 5.6], rotationY: -0.1, height: 1.5 },
  cart: { position: [8.6, 0, 7.0], rotationY: -0.3, height: 1.35 },
  // The hero piece — across the road on the far row, between the franchise
  // storefront (-3, 15.6) and the day-5 scaffold zone (-10, 15.9). Faces the
  // café; the lease/newbuild camera beats frame it beside the stand.
  fountain: { position: [-6, 0, 15.5], rotationY: Math.PI, height: 2.6 },
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

// ?district=polyfork (also ?pfDistrict) — the seeded-vendored district: each
// slot picks from a curated pool of Polyfork GLBs via the campaign seed, so
// the street is distinct per seed yet identical every replay, instantly,
// with no provider call and no Convex egress. Candidates exclude the ids the
// world.js pilot set already pins to fixed spots.
export function districtPolyforkOpt(search) {
  return /(^|[?&])(district=polyfork|pfDistrict)($|[=&])/.test(search || '');
}

// Slot -> vendored candidate ids. Picked with a seeded LCG stream
// (seed + 977), city folded in so a named street still grows its own props.
const PF_SLOTS = {
  lantern: ['street-lamp-136745', 'lantern-post-f47665', 'paper-lantern-3387e9', 'globe-lamp-346cb6'],
  planter: ['planter-trough-divider-1b0ead', 'flower-planter-550bfb', 'potted-olive-tree-7eee05'],
  stall: ['ramen-yatai-stall-53974b', 'mercado-stall-6e6ba3', 'market-stall-94937d', 'newsstand-6dfd65'],
  sign: ['sandwich-board-sign-cb5e7c', 'hanging-shop-sign-18d2b0', 'yard-sign-f1882f', 'street-sign-pole-1e9551', 'projecting-shop-sign-aa1867', 'chalkboard-menu-board-a24d9d'],
  cart: ['hot-dog-cart-115192', 'elote-cart-a8fb49', 'ice-cream-kiosk-on-40a568', 'sopaipilla-cart-712632'],
  fountain: ['campus-plaza-fountain-a0cab1', 'plaza-fountain-5a5f6e'],
};

// Seeded canopy/stripe variants — passed to loadPF as tint overrides; zones
// an asset doesn't carry are ignored, so the table is safe across all
// candidates. {} keeps the authored paint.
const PF_TINT_VARIANTS = [
  { stripeA: '#c9a227', stripeB: '#f6efe0' },   // brass & cream
  { stripeA: '#86a860', stripeB: '#f6efe0' },   // matcha & cream
  { stripeA: '#7fb3b0', stripeB: '#efe6d3' },   // teal & paper
  { stripeA: '#d0603b', stripeB: '#f6efe0' },   // terracotta & cream
  { stripeA: '#3d5243', stripeB: '#efe6d3' },   // ok-ink & paper
  { stripeA: '#4a3423', stripeB: '#e0a96d' },   // walnut & honey
  {},
];

// Cheap string hash so ?city=Lisbon steers the same seeded picks.
function strHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

// Fit a loaded GLB to the slot's target height and ground it (arbitrary
// generator scale/origin → box-normalize to min.y = 0).
//
// Measure with the instance parked at the origin. The slot position is
// already on the object; subtracting the world-space centre from it
// cancelled that position and dropped every prop on (0, y, 0) — a pile in
// the middle of the café, straight down the opening camera.
export function fitToSlot(inst, height) {
  const slot = inst.position.clone();
  inst.position.set(0, 0, 0);
  inst.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inst);
  if (box.isEmpty() || !isFinite(box.max.y - box.min.y)) {
    inst.position.copy(slot);
    return;
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0.001) inst.scale.multiplyScalar(height / size.y);
  inst.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(inst);
  const center2 = new THREE.Vector3();
  box2.getCenter(center2);
  inst.position.set(slot.x - center2.x, -box2.min.y, slot.z - center2.z);
}

export function initDistrictGen({ scene, seed, classic, loader, city, polyfork }) {
  const state = { live: false, placed: 0, total: Object.keys(SLOTS).length, seed, classic: !!classic };
  // City Remix: a city name folds into the kit prompts server-side, so a
  // "Lisbon" street grows its own props instead of sharing seed-7's.
  const cityQ = city ? `&city=${encodeURIComponent(city)}` : '';
  if (classic) return state; // explicit opt-out — the procedural street carries the demo
  if (typeof globalThis !== 'undefined' && (globalThis.__headless || globalThis.__noGLB)) return state;
  if (!scene) return state;
  const glb = loader || GLBLoader();
  const placed = new Set();
  state.grown = false;
  state.grownSlots = [];
  state.pending = true;
  state.successCount = 0;

  // The kit is "grown" once nothing is processing and every success the
  // server reported has actually landed in the scene. One hook, fires once —
  // main.js turns it into the arrival celebration.
  function markGrown() {
    if (state.grown) return;
    state.grown = true;
    if (state.onGrown) state.onGrown(state.grownSlots);
  }
  function maybeMarkGrown() {
    if (!state.pending && state.successCount > 0 && state.placed >= state.successCount) markGrown();
  }

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
      state.grownSlots.push({ slot, inst });
      if (state.onPlaced) state.onPlaced(slot, inst);
      maybeMarkGrown();
    } catch {
      /* one bad asset never blocks the street */
    }
  }

  // Seeded Polyfork district (?district=polyfork): pick one vendored
  // candidate per slot with the campaign seed (+ city hash) and place them
  // all at once — no fetch, no provider, fully offline. loadPF already
  // box-normalizes to the slot height via opts.height.
  function growPfDistrict() {
    const rng = seeded((seed >>> 0) + 977 + (city ? strHash(city) : 0));
    const slots = Object.entries(SLOTS);
    let settled = 0;
    const settle = () => {
      if (++settled >= slots.length) { state.pending = false; maybeMarkGrown(); }
    };
    for (const [slot, s] of slots) {
      const cands = PF_SLOTS[slot] || [];
      if (!cands.length) { settle(); continue; }
      const id = cands[Math.floor(rng() * cands.length)];
      const tint = PF_TINT_VARIANTS[Math.floor(rng() * PF_TINT_VARIANTS.length)];
      loadPF(glb, id, { position: s.position, rotationY: s.rotationY, height: s.height, night: 'street', tint })
        .then((inst) => {
          if (!inst?.userData?.placeholder) {
            placed.add(slot);
            scene.add(inst);
            state.placed++;
            state.successCount++;
            state.grownSlots.push({ slot, inst, pfId: id });
            if (state.onPlaced) state.onPlaced(slot, inst);
          }
          settle();
        }, settle);
    }
    state.live = true;
    state.known = slots.length;
  }

  if (polyfork) {
    growPfDistrict();
    return state;
  }

  async function tick(attempt) {
    const base = (baseUrl() || '').replace(/\/$/, '');
    if (!base) { state.pending = false; return; }
    let data;
    try {
      const r = await fetch(`${base}/district/kit?seed=${seed}${cityQ}`);
      if (!r.ok) return;
      data = await r.json();
    } catch {
      return; // network blip — classic district carries on
    }
    const slots = data?.slots ?? {};
    let pending = false;
    let missing = [];
    let successCount = 0;
    for (const [slot, s] of Object.entries(slots)) {
      if (!SLOTS[slot]) continue;
      if (s.status === 'success' && s.modelUrl) {
        successCount++;
        if (!placed.has(slot)) placeSlot(slot, s.modelUrl);
      } else if (s.status === 'processing') {
        pending = true;
      } else if (s.status === 'missing' && !placed.has(slot)) {
        missing.push(slot);
      }
      // "failed" stays failed — classic stand-in is the design, not a bug
    }
    state.pending = pending;
    state.successCount = successCount;
    if (missing.length && !state.ensured) {
      state.ensured = true;
      fetch(`${base}/district/ensure?seed=${seed}${cityQ}`, { method: 'POST' }).catch(() => {});
    }
    state.live = true;
    state.known = Object.keys(slots).length;
    maybeMarkGrown();   // covers the all-already-placed re-poll case
    if (pending && attempt < MAX_POLLS) {
      setTimeout(() => tick(attempt + 1), 30000);
    }
  }

  state.known = 0;
  tick(1);
  return state;
}
