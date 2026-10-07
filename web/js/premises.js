// Neighbour cutaways. The café is already a dollhouse. The Quill, Hearth &
// Rye, Bell & Brass, and Marrow Lane are solid shells with a window diorama
// on the street face. A peek lifts that building's lid and hides the street
// wall so one room shows. Nothing here joins a queue, pays, or touches demand.
import * as THREE from '../vendor/three.module.js';

// Real-time, not sim-time. One shop, a few seconds, then a long quiet.
export const PEEK_FIRST = 52;
export const PEEK_PERIOD = 92;
export const PEEK_SHOW = 4.6;

export const PREMISES = [
  { id: 'quill', name: 'The Quill', line: 'books on the shelves, and a bed in the room above', room: 'books' },
  { id: 'hearth', name: 'Hearth & Rye', line: 'the bakery — loaves on the counter, the oven lit', room: 'bakery' },
  { id: 'bell', name: 'Bell & Brass', line: 'a clerk’s desk, clocks on the bench, and an office above', room: 'office' },
  { id: 'marrow', name: 'Marrow Lane', line: 'the grocer — tins, fruit, and a short aisle', room: 'grocer' },
];

// elapsedSec is seconds since peeks were allowed. Returns an index into the
// premise list, or -1 while the roofs stay shut.
export function ambientPremiseIndex(elapsedSec, count, timing = {}) {
  const n = count | 0;
  const first = timing.first ?? PEEK_FIRST;
  const period = timing.period ?? PEEK_PERIOD;
  const show = timing.show ?? PEEK_SHOW;
  if (n <= 0 || !(elapsedSec >= first) || !(period > 0)) return -1;
  const t = elapsedSec - first;
  const slot = Math.floor(t / period);
  if (t - slot * period >= show) return -1;
  return ((slot % n) + n) % n;
}

const NO = { cast: false, recv: false };

function labelMaterial(text, sub) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  let canvas;
  try { canvas = document.createElement('canvas'); } catch { return null; }
  if (!canvas || !canvas.getContext) return null;
  canvas.width = 512; canvas.height = 168;
  const g = canvas.getContext('2d');
  if (!g || !g.fillRect) return null;
  g.fillStyle = '#fff8ee'; g.fillRect(0, 0, 512, 168);
  g.strokeStyle = '#c9a227'; g.lineWidth = 14; g.strokeRect(12, 12, 488, 144);
  g.fillStyle = '#171310'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 84px Georgia, serif'; g.fillText(text, 256, sub ? 64 : 84);
  if (sub) { g.fillStyle = '#4a3423'; g.font = 'italic 30px Georgia, serif'; g.fillText(sub, 256, 122); }
  const tex = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  // Unlit, so a peek stays readable in wall shadow and at night.
  return new THREE.MeshBasicMaterial({ map: tex });
}

function roomBoard(env, text, sub, x, y, z) {
  const material = labelMaterial(text, sub);
  if (!material) return;
  // The play camera is high and in front. rx positive tips the card up
  // toward it; the parent's half-turn already aims the face at the street.
  const w = Math.min(2.2, Math.max(1.45, (env.w || 2.6) * 0.62));
  env.plane(env.interior, w, w * 0.34, material, x, y, z, { rx: 0.62, ry: Math.PI, cast: false, recv: false });
}

// The play camera looks down into the lot. A dark floor inside plaster
// walls reads as a closed roof, so the cavity itself has to be bright.
function washRoom(env) {
  const { box, interior, w, h, d } = env;
  const floorW = Math.max(0.9, w - 0.42);
  const floorD = Math.max(0.8, d - 0.46);
  box(interior, floorW, 0.03, floorD, 0xfff6e4, 0, 0.075, 0.02, {
    cast: false, recv: false, em: 0xfff1d0, emi: 0.85, rough: 1,
  });
  const linerH = Math.min(Math.max(1.2, h * 0.55), 2.4);
  box(interior, Math.max(0.7, w - 0.46), linerH, 0.04, 0xfff8ee, 0, 0.28 + linerH / 2, d / 2 - 0.2, {
    cast: false, recv: false, em: 0xfff4e2, emi: 0.55, rough: 1,
  });
}

function counter(env, x, z, w) {
  const { box, PAL, interior } = env;
  box(interior, w, 0.7, 0.46, PAL.walnutDark, x, 0.55, z, NO);
  box(interior, w + 0.06, 0.07, 0.52, PAL.walnut, x, 0.92, z, NO);
}

function lamp(env, parent, x, y, z) {
  const { cyl, PAL } = env;
  cyl(parent, 0.02, 0.02, 0.32, PAL.ink, x, y, z, NO);
  cyl(parent, 0.11, 0.15, 0.09, PAL.brass, x, y + 0.2, z, { ...NO, metal: 0.55, rough: 0.35, em: PAL.brass, emi: 0.4 });
  cyl(parent, 0.045, 0.045, 0.05, 0xfff2d8, x, y + 0.1, z, { ...NO, em: 0xffd2a0, emi: 1.1 });
}

function chair(env, parent, x, y, z) {
  const { box, PAL } = env;
  box(parent, 0.36, 0.07, 0.36, PAL.walnut, x, y + 0.4, z, NO);
  box(parent, 0.36, 0.4, 0.06, PAL.walnutDark, x, y + 0.62, z + 0.15, NO);
}

function bookcase(env, parent, x, z) {
  const { box, PAL } = env;
  const cols = [PAL.ink, PAL.walnut, PAL.walnutDark, PAL.cream, PAL.brass];
  box(parent, 0.78, 1.45, 0.28, PAL.walnutDark, x, 1.2, z, NO);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3; i++) {
      const c = cols[(row + i) % cols.length];
      box(parent, 0.16, 0.26, 0.16, c, x - 0.22 + i * 0.22, 0.62 + row * 0.42, z - 0.02, { ...NO, em: c, emi: 0.14 });
    }
  }
}

function dressQuill(env) {
  const { box, interior, detail, PAL, d } = env;
  env.interior.userData.room = 'books';
  const bz = d / 2 - 0.42;
  bookcase(env, interior, -0.85, bz);
  bookcase(env, interior, 0.85, bz);
  counter(env, 0, -0.2, 1.35);
  box(interior, 0.22, 0.06, 0.16, PAL.walnut, -0.28, 0.99, -0.18, { ...NO, em: PAL.walnut, emi: 0.12 });
  box(interior, 0.2, 0.05, 0.15, PAL.ink, -0.26, 1.05, -0.16, NO);
  lamp(env, interior, 0.28, 0.95, -0.16);
  chair(env, interior, 0, 0, 0.28);
  roomBoard(env, 'BOOKS', 'the room above is let', 0, 1.72, -0.35);
  const loftY = 2.12;
  const loftZ = 0.46;
  box(detail, 2.2, 0.08, 0.82, PAL.walnut, 0, loftY, loftZ, NO);
  box(detail, 2.2, 0.12, 0.06, PAL.walnutDark, 0, loftY - 0.02, loftZ - 0.4, NO);
  box(detail, 0.95, 0.14, 0.62, PAL.cream, -0.35, loftY + 0.15, loftZ, { ...NO, em: PAL.cream, emi: 0.12 });
  box(detail, 0.28, 0.08, 0.2, PAL.paper, -0.5, loftY + 0.26, loftZ - 0.14, NO);
  box(detail, 0.32, 0.22, 0.32, PAL.walnut, 0.48, loftY + 0.2, loftZ, NO);
  lamp(env, detail, 0.48, loftY + 0.36, loftZ - 0.22);
}

function dressHearth(env) {
  const { box, interior, detail, PAL, d } = env;
  interior.userData.room = 'bakery';
  counter(env, -0.35, -0.15, 2.1);
  const loaf = (x, z, s) => {
    box(interior, 0.28 * s, 0.12 * s, 0.16 * s, PAL.walnut, x, 1.02, z, { ...NO, em: PAL.walnut, emi: 0.16 });
    box(interior, 0.16 * s, 0.025, 0.02, PAL.cream, x, 1.1, z - 0.02, NO);
  };
  loaf(-0.85, -0.12, 1.3);
  loaf(-0.45, -0.08, 1.1);
  loaf(-0.1, -0.16, 1.2);
  box(interior, 0.72, 0.85, 0.48, PAL.ink, 1.45, 0.72, d / 2 - 0.5, { ...NO, em: 0x2a1812, emi: 0.2 });
  box(interior, 0.4, 0.28, 0.06, 0xff9a4a, 1.45, 0.7, d / 2 - 0.74, { ...NO, em: 0xff8a3a, emi: 0.95 });
  roomBoard(env, 'BAKERY', 'hearth & rye', -0.15, 1.85, -0.28);
  lamp(env, interior, 0.35, 0.95, -0.1);
  const tinCols = [PAL.brass, PAL.teal, PAL.cream];
  for (let i = 0; i < 3; i++) {
    const c = tinCols[i];
    box(detail, 0.16, 0.14, 0.16, c, 0.55, 1.02 + i * 0.15, -0.12, { ...NO, metal: 0.45, em: c, emi: 0.2 });
  }
  box(detail, 0.26, 0.12, 0.16, PAL.walnut, 0.15, 1.02, -0.18, { ...NO, em: PAL.walnut, emi: 0.14 });
}

function dressBell(env) {
  const { box, cyl, interior, detail, PAL, d } = env;
  interior.userData.room = 'office';
  // Ground floor is the clerk's office; the bench of clocks sits beside it.
  box(interior, 1.15, 0.68, 0.5, PAL.walnutDark, -0.55, 0.5, -0.05, NO);
  box(interior, 1.2, 0.07, 0.56, PAL.walnut, -0.55, 0.88, -0.05, NO);
  box(interior, 0.28, 0.015, 0.2, PAL.cream, -0.7, 0.93, -0.02, { ...NO, em: PAL.cream, emi: 0.25 });
  box(interior, 0.22, 0.015, 0.16, PAL.paper, -0.35, 0.93, 0.02, NO);
  chair(env, interior, -0.55, 0, -0.55);
  lamp(env, interior, -0.15, 0.92, 0.02);
  box(interior, 1.15, 0.08, 0.42, PAL.walnut, 0.85, 0.78, d / 2 - 0.48, NO);
  cyl(interior, 0.1, 0.1, 0.06, PAL.brass, 0.55, 0.88, d / 2 - 0.48, { ...NO, rx: Math.PI / 2, metal: 0.6, em: PAL.brass, emi: 0.35 });
  cyl(interior, 0.07, 0.07, 0.04, PAL.cream, 0.55, 0.88, d / 2 - 0.56, { ...NO, rx: Math.PI / 2, em: PAL.cream, emi: 0.3 });
  box(interior, 0.16, 0.12, 0.12, PAL.brass, 1.15, 0.9, d / 2 - 0.46, { ...NO, metal: 0.55, em: PAL.brass, emi: 0.3 });
  roomBoard(env, 'OFFICE', 'bell & brass', -0.15, 1.7, -0.22);
  const loftY = 1.78;
  box(detail, 2.4, 0.07, 0.85, PAL.walnut, 0, loftY, 0.42, NO);
  box(detail, 0.85, 0.5, 0.4, PAL.walnutDark, -0.55, loftY + 0.32, 0.45, NO);
  box(detail, 0.9, 0.05, 0.44, PAL.walnut, -0.55, loftY + 0.58, 0.45, NO);
  box(detail, 0.85, 0.5, 0.4, PAL.walnutDark, 0.55, loftY + 0.32, 0.48, NO);
  box(detail, 0.9, 0.05, 0.44, PAL.cream, 0.55, loftY + 0.58, 0.48, NO);
  chair(env, detail, -0.55, loftY, 0.02);
  chair(env, detail, 0.55, loftY, 0.05);
}

function dressMarrow(env) {
  const { box, interior, detail, PAL } = env;
  interior.userData.room = 'grocer';
  const cols = [PAL.matcha, PAL.cream, PAL.brass, PAL.neg, PAL.teal, PAL.paper];
  const shelf = (parent, x) => {
    box(parent, 1.05, 0.95, 0.36, PAL.walnut, x, 0.72, 0.15, NO);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 4; i++) {
        const c = cols[(row * 4 + i) % cols.length];
        box(parent, 0.16, 0.16, 0.16, c, x - 0.36 + i * 0.24, 0.42 + row * 0.4, 0.12, { ...NO, em: c, emi: 0.16 });
      }
    }
  };
  shelf(interior, -0.85);
  counter(env, 0.15, -0.35, 1.15);
  box(interior, 0.22, 0.18, 0.22, PAL.matcha, -0.15, 1.05, -0.32, { ...NO, em: PAL.matcha, emi: 0.18 });
  box(interior, 0.16, 0.14, 0.16, PAL.neg, 0.15, 1.04, -0.28, { ...NO, em: PAL.neg, emi: 0.15 });
  box(interior, 0.18, 0.16, 0.18, PAL.brass, 0.4, 1.04, -0.34, { ...NO, em: PAL.brass, emi: 0.18 });
  roomBoard(env, 'GROCER', 'marrow lane', 0.15, 1.62, -0.28);
  shelf(detail, 0.95);
  box(detail, 0.2, 0.16, 0.2, PAL.matcha, 0.7, 1.05, -0.3, { ...NO, em: PAL.awning, emi: 0.15 });
}

const DRESS = { quill: dressQuill, hearth: dressHearth, bell: dressBell, marrow: dressMarrow };

export function dressInterior(id, env) {
  washRoom(env);
  const fn = DRESS[id];
  if (fn) fn(env);
}

function chainVisible(object) {
  for (let p = object; p; p = p.parent) if (p.visible === false) return false;
  return true;
}

export function createCutawayRig({ lite = false } = {}) {
  const premises = [];
  const details = [];
  let roofsOpen = false;
  let roofsShut = false;
  let peekEpoch = 0;
  let lastAmbient = null;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function trackDetail(group) {
    details.push(group);
    if (lite) group.visible = false;
    return group;
  }

  function add(entry) {
    entry.interior.visible = false;
    entry.face.visible = true;
    entry.roof.visible = true;
    premises.push({ open: 0, holdUntil: 0, ...entry });
    for (const part of [entry.shell, entry.face, entry.roof, entry.interior]) {
      if (part && part.traverse) part.traverse((o) => { o.userData.premise = entry.id; });
    }
  }

  // open: every neighbour roof stays off. explicit: the player turned the
  // control off, which also stops the rare ambient glimpse.
  function setRoofs(open, explicit = false) {
    roofsOpen = !!open;
    if (open) roofsShut = false;
    else if (explicit) roofsShut = true;
  }

  function peek(id, ms = 7000) {
    const p = premises.find((x) => x.id === id);
    if (!p) return null;
    p.holdUntil = nowMs() + ms;
    return p;
  }

  function pick(clientX, clientY, camera, width, height) {
    if (!camera || !width || !height) return null;
    ndc.set((clientX / width) * 2 - 1, -(clientY / height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const roots = [];
    for (const p of premises) {
      for (const part of [p.shell, p.face, p.roof, p.interior]) {
        if (!part) continue;
        part.updateMatrixWorld(true);
        roots.push(part);
      }
    }
    const hits = ray.intersectObjects(roots, true);
    for (const h of hits) {
      if (!chainVisible(h.object)) continue;
      let o = h.object;
      while (o) {
        if (o.userData && o.userData.premise) return premises.find((p) => p.id === o.userData.premise) || null;
        o = o.parent;
      }
    }
    return null;
  }

  function update(dt, now, opts = {}) {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const allow = !!opts.ambient && !lite && !roofsOpen && !roofsShut && !reduce;
    let ambientId = null;
    if (allow && premises.length) {
      if (!peekEpoch) peekEpoch = now;
      const idx = ambientPremiseIndex((now - peekEpoch) / 1000, premises.length);
      if (idx >= 0) ambientId = premises[idx].id;
    }
    let begun = null;
    if (ambientId !== lastAmbient) {
      const prev = lastAmbient;
      lastAmbient = ambientId;
      if (ambientId && ambientId !== prev) begun = premises.find((p) => p.id === ambientId) || null;
    }
    const k = reduce ? 1 : (1 - Math.exp(-Math.max(0, dt) * 8));
    for (const p of premises) {
      const held = p.holdUntil > now;
      const want = (roofsOpen || held || p.id === ambientId) ? 1 : 0;
      p.open += (want - p.open) * k;
      if (Math.abs(want - p.open) < 0.004) p.open = want;
      p.roof.position.y = p.open * 1.7;
      p.roof.position.z = p.open * 0.42;
      p.roof.visible = p.open < 0.985;
      p.face.visible = p.open < 0.2;
      p.interior.visible = p.open > 0.08;
    }
    return begun;
  }

  function applyLite(enabled) {
    for (const g of details) g.visible = !enabled;
  }

  function openIds() {
    const ids = [];
    for (const p of premises) {
      if (p.open > 0.45 && p.interior && p.interior.visible) ids.push(p.id);
    }
    return ids;
  }

  return {
    premises,
    get roofsOpen() { return roofsOpen; },
    get roofsShut() { return roofsShut; },
    trackDetail,
    add,
    setRoofs,
    peek,
    pick,
    update,
    applyLite,
    openIds,
  };
}

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}
