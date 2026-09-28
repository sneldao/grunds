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
export function rivalChoiceProbability({ strategy = 'DEFAULT', cohort, ourPrice, op = 0, ourQueue = 0, rivalQueue = 0 }) {
  const s = CAMPAIGN.rivalStrategies[strategy] || CAMPAIGN.rivalStrategies.DEFAULT;
  const pull = cohort === 'students' ? s.studentPull || 0 : cohort === 'creatives' ? s.creativePull || 0 : 0;
  return Math.max(0, Math.min(.6, .08 + .12 * (ourPrice - s.price) + pull + .01 * (ourQueue - rivalQueue) - .08 * op));
}
