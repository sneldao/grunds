// Demand — awareness brings them, loyalty brings them back.
//
// Two stocks, one funnel. Awareness (0..1) multiplies the wave spawn rate:
// coasting decays it every close, dawn actions buy it back. Loyalty is the
// existing reputation stock re-explained as a return rate: a share of
// yesterday's served reappear, spread across today's waves.
//
// Pure + deterministic: no DOM, no RNG, no clock. The sim (main.js) owns
// when staged actions commit and when resolveDay runs; this module owns
// the numbers. Tests pin every number through CAMPAIGN.demand.
import { CAMPAIGN } from './config.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const DEMAND_ACTIONS = ['sample', 'sponsor'];

// Sticky satisfaction. 62 is the same neutral the return rate already uses.
// Yesterday keeps 0.55, today writes 0.45. Milk-outs and long lines are
// different weights on the way to that target.
export const SAT_KEEP = 0.55;
export const SAT_TODAY = 0.45;
const ELASTIC_SLOPE = 0.6;
const ELASTIC_LO = 0.6;
const ELASTIC_HI = 1.25;

// Neighborhood price where the street is neither scared off nor pulled in:
// our opening board and the rival's balanced price, averaged.
export function streetAnchor() {
  return (CAMPAIGN.drift.priceFloor + CAMPAIGN.rivalStrategies.DEFAULT.price) / 2;
}

// Shared price level grows or shrinks the pool. A gap is not required —
// both cafes expensive is a smaller street.
export function priceElasticity(ourPrice, rivalPrice, anchor = streetAnchor()) {
  const base = anchor > 0 ? anchor : 1;
  const avg = ((Number(ourPrice) || base) + (Number(rivalPrice) || base)) / 2;
  return clamp(1 - (avg / base - 1) * ELASTIC_SLOPE, ELASTIC_LO, ELASTIC_HI);
}

// Marketing reach. Sample and sponsor multiply. 1 when the dawn bought neither.
export function marketingReach(staged = {}) {
  const d = CAMPAIGN.demand;
  let reach = 1;
  if (staged.sample) reach *= d.sampleReach;
  if (staged.sponsor) reach *= d.sponsorReach;
  return reach;
}

export function satisfactionTarget({ priceLevel = 1, cupQuality = 1, queueAway = 0, milkAway = 0 } = {}) {
  const quality = clamp(cupQuality, 0, 1.5) * 100;
  return 64
    + (quality - 60) * 0.5
    - (priceLevel - 1) * 50
    - Math.max(0, queueAway) * 40
    - Math.max(0, milkAway) * 70;
}

export function blendSatisfaction(previous, target) {
  const prev = Number.isFinite(previous) ? previous : 62;
  return clamp(prev * SAT_KEEP + target * SAT_TODAY, 0, 100);
}

export class Demand {
  constructor() {
    this.reset();
  }
  reset() {
    this.awareness = CAMPAIGN.demand.start;
    this.satisfaction = 62;
    this.staged = { sample: false, sponsor: false };
    this.todayReturnees = 0;
    this.lastReturnRate = 0;
  }
  // Wave spawn multiplier for this dawn: 0.4× (regulars only) .. 1.3×.
  // Opening awareness (0.28) reads ≈0.65× — a handful try you on a whim.
  spawnMul() {
    const d = CAMPAIGN.demand;
    return d.spawnMin + (d.spawnMax - d.spawnMin) * clamp(this.awareness, 0, 1);
  }
  // Loyalty as a return rate from a reputation number (see Regulars.returnRate
  // for the live-stock version). 62 → returnBase; ±1 rep moves returnPerRep.
  static returnRateFor(reputation) {
    const d = CAMPAIGN.demand;
    const linear = d.returnBase + (reputation - 62) * d.returnPerRep;
    // Below 92 the old slope stands. A strong stock earns a step the old
    // 35% cap would have cut off; returnMax is the new ceiling.
    const extra = reputation > 92 ? (reputation - 92) * 0.02 : 0;
    return clamp(linear + extra, 0, d.returnMax);
  }
  // Dawn staging — one tap per action per day (chalk is free, sample costs
  // cups at commit, sponsor costs till at commit and unlocks sponsorDay+).
  // Returns false when the action can't stage (already staged / locked).
  canStage(id, day) {
    if (!DEMAND_ACTIONS.includes(id) || day >= CAMPAIGN.days) return false;
    if (id === 'sponsor' && day < CAMPAIGN.demand.sponsorDay) return false;
    return true;
  }
  stage(id, day) {
    if (!this.canStage(id, day)) return false;
    this.staged[id] = !this.staged[id];
    return true;
  }
  // Close-of-day: decay awareness (catastrophes scare extra), land the
  // staged dawn actions on *tomorrow's* awareness, and count returnees.
  // When the walkout mix is passed, satisfaction blends yesterday with today
  // and tomorrow's return rate reads that stock. Otherwise the rate still
  // reads reputation (62 neutral). Phase 1: extraReturnees adds evangelist
  // word-of-mouth (each evangelist serve brings +2 back).
  resolveDay({ served, reputation, eventTier, extraReturnees = 0, priceLevel, cupQuality: quality, queueBalks, milkBalks, attracted }) {
    const d = CAMPAIGN.demand;
    const before = this.awareness;
    const satOn = priceLevel != null || quality != null || queueBalks != null || milkBalks != null || attracted != null;
    let satTrace = null;
    if (satOn) {
      const attr = Math.max(0, attracted ?? ((served || 0) + (queueBalks || 0) + (milkBalks || 0)));
      const queueAway = attr > 0 ? Math.max(0, queueBalks || 0) / attr : 0;
      const milkAway = attr > 0 ? Math.max(0, milkBalks || 0) / attr : 0;
      const target = satisfactionTarget({
        priceLevel: priceLevel ?? 1,
        cupQuality: quality ?? 1,
        queueAway,
        milkAway,
      });
      const prev = this.satisfaction;
      this.satisfaction = blendSatisfaction(prev, target);
      satTrace = { before: prev, after: this.satisfaction, target, attracted: attr, queueAway, milkAway };
    }
    const rate = Demand.returnRateFor(satTrace ? this.satisfaction : reputation);
    this.lastReturnRate = rate;
    this.todayReturnees = Math.max(0, Math.round(served * rate)) + Math.max(0, Math.floor(extraReturnees));
    let decay = d.decay;
    if (eventTier === 'cata') decay += d.cataExtra;
    let gain = d.chalkGain;
    if (this.staged.sample) gain += d.sampleGain;
    if (this.staged.sponsor) gain += d.sponsorGain;
    this.awareness = clamp(before - decay + gain, 0, 1);
    const staged = { ...this.staged };
    this.staged = { sample: false, sponsor: false };
    return { before, after: this.awareness, decay, gain, staged, returnees: this.todayReturnees, returnRate: rate, satisfaction: this.satisfaction, sat: satTrace };
  }
  // Awareness pips for the HUD tape: ●●●○○.
  pips() {
    const full = Math.round(clamp(this.awareness, 0, 1) * 5);
    return '●'.repeat(full) + '○'.repeat(5 - full);
  }
}
