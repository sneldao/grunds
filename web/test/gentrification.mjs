// Headless test that PROVES the gentrification drift:
//   1. applyDrift() raises beanIndex by `day * CAMPAIGN.drift.perDay` from
//      the day-1 baseline (deterministic; no RNG).
//   2. priceForDay() walks 4.80 → 5.40 over 5 days, monotonically.
//   3. applyExpectation() decreases elders' op by `day * 0.02` after end
//      of day, even when no events fire; creatives also drop; students
//      and tourists rise; commuters are flat.
//   4. applyDrift() is capped at `CAMPAIGN.drift.maxIndex`.
//   5. The drift is pure: two calls with the same args produce identical
//      beanIndex and matchaPrice.
//   6. Public API smoke: applyDrift, applyExpectation, priceForDay all
//      exported; exchange.openDay() actually calls applyDrift (so the
//      drift is wired, not a dead module).
//
// Run: node web/test/gentrification.mjs
import { applyDrift, applyExpectation, priceForDay } from '../js/gentrification.js';
import { Exchange } from '../js/exchange.js';
import { Regulars } from '../js/regulars.js';
import { CAMPAIGN } from '../js/config.js';

const fails = [];

// 1) applyDrift raises beanIndex by day * perDay (capped at maxIndex).
const ex1 = new Exchange(7);
const baseline = ex1.beanIndex;
const beforeDay1 = ex1.beanIndex;     // 1.00 by constructor
applyDrift(ex1, 1);
const day1 = ex1.beanIndex;
applyDrift(ex1, 2);
const day2 = ex1.beanIndex;
if (!(Math.abs(day1 - beforeDay1 - CAMPAIGN.drift.perDay) < 1e-12))
  fails.push(`day 1 drift: ${day1} - ${beforeDay1} = ${day1 - beforeDay1}, expected ${CAMPAIGN.drift.perDay}`);
if (!(Math.abs(day2 - day1 - CAMPAIGN.drift.perDay) < 1e-12))
  fails.push(`day 2 drift: ${day2 - day1}, expected ${CAMPAIGN.drift.perDay}`);
console.log('DRIFT   beanIndex', baseline, '→ day1', day1, '→ day2', day2,
  `(+${CAMPAIGN.drift.perDay}/day)`);

// 2) priceForDay walks 4.80 → 5.40 monotonically.
const prices = [priceForDay(1), priceForDay(2), priceForDay(3), priceForDay(4), priceForDay(5)];
const expected = [4.80, 4.95, 5.10, 5.25, 5.40];
let monotonic = true;
for (let i = 1; i < prices.length; i++) if (prices[i] <= prices[i - 1]) monotonic = false;
if (!monotonic) fails.push(`prices not monotonic: ${prices.join(', ')}`);
for (let i = 0; i < prices.length; i++) {
  if (Math.abs(prices[i] - expected[i]) > 0.01)
    fails.push(`priceForDay(${i + 1}) = ${prices[i]}, expected ~${expected[i]}`);
}
console.log('PRICE   day1..day5:', prices.map(p => '£' + p.toFixed(2)).join(' '));

// 3) applyExpectation pulls cohort op by day * delta. Seed the regulars with
//    a uniform op so we can read the delta cleanly.
const reg3 = new Regulars();
for (const r of reg3.regulars) { r.op = 0; r.seen = true; }   // all seen, op=0
const day = 3;
applyExpectation(reg3, day);
const byCoh = {};
for (const r of reg3.regulars) (byCoh[r.coh] ??= []).push(r.op);
const opOf = coh => byCoh[coh][0];
const expDeltas = {
  elders:    opOf('elders')    - 0,
  creatives: opOf('creatives') - 0,
  commuters: opOf('commuters') - 0,
  students:  opOf('students')  - 0,
  tourists:  opOf('tourists')  - 0,
};
const expExpected = {};
for (const [k, v] of Object.entries(CAMPAIGN.expectation)) expExpected[k] = v * day;
for (const k of Object.keys(expExpected)) {
  if (Math.abs(expDeltas[k] - expExpected[k]) > 1e-12)
    fails.push(`cohort ${k} delta: ${expDeltas[k]}, expected ${expExpected[k]}`);
}
console.log('EXPECT  day', day, 'deltas:', Object.entries(expDeltas).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' '));

// 4) Cap at maxIndex. Call applyDrift with day=999 to overflow.
const ex4 = new Exchange(7);
applyDrift(ex4, 999);
if (ex4.beanIndex > CAMPAIGN.drift.maxIndex + 1e-12)
  fails.push(`beanIndex not capped: ${ex4.beanIndex} > ${CAMPAIGN.drift.maxIndex}`);
console.log('CAP     beanIndex capped at', ex4.beanIndex, '(max', CAMPAIGN.drift.maxIndex, ')');

// 5) Determinism: two exchanges, same seed, same day → same result.
const exA = new Exchange(7); applyDrift(exA, 2); exA.matchaPrice = priceForDay(2);
const exB = new Exchange(7); applyDrift(exB, 2); exB.matchaPrice = priceForDay(2);
if (exA.beanIndex !== exB.beanIndex) fails.push(`A != B beanIndex: ${exA.beanIndex} vs ${exB.beanIndex}`);
if (exA.matchaPrice !== exB.matchaPrice) fails.push(`A != B matchaPrice: ${exA.matchaPrice} vs ${exB.matchaPrice}`);
console.log('PURE    same day → beanIndex', exA.beanIndex, '| matchaPrice £' + exA.matchaPrice.toFixed(2));

// 6) Public API + integration: openDay() actually calls applyDrift().
//    The drift contribution is `+perDay`; the event rides on top with its
//    own ±dIndex. So the *total* delta can be negative (e.g. a good event
//    day) — we check the drift component by reconstructing the math: the
//    beanIndex after openDay should equal `before + perDay + event.dIndex`.
//    Also assert matchaPrice was set.
const ex6 = new Exchange(7);
const before6 = ex6.beanIndex;
const ev = ex6.openDay();
const after6 = ex6.beanIndex;
const expectedDelta = CAMPAIGN.drift.perDay + ev.dIndex;
if (Math.abs(after6 - before6 - expectedDelta) > 1e-12)
  fails.push(`openDay() drift+event mismatch: beanIndex moved ${after6 - before6}, expected ${expectedDelta} (drift ${CAMPAIGN.drift.perDay} + event ${ev.dIndex})`);
if (typeof ex6.matchaPrice !== 'number' || ex6.matchaPrice < 4.79 || ex6.matchaPrice > 5.41)
  fails.push(`openDay() did not set matchaPrice: ${ex6.matchaPrice}`);
console.log('WIRED   openDay() day1: beanIndex', before6, '→', after6,
  `(drift ${CAMPAIGN.drift.perDay} + event ${ev.dIndex}) | matchaPrice £` + ex6.matchaPrice.toFixed(2));

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nPASS — drift is deterministic, capped, wired into openDay, and pulls cohort expectations');
