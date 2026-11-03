// Cosy street, phase 1 (VISION.md "The cosy street"): footfall looks
// recruited, not spawned. Two choreography changes, no count changes:
//   1. Door consideration beat — when a line has already formed, arriving
//      patrons pause at the door and read the board before joining. The
//      beat consumes NO sim rng draws (dwell comes off the cosmetic phase)
//      and an empty bar still joins at once, so the idle path is unchanged.
//   2. Rival-door ambience — the street gets people whose whole purpose is
//      the shop next door (stop at a neighbour door, leave with a cup).
//      Pure streetLife: its own mulberry32 stream, cosmetic, no sim effect.
// Run: node --test web/test/cosy-street.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PatronSystem } from '../js/patrons.js';
import { buildRoute, ambientChoices, STREET_LIMITS } from '../js/streetLife.js';

// ---- 1. the door consideration beat ----------------------------------------

const considerThis = (queueLen) => ({
  counterQ: Array.from({ length: queueLen }, () => ({})),
  _campDivert: () => false,
  _leaveForRival: () => {},
});

test('arrival pauses at the door when a line has formed', () => {
  const p = { state: 'walkingIn', phase: 2.1, considered: false };
  PatronSystem.prototype._onArrive.call(considerThis(3), p);
  assert.equal(p.state, 'consider');
  assert.ok(p.dwell >= 1 && p.dwell <= 2, 'one or two sim-minutes at the board');
  assert.equal(p.face, Math.PI, 'faces the board, not the street');
  assert.ok(p.considered, 'the beat happens once');
});

test('an empty bar is joined at once — no pause, no beat', () => {
  for (const len of [1, 2]) {
    const p = { state: 'walkingIn', phase: 0.4, considered: false };
    PatronSystem.prototype._onArrive.call(considerThis(len), p);
    assert.equal(p.state, 'toQueue', `queue of ${len} joins immediately`);
  }
});

test('the beat never repeats and ends in the ordinary door decision', () => {
  const p = { state: 'walkingIn', phase: 5.9, considered: false };
  const sys = considerThis(4);
  PatronSystem.prototype._onArrive.call(sys, p);
  assert.equal(p.state, 'consider');
  PatronSystem.prototype._onArrive.call(sys, p);   // second arrival of the beat
  assert.equal(p.state, 'toQueue');
});

test('a full room still diverts after the beat (camp decision unchanged)', () => {
  const sys = considerThis(5);
  let diverted = false;
  sys._campDivert = () => true;
  sys._leaveForRival = () => { diverted = true; };
  const p = { state: 'consider', phase: 1.0, considered: true };
  PatronSystem.prototype._onArrive.call(sys, p);
  assert.ok(diverted, 'the camp divert fires exactly where it always did');
});

test('the dwell is derived from cosmetics — no sim rng in the beat', () => {
  // Same phase → same dwell, always. If the beat drew this.random(), the
  // seeded-floor/replay guards would catch it too; this pins the contract.
  const src = PatronSystem.prototype._onArrive.toString();
  assert.ok(!/this\.random\(\)/.test(src.split('case \'consider\'')[0].split('case \'walkingIn\'')[1]),
    'the walkingIn branch takes no new draws');
  for (const phase of [0, 1.3, 2.7, 4.4, 6.0]) {
    const p = { state: 'walkingIn', phase, considered: false };
    PatronSystem.prototype._onArrive.call(considerThis(3), p);
    const again = { state: 'walkingIn', phase, considered: false };
    PatronSystem.prototype._onArrive.call(considerThis(3), again);
    assert.equal(p.dwell, again.dwell);
  }
});

// ---- 2. rival-door ambience --------------------------------------------------

test('the street offers rival visits, capped at two at a time', () => {
  const choices = ambientChoices({ rowLots: [], rivalHeat: 0, truce: false });
  const rv = choices.find(c => c.kind === 'rivalvisit');
  assert.ok(rv && rv.weight > 0);
  assert.equal(STREET_LIMITS.rivalvisit, 2);
});

test('a rival visit stops at a neighbour door with a cup, then leaves', () => {
  const door = { id: 'hearth', x: 3.55, z: 5.7, face: Math.PI };
  let i = 0;
  const rng = () => [0.5, 0.2, 0.7, 0.9, 0.3, 0.6][i++ % 6];
  const route = buildRoute({ kind: 'rivalvisit', door, fromLeft: true }, rng);
  assert.ok(route, 'route builds');
  const stops = route.points.filter(pt => pt.dwell > 0);
  assert.equal(stops.length, 1, 'one stop — at the door');
  assert.ok(Math.abs(stops[0].x - door.x) < 0.5, 'the stop is the neighbour door');
  assert.ok(stops[0].dwell >= 6 && stops[0].dwell <= 14, 'longer than a glance');
  assert.equal(stops[0].face, door.face, 'they face the shop');
  const last = route.points[route.points.length - 1];
  assert.ok(Math.abs(last.x) >= 15, 'and they walk on — the street is theirs');
});
