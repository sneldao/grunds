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
export function applyDrift(exchange, day = exchange.day) {
  const { drift } = CAMPAIGN;
  exchange.beanIndex = Math.min(drift.maxIndex, exchange.beanIndex + drift.perDay);
  exchange.matchaPrice = priceForDay(day);
  return exchange.matchaPrice;
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
