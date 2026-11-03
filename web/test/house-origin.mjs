// The player's house origin (VISION.md open question 2): Exchange events
// become personal. Pure-module checks + wiring checks; the open table
// (no origin) must stay bit-identical.
// Run: node web/test/house-origin.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Exchange } from '../js/exchange.js';
import { ORIGINS, originAmp, originPull, validOrigin, originKey, streetForDay, houseRead, HOUSE_READS, OPEN_TABLE } from '../js/street.js';

const frost = { id: 'frost_minas', tier: 'cata' };
const harvest = { id: 'harvest_good', tier: 'good' };
const rains = { id: 'drought_ea', tier: 'bad' };

test('open table is neutral: no origin → amp 1, pull 1', () => {
  for (const e of [frost, harvest, rains, { id: 'stable', tier: 'calm' }]) {
    assert.equal(originAmp(null, e), 1);
    assert.equal(originPull(null, e), 1);
  }
});

test('a matching origin amplifies; a mismatched one does not', () => {
  assert.ok(originAmp('brazil', frost) > 1);
  assert.ok(originAmp('colombia', harvest) > 1);
  assert.ok(originAmp('eastAfrica', rains) > 1);
  assert.equal(originAmp('colombia', frost), 1);
  assert.equal(originAmp('brazil', { id: 'stable', tier: 'calm' }), 1);
  assert.ok(originPull('brazil', frost) > 1);
  assert.equal(originPull('brazil', harvest), 1);
});

test('validOrigin rejects junk (stale saves)', () => {
  assert.equal(validOrigin('narnia'), null);
  assert.equal(validOrigin(undefined), null);
  assert.equal(validOrigin('brazil'), 'brazil');
  assert.equal(validOrigin('none'), 'none', 'the open table is a real answer');
  assert.equal(ORIGINS[0].id, null, 'the pick default is "not chosen", not "open table"');
});

test('originKey: "none" and null both mean no identity; junk means none', () => {
  assert.equal(originKey('none'), null);
  assert.equal(originKey(null), null);
  assert.equal(originKey(undefined), null);
  assert.equal(originKey('narnia'), null);
  assert.equal(originKey('brazil'), 'brazil');
});

test('"none" (the chosen open table) plays exactly like no origin', () => {
  assert.equal(originAmp('none', { id: 'frost_minas', tier: 'cata' }), 1);
  assert.equal(originPull('none', { id: 'frost_minas', tier: 'cata' }), 1);
  assert.equal(streetForDay({ id: 'frost_minas', tier: 'cata' }, 0, 'none').find(r => r.id === 'player').exposure, 1);
  const none = new Exchange(13), open = new Exchange(13);
  none.origin = OPEN_TABLE; open.origin = null;
  for (let i = 0; i < 30; i++) {
    none.day = open.day = 1 + (i % 5);
    assert.deepEqual(none.roll(), open.roll());
    assert.equal(none.beanIndex, open.beanIndex);
  }
});

test('Exchange: same seed, origin changes only matching-event swings', () => {
  const run = (origin) => {
    const x = new Exchange(11); x.origin = origin;
    const out = [];
    for (let i = 0; i < 40; i++) { x.day = 4 + (i % 3); const ev = x.roll(); out.push({ id: ev.id, idx: x.beanIndex }); x.beanIndex = 1; }
    return out;
  };
  const base = run(null), br = run('brazil');
  assert.deepEqual(base.map(o => o.id), br.map(o => o.id), 'origin never changes the deck');
  let hit = 0;
  base.forEach((o, i) => {
    if (o.id === 'frost_minas' || o.id === 'rumour_frost') { assert.ok(br[i].idx > o.idx); hit++; }
    else assert.equal(br[i].idx, o.idx, `${o.id} unaffected`);
  });
  assert.ok(hit > 0, 'sample contained a Brazil event');
});

test('streetForDay: the player row carries the house origin exposure', () => {
  const none = streetForDay(frost, 0, null).find(r => r.id === 'player');
  const house = streetForDay(frost, 0, 'brazil').find(r => r.id === 'player');
  assert.equal(none.exposure, 1);
  assert.ok(house.exposure > 1);
});

test('wiring: the pick lives in the street brief, answers persist, open table is an answer', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(html.includes('id="lic-house"'), false, 'the licence carries no house pick');
  assert.match(main, /Your house/, 'the house pick lives in the street brief');
  assert.match(main, /!introducedSet\(\)\.has\('street'\)/, 'street block is gated until the tool is introduced');
  assert.match(main, /playerName, standName, playerRole, perkBg, houseOrigin,/);
  assert.match(main, /originPull\(originKey\(houseOrigin\), exchange\.event\)/);
  assert.match(main, /houseOrigin = o\.id \|\| 'none'/, 'choosing "no origin" stores the sentinel, so the picker dismisses');
  assert.match(main, /houseOrigin == null && validOrigin\(s\.houseOrigin\)/, 'a returning player is not re-asked');
});

test('peek is the next roll, and never spends the stream', () => {
  const x = new Exchange(23), y = new Exchange(23);
  for (let i = 0; i < 30; i++) {
    x.day = i % 5; y.day = x.day;    // Brief time: openDay has not incremented yet
    const before = x.rng.state();
    const p1 = x.peek(), p2 = x.peek();
    x.day++; y.day++;                // what openDay does before it rolls
    assert.equal(x.rng.state(), before, 'peek leaves the rng untouched');
    assert.equal(p1.id, p2.id);
    const rolled = x.roll();
    assert.equal(rolled.id, p1.id, 'peek names exactly what the roll draws');
    y.roll();                       // control exchange never peeked
    assert.equal(x.rng.state(), y.rng.state(), 'peeking never shifts the seeded sequence');
  }
});

test('peek honours the rumour tilt and wire bias like the roll', () => {
  const x = new Exchange(5); x.day = 1; const d0 = x.day; x.lastEventId = 'rumour_frost'; x.lastTier = 'warn';
  const bias = { harvest_good: 3 };
  const p = x.peek(bias); x.day = d0 + 1; const r = x.roll(bias);
  assert.equal(p.id, r.id);
});

test('houseRead: only a matching house hears, and Cerrado cannot tell talk from front', () => {
  assert.equal(houseRead(null, { id: 'frost_minas' }), null);
  assert.equal(houseRead('colombia', { id: 'frost_minas' }), null);
  assert.equal(houseRead('brazil', { id: 'stable' }), null);
  assert.ok(houseRead('colombia', { id: 'harvest_good' }));
  assert.ok(houseRead('eastAfrica', { id: 'drought_ea' }));
  assert.equal(houseRead('brazil', { id: 'frost_minas' }), houseRead('brazil', { id: 'rumour_frost' }),
    'rumour and front read identically — asymmetric, not a perfect hedge');
  for (const r of Object.values(HOUSE_READS)) assert.ok(r.head && r.line && !/[→~%]| · /.test(r.line));
});

test('wiring: the Brief reads the house from a peek, past-tense for rivals', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /houseRead\(originKey\(houseOrigin\), exchange\.peek\(currentIntelBias\(\)\)\)/);
  assert.match(main, /const intelBias = currentIntelBias\(\);/);
});

import { rivalTells, TELL_CHANCE } from '../js/street.js';

test('rivalTells: only a rival whose origin the draw names can tell', () => {
  assert.deepEqual(rivalTells({ id: 'stable' }, 7, 3), []);
  assert.deepEqual(rivalTells(null, 7, 3), []);
  for (let seed = 1; seed < 200; seed++) {
    for (const t of rivalTells({ id: 'frost_minas' }, seed, 2)) assert.equal(t.id, 'cerrado_stand');
    for (const t of rivalTells({ id: 'harvest_good' }, seed, 2)) assert.equal(t.id, 'huila_house');
  }
});

test('rivalTells: deterministic, and honest-but-not-guaranteed (~60%)', () => {
  assert.deepEqual(rivalTells({ id: 'frost_minas' }, 42, 3), rivalTells({ id: 'frost_minas' }, 42, 3));
  let shown = 0; const N = 2000;
  for (let seed = 1; seed <= N; seed++) shown += rivalTells({ id: 'frost_minas' }, seed, 2).length;
  const rate = shown / N;
  assert.ok(Math.abs(rate - TELL_CHANCE) < 0.05, `tell rate ${rate} ≈ ${TELL_CHANCE}`);
  assert.ok(shown < N, 'absence proves nothing — some frosts come with no tell');
});

test('rivalTells: copy contract — one plain sentence, no chains', () => {
  for (const id of ['frost_minas', 'rumour_frost', 'harvest_good', 'drought_ea'])
    for (let seed = 1; seed < 60; seed++)
      for (const t of rivalTells({ id }, seed, 2)) assert.ok(t.line && !/[→~%]| · /.test(t.line));
});

test('wiring: Brief shows rival tells from the same peek', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /rivalTells\(exchange\.peek\(currentIntelBias\(\)\), seedNow\(\), day\)/);
});
