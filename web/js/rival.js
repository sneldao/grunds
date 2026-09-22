import { CAMPAIGN } from './config.js';
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
