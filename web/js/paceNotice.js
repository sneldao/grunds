// Rush speed cap. 20× makes the cup countdown unreadable, so the floor
// drops to 5× at 14:00 and hands the chosen speed back at 17:00.
export const RUSH_LO = 840;
export const RUSH_HI = 1020;
export const FAST = 1200;
export const RUSH_SPEED = 300;

export function rushSpeed(dayMin, chosen, headless = false) {
  const speed = Number(chosen) || 60;
  if (headless || speed < FAST) {
    return { speed, dropped: false, restored: false, blocked: false, notice: null };
  }
  if (dayMin >= RUSH_LO && dayMin < RUSH_HI) {
    return {
      speed: RUSH_SPEED,
      dropped: dayMin === RUSH_LO,
      restored: false,
      blocked: true,
      notice: dayMin === RUSH_LO ? 'slowed to 5× for the rush — 20× returns after 17:00' : null,
    };
  }
  if (dayMin === RUSH_HI) {
    return {
      speed,
      dropped: false,
      restored: true,
      blocked: false,
      notice: 'back to 20× — the rush is over',
    };
  }
  return { speed, dropped: false, restored: false, blocked: false, notice: null };
}
