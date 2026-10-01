export const QUIET_MUL = 4;

export function isQuiet(s) {
  const { phase, paused, closed, modalOpen, cardVisible, momentPending, dayMin, offerResolved, incidentPending, settled } = s;
  if (phase !== 'trading' || paused || closed || modalOpen || cardVisible || momentPending) return false;
  if (!settled) return false;
  if (dayMin < 660) return true;
  if (offerResolved && dayMin < 810) return true;
  if (dayMin >= 960 && dayMin < 1020 && !incidentPending) return true;
  return false;
}
