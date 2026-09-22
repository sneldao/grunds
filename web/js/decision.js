import { CAMPAIGN } from './config.js';
import { hedgeTerms } from './economy.js';
import { canChooseStaffing } from './staffing.js';

const HEDGES = new Set(['hold', 'settle', 'contract_light', 'contract', 'contract_heavy']);
const STAFFING = new Set(['work', 'home', 'apprentice']);
const fin = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const ownKeys = (o) => Object.keys(o).filter(k => Object.prototype.hasOwnProperty.call(o, k));
const exactKeys = (o, keys) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const ks = ownKeys(o);
  return ks.length === keys.length && keys.every(k => ks.includes(k));
};

export function resolveDecision(snapshot, plan) {
  if (!exactKeys(snapshot, ['day', 'index', 'debt', 'contract', 'extraFee', 'staffCondition'])) return { ok: false, why: 'bad input' };
  if (!exactKeys(plan, ['hedge', 'staffing', 'marketing'])) return { ok: false, why: 'bad input' };
  const { day, index, debt, contract, extraFee, staffCondition } = snapshot;
  if (!Number.isInteger(day) || day < 1 || day > CAMPAIGN.days) return { ok: false, why: 'bad day' };
  if (!fin(index, 0.6, 2.6)) return { ok: false, why: 'bad index' };
  if (!fin(debt, 0, Infinity)) return { ok: false, why: 'bad debt' };
  if (!fin(extraFee, 0, Infinity)) return { ok: false, why: 'bad surcharge' };
  if (!fin(staffCondition, 0, 1)) return { ok: false, why: 'bad condition' };
  if (contract !== null) {
    if (!exactKeys(contract, ['price', 'units', 'fee'])) return { ok: false, why: 'bad contract' };
    if (!fin(contract.price, 0.6, 2.6) || !Number.isInteger(contract.units) || contract.units <= 0 || contract.units > CAMPAIGN.contractUnits * 2 || !fin(contract.fee, 0, Infinity)) return { ok: false, why: 'bad contract' };
  }
  const { hedge, staffing, marketing } = plan;
  if (!HEDGES.has(hedge)) return { ok: false, why: 'bad hedge' };
  if (!STAFFING.has(staffing)) return { ok: false, why: 'bad staffing' };
  if (!exactKeys(marketing, ['sample', 'sponsor'])) return { ok: false, why: 'bad marketing' };
  if (typeof marketing.sample !== 'boolean' || typeof marketing.sponsor !== 'boolean') return { ok: false, why: 'bad marketing' };
  const sample = marketing.sample, sponsor = marketing.sponsor;
  if (sponsor && day < 3) return { ok: false, why: 'sponsor too early' };
  if (day >= CAMPAIGN.days && (sample || sponsor)) return { ok: false, why: 'no tomorrow' };
  if (staffing !== 'work' && !canChooseStaffing(day, staffCondition)) return { ok: false, why: 'staffing unavailable' };
  if (hedge !== 'hold' && hedge !== 'settle' && contract) return { ok: false, why: 'already contracted' };

  const settlement = hedge === 'settle' ? debt : 0;
  const interest = day > 1 && debt > 0 && hedge !== 'settle' ? CAMPAIGN.debtInterest : 0;   // the debt clock ticks at dawn
  const terms = hedgeTerms(hedge, extraFee);
  const fee = terms ? terms.fee : 0;
  const newDebt = debt - settlement + interest + fee;
  if (!Number.isFinite(newDebt)) return { ok: false, why: 'debt overflow' };
  const newContract = contract
    ? { price: contract.price, units: contract.units, fee: contract.fee }
    : terms ? { price: index, units: terms.units, fee: terms.fee } : null;
  return {
    ok: true,
    plan: { hedge, staffing, marketing: { sample, sponsor } },
    index,
    debt: newDebt,
    contract: newContract,
    extraFee: terms ? 0 : extraFee,
    fee,
    interest,
    settlement,
  };
}
