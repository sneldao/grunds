// web/test/street-theatre.mjs — attention-street pillar 2 (VISION.md):
// authored, seeded street theatre. The sim never changes — these moments are
// cosmetic, ride the street's own seeded stream, and must stay deterministic:
//   1. the coffee argument — squared-up pair, one lifts the cup, a watcher
//   2. the cat-watch — passers-by gather at the street cat's bench
//      (the cat itself is world.js' one street cat — LAYOUT.catHome is its
//      home; streetLife owns no cat mesh)
//   3. the skater — fast crossing, board under foot, one at a time
// Run: node --test web/test/street-theatre.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import { LAYOUT } from '../js/config.js';
import { StreetLife, VIGNETTE_SPOTS } from '../js/streetLife.js';

export const THEATRE_ROLES = ['busker', 'chat', 'argue', 'catwatch', 'crowd', 'skater'];

function drive(seed, ticks, { lite = false } = {}) {
  const s = new StreetLife(new THREE.Group(), { lite });
  s.live = true;
  s.beginDay(1, seed);
  const events = [];               // [tick, vg] first-sighting order
  const byRole = new Map();
  for (let i = 0; i < ticks; i++) {
    s.tick();
    s.update(1, 2, false);
    for (const a of s.agents) {
      if (!a.vg) continue;
      if (!byRole.has(a.vg)) {
        byRole.set(a.vg, a);
        events.push([i, a.vg]);
      }
    }
  }
  return { s, events, byRole };
}

test('the full theatre takes the stage within a day of street life', () => {
  const seen = new Set();
  for (let seed = 11; seed <= 16 && seen.size < 5; seed++) {
    const { byRole } = drive(seed, 2400);
    for (const k of byRole.keys()) seen.add(k);
  }
  for (const role of ['busker', 'chat', 'argue', 'catwatch', 'skater']) {
    assert.ok(seen.has(role), `${role} never appeared across seeds 11–16`);
  }
});

test('the argument is staged: squared pair, one lifts the cup', () => {
  let holder = null;
  for (let seed = 11; seed <= 16 && !holder; seed++) {
    holder = drive(seed, 2400).byRole.get('argue') || null;
  }
  assert.ok(holder, 'no argue pair appeared across seeds 11\u201316');
  assert.equal(holder.act, 'sip', 'the aggrieved party lifts the cup in question');
  assert.equal(holder.heldKind, 'cup');
});

test('cat-watch forms around the bench cat and holds its own gate', () => {
  const s = new StreetLife(new THREE.Group(), {});
  s.live = true;
  s.beginDay(1, 13);
  assert.ok(s._spawnCatWatch(), 'cat-watch should form on an empty street');
  const watchers = s.agents.filter(a => a.vg === 'catwatch');
  assert.ok(watchers.length >= 1 && watchers.length <= 2, `watchers: ${watchers.length}`);
  assert.ok(s.holds.has('vg:cat'), 'the watch holds its gate');
  assert.equal(s._spawnCatWatch(), null, 'a second watch must wait');
  assert.equal(s._vgAnchor && s._vgAnchor.vg, 'catwatch');
  // The watcher's dwell point sits road-side of the bench, turned at the cat.
  const w = watchers[0];
  const dwellPt = w.path.find(p => p.dwell > 0);
  assert.ok(dwellPt, 'watcher has a dwell point');
  assert.ok(dwellPt.z > 7.9 && dwellPt.z < 8.8, `watcher stands pavement-side of the cat (z ${dwellPt.z})`);
  assert.ok(Math.abs(dwellPt.x - 5.95) < 1.4, `watcher gathers near the cat (x ${dwellPt.x})`);
});

test('the skater crosses fast, one at a time, board under foot', () => {
  const s = new StreetLife(new THREE.Group(), {});
  s.live = true;
  s.beginDay(1, 23);
  const sk = s._spawnSkater();
  assert.ok(sk, 'skater route should be clear on an empty street');
  assert.equal(sk.vg, 'skater');
  assert.ok(sk.speed > 3.5, `skater should push hard, got ${sk.speed}`);
  assert.equal(sk.act, null);
  assert.equal(sk.heldKind, null, 'no hands in pockets while pushing');
  assert.equal(s._spawnSkater(), null, 'only one skater at a time');
  s.update(1, 2, false);
  assert.equal(s.skateBoard.visible, true, 'board rides under a live skater');
  // Push them across the whole pavement; they despawn at the far edge.
  for (let i = 0; i < 40 && s._skater; i++) s.update(1, 2, false);
  assert.equal(s._skater, null, 'skater must release the board when they leave');
  assert.equal(s.skateBoard.visible, false, 'board hidden once the skater is gone');
});

test('one street cat: home on the bench, cameo walk starts there', () => {
  // The cat fixture lives in world.js — streetLife owns no cat mesh.
  const s = new StreetLife(new THREE.Group(), {});
  assert.equal(s.cat, undefined, 'streetLife must not build its own cat');
  // The home is the far end of the bench slab (bench centred x 5, top 0.49).
  assert.ok(Math.abs(LAYOUT.catHome.x - 5.95) < 0.01 && Math.abs(LAYOUT.catHome.z - 7.4) < 0.01);
  for (const sp of VIGNETTE_SPOTS) {
    assert.ok(Math.hypot(sp.x - LAYOUT.catHome.x, sp.z - LAYOUT.catHome.z) > 1.5,
      'vignette spot overlaps the cat\u2019s bench');
  }
  // world.js: the cameo walk leaves from the bench and the cat goes home
  // after its sit (one cat, one street).
  const world = readFileSync(new URL('../js/world.js', import.meta.url), 'utf8');
  assert.ok(world.includes('W.cat.position.set(LAYOUT.catHome.x, 0.49, LAYOUT.catHome.z)'),
    'the cat must start the day at home on the bench');
  assert.ok(/catPath = \[new THREE\.Vector3\(L\.catHome\.x/.test(world),
    'the 09:30 cameo must leave from the bench');
  assert.ok(world.includes('W.catGoHome'), 'the visit ends with the cat walking home');
  assert.ok(!/W\.cat\.visible = false/.test(world), 'the cat never leaves the world \u2014 it goes home');
});

test('update() animation never touches the seeded stream', () => {
  const a = new StreetLife(new THREE.Group(), {});
  const b = new StreetLife(new THREE.Group(), {});
  a.live = b.live = true;
  a.beginDay(1, 77); b.beginDay(1, 77);
  // Burn arbitrary animation frames on one instance only (board, pigeons,
  // dogs — the whole render pass).
  for (let i = 0; i < 500; i++) a.update(0.7, 2, false);
  const ra = [a.rng(), a.rng(), a.rng()];
  const rb = [b.rng(), b.rng(), b.rng()];
  assert.deepEqual(ra, rb, 'update() drew from the street stream');
});

test('the theatre is deterministic — same seed, same stage directions', () => {
  const d1 = drive(31, 1600);
  const d2 = drive(31, 1600);
  assert.deepEqual(d1.events, d2.events, 'first-sighting order drifted');
  const census = (s) => JSON.stringify([...s.agents.map(a => [a.vg || a.kind, a.idx])].sort());
  assert.equal(census(d1.s), census(d2.s), 'end state drifted');
});

test('lite streets keep the theatre off', () => {
  const { s, byRole } = drive(11, 800, { lite: true });
  assert.equal(byRole.size, 0, 'lite mode spawned theatre');
  assert.ok(!s._skater && !s._vgAnchor);
});
