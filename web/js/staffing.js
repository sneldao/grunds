import { CAMPAIGN } from './config.js';

export const canChooseStaffing = (day, condition) => day >= 2 && condition < .55;

export const HIRE_RUTH = 'ruth';
export const HIRE_ROBOT = 'robot';

// Day 1 of the real week is the only morning the hire can move. It locks
// at open. Ruth stays the default. The robot stands in for her and for
// the apprentice for the whole stretch — it does not call in, and it
// cannot be sent home.
export function canStageHire(day, { softDay = false, locked = false } = {}) {
  return day === 1 && !softDay && !locked;
}

// Ruth's sick morning still books the apprentice. A robot stretch has
// no cover: she isn't on the rota, and neither is the temp.
export function sickMorningCover(hire) {
  return hire === HIRE_ROBOT ? null : 'apprentice';
}

// One morning in the stretch, never day 1 (that morning is the player's
// hire) and never a morning the player picks. Stable for a seed.
export function maintenanceDay(seed, days = CAMPAIGN.days) {
  const span = Math.max(1, (days | 0) - 1);
  const n = Math.abs((Number(seed) | 0) * 13 + 7);
  return 2 + (n % span);
}

export function isMaintenanceMorning(seed, day, days = CAMPAIGN.days) {
  return day === maintenanceDay(seed, days);
}

export function robotPace(maintenance) {
  const base = CAMPAIGN.staff.robotStaffMul;
  return maintenance ? base * CAMPAIGN.staff.maintenanceSlow : base;
}

// A warm room credits every arrival. A robot stretch, and the quiet it
// leaves behind, credits every other one. The quiet is not a dawn reset.
export function visitLands(nth, { robot = false, quiet = 0 } = {}) {
  if (!robot && !(quiet > 0)) return true;
  return (Math.abs(nth | 0) % 2) === 0;
}

// Tips that don't land. A Ruth week with a warm room forgoes nothing, so
// the ticket is unchanged. A robot week, and any later week still carrying
// that room, keeps only robotTipKeep of the gratuity.
export function tipForgone(price, tipMul = 1, { robot = false, quiet = 0 } = {}) {
  if (!robot && !(quiet > 0)) return 0;
  const base = Math.max(0, Number(price) || 0) * CAMPAIGN.staff.robotTipRate * (Number(tipMul) || 1);
  const forgone = base * (1 - CAMPAIGN.staff.robotTipKeep);
  return Math.round(forgone * 100) / 100;
}

// Opinion shift for a pocket of quiet. Applied on top of the day's own
// resolve, and again when a new week opens onto the room the last one left.
export function quietOpinionDrag(quiet) {
  const q = Math.max(0, Math.min(1, Number(quiet) || 0));
  return -0.15 * q;
}

// A strong day unlocks Ruth's rest for the next morning, while the week
// still has one. Tiredness is the other door (canChooseStaffing). This one
// opens because the floor went well, so the rest can be used before day 5.
export function earnedRestDay(day, { reputation = 0, served = 0, balked = 0, campaignDays = 5 } = {}) {
  if (!Number.isInteger(day) || day < 1 || day >= campaignDays) return 0;
  const cups = Math.max(0, served || 0);
  const walks = Math.max(0, balked || 0);
  const quiet = cups >= 100 && walks <= cups * 0.06;
  const loved = reputation >= 60;
  return (quiet || loved) ? day + 1 : 0;
}
export const canHaveStaffCrisis = ({ day, staffing, condition, crisis, dayMin }) => day >= 2 && staffing === 'work' && !crisis && condition < .2 && dayMin >= 900 && dayMin < 1030;
