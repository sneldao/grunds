// streetLife.js — cosmetic district life.
//
// Café waves, rival choice, balks, and the till stay in patrons.js and use
// PatronSystem.random / Math.random. This module has its own stream and its
// own instanced meshes. Nobody here joins a queue, pays, or adds a returnee.
//
// Do not call Math.random from this file. The headless day seeds that global
// stream; burning it would move the café's balks.
//
// A neighbour visit still aims at the apron (z ≈ 5.7). On the dwell they
// slide past the door and drop out of sight for 2–4s, then come back out.
// Open roofs show one or two sitters inside. None of them join a queue.

import * as THREE from '../vendor/three.module.js';
import { COHORTS, COHORT_KEYS, LAYOUT, FRANCHISE } from './config.js';

export const STREET_CAP = { full: 16, lite: 7 };
export const STREET_LIMITS = {
  pavement: 8,
  neighbor: 4,
  park: 3,
  bench: 2,
  glasshouse: 4,
  prop: 3,
  rowPerLot: 3,
  rowTotal: 5,
};
export const STREET_SEED = { full: 7, lite: 3 };
export const STREET_EVERY = { full: 11, lite: 24 };

const PEOPLE = COHORT_KEYS.filter(k => k !== 'rival');
const SKIN = [0xf2c89a, 0xe0ac82, 0xc98a5e, 0xa06a42, 0x7a4e30, 0x5e3a24];
const LEGS = [0x2a2c34, 0x3a3230, 0x24303a];

// Shop fronts face the play camera at z ≈ 3.6. These stands are on the
// pavement side of the door, clear of the café threshold. `seat` is a
// chair inside the open shell (shopGroup front at z 3.6, local +z toward
// the back wall) — only drawn while that roof is open.
export const NEIGHBOR_DOORS = [
  // On the apron in front of each bay (shop fronts sit near z 3.6–4).
  // Far enough out that a body reads as a visitor, not a fixture in the wall.
  { id: 'quill', x: -10.55, z: 5.7, face: Math.PI, seat: { x: -10.95, z: 2.45 } },
  { id: 'hearth', x: 3.55, z: 5.7, face: Math.PI, seat: { x: 3.0, z: 2.425 } },
  { id: 'bell', x: 7.9, z: 5.7, face: Math.PI, seat: { x: 8.2, z: 2.4 } },
  { id: 'marrow', x: 11.7, z: 5.7, face: Math.PI, seat: { x: 11.4, z: 2.4 } },
];

const DOOR_BY_ID = Object.create(null);
for (const door of NEIGHBOR_DOORS) DOOR_BY_ID[door.id] = door;

// How long a neighbour visit spends past the door. The apron beat stays;
// the hidden stretch is what reads as "they went in".
export const ENTER_SLIDE_S = 0.45;
export const ENTER_INSIDE_MIN = 2;
export const ENTER_INSIDE_MAX = 4;
// Just inside the shop front (z ≈ 3.6), still outside the player café.
export const ENTER_THRESHOLD_Z = 3.45;
export const INTERIOR_CAP = 2;

export function neighborInsideSeconds(dwellTotal) {
  const total = Math.max(0, Number(dwellTotal) || 0);
  if (total <= 0.4) return 0;
  const reserved = ENTER_SLIDE_S * 2 + 0.6;
  const room = total - reserved;
  if (room >= ENTER_INSIDE_MAX) return ENTER_INSIDE_MAX;
  if (room >= ENTER_INSIDE_MIN) return room;
  return Math.min(ENTER_INSIDE_MIN, Math.max(0.5, total * 0.5));
}

// Pure. `elapsed` is on the same clock as the dwell countdown.
export function neighborEnterPose(door, dwellTotal, elapsed) {
  const total = Math.max(0.01, Number(dwellTotal) || 0);
  const t = Math.max(0, Math.min(Number(elapsed) || 0, total));
  let inside = neighborInsideSeconds(total);
  let slide = ENTER_SLIDE_S;
  if (inside + slide * 2 > total) slide = Math.max(0.05, (total - inside) / 2);
  if (inside + slide * 2 > total) inside = Math.max(0, total - slide * 2);
  const lead = Math.max(0, total - inside - slide * 2);
  const apronZ = door.z;
  const inZ = ENTER_THRESHOLD_Z;
  const insideStart = lead + slide;
  const insideEnd = insideStart + inside;
  const hideIn = lead + slide * 0.72;
  const showOut = insideEnd + slide * 0.28;
  let z = apronZ;
  let phase = 'apron';
  if (t < lead) {
    phase = 'apron';
  } else if (t < insideStart) {
    phase = 'in';
    const u = slide > 0 ? (t - lead) / slide : 1;
    z = apronZ + (inZ - apronZ) * u;
  } else if (t < insideEnd) {
    phase = 'inside';
    z = inZ;
  } else if (t < insideEnd + slide) {
    phase = 'out';
    const u = slide > 0 ? (t - insideEnd) / slide : 1;
    z = inZ + (apronZ - inZ) * u;
  }
  const hidden = inside > 0 && t >= hideIn && t < showOut;
  return { x: door.x, z, hidden, phase, inside };
}

// The street bench is the slab at (5, 0.45, 7.4). Two people, facing the road.
export const BENCH_SEATS = [
  { x: 4.4, z: 7.4, face: 0 },
  { x: 5.6, z: 7.4, face: 0 },
];

// The deep lawn (z ≈ 19+) sits under the home camera. These seats are on
// the far pavement, the lip you see at the bottom of the frame, clear of
// Sam's line (that queue starts near x 2.4, z 15.4 and grows to the right).
export const PARK_SPOTS = [
  { x: -11.2, z: 14.2, face: 0 },
  { x: -4.6, z: 14.15, face: 0 },
  { x: 11.2, z: 14.25, face: 0 },
];

// Beside the generated kit slots (districtGen SLOTS) plus the ticker and the
// dropped cup. Offsets keep a body next to the prop, not inside it.
export const STREET_PROPS = [
  { id: 'lantern', x: -14.5, z: 6.55, far: false },
  { id: 'planter', x: -12.4, z: 7.55, far: false },
  { id: 'stall', x: -9.35, z: 7.65, far: false },
  { id: 'sign', x: 2.15, z: 6.4, far: false },
  { id: 'cart', x: 8.6, z: 7.65, far: false },
  { id: 'ticker', x: 12.25, z: 6.95, far: false },
  { id: 'cup', x: 6.15, z: 8.15, far: false },
  { id: 'fountain', x: -6.0, z: 14.45, far: true },
];

// Left of the zebra on the far pavement — beside Sam's line, not in it.
export const GLASSHOUSE_WAIT = { x: -4.6, z: 14.75, face: 0 };

// A demand surge poses a line on the apron before the real queue arrives.
// Outside the door radius and off the café floor, facing the door.
// The real counter line takes these spots over once it is this long.
export const QUEUE_MARKS = [
  { x: -6.35, z: 6.35, face: Math.PI, hold: 'queue:0' },
  { x: -7.15, z: 6.42, face: Math.PI, hold: 'queue:1' },
  { x: -7.95, z: 6.28, face: Math.PI, hold: 'queue:2' },
];

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function streetRng() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function mixSeed(seed, day) {
  const s = (Number(seed) || 1) >>> 0;
  const d = (Number(day) || 1) >>> 0;
  return (Math.imul(s, 0x9E3779B1) ^ Math.imul(d, 0x85EBCA6B) ^ 0x51EE7) >>> 0;
}

export function cafeBlock() {
  const f = LAYOUT.floor;
  return {
    x0: f.x - f.w / 2,
    x1: f.x + f.w / 2,
    z0: f.z - f.d / 2,
    z1: LAYOUT.door.z + 0.22,
  };
}

export function inPlayerCafe(x, z) {
  const r = cafeBlock();
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}

export function nearCafeDoor(x, z, radius = 1.2) {
  const dx = x - LAYOUT.door.x;
  const dz = z - LAYOUT.door.z;
  return dx * dx + dz * dz < radius * radius;
}

function orient(a, b, c) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) return false;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

export function segmentHitsCafe(a, b) {
  if (inPlayerCafe(a.x, a.z) || inPlayerCafe(b.x, b.z)) return true;
  const r = cafeBlock();
  const edges = [
    [{ x: r.x0, z: r.z0 }, { x: r.x1, z: r.z0 }],
    [{ x: r.x1, z: r.z0 }, { x: r.x1, z: r.z1 }],
    [{ x: r.x1, z: r.z1 }, { x: r.x0, z: r.z1 }],
    [{ x: r.x0, z: r.z1 }, { x: r.x0, z: r.z0 }],
  ];
  return edges.some(([c, d]) => segmentsIntersect(a, b, c, d));
}

export function segmentNearDoor(a, b, radius = 1.2) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  let t = 0;
  if (len2 > 1e-8) {
    t = ((LAYOUT.door.x - a.x) * dx + (LAYOUT.door.z - a.z) * dz) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  return nearCafeDoor(a.x + dx * t, a.z + dz * t, radius);
}

export function routeBlocked(points) {
  if (!points || !points.length) return true;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (inPlayerCafe(p.x, p.z) || nearCafeDoor(p.x, p.z)) return true;
    if (i > 0 && (segmentHitsCafe(points[i - 1], p) || segmentNearDoor(points[i - 1], p))) return true;
  }
  return false;
}

// Hubs and draws only, and only on days the ledger bonus is already paying
// (day > placedDay, same window as franchise.effectsDue). Rent stays quiet.
// The list carries no returnee count — the street must not add one.
export function deriveRowLots(franchise, day) {
  const out = [];
  const lots = franchise && franchise.lots;
  if (!lots) return out;
  const dayNow = Number(day) || 0;
  for (const def of FRANCHISE.lots) {
    const s = lots[def.id];
    if (!s || !s.placed) continue;
    if (s.purpose !== 'community' && s.purpose !== 'draw') continue;
    if (!(dayNow > (s.placedDay || 0))) continue;
    out.push({
      id: def.id,
      purpose: s.purpose,
      x: def.position[0],
      z: def.position[2] - 1.2,
      face: 0,
    });
  }
  return out;
}

export function ambientChoices({ rowLots = [], rivalHeat = 0, truce = false, demandKind = 'flat' } = {}) {
  const heat = Math.max(0, Number(rivalHeat) || 0);
  const surge = demandKind === 'surge' && !truce;
  const thin = demandKind === 'thin';
  const glass = truce ? 0 : (8 + Math.min(16, heat * 1.25) + (surge ? 10 : 0)) * (thin ? 0.5 : 1);
  const choices = [
    { kind: 'pavement', weight: surge ? 52 : thin ? 16 : 36 },
    { kind: 'neighbor', weight: 22 },
    { kind: 'park', weight: thin ? 24 : 14 },
    { kind: 'bench', weight: thin ? 18 : 12 },
    { kind: 'glasshouse', weight: glass },
    { kind: 'prop', weight: 8 },
  ];
  for (const lot of rowLots) {
    choices.push({
      kind: 'row',
      weight: lot.purpose === 'community' ? 16 : 12,
      lot,
    });
  }
  return choices;
}

export function weightedPick(rng, entries) {
  const live = [];
  let total = 0;
  for (const e of entries || []) {
    if (!e || !(e.weight > 0)) continue;
    live.push(e);
    total += e.weight;
  }
  if (!live.length) return null;
  let r = rng() * total;
  for (const e of live) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return live[live.length - 1];
}

function pt(x, z, extra) {
  return { x, z, dwell: 0, sit: false, face: null, ...(extra || {}) };
}

function pavementEnd(x, roll) {
  const z = LAYOUT.pavementZ + (roll() - 0.5) * 0.3;
  return pt(x, Math.max(7.5, Math.min(8.15, z)));
}

// Pure route. `plan` names the destination; `rng` is the street stream.
export function buildRoute(plan, rng) {
  const roll = typeof rng === 'function' ? rng : () => 0.5;
  const fromLeft = plan.fromLeft != null ? plan.fromLeft : roll() < 0.5;
  const startX = fromLeft ? LAYOUT.spawnL.x : LAYOUT.spawnR.x;
  const endX = fromLeft ? LAYOUT.spawnR.x : LAYOUT.spawnL.x;
  const points = [];
  const start = plan.from
    ? pt(plan.from.x, inPlayerCafe(plan.from.x, plan.from.z) ? LAYOUT.pavementZ : plan.from.z)
    : pt(startX, LAYOUT.pavementZ);
  points.push(start);

  if (plan.kind === 'pavement') {
    if (plan.pause && plan.seat) {
      points.push(pt(plan.seat.x, plan.seat.z, {
        dwell: 8 + roll() * 7, sit: true, face: plan.seat.face,
      }));
    }
    points.push(pavementEnd(endX, roll));
  } else if (plan.kind === 'bench' && plan.seat) {
    points.push(pt(plan.seat.x, LAYOUT.pavementZ));
    points.push(pt(plan.seat.x, plan.seat.z, {
      dwell: 9 + roll() * 8, sit: true, face: plan.seat.face,
    }));
    points.push(pavementEnd(endX, roll));
  } else if (plan.kind === 'neighbor' && plan.door) {
    const d = plan.door;
    points.push(pt(d.x, LAYOUT.pavementZ));
    points.push(pt(d.x, d.z, { dwell: 4.2 + roll() * 2.2, face: d.face }));
    points.push(pt(d.x, LAYOUT.pavementZ));
    points.push(pavementEnd(endX, roll));
  } else if (plan.kind === 'park' && plan.spot) {
    points.push(pt(LAYOUT.crossX, LAYOUT.pavementZ));
    points.push(pt(LAYOUT.crossX, LAYOUT.farSideZ));
    points.push(pt(plan.spot.x, plan.spot.z, {
      dwell: 14 + roll() * 12, sit: true, face: plan.spot.face,
    }));
    points.push(pt(LAYOUT.crossX, LAYOUT.farSideZ));
    points.push(pt(LAYOUT.crossX, LAYOUT.pavementZ));
    points.push(pavementEnd(endX, roll));
  } else if (plan.kind === 'queue' && plan.mark) {
    const m = plan.mark;
    points.push(pt(m.x, m.z, { dwell: 36, face: m.face }));
    points.push(pavementEnd(endX, roll));
  } else if (plan.kind === 'glasshouse') {
    const x = GLASSHOUSE_WAIT.x - (plan.stand || 0) * 0.5;
    points.push(pt(LAYOUT.crossX, LAYOUT.pavementZ));
    points.push(pt(LAYOUT.crossX, LAYOUT.farSideZ));
    points.push(pt(x, GLASSHOUSE_WAIT.z, {
      dwell: plan.pass ? 0 : 1.8 + roll() * 1.6,
      face: GLASSHOUSE_WAIT.face,
    }));
    if (!plan.pass) {
      points.push(pt(LAYOUT.crossX, LAYOUT.farSideZ));
      points.push(pt(LAYOUT.crossX, LAYOUT.pavementZ));
      points.push(pavementEnd(endX, roll));
    }
  } else if (plan.kind === 'row' && plan.lot) {
    const lot = plan.lot;
    const x = lot.x + ((plan.stand || 0) - 1) * 0.62;
    points.push(pt(LAYOUT.crossX, LAYOUT.pavementZ));
    points.push(pt(LAYOUT.crossX, LAYOUT.farSideZ));
    points.push(pt(x, lot.z, { dwell: 3.2 + roll() * 2.6, face: lot.face }));
    points.push(pt(endX, LAYOUT.farSideZ));
  } else if (plan.kind === 'prop' && plan.prop) {
    const prop = plan.prop;
    if (prop.far) {
      points.push(pt(LAYOUT.crossX, LAYOUT.pavementZ));
      points.push(pt(LAYOUT.crossX, LAYOUT.farSideZ));
      points.push(pt(prop.x, prop.z, { dwell: 1.6 + roll() * 1.4, face: Math.PI }));
      points.push(pt(LAYOUT.crossX, LAYOUT.farSideZ));
      points.push(pt(LAYOUT.crossX, LAYOUT.pavementZ));
    } else {
      points.push(pt(prop.x, LAYOUT.pavementZ));
      points.push(pt(prop.x, prop.z, { dwell: 1.4 + roll() * 1.3, face: prop.z < LAYOUT.pavementZ ? Math.PI : 0 }));
      points.push(pt(prop.x, LAYOUT.pavementZ));
    }
    points.push(pavementEnd(endX, roll));
  } else {
    return null;
  }

  return {
    kind: plan.kind,
    lotId: plan.lot ? plan.lot.id : null,
    hold: plan.hold || null,
    doorId: plan.door ? plan.door.id : null,
    points,
    economic: false,
  };
}

export class StreetLife {
  constructor(scene, { lite = false } = {}) {
    this.lite = !!lite;
    this.truce = false;
    this.live = false;
    this.day = 1;
    this.rivalHeat = 0;
    this.demandKind = 'flat';
    this.demandQueue = 0;
    this.demandGlass = 0;
    this.rowLots = [];
    this.agents = [];
    this.holds = new Set();
    this._since = 0;
    this.rng = mulberry32(1);
    this._c = new THREE.Color();
    // Three's Object3D ids draw Math.random. Park that draw on a private
    // stream so building these meshes cannot shift the café's seeded day.
    const savedRandom = Math.random;
    let uuidSeed = 0x51EE7;
    Math.random = () => {
      uuidSeed = (Math.imul(uuidSeed, 1664525) + 1013904223) >>> 0;
      return uuidSeed / 4294967296;
    };
    try {
      this._d = new THREE.Object3D();
      const cap = STREET_CAP.full;
      const mk = (geo) => {
        const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.82 }), cap);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = false;
        m.count = cap;
        if (scene && scene.add) scene.add(m);
        return m;
      };
      const leg = new THREE.BoxGeometry(0.09, 0.34, 0.09);
      leg.translate(0, -0.17, 0);
      this.parts = {
        torso: mk(new THREE.CapsuleGeometry(0.16, 0.34, 3, 6)),
        head: mk(new THREE.SphereGeometry(0.13, 8, 6)),
        legL: mk(leg),
        legR: mk(leg.clone()),
      };
      for (const part of Object.values(this.parts)) {
        for (let i = 0; i < cap; i++) part.setMatrixAt(i, ZERO);
      }
    } finally {
      Math.random = savedRandom;
    }
    this.free = [];
    for (let i = STREET_CAP.full - 1; i >= 0; i--) this.free.push(i);
  }

  get cap() { return this.lite ? STREET_CAP.lite : STREET_CAP.full; }
  get count() { return this.agents.length; }

  census() {
    const out = {};
    for (const a of this.agents) out[a.kind] = (out[a.kind] || 0) + 1;
    return out;
  }

  setLite(on) {
    this.lite = !!on;
    while (this.agents.length > this.cap) {
      const pawn = this.agents.find(a => a.kind === 'pavement' || a.kind === 'prop' || a.kind === 'glasshouse' || a.kind === 'queue');
      this._despawn(pawn || this.agents[this.agents.length - 1]);
    }
  }

  setTruce(on) {
    this.truce = !!on;
    if (!this.truce) return;
    for (let i = this.agents.length - 1; i >= 0; i--) {
      if (this.agents[i].kind === 'glasshouse') this._despawn(this.agents[i]);
    }
  }

  setRivalHeat(n) { this.rivalHeat = Math.max(0, Number(n) || 0); }

  // Cosmetic. `read` comes from demandShockRead. It never joins a queue.
  setDemandRead(read) {
    const kind = read && (read.kind === 'surge' || read.kind === 'thin') ? read.kind : 'flat';
    this.demandKind = kind;
    const queue = kind === 'surge' ? Math.max(0, Math.floor(Number(read.queue) || 0)) : 0;
    const glass = kind === 'surge' ? Math.max(0, Math.floor(Number(read.glass) || 0)) : 0;
    this.demandQueue = Math.min(QUEUE_MARKS.length, queue);
    this.demandGlass = Math.min(STREET_LIMITS.glasshouse, glass);
  }

  // The real line has caught the picture. The stand-ins step off.
  noteQueue(n) {
    const real = Math.max(0, Math.floor(Number(n) || 0));
    const marks = this._kindCount('queue');
    if (!marks || real < marks) return 0;
    let gone = 0;
    for (let i = this.agents.length - 1; i >= 0; i--) {
      if (this.agents[i].kind !== 'queue') continue;
      this._despawn(this.agents[i]);
      gone++;
    }
    return gone;
  }

  // Which neighbour rooms are currently open (all roofs, or one peek).
  // At most INTERIOR_CAP sitters, in door order. Does not draw the street
  // rng — opening a roof must not change who walks the pavement.
  setOpenShops(ids) {
    const open = new Set(ids || []);
    const want = [];
    for (const door of NEIGHBOR_DOORS) {
      if (!open.has(door.id) || !door.seat) continue;
      want.push(door);
      if (want.length >= INTERIOR_CAP) break;
    }
    const wantIds = new Set(want.map((d) => d.id));
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      if (a.kind === 'interior' && !wantIds.has(a.doorId)) this._despawn(a);
    }
    for (const door of want) {
      if (this.agents.some((a) => a.kind === 'interior' && a.doorId === door.id)) continue;
      this._spawnInterior(door);
    }
  }

  // Visual only. Does not write franchise.effectsDue or tomorrow's returnees.
  syncFranchise(franchise, day) {
    const next = deriveRowLots(franchise, day);
    const grew = next.filter(l => !this.rowLots.some(o => o.id === l.id));
    this.rowLots = next;
    if (this.live) {
      for (const lot of grew) this._spawnForced({ kind: 'row', lot });
    }
    return next;
  }

  beginDay(day, seed) {
    const truce = this.truce;
    const heat = this.rivalHeat;
    const kind = this.demandKind;
    const queue = this.demandQueue;
    const glass = this.demandGlass;
    const lots = this.rowLots.slice();
    this.reset();
    this.truce = truce;
    this.rivalHeat = heat;
    this.demandKind = kind;
    this.demandQueue = queue;
    this.demandGlass = glass;
    this.rowLots = lots;
    this.day = day || 1;
    this.rng = mulberry32(mixSeed(seed, this.day));
    this.live = true;
    this._since = 0;
    this._spawnOne({ kind: 'bench', settled: true });
    this._spawnOne({ kind: 'park', settled: true });
    this._spawnOne({ kind: 'neighbor', settled: true });
    for (const lot of this.rowLots) this._spawnForced({ kind: 'row', lot });
    let target = this.lite ? STREET_SEED.lite : STREET_SEED.full;
    if (this.demandKind === 'thin') target = Math.max(3, target - 2);
    let guard = 0;
    while (this.count < target && guard++ < 24) {
      if (!this._spawnOne()) break;
    }
    if (this.demandKind === 'surge') this._poseSurge();
  }

  // Stand-ins only. They are not patrons and they do not pay.
  _poseSurge() {
    const queueN = this.lite ? Math.min(2, this.demandQueue) : this.demandQueue;
    const glassN = this.lite ? Math.min(1, this.demandGlass) : this.demandGlass;
    for (let i = 0; i < queueN; i++) {
      if (this.count >= this.cap) break;
      this._spawnForced({ kind: 'queue', stand: i, settled: true });
    }
    if (this.truce) return;
    for (let i = 0; i < glassN; i++) {
      if (this.count >= this.cap) break;
      this._spawnForced({ kind: 'glasshouse', settled: true });
    }
  }

  tick() {
    if (!this.live) return;
    this._since += 1;
    const every = this.lite ? STREET_EVERY.lite : STREET_EVERY.full;
    if (this._since < every) return;
    this._since = 0;
    if (this.count >= this.cap) return;
    this._spawnOne();
  }

  // A high-speed defection already joined Sam's queue. This walker only
  // traces the zebra so the cross still reads. It never joins Sam's line.
  mirrorCrossing(from) {
    if (!this.live || this.truce) return null;
    if (this._kindCount('glasshouse') >= STREET_LIMITS.glasshouse) return null;
    return this._spawnForced({
      kind: 'glasshouse',
      from: from || { x: LAYOUT.spawnL.x, z: LAYOUT.pavementZ },
      pass: true,
    });
  }

  reset() {
    for (let i = this.agents.length - 1; i >= 0; i--) this._despawn(this.agents[i]);
    this.agents = [];
    this.holds = new Set();
    this.live = false;
    this._since = 0;
    this.rowLots = [];
  }

  update(dt, walkMul, reduced = false) {
    const stepScale = Math.max(0, Number(dt) || 0);
    const mul = Number(walkMul) > 0 ? walkMul : 1;
    const dwellScale = Math.max(1, Math.min(mul, 4));
    for (const a of this.agents.slice()) {
      if (!a.active) continue;
      let walking = false;
      if (a.state === 'dwell' && a.kind !== 'interior') {
        a.dwell -= stepScale * dwellScale;
        if (a.dwell <= 0) {
          a.state = 'walk';
          a.sitting = false;
          a.hidden = false;
          if (a.kind === 'neighbor' && DOOR_BY_ID[a.doorId]) {
            a.pos.x = DOOR_BY_ID[a.doorId].x;
            a.pos.z = DOOR_BY_ID[a.doorId].z;
          }
          if (a.hold) { this.holds.delete(a.hold); a.hold = null; }
          if (!a.path.length) { this._despawn(a); continue; }
        } else if (a.kind === 'neighbor' && DOOR_BY_ID[a.doorId]) {
          const total = a.dwell0 || a.dwell;
          const pose = neighborEnterPose(DOOR_BY_ID[a.doorId], total, total - a.dwell);
          a.pos.x = pose.x;
          a.pos.z = pose.z;
          a.hidden = pose.hidden;
          if (pose.phase === 'apron' || pose.phase === 'in') a.face = DOOR_BY_ID[a.doorId].face;
        }
      }
      if (a.state === 'walk' && a.path.length) {
        const t = a.path[0];
        const dx = t.x - a.pos.x;
        const dz = t.z - a.pos.z;
        const dist = Math.hypot(dx, dz);
        const step = a.speed * mul * stepScale;
        if (dist <= Math.max(step, 0.06)) {
          a.pos.x = t.x;
          a.pos.z = t.z;
          a.path.shift();
          if (t.dwell > 0) {
            a.state = 'dwell';
            a.dwell = t.dwell;
            a.dwell0 = t.dwell;
            a.hidden = false;
            a.sitting = !!t.sit;
            if (t.face != null) a.face = t.face;
          } else if (!a.path.length) {
            this._despawn(a);
            continue;
          }
        } else {
          a.pos.x += (dx / dist) * step;
          a.pos.z += (dz / dist) * step;
          const want = Math.atan2(dx, dz);
          let diff = want - a.face;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          a.face += diff * Math.min(1, stepScale * 10);
          walking = true;
        }
      }
      a.walking = walking;
      a.phase += stepScale * (walking ? 7 : 1.2);
      if (a.hidden) {
        for (const part of Object.values(this.parts)) part.setMatrixAt(a.idx, ZERO);
      } else {
        this._draw(a, walking, !!reduced);
      }
    }
    for (const part of Object.values(this.parts)) part.instanceMatrix.needsUpdate = true;
  }

  _kindCount(kind, lotId) {
    let n = 0;
    for (const a of this.agents) {
      if (a.kind !== kind) continue;
      if (lotId && a.lotId !== lotId) continue;
      n++;
    }
    return n;
  }

  _peek(prefix) {
    const list = prefix === 'bench' ? BENCH_SEATS : PARK_SPOTS;
    for (let i = 0; i < list.length; i++) {
      const hold = `${prefix}:${i}`;
      if (!this.holds.has(hold)) return { ...list[i], hold };
    }
    return null;
  }

  _peekDoor() {
    for (const d of NEIGHBOR_DOORS) {
      const hold = `door:${d.id}`;
      if (!this.holds.has(hold)) return { ...d, hold };
    }
    return null;
  }

  _peekProp() {
    for (const p of STREET_PROPS) {
      const hold = `prop:${p.id}`;
      if (!this.holds.has(hold)) return { ...p, hold };
    }
    return null;
  }

  _hasRoom(choice) {
    switch (choice.kind) {
      case 'pavement': return this._kindCount('pavement') < STREET_LIMITS.pavement;
      case 'bench': return !!this._peek('bench');
      case 'park': return !!this._peek('park');
      case 'neighbor': return !!this._peekDoor();
      case 'prop': return !!this._peekProp();
      case 'glasshouse':
        return !this.truce && this._kindCount('glasshouse') < STREET_LIMITS.glasshouse;
      case 'row': {
        const lot = choice.lot;
        if (!lot) return false;
        if (this._kindCount('row') >= STREET_LIMITS.rowTotal) return false;
        return this._kindCount('row', lot.id) < STREET_LIMITS.rowPerLot;
      }
      default: return false;
    }
  }

  _planFor(kind, lot, force) {
    const fromLeft = this.rng() < 0.5;
    if (kind === 'pavement') {
      const seat = this.rng() < 0.34 ? this._peek('bench') : null;
      return { kind, fromLeft, seat, pause: !!seat, hold: seat ? seat.hold : null };
    }
    if (kind === 'bench') {
      const seat = this._peek('bench');
      if (!seat) return null;
      return { kind, fromLeft, seat, hold: seat.hold };
    }
    if (kind === 'park') {
      const spot = this._peek('park');
      if (!spot) return null;
      return { kind, fromLeft, spot, hold: spot.hold };
    }
    if (kind === 'neighbor') {
      const door = this._peekDoor();
      if (!door) return null;
      return { kind, fromLeft, door, hold: door.hold };
    }
    if (kind === 'prop') {
      const prop = this._peekProp();
      if (!prop) return null;
      return { kind, fromLeft, prop, hold: prop.hold };
    }
    if (kind === 'glasshouse') {
      if (this.truce || this._kindCount('glasshouse') >= STREET_LIMITS.glasshouse) return null;
      return { kind, fromLeft, stand: this._kindCount('glasshouse') };
    }
    if (kind === 'queue') {
      const i = force && Number.isFinite(force.stand) ? force.stand : this._kindCount('queue');
      const mark = QUEUE_MARKS[i];
      if (!mark || this.holds.has(mark.hold)) return null;
      return { kind, fromLeft, mark, hold: mark.hold, stand: i };
    }
    if (kind === 'row') {
      const row = lot || this.rowLots.find(l => this._kindCount('row', l.id) < STREET_LIMITS.rowPerLot);
      if (!row) return null;
      if (this._kindCount('row') >= STREET_LIMITS.rowTotal) return null;
      if (this._kindCount('row', row.id) >= STREET_LIMITS.rowPerLot) return null;
      return { kind, fromLeft, lot: row, stand: this._kindCount('row', row.id) };
    }
    return null;
  }

  _makeRoom() {
    if (this.count < this.cap) return true;
    const pawn = this.agents.find(a => a.kind === 'pavement' || a.kind === 'prop');
    if (!pawn) return false;
    this._despawn(pawn);
    return this.count < this.cap;
  }

  _spawnInterior(door) {
    if (!door || !door.seat) return null;
    if (!this._makeRoom()) return null;
    if (!this.free.length || this.count >= this.cap) return null;
    const idx = this.free.pop();
    const n = NEIGHBOR_DOORS.indexOf(door);
    const cohort = PEOPLE[(n >= 0 ? n : 0) % PEOPLE.length] || 'commuters';
    const agent = {
      idx,
      active: true,
      economic: false,
      kind: 'interior',
      lotId: null,
      hold: null,
      doorId: door.id,
      cohort,
      pos: new THREE.Vector3(door.seat.x, 0, door.seat.z),
      face: 0,
      path: [],
      state: 'dwell',
      dwell: 1e9,
      dwell0: 1e9,
      hidden: false,
      sitting: true,
      walking: false,
      speed: 0,
      phase: n * 1.3,
      scale: 0.92,
      skin: new THREE.Color(SKIN[(n >= 0 ? n : 0) % SKIN.length]),
      legs: new THREE.Color(LEGS[(n >= 0 ? n : 0) % LEGS.length]),
      torso: new THREE.Color(COHORTS[cohort]?.color ?? 0xaaaaaa),
    };
    this.agents.push(agent);
    this._paint(agent);
    this._draw(agent, false, false);
    return agent;
  }

  _spawnForced(force) {
    if (!this._makeRoom()) return null;
    return this._spawnOne(force);
  }

  _spawnOne(force) {
    if (!this.free.length || this.count >= this.cap) return null;
    const settled = !!(force && force.settled);
    for (let attempt = 0; attempt < 6; attempt++) {
      let plan;
      if (force && force.kind) {
        if (attempt > 0) return null;
        plan = this._planFor(force.kind, force.lot, force);
        if (plan && force.from) plan.from = force.from;
        if (plan && force.pass) plan.pass = true;
      } else {
        const choices = ambientChoices({
          rowLots: this.rowLots, rivalHeat: this.rivalHeat, truce: this.truce,
          demandKind: this.demandKind,
        }).filter(c => this._hasRoom(c));
        const choice = weightedPick(this.rng, choices);
        if (!choice) return null;
        plan = this._planFor(choice.kind, choice.lot);
      }
      if (!plan) return null;
      const route = buildRoute(plan, this.rng);
      if (!route || routeBlocked(route.points)) continue;
      return this._activate(route, settled);
    }
    return null;
  }

  _activate(route, settled) {
    if (!this.free.length) return null;
    const idx = this.free.pop();
    const roll = this.rng;
    const cohort = PEOPLE[(roll() * PEOPLE.length) | 0] || 'commuters';
    const points = route.points;
    const agent = {
      idx,
      active: true,
      economic: false,
      kind: route.kind,
      lotId: route.lotId,
      hold: route.hold,
      doorId: route.doorId || null,
      cohort,
      pos: new THREE.Vector3(points[0].x, 0, points[0].z),
      face: points[0].face != null ? points[0].face : (points[0].x < 0 ? Math.PI / 2 : -Math.PI / 2),
      path: points.slice(1),
      state: 'walk',
      dwell: 0,
      dwell0: 0,
      hidden: false,
      sitting: false,
      walking: false,
      speed: (COHORTS[cohort]?.walkSpeed || 1.8) * 0.84,
      phase: roll() * 6.28,
      scale: 0.86 + roll() * 0.26,
      skin: new THREE.Color(SKIN[(roll() * SKIN.length) | 0]),
      legs: new THREE.Color(LEGS[(roll() * LEGS.length) | 0]),
      torso: new THREE.Color(COHORTS[cohort]?.color ?? 0xaaaaaa),
    };
    if (route.hold) this.holds.add(route.hold);
    if (settled) {
      const i = points.findIndex(p => p.dwell > 0);
      if (i >= 0) {
        const spot = points[i];
        agent.pos.set(spot.x, 0, spot.z);
        agent.path = points.slice(i + 1);
        agent.state = 'dwell';
        agent.dwell = spot.dwell;
        // The dawn visitor has to still be at the door when the crane settles.
        if (route.kind === 'neighbor') agent.dwell = Math.max(agent.dwell, 14);
        if (route.kind === 'queue') agent.dwell = Math.max(agent.dwell, 36);
        if (route.kind === 'glasshouse' && this.demandKind === 'surge') agent.dwell = Math.max(agent.dwell, 18);
        agent.dwell0 = agent.dwell;
        agent.sitting = !!spot.sit;
        if (spot.face != null) agent.face = spot.face;
      }
    }
    this.agents.push(agent);
    this._paint(agent);
    this._draw(agent, false, false);
    return agent;
  }

  _despawn(agent) {
    if (!agent || !agent.active) return;
    agent.active = false;
    if (agent.hold) this.holds.delete(agent.hold);
    for (const part of Object.values(this.parts)) {
      part.setMatrixAt(agent.idx, ZERO);
      part.instanceMatrix.needsUpdate = true;
    }
    this.free.push(agent.idx);
    const i = this.agents.indexOf(agent);
    if (i >= 0) this.agents.splice(i, 1);
  }

  _paint(agent) {
    const P = this.parts;
    P.torso.setColorAt(agent.idx, agent.torso);
    P.head.setColorAt(agent.idx, agent.skin);
    P.legL.setColorAt(agent.idx, agent.legs);
    P.legR.setColorAt(agent.idx, agent.legs);
    for (const part of Object.values(P)) if (part.instanceColor) part.instanceColor.needsUpdate = true;
  }

  _draw(agent, walking, reduced) {
    const d = this._d;
    d.rotation.order = 'YXZ';
    const P = this.parts;
    const sitting = agent.sitting;
    const bob = walking && !reduced ? Math.sin(agent.phase) * 0.04 : 0;
    const s = agent.scale;
    const torsoY = sitting ? (agent.kind === 'bench' ? 0.58 : 0.46) : 0.62 + bob;
    const headY = torsoY + 0.46 * s;
    const swing = walking && !reduced ? Math.sin(agent.phase) * 0.45 : 0;
    d.rotation.set(0, agent.face, 0);
    d.position.set(agent.pos.x, torsoY, agent.pos.z);
    d.scale.setScalar(s);
    d.updateMatrix();
    P.torso.setMatrixAt(agent.idx, d.matrix);
    d.position.set(agent.pos.x, headY, agent.pos.z);
    d.updateMatrix();
    P.head.setMatrixAt(agent.idx, d.matrix);
    const rx = Math.cos(agent.face);
    const rz = -Math.sin(agent.face);
    const hipY = (sitting ? 0.34 : 0.36) + bob * 0.4;
    const legS = sitting ? 0.001 : s;
    d.position.set(agent.pos.x - rx * 0.09 * s, hipY, agent.pos.z - rz * 0.09 * s);
    d.rotation.set(swing, agent.face, 0);
    d.scale.set(s, legS, s);
    d.updateMatrix();
    P.legL.setMatrixAt(agent.idx, d.matrix);
    d.position.set(agent.pos.x + rx * 0.09 * s, hipY, agent.pos.z + rz * 0.09 * s);
    d.rotation.set(-swing, agent.face, 0);
    d.updateMatrix();
    P.legR.setMatrixAt(agent.idx, d.matrix);
  }
}
