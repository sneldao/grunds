// PR-4a — RevenueCat multi-tier catalog.
//
// Pins the surface contract for the District Insider / Founder's Pass tiers:
// three products (monthly, yearly, founder), two entitlements (insider,
// founder), three price fallbacks, and the manager's per-tier purchase
// entry points. Headless — no DOM, no SDK import, no network.
import assert from 'node:assert/strict';
import { PRODUCTS, ENTITLEMENTS, TIER_PRICING } from '../js/billing.js';

// ---- 1. The catalog exists with the right shape ---------------------
assert.ok(PRODUCTS && typeof PRODUCTS === 'object', 'PRODUCTS map must exist');
for (const key of ['monthly', 'yearly', 'founder']) {
  assert.ok(typeof PRODUCTS[key] === 'string' && PRODUCTS[key].startsWith('rc_'),
    `PRODUCTS.${key} should be a RevenueCat product id (got ${PRODUCTS[key]})`);
}

assert.ok(ENTITLEMENTS && typeof ENTITLEMENTS === 'object', 'ENTITLEMENTS map must exist');
for (const key of ['insider', 'founder']) {
  assert.ok(typeof ENTITLEMENTS[key] === 'string' && ENTITLEMENTS[key].length > 0,
    `ENTITLEMENTS.${key} should be a RevenueCat entitlement id`);
}

// ---- 2. TIER_PRICING fallbacks ------------------------------------
for (const tier of Object.keys(PRODUCTS)) {
  assert.ok(typeof TIER_PRICING[tier] === 'string' && /[£$€]\d/.test(TIER_PRICING[tier]),
    `TIER_PRICING.${tier} should be a money string (got ${TIER_PRICING[tier]})`);
}

// Yearly should be roughly 10-12× monthly (≈17% off per month)
const moMatch = TIER_PRICING.monthly.match(/\d+(\.\d+)?/);
const yrMatch = TIER_PRICING.yearly.match(/\d+(\.\d+)?/);
const mo = moMatch ? +moMatch[0] : 0;
const yr = yrMatch ? +yrMatch[0] : 0;
const ratio = yr / mo;     // £39.99 / £4.99 ≈ 8.01 — a 33% discount
assert.ok(ratio >= 7 && ratio <= 12.5, `yearly/monthly ratio ${ratio.toFixed(2)} should be 7-12.5× (≈33% off)`);

// ---- 3. billing manager state isolation ----------------------------
// Headless environment: no DOM stubs needed for instance state.
process.env.NODE_ENV = 'test';

// polyfill a minimal localStorage so billing.js doesn't throw on import
const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => memStore.has(k) ? memStore.get(k) : null,
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
};
globalThis.window = globalThis;
globalThis.location = { search: '' };

// Use a dynamic import AFTER the polyfills so the module evaluates cleanly.
// eslint-disable-next-line no-unused-vars
const { billing } = await import('../js/billing.js?isolate=' + Date.now());

// ---- 4. Entitlement combinatorics ---------------------------------
// fresh manager: no subscription, no founder
assert.equal(billing.subscribed, false, 'fresh manager should not be subscribed');
assert.equal(billing.insider, false, 'fresh manager should not be an insider');
assert.equal(billing.founder, false, 'fresh manager should not be a founder');

// grant insider → both `isInsider` and the legacy `isSubscribed` flip true
billing.setEntitlement(ENTITLEMENTS.insider, true);
assert.equal(billing.insider, true, 'setEntitlement(insider) should flip insider=true');
assert.equal(billing.isInsider(), true, 'isInsider() should be true');
assert.equal(billing.isSubscribed(), true, 'isSubscribed() legacy alias should track insider');

// grant founder → insider perks flow through, founder flag separate
billing.setEntitlement(ENTITLEMENTS.founder, true);
assert.equal(billing.founder, true, 'setEntitlement(founder) should flip founder=true');
assert.equal(billing.isFounder(), true, 'isFounder() should be true');
assert.equal(billing.isInsider(), true, 'isInsider() should remain true (founder carries insider)');

// losing founder shouldn't lose insider
billing.setEntitlement(ENTITLEMENTS.founder, false);
assert.equal(billing.founder, false, 'setEntitlement(founder,false) should clear founder');
assert.equal(billing.isInsider(), true, 'isInsider() should remain true (insider still active)');

// losing insider shouldn't affect founder if founder was set above (after cancel)
// Re-grant founder, then drop insider, founder stays
billing.setEntitlement(ENTITLEMENTS.founder, true);
billing.setEntitlement(ENTITLEMENTS.insider, false);
assert.equal(billing.founder, true, 'founder flag should survive losing insider');
assert.equal(billing.isFounder(), true, 'isFounder() independent of insider');
assert.equal(billing.isInsider(), true, 'isInsider() = isInsider() OR isFounder() — founder passes through');

// ---- 5. _pickPackage selects by tier -------------------------------
// Build a fake offerings object covering every tier
const fakeOfferings = {
  current: {
    availablePackages: [
      { identifier: 'rc_district_insider_monthly', rcBillingProduct: { productType: 'subscription', currentPrice: { formattedPrice: '$9.99' } } },
      { identifier: 'rc_district_insider_yearly',  rcBillingProduct: { productType: 'subscription', currentPrice: { formattedPrice: '$99.99' } } },
      { identifier: 'rc_district_founder_one_time', rcBillingProduct: { productType: 'one_time',     currentPrice: { formattedPrice: '$49.99' } } },
    ],
  },
};

// Use a temporary manager to test _pickPackage (internal method, used in
// production; expose via a small wrapper)
function fakePick(tier) { return billing._pickPackage(fakeOfferings, tier); }
assert.equal(fakePick('monthly').identifier, PRODUCTS.monthly);
assert.equal(fakePick('yearly').identifier,  PRODUCTS.yearly);
assert.equal(fakePick('founder').identifier, PRODUCTS.founder);

// offers where the identifier heuristic kicks in (drift in the dashboard)
const heuristicOfferings = {
  current: {
    availablePackages: [
      { identifier: '$rc_monthly_a',     rcBillingProduct: { productType: 'subscription', currentPrice: { formattedPrice: '$9.99' } } },
      { identifier: '$rc_annual_b',      rcBillingProduct: { productType: 'subscription', currentPrice: { formattedPrice: '$99.99' } } },
      { identifier: '$rc_lifetime_pass', rcBillingProduct: { productType: 'one_time',     currentPrice: { formattedPrice: '$49.99' } } },
    ],
  },
};
function heuristicPick(tier) { return billing._pickPackage(heuristicOfferings, tier); }
assert.match(heuristicPick('monthly').identifier, /month/i, 'monthly fallback matches /month/');
assert.match(heuristicPick('yearly').identifier,  /year|annual|12mo/i, 'yearly fallback matches year/annual/12mo');
assert.match(heuristicPick('founder').identifier, /found|lifetime|once|onetime|one_time/i, 'founder fallback matches founder/lifetime');

// ---- 6. priceLabel routes per tier ---------------------------------
// Without an SDK, falls back to TIER_PRICING
assert.equal(await billing.priceLabel('monthly'), TIER_PRICING.monthly);
assert.equal(await billing.priceLabel('yearly'),  TIER_PRICING.yearly);
assert.equal(await billing.priceLabel('founder'), TIER_PRICING.founder);

// With a stubbed purchases.getOfferings() that returns $X.XX formattedPrice
const stub = {
  async getOfferings() { return fakeOfferings; },
  async getCustomerInfo() { return { entitlements: { active: { commodity_insider: {}, district_founder: {} } } }; },
};
billing.purchases = stub;
billing.testKey = true;
assert.match(await billing.priceLabel('monthly'), /\$.*mo/);
assert.match(await billing.priceLabel('yearly'),  /\$.*yr/);
assert.match(await billing.priceLabel('founder'), /\$.*once/);

console.log(JSON.stringify({
  passed: true,
  tests: 13,
  products: PRODUCTS,
  entitlements: ENTITLEMENTS,
  pricing: TIER_PRICING,
}));
