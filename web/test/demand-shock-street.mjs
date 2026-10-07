// A wire demand shock is a street picture first. The spawn roll is untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EVENTS } from '../js/config.js';
import { demandShockRead, dawnDemandMult } from '../js/shocks.js';
import {
  STREET_SEED, QUEUE_MARKS, GLASSHOUSE_WAIT,
  ambientChoices, buildRoute, routeBlocked, inPlayerCafe, nearCafeDoor,
  StreetLife,
} from '../js/streetLife.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const scene = { add() {} };
const roll = () => 0.37;

function posed(kind, { lite = false, truce = false, seed = 11, day = 2 } = {}) {
  const life = new StreetLife(scene, { lite });
  const sample = kind === 'surge'
    ? demandShockRead(EVENTS.hype_matcha.demand, 1)
    : kind === 'thin'
      ? demandShockRead(EVENTS.rain_soak.demand, 1)
      : demandShockRead(1, 1);
  life.setDemandRead(sample);
  life.setTruce(truce);
  const orig = Math.random;
  Math.random = () => { throw new Error('street life called Math.random'); };
  try { life.beginDay(day, seed); }
  finally { Math.random = orig; }
  return life;
}

test('wire demand events classify without becoming a spawn input', () => {
  const surge = demandShockRead(EVENTS.hype_matcha.demand, dawnDemandMult({ day: 1 }));
  const thin = demandShockRead(EVENTS.rain_soak.demand, 1);
  const frost = demandShockRead(EVENTS.frost_minas.demand, 1);
  assert.equal(surge.kind, 'surge');
  assert.equal(surge.queue, 3);
  assert.equal(surge.glass, 2);
  assert.equal(surge.heat, 6);
  assert.equal(surge.energy, 1);
  assert.equal(surge.word, 'STREET UP');
  assert.equal(/\d/.test(surge.word), false);
  assert.equal(thin.kind, 'thin');
  assert.equal(thin.queue, 0);
  assert.equal(thin.heat, 0);
  assert.equal(thin.energy, -1);
  assert.equal(thin.word, 'STREET THIN');
  assert.equal(frost.kind, 'flat');
  assert.equal(frost.word, '');
  assert.equal(dawnDemandMult({ day: 2 }), 1);
  const stacked = demandShockRead(1.1, 1.1);
  assert.equal(stacked.kind, 'surge');
  assert.ok(Math.abs(stacked.mul - 1.21) < 1e-9);
});

test('a surge stands a line and heats Glasshouse before anyone pays', () => {
  for (const mark of QUEUE_MARKS) {
    assert.equal(inPlayerCafe(mark.x, mark.z), false);
    assert.equal(nearCafeDoor(mark.x, mark.z), false);
    const route = buildRoute({ kind: 'queue', fromLeft: true, mark, hold: mark.hold }, roll);
    assert.equal(route.economic, false);
    assert.equal(routeBlocked(route.points), false, `${mark.x},${mark.z}`);
  }
  const life = posed('surge');
  assert.equal(life.census().queue, 3);
  assert.ok(life.census().glasshouse >= 2);
  assert.ok(life.agents.every(a => a.economic === false));
  const line = life.agents.filter(a => a.kind === 'queue');
  assert.deepEqual(line.map(a => a.pos.x), QUEUE_MARKS.map(m => m.x));
  for (const a of line) {
    assert.equal(a.state, 'dwell');
    assert.ok(a.dwell >= 36);
    assert.equal(routeBlocked([{ x: a.pos.x, z: a.pos.z }]), false);
  }
  const glass = life.agents.filter(a => a.kind === 'glasshouse' && a.state === 'dwell');
  assert.ok(glass.length >= 2);
  for (const a of glass) assert.ok(Math.abs(a.pos.z - GLASSHOUSE_WAIT.z) < 0.2);

  const again = posed('surge');
  assert.equal(
    life.agents.map(a => `${a.kind}:${a.pos.x.toFixed(2)},${a.pos.z.toFixed(2)}`).join('|'),
    again.agents.map(a => `${a.kind}:${a.pos.x.toFixed(2)},${a.pos.z.toFixed(2)}`).join('|'),
  );

  assert.equal(life.noteQueue(2), 0);
  assert.equal(life.census().queue, 3);
  assert.equal(life.noteQueue(3), 3);
  assert.equal(life.census().queue || 0, 0);
  assert.ok(life.census().glasshouse >= 2);

  const quiet = posed('thin');
  assert.equal(quiet.census().queue || 0, 0);
  assert.equal(quiet.count, STREET_SEED.full - 2);

  const cease = posed('surge', { truce: true });
  assert.equal(cease.census().queue, 3);
  assert.equal(cease.census().glasshouse || 0, 0);

  const lite = posed('surge', { lite: true });
  assert.equal(lite.census().queue, 2);
  assert.ok(lite.count <= lite.cap);
});

test('surge traffic leans toward the pavement and Glasshouse; a truce still stops the cross', () => {
  const flat = ambientChoices({ rivalHeat: 0 }).find(c => c.kind === 'glasshouse').weight;
  const surge = ambientChoices({ rivalHeat: 0, demandKind: 'surge' }).find(c => c.kind === 'glasshouse').weight;
  const thin = ambientChoices({ rivalHeat: 0, demandKind: 'thin' }).find(c => c.kind === 'glasshouse').weight;
  const truce = ambientChoices({ rivalHeat: 12, demandKind: 'surge', truce: true }).find(c => c.kind === 'glasshouse').weight;
  assert.ok(surge > flat);
  assert.ok(thin < flat);
  assert.equal(truce, 0);
  const pave = (kind) => ambientChoices({ demandKind: kind }).find(c => c.kind === 'pavement').weight;
  assert.ok(pave('surge') > pave('flat'));
  assert.ok(pave('thin') < pave('flat'));
});

test('the day poses the street before the headline, and the wave math is the old line', () => {
  const main = read('web/js/main.js');
  const open = main.slice(main.indexOf('function startTradingDay'), main.indexOf('function updateTicker'));
  const pose = open.indexOf('street.beginDay');
  const card = open.indexOf("fx.card('DAY '");
  assert.ok(pose > 0 && card > pose, 'the street is posed before the day card');
  assert.match(open, /demandShockRead\(ev\.demand/);
  assert.match(open, /setDemandHeat\(read\.heat\)/);
  assert.match(open, /setTickerEnergy\(read\.energy\)/);
  assert.match(open, /street\.setDemandRead\(read\)/);
  assert.match(open, /scheduleRun\(sayDay, DEMAND_CARD_MS\)/);
  assert.doesNotMatch(open.slice(card), /read\.mul|toFixed|1\.18|0\.82/);
  const tick = main.slice(main.indexOf('function tick'), main.indexOf('function beats'));
  assert.match(tick, /exchange\.event\?\.demand \|\| 1/);
  assert.match(tick, /shockDemandMul \|\| 1/);
  assert.doesNotMatch(tick, /demandShockRead|setDemandRead/);
  assert.match(tick, /street\.noteQueue\(patrons\.queueLength\)/);
  const world = read('web/js/world.js');
  assert.match(world, /setDemandHeat/);
  assert.match(world, /setTickerEnergy/);
  assert.match(world, /s\.street && !\/\\d\/\.test\(s\.street\)/);
});
