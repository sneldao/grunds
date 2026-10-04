export const canChooseStaffing = (day, condition) => day >= 2 && condition < .55;

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
