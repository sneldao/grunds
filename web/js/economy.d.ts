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
