// rival.js — Phase 5: display copy for Sam's chalkboard. strategyCopy()
// maps a strategy key → {title, line, price} so the floor renders the
// actual strategy, not the key. Pure, DOM-free.
import { CAMPAIGN } from './config.js';

// Phase 5 — chalkboard copy: title/line/price for the actual board.
export function strategyCopy(strategyId) {
  const s = CAMPAIGN.rivalStrategies[strategyId] || CAMPAIGN.rivalStrategies.DEFAULT;
  return { title: s.name, line: s.desc, price: s.price };
}
export function strategyForDay(day, tier) {
  if (day === 1) return 'DEFAULT';
  if (tier === 'cata') return 'ROASTER_PIVOT';
  if (day === 3 || tier === 'good') return 'PRICE_WAR';
  return ['DEFAULT', 'PRICE_WAR', 'ROASTER_PIVOT', 'EFFICIENCY_RUSH'][(day - 1) % 4];
}
// Added to the rival-choice roll when the room has no free seat and the
// cohort came to stay (creatives, elders, or anyone the transit dwell
// bonus pushes over a sit of 1). Low-dwell cohorts do not get it.
// Enough to send a high-dwell cohort across even when the cup they wanted
// is cheaper than the rival's board. A low-dwell cohort does not get it.
export const FULL_ROOM_PULL = 0.30;

export function rivalChoiceProbability({ strategy = 'DEFAULT', cohort, ourPrice, op = 0, ourQueue = 0, rivalQueue = 0, reach = 1, rivalReach = 1, cupQuality = 1, campPull = 0 }) {
  const s = CAMPAIGN.rivalStrategies[strategy] || CAMPAIGN.rivalStrategies.DEFAULT;
  const pull = cohort === 'students' ? s.studentPull || 0 : cohort === 'creatives' ? s.creativePull || 0 : 0;
  const quality = Number.isFinite(cupQuality) ? cupQuality : 1;
  const qualityPull = (1 - quality) * 0.12;
  const base = .08 + .12 * (ourPrice - s.price) + pull + .01 * (ourQueue - rivalQueue) - .08 * op + qualityPull;
  const ourReach = Number.isFinite(reach) && reach > 0 ? reach : 1;
  const theirReach = Number.isFinite(rivalReach) && rivalReach > 0 ? rivalReach : 1;
  const extra = Number.isFinite(campPull) ? campPull : 0;
  return Math.max(0, Math.min(.6, base * (theirReach / ourReach) + extra));
}

// Someone already in Glasshouse's line. Felt wait is clock wait divided by
// how fast that bar serves. Under the floor they stay; past it a share
// walks back to our door. A fast bar (speedMul above 1) keeps felt wait
// under the floor and the line holds.
export function rivalWalkbackChance(waitMin, speedMul = 1) {
  const speed = Number.isFinite(speedMul) && speedMul > 0 ? speedMul : 1;
  const felt = (Number.isFinite(waitMin) ? waitMin : 0) / speed;
  const floor = 16;
  if (felt <= floor) return 0;
  return Math.min(0.45, 0.06 * (felt - floor));
}
