// The Exchange — the Gamble (days). A seeded bean market with a pity-timer
// event deck, forward contracts, and a supplier debt clock. The floor's till
// is measured against the market's cost basis; worlds events pass through
// commodity economics into your margin and (via the Regulars) into the floor.
import { CAMPAIGN, EVENTS } from './config.js';
import { applyDrift, priceForDay } from './gentrification.js';

// A tiny seeded PRNG so a campaign is reproducible per seed (per EVAL.md
// "same seed → same run").
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Exchange {
  constructor(seed = 7) {
    this.rng = seeded(seed);
    this.day = 0;
    this.beanIndex = 1.0;             // the benchmark
    this.event = null;                 // today's rolled event ({id, ...EVENTS[id], day})
    this.lastTier = null;              // for the pity timer
    this.contract = null;             // { price, units, fee } when locked
    this.debt = 0;                     // supplier credit (£)
    this.history = [];                // [{day, id, index, cost, margin}]
  }

  // What it costs you to make ONE drink this minute — contracts hedge spikes.
  get costPerCup() {
    return (this.contract ? this.contract.price : this.beanIndex) * CAMPAIGN.beanBaseCost;
  }
  // Margin per matcha at the given till price (after waste).
  margin(price) { return Math.max(0, price - this.costPerCup) * (1 - CAMPAIGN.wastePct); }
  // The market line — for the ticker board and the letter.
  get trend() { return this.beanIndex - 1.0; }

  // Roll a new event with the pity timer: no two catastrophes in a row, and a
  // catastrophe is always followed by a benign draw (docs: fairest losses win).
  roll() {
    const pool = [];
    for (const [id, e] of Object.entries(EVENTS)) {
      let w = e.weight;
      // pity: a second consecutive catastrophe is forbidden
      if (e.tier === 'cata' && this.lastTier === 'cata') w = 0;
      // after a catastrophe, bias toward recovery (good/calm/stable up)
      if (this.lastTier === 'cata' && e.tier !== 'good' && e.tier !== 'calm') w *= 0.35;
      for (let i = 0; i < Math.round(w); i++) pool.push(id);
    }
    const id = pool[(this.rng() * pool.length) | 0];
    const def = EVENTS[id];
    this.event = { id, ...def, day: this.day };
    this.beanIndex = Math.max(0.6, Math.min(2.6, this.beanIndex + def.dIndex));
    this.lastTier = def.tier;
    // a contract is now consumed cup-by-cup (Exchange.consume), not dawn-by-dawn
    return this.event;
  }

  // Burn contract units against actual serves. Called per cup. Clears the
  // contract exactly when its quota is filled, so a 40-unit contract lives
  // as long as the player keeps selling under it.
  consume(n = 1) {
    if (!this.contract) return false;
    this.contract.units = Math.max(0, this.contract.units - n);
    if (this.contract.units === 0) this.contract = null;
    return true;
  }

  // Day open: drift first (the baseline pressure), then roll the event on
  // top. The drift is the *baseline* cost creep; the event is the *deviation*.
  // That ordering matters: a frost on a drifting index is a bigger shock than
  // a frost on a fresh one.
  openDay() {
    this.day++;
    applyDrift(this, this.day);
    this.roll();
    const cost = this.costPerCup;
    const m = this.margin(this.matchaPrice ?? priceForDay(this.day));
    this.history.push({ day: this.day, id: this.event.id, index: this.beanIndex, cost, margin: m });
    return this.event;
  }

  // Reply-to-command handlers (the Roaster's Letter → contract/hold/settle).
  contractBeans() {
    if (this.contract) return { ok: false, why: 'already contracted' };
    this.contract = { price: this.beanIndex, units: CAMPAIGN.contractUnits, fee: CAMPAIGN.contractFee };
    this.debt += CAMPAIGN.contractFee;
    return { ok: true, debt: this.debt };
  }
  settle(amount) {
    const paid = Math.min(amount, this.debt);
    this.debt -= paid;
    return { ok: true, paid, debt: this.debt };
  }

  // Net worth used by the campaign verdict: till − debt, plus reputation.
  snapshot({ till, reputation }) {
    const net = till - this.debt;
    return { day: this.day, index: this.beanIndex, cost: this.costPerCup, debt: this.debt, till, net, reputation };
  }
}
