// Floor chairs follow patrons who are actually inside.
// Nobody inside → no visual sitters, and the full-room flag stays clear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../js/config.js';
import {
  FLOOR_SEAT_CAP, floorSeatBudget, isInsidePatron, planVisualSitters, spreadSeats,
} from '../js/floorSeats.js';
import { PatronSystem } from '../js/patrons.js';

const door = { doorZ: LAYOUT.door.z };

function person(over) {
  return {
    idx: 0, active: true, state: 'inQueue', slotI: 0,
    pos: { x: -6, z: -3 },
    ...over,
  };
}

test('nobody inside seats nobody', () => {
  assert.equal(floorSeatBudget([]), 0);
  assert.equal(floorSeatBudget(null), 0);
  assert.deepEqual(planVisualSitters([{ idx: 1 }], [], 4), []);
  assert.equal(isInsidePatron(person({ active: false }), door), false);
  assert.equal(isInsidePatron(person({ state: 'leaving' }), door), false);
  assert.equal(isInsidePatron(person({ state: 'inRivalQ', pos: { x: 1, z: 15 } }), door), false);
  assert.equal(isInsidePatron(person({ pos: { x: 0, z: LAYOUT.door.z + 1 } }), door), false);
  assert.equal(isInsidePatron(person({ state: 'toQueue' }), door), false);
});

test('a patron on the café floor counts as inside', () => {
  assert.equal(isInsidePatron(person(), door), true);
  assert.equal(isInsidePatron(person({ state: 'browse', pos: { x: -9, z: 1 } }), door), true);
  assert.equal(isInsidePatron(person({ state: 'sit', pos: { x: 5, z: 1 } }), door), true);
});

test('real sitters consume the cap and a few others fill what is left', () => {
  const room = [
    person({ state: 'sit', idx: 1 }),
    person({ state: 'toSeat', idx: 2 }),
    person({ idx: 3 }), person({ idx: 4 }), person({ idx: 5 }),
  ];
  assert.equal(floorSeatBudget(room), FLOOR_SEAT_CAP - 2);
  assert.equal(floorSeatBudget([person({ state: 'sit' })]), 0);
  assert.equal(floorSeatBudget([person()]), 1);
});

test('a long line keeps its head at the bar and seats the back', () => {
  const inside = Array.from({ length: 10 }, (_, i) => person({ idx: i, slotI: i, pos: { x: -6, z: -3.5 + i * 0.4 } }));
  const chosen = planVisualSitters([], inside, 5);
  assert.deepEqual(chosen.map(p => p.slotI).sort((a, b) => a - b), [5, 6, 7, 8, 9]);
  const again = planVisualSitters(chosen, inside, 5);
  assert.deepEqual(again.map(p => p.idx), chosen.map(p => p.idx), 'the same people keep the chairs');
  const quiet = planVisualSitters(chosen, inside.slice(0, 2), 2);
  assert.equal(quiet.length, 2);
});

test('chairs spread across tables', () => {
  const t0 = { id: 0 }, t1 = { id: 1 }, t2 = { id: 2 };
  const seats = [
    { table: t0, id: 'a' }, { table: t0, id: 'b' },
    { table: t1, id: 'c' }, { table: t2, id: 'd' },
  ];
  assert.deepEqual(spreadSeats(seats, 3).map(s => s.id), ['a', 'c', 'd']);
  assert.deepEqual(spreadSeats(seats, 0), []);
});

function seatsOf(n = 9) {
  const seats = [];
  for (let t = 0; t < 3; t++) {
    const table = { id: t };
    for (let s = 0; s < n / 3; s++) {
      seats.push({ x: 4 + t * 2, z: -1 + s * 1.6, face: 0, taken: null, table });
    }
  }
  return seats;
}

function system(seats) {
  return new PatronSystem({ add() {} }, { seats }, null, null, null, { random: () => 0.99 });
}

function parkInside(ps, count, z0 = -3.2) {
  const cohorts = ['commuters', 'students', 'creatives', 'elders', 'tourists'];
  const people = [];
  for (let i = 0; i < count; i++) {
    const p = ps.spawn(cohorts[i % cohorts.length], 'counter', true);
    p.state = 'inQueue';
    p.slotI = i;
    p.pos.set(-6, 0, z0 + i * 0.35);
    people.push(p);
  }
  return people;
}

test('a busy room seats a few real patrons and does not fill the room flag', () => {
  const seats = seatsOf();
  const ps = system(seats);
  parkInside(ps, 10);
  assert.equal(ps.queueLength, 10);
  ps.update(0.05, 2, 1000, false);
  assert.equal(ps._floorSitters.length, FLOOR_SEAT_CAP);
  assert.ok(ps._floorSitters.every(p => p._floorSeat && p.state === 'inQueue'));
  assert.ok(seats.every(s => !s.taken), 'visual chairs are not a full room');
  assert.equal(ps.queueLength, 10, 'sitting visually does not leave the queue');
  const tables = new Set(ps._floorSitters.map(p => p._floorSeat.table));
  assert.ok(tables.size >= 3, 'sitters spread across the tables');
  const heads = ps._floorSitters.filter(p => p.slotI < 3);
  assert.equal(heads.length, 0, 'the head of a long line stays at the bar');
  for (let i = 0; i < 24; i++) ps.update(0.5, 2, 2000 + i, false);
  assert.ok(ps._floorSitters.every(p => p._seatSettled), 'they arrive and hold the sit');
  const ids = ps._floorSitters.map(p => p.idx).join(',');
  ps.update(0.5, 2, 90000, true);
  assert.equal(ps._floorSitters.map(p => p.idx).join(','), ids, 'reduced motion does not reshuffle the chairs');
});

test('an empty room and a street-only crowd leave every chair free', () => {
  const seats = seatsOf();
  const ps = system(seats);
  ps.update(0.5, 2, 1000, false);
  assert.equal(ps._floorSitters.length, 0);
  parkInside(ps, 4, 8);
  ps.update(0.5, 2, 1000, false);
  assert.equal(ps._floorSitters.length, 0, 'the pavement is not the café');
  assert.ok(seats.every(s => !s.taken));
  ps.reset();
  ps.update(0.5, 2, 1000, false);
  assert.equal(ps._floorSitters.length, 0);
  assert.equal(ps.patrons.length, 0);
});

test('one person inside takes one chair', () => {
  const seats = seatsOf();
  const ps = system(seats);
  parkInside(ps, 1);
  ps.update(1, 2, 1000, false);
  assert.equal(ps._floorSitters.length, 1);
  assert.equal(seats.filter(s => s.taken).length, 0);
});
