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

export const DEMAND_ACTIONS = ['chalk', 'sample', 'sponsor'];

export class Demand {
  constructor() {
    this.reset();
  }
  reset() {
    this.awareness = CAMPAIGN.demand.start;
    this.staged = { chalk: false, sample: false, sponsor: false };
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
    return clamp(d.returnBase + (reputation - 62) * d.returnPerRep, 0, d.returnMax);
  }
  // Dawn staging — one tap per action per day (chalk is free, sample costs
  // cups at commit, sponsor costs till at commit and unlocks sponsorDay+).
  // Returns false when the action can't stage (already staged / locked).
  canStage(id, day) {
    if (!DEMAND_ACTIONS.includes(id) || this.staged[id]) return false;
    if (id === 'sponsor' && day < CAMPAIGN.demand.sponsorDay) return false;
    return true;
  }
  stage(id, day) {
    if (!this.canStage(id, day)) return false;
    this.staged[id] = true;
    return true;
  }
  // Close-of-day: decay awareness (catastrophes scare extra), land the
  // staged dawn actions on *tomorrow's* awareness, and count returnees from
  // today's served × loyalty. Returns the trace for the receipt/analytics.
  resolveDay({ served, reputation, eventTier }) {
    const d = CAMPAIGN.demand;
    const before = this.awareness;
    const rate = Demand.returnRateFor(reputation);
    this.lastReturnRate = rate;
    this.todayReturnees = Math.max(0, Math.round(served * rate));
    let decay = d.decay;
    if (eventTier === 'cata') decay += d.cataExtra;
    let gain = 0;
    if (this.staged.chalk) gain += d.chalkGain;
    if (this.staged.sample) gain += d.sampleGain;
    if (this.staged.sponsor) gain += d.sponsorGain;
    this.awareness = clamp(before - decay + gain, 0, 1);
    const staged = { ...this.staged };
    this.staged = { chalk: false, sample: false, sponsor: false };
    return { before, after: this.awareness, decay, gain, staged, returnees: this.todayReturnees, returnRate: rate };
  }
  // Awareness pips for the HUD tape: ●●●○○.
  pips() {
    const full = Math.round(clamp(this.awareness, 0, 1) * 5);
    return '●'.repeat(full) + '○'.repeat(5 - full);
  }
}
