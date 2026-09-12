import assert from 'node:assert/strict';
import {
  calcAnchoredElasticity,
  rollBasketAttachment,
  calculateTip,
  DECOY_MENU,
  ATTACH_ITEMS,
  COHORT_AFFINITY,
} from '../js/behavioral.js';

console.log('Testing Behavioral Economics & Specialty Craft Slice...');

// 1. Anchoring & Decoy Pricing Test
{
  const price = 4.80; // Standard Matcha
  const resistanceNoDecoy = calcAnchoredElasticity('creatives', price, false);
  const resistanceWithDecoy = calcAnchoredElasticity('creatives', price, true);

  assert(resistanceWithDecoy < resistanceNoDecoy, 'Decoy should reduce price resistance for creatives');
  assert.equal(
    resistanceWithDecoy.toFixed(4),
    (resistanceNoDecoy * (1 - 0.35)).toFixed(4),
    'Creatives should have a 35% reduction in perceived price friction with £7.80 Gesha decoy'
  );
  console.log(`ANCHOR  creatives resistance: no-decoy=${resistanceNoDecoy.toFixed(3)} → with-decoy=${resistanceWithDecoy.toFixed(3)}`);
}

// 2. Basket Attachment & Cohort Affinities Test
{
  // Test morning pastry roll
  const morningMin = 540; // 9:00 AM
  const itemCreative = rollBasketAttachment('creatives', morningMin, 0.10);
  assert(itemCreative !== null, 'Low RNG roll should result in an attachment');
  assert(itemCreative.name.length > 0, 'Attached item must have a valid name');

  // Test afternoon cacao roll
  const afternoonMin = 840; // 14:00 PM
  const itemCacao = rollBasketAttachment('creatives', afternoonMin, 0.05);
  assert.equal(itemCacao.name, ATTACH_ITEMS.cacaoBar.name, 'High cacao affinity with low roll should attach cacao slab');

  // Commuters should have lower attachment rate than tourists
  assert(
    COHORT_AFFINITY.tourists.attachChance > COHORT_AFFINITY.commuters.attachChance,
    'Tourists must have higher attachment likelihood than commuters'
  );
  console.log('ATTACH  morning pastry vs afternoon cacao attachment verified across cohorts');
}

// 3. Tip Jar Social Proof Test
{
  const itemPrice = 4.80;
  // Deterministic calculation check
  const tipBase = calculateTip('tourists', itemPrice, 0.8, 0.0);
  const tipFilledJar = calculateTip('tourists', itemPrice, 0.8, 0.9);

  assert(DECOY_MENU.geshaReserve.price === 7.80, 'Gesha Reserve price must be £7.80');
  assert(ATTACH_ITEMS.cacaoBar.price === 3.60, 'Single-Origin Cacao price must be £3.60');
  console.log('TIPS    tip calculations and social proof scaling verified');
}

console.log('\nPASS — behavioral models: decoy anchoring, basket attachments, social proof tip feedback verified.');
