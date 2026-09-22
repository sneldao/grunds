// Gentrification drift — the README's "pressure clock". Each dawn:
//   1. The bean index creeps up by `drift.perDay` (the *baseline* — events
//      add their own ±swings on top, so a frost on a drifting index is a
//      bigger shock).
//   2. The matcha till price walks from `priceFloor` to `priceCeiling` over
//      `priceDays` dawns. The chalkboard reads the new price.
//   3. (End-of-day) cohort expectation pressure pulls each seen regular's
//      `op` by `day * CAMPAIGN.expectation[coh]`.
//
// All three are deterministic and pure: no RNG, no global state. The same
// seed + same day index produce the same drift; reproducibility per
// EVAL.md "same seed → same run" is preserved.
import { CAMPAIGN } from './config.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Apply the per-dawn drift to the exchange: bean-index creep (capped at
// `maxIndex`) and the matcha price curve. The event roll is *not* part of
// this call — exchange.openDay() calls applyDrift() first, then roll().
//
// `day` is 1-indexed (1 = first dawn of the campaign). Returns the new
// matcha till price for the chalkboard.
export function applyDrift(exchange, day = exchange.day, shock = 0) {
  const { drift } = CAMPAIGN;
  const delta = calculateNonLinearDrift(day) + shock;
  exchange.beanIndex = Math.min(drift.maxIndex, exchange.beanIndex + delta);
  exchange.matchaPrice = priceForDay(day);
  return exchange.matchaPrice;
}

// Calculate non-linear accelerated drift for advanced volatility scenarios
export function calculateNonLinearDrift(day, base = CAMPAIGN.drift.perDay, accel = CAMPAIGN.drift.accel || 0) {
  if (day <= 1) return base;
  return base + accel * (day - 1);
}

// Secondary macro shocks affecting cost lines and operating variables
export const MACRO_SHOCKS = {
  pitch_reval:   { day: 3, name: 'PITCH REVALUATION', desc: 'District Council raises the base pitch rent and the turnover rate', pitchPctDelta: +0.03, pitchMinDelta: +150 },
  dairy_crunch:  { day: 4, name: 'OAT MILK SURCHARGE', desc: 'Packaging & dairy supply bottleneck (+£0.18/cup)', suppliesDelta: +0.18 },
  transit_delay: { day: 2, name: 'TUBE LINE DISRUPTION', desc: 'Commuter morning wave delayed, table dwell increases', commuterDelayMinutes: 30, dwellBonus: +0.3 },
};

export function modifiersForDay(day) {
  return {
    pitchPctDelta: day >= MACRO_SHOCKS.pitch_reval.day ? MACRO_SHOCKS.pitch_reval.pitchPctDelta : 0,
    pitchMinDelta: day >= MACRO_SHOCKS.pitch_reval.day ? MACRO_SHOCKS.pitch_reval.pitchMinDelta : 0,
    suppliesDelta: day >= MACRO_SHOCKS.dairy_crunch.day ? MACRO_SHOCKS.dairy_crunch.suppliesDelta : 0,
    commuterDelayMinutes: day === MACRO_SHOCKS.transit_delay.day ? MACRO_SHOCKS.transit_delay.commuterDelayMinutes : 0,
    dwellBonus: day === MACRO_SHOCKS.transit_delay.day ? MACRO_SHOCKS.transit_delay.dwellBonus : 0,
  };
}

export function wavesForDay(waves, day) {
  const { commuterDelayMinutes: delay } = modifiersForDay(day);
  const byTime = new Map();
  for (const w of waves) for (const s of w.spawns) {
    const t = w.t + (s.c === 'commuters' && w.t >= 420 && w.t < 600 ? delay : 0);
    if (!byTime.has(t)) byTime.set(t, []);
    byTime.get(t).push({ ...s });
  }
  return [...byTime].sort(([a], [b]) => a - b).map(([t, spawns]) => ({ t, spawns }));
}

export function getMacroShockForDay(day) {
  for (const [id, shock] of Object.entries(MACRO_SHOCKS)) {
    if (shock.day === day) return { id, ...shock };
  }
  return null;
}

// Matcha till price on the given (1-indexed) day. Linear interpolation
// between `priceFloor` (day 1) and `priceCeiling` (day `priceDays`).
// Days beyond the curve clamp to `priceCeiling`.
export function priceForDay(day) {
  const { priceFloor, priceCeiling, priceDays } = CAMPAIGN.drift;
  if (day <= 1) return priceFloor;
  if (day >= priceDays) return priceCeiling;
  return priceFloor + (priceCeiling - priceFloor) * (day - 1) / (priceDays - 1);
}

// Per-cohort expectation pressure, applied at end of day. `day` is the
// just-completed day's index. We *don't* read `regulars` for the pressure
// table — `CAMPAIGN.expectation` is the source of truth, keyed by cohort.
//
// Shifts the `op` of every seen regular by `day * expectation[coh]`,
// clamped to `[-1, 1]`. Absent regulars (not seen today) are untouched —
// gentrification only bites the people who showed up.
//
// Designed to be called from main.js at end-of-day, *before*
// `Regulars.resolveDay()` (which folds in the day's outcome delta and runs
// the friendship contagion). That way the contagion sees the gentrification
// pressure and can spread it through the network.
export function applyExpectation(regulars, day) {
  const { expectation } = CAMPAIGN;
  for (const r of regulars.regulars) {
    if (!r.seen) continue;
    const delta = (expectation[r.coh] ?? 0) * day;
    if (delta === 0) continue;
    r.op = clamp(r.op + delta, -1, 1);
  }
}
