// Grunds — Behavioral Economics & Specialty Craft Mechanics
// Pure deterministic models for:
// 1. Anchoring & Decoy Pricing (Chalkboard premium lots)
// 2. Basket Attachment (Bean-to-bar chocolate & morning pastry bake)
// 3. Tip Jar Social Proof & Tipping Psychology

export const DECOY_MENU = {
  geshaReserve: { name: 'Gesha Lot #4 Pour-Over', price: 7.80, cogs: 2.20 },
  matchaStandard: { name: 'Uji Matcha Latte', price: 4.80, cogs: 1.30 },
  matchaDeal: { name: 'Afternoon Matcha Special', price: 4.20, cogs: 1.30 },
};

export const ATTACH_ITEMS = {
  croissant: { name: 'All-Butter Croissant', price: 2.80, cogs: 0.70, prepCost: 0.10 },
  bananaLoaf: { name: 'Miso Banana Loaf Slice', price: 3.20, cogs: 0.85, prepCost: 0.10 },
  cacaoBar: { name: 'Single-Origin 72% Cacao Slab', price: 3.60, cogs: 1.10, prepCost: 0.05 },
};

export const COHORT_AFFINITY = {
  creatives: { attachChance: 0.32, cacaoAffinity: 0.60, tipTendency: 0.45 },
  elders:    { attachChance: 0.28, cacaoAffinity: 0.20, tipTendency: 0.30 },
  tourists:  { attachChance: 0.35, cacaoAffinity: 0.40, tipTendency: 0.55 },
  commuters: { attachChance: 0.14, cacaoAffinity: 0.15, tipTendency: 0.20 },
  students:  { attachChance: 0.22, cacaoAffinity: 0.35, tipTendency: 0.15 },
};

/**
 * Calculates perceived value elasticity with decoy anchoring.
 * High-end decoy (£7.80 Gesha) anchors perception so £4.80 feels reasonable.
 */
export function calcAnchoredElasticity(cohort, price, hasDecoy = true) {
  const baseResistance = (price - 4.00) * 0.45;
  if (!hasDecoy) return Math.max(0, baseResistance);
  
  // Decoy reduces price resistance by 35% for creatives and 25% for students
  const discountFactor = cohort === 'creatives' ? 0.35 : cohort === 'students' ? 0.25 : 0.20;
  return Math.max(0, baseResistance * (1 - discountFactor));
}

/**
 * Determines whether a patron attaches a pastry or bean-to-bar chocolate item.
 */
export function rollBasketAttachment(cohort, timeMin, rngVal) {
  const aff = COHORT_AFFINITY[cohort] || COHORT_AFFINITY.commuters;
  // Morning peak for pastry (before 11:30), afternoon peak for cacao (12:00-17:00)
  let timeMultiplier = 1.0;
  if (timeMin < 690) timeMultiplier = 1.25; // 7am - 11:30am
  else if (timeMin >= 720 && timeMin <= 1020) timeMultiplier = 1.15; // noon - 5pm

  const attachProb = aff.attachChance * timeMultiplier;
  if (rngVal > attachProb) return null;

  // Choose item: cacao vs pastry
  const isCacao = (rngVal / attachProb) < aff.cacaoAffinity;
  if (isCacao) return ATTACH_ITEMS.cacaoBar;
  return (timeMin < 750) ? ATTACH_ITEMS.croissant : ATTACH_ITEMS.bananaLoaf;
}

/**
 * Computes tip with social proof feedback from the tip jar.
 */
export function calculateTip(cohort, itemPrice, op = 0.5, jarFillRatio = 0.0) {
  const aff = COHORT_AFFINITY[cohort] || COHORT_AFFINITY.commuters;
  // Social proof: a visible, partially filled tip jar boosts tip likelihood by up to 30%
  const socialBoost = Math.min(0.30, jarFillRatio * 0.35);
  const tipChance = (aff.tipTendency + socialBoost) * Math.max(0.2, (op + 1) / 2);

  if (Math.random && tipChance > 0.5) {
    // 10% - 15% tip rounded to 20p/50p
    return Math.round((itemPrice * (0.10 + op * 0.05)) * 5) / 5;
  }
  return 0;
}
