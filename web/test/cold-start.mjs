// Cold start (VISION.md "The attention street"): the street does NOT know
// you yet. Day 1 opens quiet (start 0.10 → ≈0.28× spawn mul, down from the
// old 0.28/≈0.47× hose), passing trade stays viable at the spawnMin floor
// (unknown ≠ dead), and the dawn levers are the ladder out — chalk nearly
// holds the street, samples buy it, sponsors leap. Wave entries thin
// stochastically (waveHash01 in main.js): the old Math.max(1, …) guaranteed
// every wave entry a customer no matter how unknown the stand — a hidden
// funnel, now gone. Verdict gates retune with the economy (economy.js).
// Run: node --test web/test/cold-start.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAMPAIGN, CHAPTERS } from '../js/config.js';
import { Demand, strollShare } from '../js/demand.js';
import { VERDICT_GATES, campaignVerdict } from '../js/economy.js';
import { seeded } from '../js/exchange.js';
import { PatronSystem } from '../js/patrons.js';

const D = CAMPAIGN.demand;

test('the floor: opening awareness is genuinely unknown', () => {
  assert.equal(D.start, 0.10);
  const d = new Demand();
  const mul = d.spawnMul();
  assert.ok(mul > 0.26 && mul < 0.30, `day 1 opens ≈0.28×, got ${mul.toFixed(3)}`);
  assert.ok(mul < 0.4, 'day 1 is less than half the old hose (0.47×)');
});

test('passing trade stays viable — unknown is not dead', () => {
  assert.equal(D.spawnMin, 0.18, 'the zero-awareness floor is real passing trade');
  const d = new Demand();
  d.awareness = 0;
  assert.equal(d.spawnMul(), D.spawnMin);
});

test('the ladder: chalk holds, samples buy, sponsors leap', () => {
  assert.equal(D.chalkGain, 0.045);
  assert.equal(D.sampleGain, 0.18);
  assert.equal(D.sponsorGain, 0.30);
  // Idle drift: auto-chalk nearly offsets decay (−0.01/day), never a cliff.
  const idle = new Demand();
  idle.resolveDay({ served: 100, reputation: 62 });
  assert.ok(Math.abs(idle.awareness - (D.start - 0.01)) < 1e-9, `idle drift −0.01, got ${idle.awareness}`);
  // A sample day is a real step up.
  const sampled = new Demand();
  sampled.stage('sample', 1);
  sampled.resolveDay({ served: 100, reputation: 62 });
  assert.ok(Math.abs(sampled.awareness - (D.start - D.decay + D.chalkGain + D.sampleGain)) < 1e-9);
  assert.ok(sampled.awareness > D.start + 0.1, 'one sample day visibly buys the street');
});

test('cold awareness means a street of passers-by', () => {
  assert.ok(strollShare(D.start) > 0.29, 'day 1: ~30% of arrivals just pass the door');
  assert.ok(strollShare(D.start) > strollShare(0.5), 'the known stand gets purposeful visits');
});

test('the guaranteed funnel is gone — wave thinning is a pure hash', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.ok(!/Math\.max\(1,\s*Math\.round\(s\.q \* ECON\.spawnScale \* mul\)\)/.test(main),
    'no wave entry is guaranteed a customer any more');
  assert.ok(main.includes('waveHash01(seedNow(), day, waveIdx - 1, si)'),
    'thinning is a pure hash of (seed, day, entry, slot) — no rng stream to save or restore');
});

test('verdict gates retuned with the cold economy', () => {
  assert.equal(VERDICT_GATES.held.netAbove, 1000);
  assert.equal(VERDICT_GATES.good.netAbove, 2500);
  assert.equal(VERDICT_GATES.star.netAbove, 4500);
  assert.equal(campaignVerdict(1000.01, 50), 'held');
  assert.equal(campaignVerdict(999.99, 50), 'scarped');
});

test('day-1 chapters reframe the street as earned, not given', () => {
  const d1 = Object.fromEntries(CHAPTERS.filter(c => c.d1).map(c => [c.k, c.d1]));
  assert.ok(d1['FIRST LIGHT'] && /nobody knows your name/.test(d1['FIRST LIGHT']));
  assert.ok(d1['THE COMMUTE'] && /give them a reason to stop/.test(d1['THE COMMUTE']));
  assert.ok(d1['THE MATCHA WAVE'] && /won’t look twice/.test(d1['THE MATCHA WAVE']));
  assert.ok(d1['LAST ORDERS'] && /chosen, not given/.test(d1['LAST ORDERS']));
});

test('a recruited hesitator never strolls — they already chose to look', () => {
  const scene = { add() {} };
  const world = { seats: [] };
  const exchange = { matchaPrice: 4.8, day: 1, purchaseCup: () => ({ beanCost: 0, spotCost: 0, hedged: false }) };
  const sys = new PatronSystem(scene, world, null, exchange, null,
    { random: seeded(4141), cosmetic: seeded(4142) });
  sys.strollShare = 1;                 // everyone else passes the door
  sys.recruited = true;
  const p = sys.spawn('commuters', 'counter', false);
  sys.recruited = false;
  assert.notEqual(p.state, 'strolling', 'the frontage convert joins, not strolls');
  assert.equal(sys.passedBy, 0);
});
