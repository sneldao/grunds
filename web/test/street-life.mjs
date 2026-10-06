// Ambient street life stays off the café till.
// Routes may visit neighbours, the bench, the park, Glasshouse, props, and
// Row hubs — and must not enter the player door or change patron RNG.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LAYOUT, FRANCHISE } from '../js/config.js';
import { SLOTS } from '../js/districtGen.js';
import { PatronSystem } from '../js/patrons.js';
import {
  STREET_CAP, STREET_SEED, NEIGHBOR_DOORS, BENCH_SEATS, PARK_SPOTS, STREET_PROPS,
  GLASSHOUSE_WAIT, deriveRowLots, ambientChoices, weightedPick, buildRoute, routeBlocked,
  StreetLife, mulberry32,
} from '../js/streetLife.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const scene = { add() {} };
const roll = () => 0.37;

test('far-side crossing constant matches the old zebra end', () => {
  assert.equal(LAYOUT.farSideZ, 14.6);
});

test('ambient routes stay out of the player café and its door', () => {
  for (const fromLeft of [true, false]) {
    const pavement = buildRoute({ kind: 'pavement', fromLeft }, roll);
    assert.equal(routeBlocked(pavement.points), false);
    assert.ok(pavement.points.every(p => Math.abs(p.x - LAYOUT.door.x) > 2 || Math.abs(p.z - LAYOUT.door.z) > 2));
    for (const seat of BENCH_SEATS) {
      const bench = buildRoute({ kind: 'bench', fromLeft, seat }, roll);
      assert.equal(routeBlocked(bench.points), false, 'bench');
      assert.ok(bench.points.some(p => p.sit && p.dwell >= 8));
    }
    for (const spot of PARK_SPOTS) {
      const park = buildRoute({ kind: 'park', fromLeft, spot }, roll);
      assert.equal(routeBlocked(park.points), false, 'park');
      assert.ok(park.points.some(p => p.sit && p.z > LAYOUT.farSideZ - 0.6));
      assert.ok(park.points.some(p => p.x === LAYOUT.crossX && p.z === LAYOUT.farSideZ));
    }
    for (const door of NEIGHBOR_DOORS) {
      const peek = buildRoute({ kind: 'neighbor', fromLeft, door }, roll);
      assert.equal(routeBlocked(peek.points), false, door.id);
      const dwell = peek.points.find(p => p.dwell > 0);
      assert.ok(dwell.dwell >= 4 && dwell.dwell <= 7);
      assert.equal(dwell.x, door.x);
      assert.ok(dwell.z > LAYOUT.door.z);
    }
    for (const prop of STREET_PROPS) {
      const pause = buildRoute({ kind: 'prop', fromLeft, prop }, roll);
      assert.equal(routeBlocked(pause.points), false, prop.id);
    }
    const cross = buildRoute({ kind: 'glasshouse', fromLeft, stand: 0 }, roll);
    assert.equal(routeBlocked(cross.points), false);
    assert.ok(cross.points.some(p => p.x === LAYOUT.crossX && p.z === LAYOUT.pavementZ));
    assert.ok(cross.points.some(p => p.x === LAYOUT.crossX && p.z === LAYOUT.farSideZ));
    assert.ok(cross.points.some(p => p.x === GLASSHOUSE_WAIT.x));
    for (const lot of FRANCHISE.lots) {
      const visit = buildRoute({
        kind: 'row', fromLeft, stand: 1,
        lot: { id: lot.id, x: lot.position[0], z: lot.position[2] - 1.2, face: 0, purpose: 'community' },
      }, roll);
      assert.equal(routeBlocked(visit.points), false, lot.id);
      assert.ok(visit.points.some(p => p.dwell > 0 && Math.abs(p.x - lot.position[0]) < 0.7));
    }
  }
});

test('prop pauses sit beside the district kit, not inside the mesh', () => {
  for (const prop of STREET_PROPS) {
    if (!SLOTS[prop.id]) continue;
    const [sx, , sz] = SLOTS[prop.id].position;
    const d = Math.hypot(prop.x - sx, prop.z - sz);
    assert.ok(d < 1.8, `${prop.id} drifted ${d.toFixed(2)}m from its slot`);
  }
});

test('row visitors follow the ledger window and carry no returnee count', () => {
  const franchise = {
    lots: {
      14: { placed: true, purpose: 'community', placedDay: 3 },
      11: { placed: true, purpose: 'rent', placedDay: 1 },
      18: { placed: true, purpose: 'draw', placedDay: 5 },
    },
  };
  assert.deepEqual(deriveRowLots(franchise, 3).map(l => l.id), []);
  assert.deepEqual(deriveRowLots(franchise, 4).map(l => l.id), ['14']);
  const day6 = deriveRowLots(franchise, 6);
  assert.deepEqual(day6.map(l => l.id), ['14', '18']);
  assert.equal(day6.reduce((n, l) => n + (l.returnees || 0), 0), 0);
  assert.ok(!day6.some(l => l.purpose === 'rent'));
  const src = read('web/js/streetLife.js');
  assert.doesNotMatch(src, /todayReturnees|extraReturnees|counterQ|rivalQ|patrons\.spawn|Math\.random\s*\(/);
  const main = read('web/js/main.js');
  assert.match(main, /extraReturnees: womReturnees\(evangelistServes\) \+ rowFx\.returnees/);
});

test('Glasshouse weight grows with the rival queue and drops on a truce', () => {
  const calm = ambientChoices({ rivalHeat: 0 }).find(c => c.kind === 'glasshouse').weight;
  const hot = ambientChoices({ rivalHeat: 12 }).find(c => c.kind === 'glasshouse').weight;
  const truce = ambientChoices({ rivalHeat: 12, truce: true }).find(c => c.kind === 'glasshouse').weight;
  assert.ok(hot > calm);
  assert.equal(truce, 0);
  const rng = mulberry32(4);
  const picks = new Set();
  const choices = ambientChoices({
    rowLots: [{ id: '14', purpose: 'community', x: -3, z: 14.4, face: 0 }],
  });
  for (let i = 0; i < 80; i++) picks.add(weightedPick(rng, choices).kind);
  for (const kind of ['pavement', 'neighbor', 'park', 'bench', 'glasshouse', 'prop', 'row']) {
    assert.ok(picks.has(kind), `weighted choice never rolled ${kind}`);
  }
});

test('the street seeds sitters, stays capped, and never calls Math.random', () => {
  const orig = Math.random;
  Math.random = () => { throw new Error('street life called Math.random'); };
  try {
    const full = new StreetLife(scene, { lite: false });
    full.beginDay(2, 11);
    assert.equal(full.count, STREET_SEED.full);
    assert.ok(full.count <= STREET_CAP.full);
    assert.ok(full.census().bench >= 1);
    assert.ok(full.census().park >= 1);
    assert.ok(full.agents.every(a => a.economic === false));
    const other = new StreetLife(scene, { lite: false });
    other.beginDay(2, 11);
    assert.equal(
      full.agents.map(a => `${a.kind}:${a.pos.x.toFixed(2)},${a.pos.z.toFixed(2)}`).join('|'),
      other.agents.map(a => `${a.kind}:${a.pos.x.toFixed(2)},${a.pos.z.toFixed(2)}`).join('|'),
    );
    const lite = new StreetLife(scene, { lite: true });
    lite.beginDay(1, 3);
    assert.equal(lite.count, STREET_SEED.lite);
    assert.ok(lite.count <= STREET_CAP.lite);
    lite.setLite(false);
    assert.equal(lite.cap, STREET_CAP.full);

    for (let i = 0; i < 80; i++) {
      full.tick();
      full.update(0.05, 1, false);
      for (const a of full.agents) {
        assert.equal(routeBlocked([{ x: a.pos.x, z: a.pos.z }]), false, a.kind);
      }
    }
    assert.ok(full.count <= full.cap);

    const beforeRent = full.census().row || 0;
    full.syncFranchise({ lots: { 11: { placed: true, purpose: 'rent', placedDay: 1 } } }, 4);
    assert.equal(full.census().row || 0, beforeRent);
    full.syncFranchise({ lots: { 14: { placed: true, purpose: 'community', placedDay: 2 } } }, 4);
    assert.ok(full.agents.some(a => a.kind === 'row' && a.lotId === '14'));
    full.setTruce(true);
    assert.equal(full.census().glasshouse || 0, 0);
    assert.equal(full.mirrorCrossing({ x: -16, z: 7.8 }), null);
    full.setTruce(false);
    const mirror = full.mirrorCrossing({ x: LAYOUT.spawnL.x, z: LAYOUT.pavementZ });
    assert.equal(mirror.kind, 'glasshouse');
    assert.equal(mirror.economic, false);
    assert.equal(routeBlocked(mirror.path.concat([mirror.pos])), false);
  } finally {
    Math.random = orig;
  }
});

test('a quick defection still joins Sam immediately; the cosmetic cross is not the queue', () => {
  function spawnCounted(hook) {
    const orig = Math.random;
    let n = 0;
    Math.random = () => { n++; return 0.25; };
    const sys = new PatronSystem(scene, { seats: [] }, null, null, null, { random: () => 0 });
    sys.rivalStrategy = 'PRICE_WAR';
    const seen = [];
    if (hook) sys.onCosmeticCross = (from) => { seen.push(from); if (hook.street) hook.street.mirrorCrossing(from); };
    const p = sys.spawn('commuters', 'counter', true);
    Math.random = orig;
    return { n, p, seen, sys };
  }
  const street = new StreetLife(scene, { lite: false });
  const quiet = Math.random;
  Math.random = () => { throw new Error('street life called Math.random'); };
  try { street.beginDay(1, 5); } finally { Math.random = quiet; }
  const plain = spawnCounted(null);
  const crossed = spawnCounted({ street });
  assert.equal(plain.n, crossed.n);
  assert.equal(crossed.p.state, 'inRivalQ');
  assert.equal(crossed.p.queueRef, 'rival');
  assert.equal(crossed.sys.rivalQ.length, 1);
  assert.equal(crossed.sys.counterQ.includes(crossed.p), false);
  assert.equal(crossed.seen.length, 1);
  assert.ok(Math.abs(crossed.seen[0].z - LAYOUT.pavementZ) < 2);
  assert.ok(crossed.p.pos.z > 14);
  assert.equal(plain.sys.rivalChoices, crossed.sys.rivalChoices);

  const stay = new PatronSystem(scene, { seats: [] }, null, null, null, { random: () => 0.99 });
  let notes = 0;
  stay.onCosmeticCross = () => { notes++; };
  const q = stay.spawn('commuters', 'counter', true);
  assert.equal(q.queueRef, 'counter');
  assert.equal(stay.rivalQ.length, 0);
  assert.equal(notes, 0);

  const walk = new PatronSystem(scene, { seats: [] }, null, null, null, { random: () => 0 });
  walk.rivalStrategy = 'PRICE_WAR';
  let walked = 0;
  walk.onCosmeticCross = () => { walked++; };
  const slow = walk.spawn('commuters', 'counter', false);
  assert.equal(slow.state, 'defecting');
  assert.equal(walked, 0);
  assert.deepEqual(slow.path.map(v => v.z), [LAYOUT.pavementZ, LAYOUT.farSideZ]);
});

test('main wires street life beside the café waves', () => {
  const main = read('web/js/main.js');
  const world = read('web/js/world.js');
  assert.match(main, /new StreetLife\(scene, \{ lite \}\)/);
  assert.match(main, /street\.beginDay\(d, seedNow\(\)\)/);
  assert.match(main, /street\.tick\(\)/);
  assert.match(main, /street\.update\(/);
  assert.match(main, /patrons\.onCosmeticCross/);
  assert.match(main, /world\.setRivalHeat\(patrons\.rivalQ\.length\)/);
  assert.match(world, /_rivalHeat \* 0\.05/);
  assert.match(world, /W\._rivalCrowd/);
  assert.match(world, /W\.rivalHeatMat/);
});
