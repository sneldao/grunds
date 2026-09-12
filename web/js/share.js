// Grunds — The District: Viral Hooks & Social Share Cards
// Generates subtle, elegant share summaries and assigns campaign badges.

export const BASE_URL = 'https://striped-anaconda-746.convex.site';

export function calculateCampaignBadge({
  netWorth = 0,
  reputation = 60,
  served = 0,
  balked = 0,
  debt = 0,
} = {}) {
  const total = served + balked;
  const balkRatio = total > 0 ? balked / total : 0;

  if (netWorth >= 30000 && reputation >= 70 && debt === 0) {
    return { title: 'Master Roaster', icon: '☕', desc: 'Flawless execution, zero debt, revered by regulars.' };
  }
  if (debt === 0 && netWorth >= 20000) {
    return { title: 'Debt Free', icon: '⚖️', desc: 'Paid down the supplier credit and kept the margin.' };
  }
  if (balkRatio <= 0.08 && served > 1000) {
    return { title: 'Matcha Strategist', icon: '🍵', desc: 'Read the afternoon wave and held the till warm.' };
  }
  if (reputation >= 75) {
    return { title: 'Community Anchor', icon: '🏛️', desc: 'Beloved by the elders, spoken of in the lists.' };
  }
  return { title: 'District Survivor', icon: '🍂', desc: 'Endured the commodity shocks and kept the lights on.' };
}

export function formatShareText({
  day = 1,
  maxDays = 5,
  till = 0,
  reputation = 60,
  verdict = '',
  seed = 42,
  badge = null,
} = {}) {
  const tillStr = typeof till === 'number' ? `£${till.toFixed(2)}` : till;
  const badgeLine = badge ? `\n🏆 Badge: ${badge.icon} ${badge.title}` : '';
  const cleanVerdict = verdict ? `\n"${verdict.replace(/\n/g, ' ')}"` : '';

  return (
    `☕ Grunds — The District (Day ${day}/${maxDays} · Seed #${seed})\n` +
    `Till: ${tillStr} · Rep: ${reputation}/100${badgeLine}${cleanVerdict}\n` +
    `Play the seed: ${BASE_URL}?seed=${seed}`
  );
}

export function openShareToX(shareData) {
  const text = formatShareText(shareData);
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return url;
}
