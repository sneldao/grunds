import { CAMPAIGN, ECON } from './config.js';
import { priceForDay } from './gentrification.js';
import { utilityCosts } from './utilities.js';
export function salePrice(exchange, repriced = false) {
  return repriced ? ECON.matchaDeal : exchange.matchaPrice ?? priceForDay(Math.max(1, exchange.day));
}
export function operatingCosts({ till = 0, served = 0, staffing = 'work', marketing = 0, training = 0, sampling = 0, maintenance = 0, perkCostMul = 1, modifiers = {} } = {}) {
  const wage = staffing === 'home' ? 0
    : staffing === 'apprentice' ? CAMPAIGN.staff.apprenticeDayRate
    : staffing === 'robot' ? CAMPAIGN.staff.robotDayRate
    : CAMPAIGN.staffDayRate;
  const costs = {
    staff: wage + served * CAMPAIGN.staffPerCup,
    supplies: served * (CAMPAIGN.suppliesPerCup + (modifiers.suppliesDelta || 0) + (staffing === 'apprentice' ? CAMPAIGN.staff.apprenticeWasteExtra : 0)),
    pitch: Math.max(CAMPAIGN.pitchMin + (modifiers.pitchMinDelta || 0), Math.max(0, till) * (CAMPAIGN.pitchPct + (modifiers.pitchPctDelta || 0))),
    fees: Math.max(0, till) * CAMPAIGN.cardFeePct * perkCostMul,
    sundries: CAMPAIGN.sundries,
    ...utilityCosts(served),
    marketing,
    training,
    sampling,
    maintenance: maintenance || 0,
  };
  return { ...costs, total: Object.values(costs).reduce((a,b) => a+b,0) };
}
export function hedgeTerms(id, extraFee = 0) {
  const mul = { contract_light: .5, contract: 1, contract_heavy: 2 }[id];
  if (!mul) return null;
  const units = CAMPAIGN.contractUnits * mul;
  const rate = CAMPAIGN.contractUnitFee + (mul - 1) * CAMPAIGN.contractFeeSlope;
  return { units, fee: Math.round(units * rate * 100) / 100 + extraFee };   // a COD incident rides on the next contract
}
export function debtInterestFor(debt) {
  return debt > 0 ? Math.max(CAMPAIGN.debtInterest, Math.round(debt * CAMPAIGN.debtInterestRate * 100) / 100) : 0;
}
// Verdict gates. campaignVerdict uses these numbers and nothing else.
// held is net strictly above £4,500 AND reputation at least 50.
// £4,500.00 exactly is scraped. Below or at £0 is lost.
// Insolvency (the supplier calls the tab) is a separate check: net < 0
// at the next morning. These gates do not move that rule.
export const VERDICT_GATES = {
  star: { netAbove: 8000, repAtLeast: 70 },
  good: { netAbove: 5500, repAtLeast: 60 },
  held: { netAbove: 4500, repAtLeast: 50 },
};

export function campaignVerdict(net, rep) {
  const g = VERDICT_GATES;
  if (net > g.star.netAbove && rep >= g.star.repAtLeast) return 'star';
  if (net > g.good.netAbove && rep >= g.good.repAtLeast) return 'good';
  if (net > g.held.netAbove && rep >= g.held.repAtLeast) return 'held';
  if (net > 0) return 'scarped';
  return 'lost';
}

const gbp2 = (n) => {
  const sign = n < 0 ? '−' : '';
  const [whole, frac] = Math.abs(n).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + '£' + grouped + '.' + frac;
};
const gbpWhole = (n) => '£' + Math.abs(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// What the player needs to hear about cash, regulars, and "held".
// Display only — does not change campaignVerdict or the net < 0 insolvency check.
//
// asOf:
//   'opening'    — nothing has closed yet (day 1 morning / day 1 still trading)
//   'last-close' — yesterday's books, today's tab already in `net` (mid-day, evening card)
//   'close'      — the receipt, or the next morning reading those same books
//
// `nut` is today's pre-cup bill (quoteDayPlan fixedMinimum) when the caller
// has one. No second cash threshold: the warn is "under today's bills" or
// "under the held bar", both numbers the game already uses.
export function weekStanding({ net = 0, rep = 62, day = 1, days = 5, asOf = 'close', nut = null, countToday = false } = {}) {
  const heldNet = VERDICT_GATES.held.netAbove;
  const heldRep = VERDICT_GATES.held.repAtLeast;
  const books = asOf !== 'opening';
  const repNow = Math.round(rep);
  const insolvent = books && net < 0;
  const underNut = books && nut != null && nut > 0 && net >= 0 && net < nut;
  const repShort = repNow < heldRep;
  // After a close, or during a day already open, today is spent.
  // The morning brief still has today in front of it.
  const morningsLeft = Math.max(0, days - day + (countToday ? 1 : 0));
  let tone = 'ok';
  if (insolvent) tone = 'bad';
  else if (repShort || underNut) tone = 'warn';

  const heldLine = `Held needs more than ${gbpWhole(heldNet)} and regulars at ${heldRep}. Miss either and the week is scraped, not held.`;
  const repLine = repShort
    ? `Regulars ${repNow}/100 — held needs ${heldRep}, so you’re ${heldRep - repNow} short. Walk-outs cool the room, and a cold room misses held even when the till looks fine.`
    : `Regulars ${repNow}/100. Held needs ${heldRep} — you’re there. Walk-outs are what pull this down.`;

  let cashLine;
  if (!books) {
    cashLine = 'Cash is judged at each close. Below £0, Idris calls the tab and the stand closes — even before Saturday.';
  } else if (insolvent) {
    const when = asOf === 'last-close'
      ? 'If the close is still below £0, Idris calls the tab in the morning and the stand is done.'
      : 'That’s below £0 — the next morning Idris calls the tab and the stand is done.';
    const prefix = asOf === 'last-close' ? 'On the books so far' : 'Week position';
    cashLine = `${prefix} ${gbp2(net)}. ${when}`;
  } else if (underNut) {
    const prefix = asOf === 'last-close' ? 'On the books so far' : 'Week position';
    const left = morningsLeft > 0 ? ` ${morningsLeft} morning${morningsLeft === 1 ? '' : 's'} left to get there.` : '';
    cashLine = `${prefix} ${gbp2(net)}. Today’s fixed bills are ${gbp2(nut)} — the week hasn’t banked that yet.${left} Below £0, Idris calls the tab.`;
  } else {
    const prefix = asOf === 'last-close' ? 'On the books so far' : 'Week position';
    const cover = nut != null && nut > 0 ? ` Enough on the books for a day’s bills (${gbp2(nut)}).` : '';
    cashLine = `${prefix} ${gbp2(net)}. Solvent — the tab is called only below £0.${cover}`;
  }

  return {
    tone, insolvent, underNut, repShort, asOf, books,
    heldNet, heldRep, rep: repNow,
    cashLine, repLine, heldLine,
    lines: [heldLine, cashLine, repLine],
  };
}

// Mid-morning toast. The brief already states the rule every morning.
// The toast repeats it only when the miss is easy to play through:
// regulars under 50, books already below £0, or from day 3 the week
// still hasn’t banked one day’s bills. Day 2 under the nut is normal
// and stays on the brief.
export function standingNudge(stand, day = 1) {
  if (!stand) return null;
  if (stand.insolvent) return { tone: 'bad', text: stand.cashLine };
  if (stand.repShort) return { tone: 'warn', text: stand.repLine };
  if (stand.underNut && day >= 3) return { tone: 'warn', text: stand.cashLine };
  return null;
}
export function quoteDayPlan({ day, hedge = 'hold', staffing = 'work', marketing = {}, debt = 0, extraFee = 0, perkCostMul = 1, modifiers = {} }) {
  const training = staffing === 'apprentice' ? CAMPAIGN.staff.apprenticeTrainingFee : 0;
  const sampling = marketing.sample ? CAMPAIGN.demand.sampleCost : 0;
  const marketingCost = marketing.sponsor ? CAMPAIGN.demand.sponsorCost : 0;
  const ops = operatingCosts({ staffing, training, sampling, marketing: marketingCost, perkCostMul, modifiers });
  return { ops, fixedMinimum: ops.total, wage: ops.staff, training, sampling, marketing: marketingCost,
    perCup: CAMPAIGN.staffPerCup + CAMPAIGN.suppliesPerCup + CAMPAIGN.utilities.powerPerCup + (modifiers.suppliesDelta || 0) + (staffing === 'apprentice' ? CAMPAIGN.staff.apprenticeWasteExtra : 0),
    pitchPct: CAMPAIGN.pitchPct + (modifiers.pitchPctDelta || 0), cardFeePct: CAMPAIGN.cardFeePct * perkCostMul,
    contractFee: hedgeTerms(hedge, extraFee)?.fee || 0,
    interest: day > 1 && hedge !== 'settle' ? debtInterestFor(debt) : 0,
    settlement: hedge === 'settle' ? debt : 0 };
}
