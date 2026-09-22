import type { DayModifiers } from './gentrification.js';
export interface QuoteInput {
  day: number;
  hedge?: string;
  staffing?: string;
  marketing?: { sample?: boolean; sponsor?: boolean };
  debt?: number;
  extraFee?: number;
  perkCostMul?: number;
  modifiers?: Partial<DayModifiers>;
}
export interface DayPlanQuote {
  ops: Record<string, number>;
  fixedMinimum: number;
  wage: number;
  training: number;
  sampling: number;
  marketing: number;
  perCup: number;
  pitchPct: number;
  cardFeePct: number;
  contractFee: number;
  interest: number;
  settlement: number;
}
export function quoteDayPlan(input: QuoteInput): DayPlanQuote;
export function hedgeTerms(id: string, extraFee?: number): { units: number; fee: number } | null;
export function debtInterestFor(debt: number): number;
export function salePrice(exchange: { matchaPrice?: number; day: number }, repriced?: boolean): number;
export function operatingCosts(input?: {
  till?: number; served?: number; staffing?: string; marketing?: number;
  training?: number; sampling?: number; perkCostMul?: number; modifiers?: Partial<DayModifiers>;
}): Record<string, number> & { total: number };
export function campaignVerdict(net: number, rep: number): 'star' | 'good' | 'held' | 'scarped' | 'lost';
