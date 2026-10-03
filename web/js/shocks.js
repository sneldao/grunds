// Counterable shocks — a shared hit lands as a baseline, then one counter
// merges in before the floor reads the numbers. Adds stack (inventory, rep,
// staff, cost). Multipliers multiply (capacityMult, priceMult, demandMult).
//
// Capacity is its own knob. Ruth's staff condition (0..1 → staffMul) is not
// written here. This module never touches resolveDecision: that function
// rejects any plan shape it does not already know.
import { MACRO_SHOCKS } from './gentrification.js';

const ADD_FIELDS = ['inventory', 'rep', 'staff', 'cost'];
const MUL_FIELDS = ['capacityMult', 'priceMult', 'demandMult'];

// Reputation is round(62 + mean(op) * 38). One rep point is 1/38 of opinion.
export const REP_PER_OP = 38;

export function mergeEffects(a = {}, b = {}) {
  const out = {};
  for (const k of ADD_FIELDS) {
    if (a[k] == null && b[k] == null) continue;
    out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  }
  for (const k of MUL_FIELDS) {
    if (a[k] == null && b[k] == null) continue;
    out[k] = (a[k] ?? 1) * (b[k] ?? 1);
  }
  if (a.shrinkMilky || b.shrinkMilky) out.shrinkMilky = true;
  return out;
}

// Three hits, not a scenario deck. dairy_crunch shares its calendar day with
// the supplies surcharge. The other two are the same merge, staged by hand.
export const COUNTERABLE = {
  dairy_crunch: {
    day: MACRO_SHOCKS.dairy_crunch.day,
    baseline: { inventory: -80 },
    counters: {
      replace: { cost: 36, inventory: 80 },
      shrink: { inventory: 40, shrinkMilky: true },
    },
  },
  machine_breaks: {
    baseline: { capacityMult: 0.55 },
    counters: {
      repair: { cost: 52, capacityMult: 1.82 },
    },
  },
  health_inspector: {
    baseline: { rep: -6 },
    counters: {
      tidy: { cost: 8, rep: 4 },
      clean: { cost: 30, rep: 9 },
    },
  },
};

export function counterForMenu(offered) {
  if (offered && offered.flatwhite === false) return 'shrink';
  return null;
}

export function resolveShock(id, counterId) {
  const hit = COUNTERABLE[id];
  if (!hit) return {};
  const counter = (counterId && hit.counters[counterId]) || {};
  return mergeEffects(hit.baseline, counter);
}

export function applyInventory(stock, effect) {
  return Math.max(0, (stock || 0) + (effect?.inventory || 0));
}

export function repToOpinion(rep) {
  return (rep || 0) / REP_PER_OP;
}

// Knobs the dawn may set. staffCondition is echoed, never derived.
export function shockKnobs(effect = {}, staffCondition = 1) {
  return {
    capacityMult: effect.capacityMult ?? 1,
    shockStaff: effect.staff ?? 0,
    staffCondition,
    priceMult: effect.priceMult ?? 1,
    demandMult: effect.demandMult ?? 1,
    rep: effect.rep ?? 0,
    cost: effect.cost ?? 0,
    shrinkMilky: !!effect.shrinkMilky,
  };
}
