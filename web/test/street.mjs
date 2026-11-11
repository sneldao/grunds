// street.mjs — VISION.md street-of-shops: pure roster, origin exposure,
// and the specialism insight layer. Headless, deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STREET, shopById, eventOrigin, originExposure, insightFor, streetForDay, CAPITALS, NEUTRAL_CARTS, capitalForDay, capitalCartPool, capitalDrinks } from '../js/street.js';
import { DRINK_IDS } from '../js/menu.js';
import { NEIGHBOR_DOORS } from '../js/streetLife.js';
import { EVENTS } from '../js/config.js';

test('street: roster is stable and well-formed', () => {
  assert.ok(STREET.length >= 5, 'a street needs neighbours');
  const ids = STREET.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
  assert.equal(STREET.filter(s => s.id === 'player').length, 1, 'exactly one player stand');
  const hybrids = STREET.filter(s => s.hybrid);
  for (const h of hybrids) assert.equal(h.specialism, null, 'hybrids hold no specialism');
  for (const s of STREET) {
    if (!s.hybrid && !s.chain && s.id !== 'player') {
      assert.ok(s.origin, `specialist ${s.id} needs an origin identity`);
      assert.ok(s.specialism, `specialist ${s.id} needs a specialism`);
    }
  }
});

test('street: origins map onto the Exchange event geography', () => {
  assert.equal(eventOrigin('frost_minas'), 'brazil');
  assert.equal(eventOrigin('drought_ea'), 'eastAfrica');
  assert.equal(eventOrigin('harvest_good'), 'colombia');
  assert.equal(eventOrigin('rumour_frost'), 'brazil');
  assert.equal(eventOrigin('stable'), null, 'a quiet market names nobody');
  assert.equal(eventOrigin('hype_matcha'), null);
  assert.equal(eventOrigin('rain_soak'), null);
  assert.equal(eventOrigin('nonexistent'), null);
});

test('street: origin exposure hits the right shops and only them', () => {
  const frost = { ...EVENTS.frost_minas, id: 'frost_minas' };
  const hearth = shopById('hearth');
  const bell = shopById('bell');
  const glass = shopById('glasshouse');
  assert.equal(originExposure(hearth, frost), 1.8, 'frost is Hearth & Rye\u2019s crisis');
  assert.equal(originExposure(bell, frost), 1, 'the Colombia house is untouched by a Brazil frost');
  assert.equal(originExposure(glass, frost), 1, 'the chain buys spot: no origin exposure');
  const harvest = { ...EVENTS.harvest_good, id: 'harvest_good' };
  assert.equal(originExposure(bell, harvest), 1.4, 'a clean Huila harvest is the windfall side');
  const rains = { ...EVENTS.drought_ea, id: 'drought_ea' };
  assert.equal(originExposure(shopById('quill'), rains), 1.5);
});

test('street: insights fire only for their specialism and conditions', () => {
  const frost = { ...EVENTS.frost_minas, id: 'frost_minas' };
  const rumour = { ...EVENTS.rumour_frost, id: 'rumour_frost' };
  const rains = { ...EVENTS.drought_ea, id: 'drought_ea' };
  const stable = { ...EVENTS.stable, id: 'stable' };

  const bracing = insightFor(shopById('hearth'), rumour, 0);
  assert.ok(bracing, 'the rumour reaches the origin house first');
  assert.equal(bracing.edge, +1);
  const hit = insightFor(shopById('hearth'), frost, 0);
  assert.ok(hit, 'the frost confirms what they braced for');
  assert.match(hit.line, /canopy caught the frost/);
  assert.equal(insightFor(shopById('hearth'), stable, 0), null, 'nothing to say on a quiet market');

  const cupping = insightFor(shopById('quill'), rains, 0);
  assert.ok(cupping, 'thin lots show in the cup before the wire');
  assert.equal(insightFor(shopById('quill'), frost, 0), null, 'Brazil frost is not their read');

  // The roaster-café reads the board a day early, event-independent.
  const up = insightFor(shopById('bell'), stable, 0.033);
  assert.ok(up, 'rising drift is their warning');
  assert.equal(up.edge, +1);
  const down = insightFor(shopById('bell'), stable, -0.02);
  assert.ok(down, 'easing drift is their comfort');
  assert.equal(down.edge, -1);
  assert.equal(insightFor(shopById('bell'), stable, 0), null, 'flat board: no read');

  // Hybrids and the chain never read.
  assert.equal(insightFor(shopById('marrow'), frost, 0.05), null);
  assert.equal(insightFor(shopById('glasshouse'), frost, 0.05), null);
  assert.equal(insightFor(shopById('player'), frost, 0.05), null);
});

test('street: streetForDay returns one stable row per shop', () => {
  const frost = { ...EVENTS.frost_minas, id: 'frost_minas' };
  const rows = streetForDay(frost, 0.033);
  assert.equal(rows.length, STREET.length);
  assert.deepEqual(rows.map(r => r.id), STREET.map(s => s.id), 'stable order');
  const hearth = rows.find(r => r.id === 'hearth');
  assert.equal(hearth.exposure, 1.8);
  assert.ok(hearth.insight, 'the frost day gives Hearth & Rye its read');
  const marrow = rows.find(r => r.id === 'marrow');
  assert.equal(marrow.exposure, 1);
  assert.equal(marrow.insight, null);
  assert.equal(marrow.hybrid, true);
});

test('street: the neighbour doors ARE the roster shops', () => {
  // Attention street (pillar 4): door id, agent route and shop row are one
  // thing — NEIGHBOR_DOORS in streetLife.js maps 1:1 onto STREET.
  const doorIds = NEIGHBOR_DOORS.map(d => d.id);
  const shopIds = STREET.map(s => s.id);
  for (const id of doorIds) assert.ok(shopIds.includes(id), `door ${id} has no shop identity`);
  assert.equal(doorIds.length, 4, 'four buildings on the block');
});

test('street: determinism — same inputs, same street', () => {
  const frost = { ...EVENTS.frost_minas, id: 'frost_minas' };
  const a = JSON.stringify(streetForDay(frost, 0.033));
  const b = JSON.stringify(streetForDay(frost, 0.033));
  assert.equal(a, b);
});

test('street: the capital of the day is deterministic and rotates', () => {
  for (const seed of [7, 42, 1999]) {
    for (const day of [1, 3, 5]) {
      const c = capitalForDay(seed, day);
      assert.ok(CAPITALS.includes(c), `${seed}/${day} picked a capital off the roster`);
      assert.equal(capitalForDay(seed, day), c, 'same seed+day must name the same capital');
    }
  }
  const week = new Set([1, 2, 3, 4, 5, 6, 7].map(d => capitalForDay(7, d).id));
  assert.ok(week.size > 1, 'a week should not sit in one capital');
});

test('street: the capital cart pool carries the landing capital, never food carts', () => {
  const cap = capitalForDay(7, 1);
  const pool = capitalCartPool(7);
  assert.ok(pool.length >= NEUTRAL_CARTS.length);
  if (cap.cart) {
    assert.equal(pool.filter(id => id === cap.cart).length, 2, 'signature cart deals weighted');
    for (const id of NEUTRAL_CARTS) assert.ok(pool.includes(id), 'neutral carts stay in the pool');
  } else {
    assert.deepEqual(pool, NEUTRAL_CARTS.slice(), 'no signature → the shared kerb pool');
  }
  for (const id of pool) {
    assert.ok(!/hot-dog|elote|ice-cream|sopaipilla|ramen|mercado/.test(id), `${id} is a literal food cart`);
  }
});

test('street: the capital drink bias is bounded, valid, and deterministic', () => {
  for (const cap of CAPITALS) {
    assert.ok(cap.drinks && Object.keys(cap.drinks).length > 0, `${cap.id} must bias the drink mix`);
    for (const [id, mult] of Object.entries(cap.drinks)) {
      assert.ok(DRINK_IDS.includes(id), `${cap.id} biases unknown drink ${id}`);
      assert.ok(mult >= 0.5 && mult <= 1.5, `${cap.id}/${id} bias ${mult} outside the lean band`);
    }
  }
  const bias = capitalDrinks(7, 3);
  assert.equal(bias, capitalForDay(7, 3).drinks, 'capitalDrinks is the day capital\'s own map');
  assert.equal(capitalDrinks(7, 3), capitalDrinks(7, 3), 'deterministic per seed+day');
});
