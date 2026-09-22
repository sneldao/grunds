export interface DecisionContract {
  price: number;
  units: number;
  fee: number;
}
export interface DecisionSnapshot {
  day: number;
  index: number;
  debt: number;
  contract: DecisionContract | null;
  extraFee: number;
  staffCondition: number;
}
export interface DecisionMarketing {
  sample: boolean;
  sponsor: boolean;
}
export type HedgeChoice = 'hold' | 'settle' | 'contract_light' | 'contract' | 'contract_heavy';
export type StaffingChoice = 'work' | 'home' | 'apprentice';
export interface DecisionPlan {
  hedge: HedgeChoice;
  staffing: StaffingChoice;
  marketing: DecisionMarketing;
}
export interface DecisionSuccess {
  ok: true;
  plan: DecisionPlan;
  index: number;
  debt: number;
  contract: DecisionContract | null;
  extraFee: number;
  fee: number;
  interest: number;
  settlement: number;
}
export interface DecisionFailure {
  ok: false;
  why: string;
}
export type DecisionResult = DecisionSuccess | DecisionFailure;
export function resolveDecision(snapshot: DecisionSnapshot, plan: DecisionPlan): DecisionResult;
