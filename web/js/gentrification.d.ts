export interface DayModifiers {
  pitchPctDelta: number;
  pitchMinDelta: number;
  suppliesDelta: number;
  commuterDelayMinutes: number;
  dwellBonus: number;
}
export function modifiersForDay(day: number): DayModifiers;
