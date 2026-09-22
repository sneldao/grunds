import { CAMPAIGN, ECON } from './config.js';
import { priceForDay } from './gentrification.js';
export function salePrice(exchange, repriced = false) {
  return repriced ? ECON.matchaDeal : exchange.matchaPrice ?? priceForDay(Math.max(1, exchange.day));
}
export function operatingCosts({ till = 0, served = 0, staffing = 'work', marketing = 0, training = 0, sampling = 0, perkCostMul = 1, modifiers = {} } = {}) {
  const wage = staffing === 'home' ? 0 : staffing === 'apprentice' ? CAMPAIGN.staff.apprenticeDayRate : CAMPAIGN.staffDayRate;
  const costs = {
    staff: wage + served * CAMPAIGN.staffPerCup,
    supplies: served * (CAMPAIGN.suppliesPerCup + (modifiers.suppliesDelta || 0) + (staffing === 'apprentice' ? CAMPAIGN.staff.apprenticeWasteExtra : 0)),
    pitch: Math.max(CAMPAIGN.pitchMin + (modifiers.pitchMinDelta || 0), Math.max(0, till) * (CAMPAIGN.pitchPct + (modifiers.pitchPctDelta || 0))),
    fees: Math.max(0, till) * CAMPAIGN.cardFeePct * perkCostMul,
    sundries: CAMPAIGN.sundries,
    marketing,
    training,
    sampling,
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
export function campaignVerdict(net, rep) {
  if (net > 8000 && rep >= 70) return 'star';
  if (net > 5500 && rep >= 60) return 'good';
  if (net > 4500) return 'held';
  if (net > 0) return 'scarped';
  return 'lost';
}
export function quoteDayPlan({ day, hedge = 'hold', staffing = 'work', marketing = {}, debt = 0, extraFee = 0, perkCostMul = 1, modifiers = {} }) {
  const training = staffing === 'apprentice' ? CAMPAIGN.staff.apprenticeTrainingFee : 0;
  const sampling = marketing.sample ? CAMPAIGN.demand.sampleCost : 0;
  const marketingCost = marketing.sponsor ? CAMPAIGN.demand.sponsorCost : 0;
  const ops = operatingCosts({ staffing, training, sampling, marketing: marketingCost, perkCostMul, modifiers });
  return { ops, fixedMinimum: ops.total, wage: ops.staff, training, sampling, marketing: marketingCost,
    perCup: CAMPAIGN.staffPerCup + CAMPAIGN.suppliesPerCup + (modifiers.suppliesDelta || 0) + (staffing === 'apprentice' ? CAMPAIGN.staff.apprenticeWasteExtra : 0),
    pitchPct: CAMPAIGN.pitchPct + (modifiers.pitchPctDelta || 0), cardFeePct: CAMPAIGN.cardFeePct * perkCostMul,
    contractFee: hedgeTerms(hedge, extraFee)?.fee || 0,
    interest: day > 1 && hedge !== 'settle' ? debtInterestFor(debt) : 0,
    settlement: hedge === 'settle' ? debt : 0 };
}
