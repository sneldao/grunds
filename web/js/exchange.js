// The Exchange — the Gamble (days). A seeded bean market with a pity-timer
// event deck, forward contracts, and a supplier debt clock. The floor's till
// is measured against the market's cost basis; worlds events pass through
// commodity economics into your margin and (via the Regulars) into the floor.
import { CAMPAIGN, EVENTS } from './config.js';
import { applyDrift, priceForDay } from './gentrification.js';
import { EMERGENCY_MUL } from './lots.js';
import { originAmp } from './street.js';

// A tiny seeded PRNG so a campaign is reproducible per seed (per EVAL.md
// "same seed → same run").
export function seeded(seed, state) {
  let s = state != null ? (state >>> 0) : ((seed >>> 0) || 1);
  if (s === 0) s = 1;
  const fn = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  fn.state = () => s;
  return fn;
}

export class Exchange {
  constructor(seed = 7) {
    this.rng = seeded(seed);
    this.day = 0;
    this.beanIndex = 1.0;             // the benchmark
    this.origin = null;                // the player's house origin (street.js ORIGINS) — null = open table
    this.event = null;                 // today's rolled event ({id, ...EVENTS[id], day})
    this.lastTier = null;              // for the pity timer
    this.lastEventId = null;           // yesterday's draw — a rumour tilts tomorrow
    this.contract = null;             // { price, units, fee } when locked
    this.debt = 0;                     // supplier credit (£)
    this.history = [];                // [{day, id, index, cost, margin}]
    this.anchor = null;               // marketSnapshot anchor (pillar 3) — live or synthetic
  }

  // Pillar 3 — fold the real-world snapshot in once, at campaign start. A
  // live anchor biases the opening bean index within a bounded band (the
  // market that actually existed that week); the synthetic anchor keeps
  // startIndex 1.0 so offline/harness/replay runs stay bit-identical. Only
  // applies before the first dawn, and only once, so a resumed week is never
  // re-anchored mid-run.
  setAnchor(anchor) {
    if (this.anchor) return;
    this.anchor = anchor || null;
    if (this.day === 0 && anchor && Number.isFinite(anchor.startIndex)) {
      this.beanIndex = anchor.startIndex;
    }
  }

  // What it costs you to make ONE drink this minute — contracts hedge spikes.
  get costPerCup() {
    return (this.contract ? this.contract.price : this.beanIndex) * CAMPAIGN.beanBaseCost;
  }
  // Margin per matcha at the given till price (after waste).
  margin(price) { return Math.max(0, price - this.costPerCup) * (1 - CAMPAIGN.wastePct); }
  // The market line — for the ticker board and the letter.
  get trend() { return this.beanIndex - 1.0; }

  // Roll a new event with the pity timer: no two catastrophes in a row
  // through day 3 (the on-ramp), and a catastrophe is always followed by a
  // benign draw (docs: fairest losses win). On day 4+, pity is lifted so the
  // climax lives — the wire can be right.
  // `bias` (optional, {eventId: mul}) is live market intel — news tilts the
  // deck, asymmetrically: clamp only the downside (a 0.1× signal still gets
  // the 0.2× floor so a wire report can never fix a catastrophe away); let
  // positive-event news run free (a 4× rumor of harvest isn't a guarantee).
  // The weighted deck for a given day — shared by roll() and peek() so the
  // read can never disagree with the draw.
  _pool(day, bias) {
    const pityActive = day < 4;
    const pool = [];
    for (const [id, e] of Object.entries(EVENTS)) {
      let w = e.weight;
      // pity: a second consecutive catastrophe is forbidden (days 1-3 only)
      if (e.tier === 'cata' && this.lastTier === 'cata' && pityActive) w = 0;
      // after a catastrophe, bias toward recovery (good/calm/stable up)
      if (this.lastTier === 'cata' && e.tier !== 'good' && e.tier !== 'calm' && pityActive) w *= 0.35;
      // a rumour is a real signal: yesterday's whisper loads tomorrow's bad draws
      if (this.lastEventId === 'rumour_frost' && (id === 'frost_minas' || id === 'drought_ea')) w *= 3;
      // PR-0: asymmetric bias — clamp only the low side; pass through the high side
      if (bias && Number.isFinite(bias[id])) {
        const clamped = bias[id] < 1 ? Math.max(0.2, bias[id]) : bias[id];
        w *= clamped;
      }
      for (let i = 0; i < Math.round(w); i++) pool.push(id);
    }
    return pool;
  }
  // The next dawn's draw, without taking it: a clone of the rng stream, so
  // the seeded sequence is untouched. Only a house that names the event's
  // origin is told (street.js houseRead) — the deck itself stays hidden.
  peek(bias) {
    const pool = this._pool(this.day + 1, bias);
    const r = seeded(0, this.rng.state());
    const id = pool[(r() * pool.length) | 0];
    return { id, ...EVENTS[id] };
  }
  roll(bias) {
    const pool = this._pool(this.day, bias);
    const id = pool[(this.rng() * pool.length) | 0];
    const def = EVENTS[id];
    // A house built on this event's origin feels it harder (street.js
    // originAmp). 1 with no origin — the open table is bit-identical.
    const amp = originAmp(this.origin, { id, ...def });
    this.event = { id, ...def, day: this.day, ...(amp !== 1 ? { amp } : {}) };
    this.beanIndex = Math.max(0.6, Math.min(2.6, this.beanIndex + def.dIndex * amp));
    this.lastTier = def.tier;
    this.lastEventId = id;
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

  purchaseCup(kind = 'other') {
    // Phase 2 — matcha keeps legacy bean math (separate supply chain);
    // everything else pours from the house lot. Cash-basis books: the dawn
    // top-up was the expense, so poured lot cups carry display beanCost
    // (margin + savings readouts) while cogs stays 0 — same as batch prep.
    if (kind === 'matcha' || !this.lots) {
      const beanCost = this.costPerCup;
      const spotCost = this.beanIndex * CAMPAIGN.beanBaseCost;
      const hedged = !!this.contract;
      this.consume(1);
      return { beanCost, spotCost, hedged };
    }
    const spotCost = this.beanIndex * CAMPAIGN.beanBaseCost;
    const poured = this.lots.pour(this.day);
    if (poured.emergency) {
      return { beanCost: 0, spotCost: spotCost * EMERGENCY_MUL, hedged: false, emergency: true, lotId: poured.lotId };
    }
    return {
      beanCost: poured.unitCost, spotCost, hedged: poured.hedged,
      lotId: poured.lotId, switched: poured.switched,
    };
  }

  // Day open: drift first (the baseline pressure), then roll the event on
  // top. The drift is the *baseline* cost creep; the event is the *deviation*.
  // That ordering matters: a frost on a drifting index is a bigger shock than
  // a frost on a fresh one.
  openDay(bias) {
    this.day++;
    applyDrift(this, this.day);
    this.roll(bias);
    const cost = this.costPerCup;
    const m = this.margin(this.matchaPrice ?? priceForDay(this.day));
    this.history.push({ day: this.day, id: this.event.id, index: this.beanIndex, cost, margin: m });
    return this.event;
  }

  // Reply-to-command handlers (the Roaster's Letter → contract/hold/settle).
  // Sizing is the position: `units` burn cup-by-cup, so a deep lock covers
  // ~two days of demand — more upside if the board rises, more fee + a
  // stuck price if it falls.
  contractBeans(units = CAMPAIGN.contractUnits, fee = Math.round(units * CAMPAIGN.contractUnitFee * 100) / 100) {
    if (this.contract) return { ok: false, why: 'already contracted' };
    this.contract = { price: this.beanIndex, units, fee };
    this.debt += fee;
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
