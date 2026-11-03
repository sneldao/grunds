// web/test/neighbor-queues.mjs — attention street pillar 4 (slice 2):
// the boards are real shops, so their aprons carry the day's queue.
// neighborQueues() in street.js is a pure function of the board tones
// (the same streetForDay shape the Brief renders) + a hash of
// (seed, day, shop) — no rng stream, replays agree without saving anything.
// streetLife reconciles each line at its target with walk-in / dwell /
// peel-out members. Cosmetic only: none of it touches the café till.
// Run: node --test web/test/neighbor-queues.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { streetForDay, boardLine, neighborQueues } from '../js/street.js';
import { StreetLife, NEIGHBOR_DOORS, NQUEUE_SLOTS, STREET_CAP } from '../js/streetLife.js';
import { EVENTS } from '../js/config.js';

const ev = (id) => ({ ...EVENTS[id], id });
const boardsFor = (event, drift = 0) =>
  streetForDay(event, drift).map(r => Object.assign({ id: r.id }, boardLine(r, event) || {}));

test('queue counts follow the posture: hit shops stand empty, windfalls draw lines', () => {
  const frost = ev('frost_minas');
  const q = neighborQueues(boardsFor(frost), 1234, 2);
  assert.ok(q.hearth <= 1, `the frost hit Hearth & Rye — its queue must be thin, got ${q.hearth}`);
  assert.ok(q.bell >= 1 && q.bell <= 2, `untouched shops keep their baseline, got ${q.bell}`);
  assert.ok(q.quill >= 1 && q.quill <= 2);
  assert.ok(q.marrow >= 1 && q.marrow <= 2);
  const harvest = ev('harvest_good');
  const qh = neighborQueues(boardsFor(harvest), 1234, 2);
  assert.ok(qh.bell >= 3, `a clean harvest is Bell & Brass's day — the line should form, got ${qh.bell}`);
  assert.ok(qh.hearth <= 2, 'Colombia windfall is not a Brazil house read');
});

test('neighborQueues is pure and skips the player + the chain', () => {
  const frost = ev('frost_minas');
  const a = JSON.stringify(neighborQueues(boardsFor(frost, 0.03), 77, 3));
  const b = JSON.stringify(neighborQueues(boardsFor(frost, 0.03), 77, 3));
  assert.equal(a, b);
  const q = neighborQueues(boardsFor(frost), 77, 3);
  assert.equal(q.player, undefined);
  assert.equal(q.glasshouse, undefined, 'Glasshouse keeps its own stand-in queue');
  assert.deepEqual(Object.keys(q).sort(), ['bell', 'hearth', 'marrow', 'quill']);
  for (const n of Object.values(q)) assert.ok(n >= 0 && n <= 4);
});

test('every door has queue slots running toward the pavement, capped at 4', () => {
  for (const door of NEIGHBOR_DOORS) {
    const slots = NQUEUE_SLOTS[door.id];
    assert.equal(slots.length, 4, `${door.id} supports a four-deep line`);
    let prevZ = door.z;
    for (const s of slots) {
      assert.ok(s.z > prevZ, `${door.id} slots run from the door toward the pavement`);
      prevZ = s.z;
      assert.equal(s.face, door.face, 'the line faces the shop');
    }
    assert.ok(slots[slots.length - 1].z < 8.2, 'the tail stays off the walking lane');
  }
});

function drive(seed, targets, ticks) {
  const s = new StreetLife(new THREE.Group(), {});
  s.live = true;
  s.beginDay(1, seed);
  s.setNeighborQueues(targets);
  for (let i = 0; i < ticks; i++) s.tick();
  return s;
}

test('reconcile fills each apron to its target with non-economic members', () => {
  const targets = { quill: 2, hearth: 0, bell: 4, marrow: 1 };
  const s = drive(31, targets, 96);
  for (const door of NEIGHBOR_DOORS) {
    const live = s.agents.filter(a => a.kind === 'nqueue' && a.doorId === door.id);
    assert.equal(live.length, targets[door.id], `${door.id} line should match its board`);
    for (const a of live) assert.equal(a.economic, false);
  }
  assert.equal(s.count <= STREET_CAP.full, true, 'queues never breach the street cap');
  // Slots never double-booked.
  const holds = [...s.holds].filter(h => h.startsWith('nq:'));
  assert.equal(new Set(holds).size, holds.length);
});

test('a peel-out is replaced — the line holds through churn', () => {
  const s = drive(31, { quill: 3, hearth: 1, bell: 2, marrow: 1 }, 96);
  const before = s.agents.filter(a => a.kind === 'nqueue').length;
  assert.equal(before, 7);
  // One customer gets their order and leaves early.
  const gone = s.agents.find(a => a.kind === 'nqueue' && a.doorId === 'quill');
  s._despawn(gone);
  for (let i = 0; i < 32; i++) s.tick();
  const after = s.agents.filter(a => a.kind === 'nqueue' && a.doorId === 'quill').length;
  assert.equal(after, 3, 'the reconciler refills the apron');
});

test('the same seed stages the same street', () => {
  const t = { quill: 2, hearth: 1, bell: 3, marrow: 1 };
  const census = (s) => JSON.stringify(s.agents.map(a => [a.kind, a.doorId, a.idx]).sort());
  assert.equal(census(drive(97, t, 64)), census(drive(97, t, 64)));
});

test('lite streets carry no apron queues', () => {
  const s = new StreetLife(new THREE.Group(), { lite: true });
  s.live = true;
  s.beginDay(1, 5);
  s.setNeighborQueues({ quill: 3, hearth: 2, bell: 2, marrow: 1 });
  for (let i = 0; i < 96; i++) s.tick();
  assert.equal(s.agents.filter(a => a.kind === 'nqueue').length, 0);
});
