// RevenueCat Web Billing — District Insider Pass subscriptions for Grunds.
// Live path: @revenuecat/purchases-js, loaded from CDN only when a Web Billing
// public API key is configured. Test path: the Web Test Store — same
// entitlement shape, simulated locally, so the paywall demos end-to-end
// before production keys land.
//
// Configure the key via RC_API_KEY below, ?rc=<key>, or localStorage
// 'grunds.rcKey'. Web Billing *public* SDK keys are designed to ship in
// client code — secret keys never enter the repo.

// PR-4 — multi-tier catalog: a monthly pass, a yearly pass (≈33% off per
// month), and a one-time Founder's pass (non-consumable — buys you the day-5
// replay-with-new-seed CTA + brass stamp on the share card forever).
export const ENTITLEMENT_ID = "commodity_insider";
export const ENTITLEMENTS = {
  insider: "commodity_insider",          // the Wire desk tilt + ad-free Wire
  founder: "district_founder",           // day-5 replay-with-new-seed + brass share card
};
export const PRODUCTS = {
  monthly: "rc_district_insider_monthly",
  yearly:  "rc_district_insider_yearly",
  founder: "rc_district_founder_one_time",
};
// Display fallbacks for the Web Test Store (real offerings carry live price)
export const TIER_PRICING = {
  monthly: '£4.99/mo',
  yearly:  '£39.99/yr',
  founder: '£49.99 once',
};

// Public SDK key — safe to ship in client code by design. This is the Test
// Store key: the real purchases-js SDK and real entitlement checks run, but
// checkout is simulated (no card). Swap for a Web Billing key to take money.
const RC_API_KEY = "test_DOEfrSpAdSHcSyPwiCtnbOnjHqD"; // gitleaks:allow — public RevenueCat Web Test Store key, safe to ship in client code by design

const RC_SDK_URL =
  "https://cdn.jsdelivr.net/npm/@revenuecat/purchases-js@1.47.3/+esm";

function store() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function configuredKey() {
  try {
    const q = new URLSearchParams(location.search).get("rc");
    if (q) {
      store()?.setItem("grunds.rcKey", q);
      return q;
    }
  } catch {
    /* no location (headless) */
  }
  return RC_API_KEY || store()?.getItem("grunds.rcKey") || "";
}

class BillingManager {
  constructor() {
    // PR-4 — multi-entitlement state. `subscribed` keeps the legacy
    // semantics for code that still asks `billing.isSubscribed()`. The
    // granular `insider` + `founder` flags drive the new surfaces.
    this.subscribed = store()?.getItem("grunds_subscribed") === "true";
    this.insider = store()?.getItem("grunds_insider") === "true" || this.subscribed;
    this.founder = store()?.getItem("grunds_founder") === "true";
    this.listeners = new Set();
    this.purchases = null; // live Purchases instance when a key is configured
    this.testKey = false; // test_ key → real SDK, simulated checkout
    this.appUserId = null;
  }

  get mode() {
    if (!this.purchases) return "test store";
    return this.testKey ? "test store · live SDK" : "web billing";
  }

  isSubscribed() { return this.subscribed; }   // legacy alias
  isInsider()    { return this.insider || this.founder; }   // founders get all insider perks
  isFounder()    { return this.founder; }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    const snap = { subscribed: this.subscribed, insider: this.isInsider(), founder: this.founder };
    for (const fn of this.listeners) fn(snap);
  }

  setSubscribed(v) {
    this.subscribed = !!v;
    this.insider = !!v || this.insider;
    try {
      store()?.setItem("grunds_subscribed", String(this.subscribed));
      store()?.setItem("grunds_insider", String(this.insider));
    } catch {}
    this.notify();
  }

  setEntitlement(entId, v) {
    if (entId === ENTITLEMENTS.founder) {
      this.founder = !!v;
      try { store()?.setItem("grunds_founder", String(this.founder)); } catch {}
    } else if (entId === ENTITLEMENTS.insider) {
      this.insider = !!v;
      try { store()?.setItem("grunds_insider", String(this.insider)); } catch {}
    }
    // every entitlement change refreshes the legacy `subscribed` flag
    this.subscribed = this.isInsider();
    try { store()?.setItem("grunds_subscribed", String(this.subscribed)); } catch {}
    this.notify();
  }

  // Called once the floor knows its stand owner — the owner doubles as the
  // RevenueCat appUserId so a pass follows the stand across devices.
  async configure(appUserId) {
    this.appUserId = appUserId || null;
    const key = configuredKey();
    if (!key) return this.mode;
    try {
      const mod = await import(/* webpackIgnore: true */ RC_SDK_URL);
      const Purchases = mod.Purchases;
      this.purchases = Purchases.configure({
        apiKey: key,
        appUserId: appUserId || Purchases.generateRevenueCatAnonymousAppUserId(),
      });
      this.testKey = key.startsWith("test_");
      const info = await this.purchases.getCustomerInfo();
      // honour BOTH entitlements off the same customer info object
      this.setEntitlement(ENTITLEMENTS.insider, Boolean(info?.entitlements?.active?.[ENTITLEMENTS.insider]));
      this.setEntitlement(ENTITLEMENTS.founder, Boolean(info?.entitlements?.active?.[ENTITLEMENTS.founder]));
    } catch (err) {
      console.warn("RevenueCat init failed — Web Test Store stays active:", err);
      this.purchases = null;
    }
    return this.mode;
  }

  // Live price from the configured offering for the requested tier, or the
  // display fallback when the SDK isn't loaded. `tier` is one of: monthly,
  // yearly, founder.
  async priceLabel(tier = 'monthly') {
    if (this.purchases) {
      try {
        const off = await this.purchases.getOfferings();
        const pkg = this._pickPackage(off, tier);
        const prod = pkg?.rcBillingProduct ?? pkg?.product;
        const fmt = prod?.currentPrice?.formattedPrice;
        if (fmt) {
          const isOneTime = (prod?.productType ?? '').toLowerCase().includes('one_time') || tier === 'founder';
          return isOneTime ? `${fmt} once` : tier === 'yearly' ? `${fmt}/yr` : `${fmt}/mo`;
        }
      } catch {
        /* fall through to display price */
      }
    }
    return TIER_PRICING[tier] || TIER_PRICING.monthly;
  }

  // PR-4 — pick the offering package that matches the requested tier. When
  // the live offerings don't carry a matching package, fall back to a label
  // heuristic so the demo never crashes if RevenueCat's offering names drift.
  _pickPackage(offerings, tier) {
    const pkgs = offerings?.current?.availablePackages ?? [];
    const target = PRODUCTS[tier];
    if (!target) return pkgs[0];
    const idLower = target.toLowerCase();
    const exact = pkgs.find((p) => (p.identifier ?? '').toLowerCase() === idLower);
    if (exact) return exact;
    // fall back to identifier-based heuristics
    const fallbackHeuristic = (() => {
      if (tier === 'yearly')  return pkgs.find((p) => /year|annual|12mo/i.test(p.identifier ?? ''));
      if (tier === 'founder') return pkgs.find((p) => /found|lifetime|once|onetime|one_time/i.test(p.identifier ?? ''));
      return pkgs.find((p) => /month/i.test(p.identifier ?? '')) ?? pkgs[0];
    })();
    return fallbackHeuristic ?? pkgs[0];
  }

  // PR-4 — single-tier purchase entry points. Default `purchasePass()` is
  // the monthly pass for back-compat; the new `purchaseYearly()` and
  // `purchaseFounder()` are called from the multi-tier paywall.
  async _purchase(tier) {
    if (this.purchases) {
      try {
        const pkg = this._pickPackage(await this.purchases.getOfferings(), tier);
        if (!pkg) return { success: false, error: "no offering configured" };
        const { customerInfo } = await this.purchases.purchase({ rcPackage: pkg });
        const entitlements = customerInfo?.entitlements?.active ?? {};
        // propagate ALL active entitlements (one purchase may grant several)
        for (const ent of Object.values(ENTITLEMENTS)) {
          if (entitlements[ent]) this.setEntitlement(ent, true);
        }
        const entId = tier === 'founder' ? ENTITLEMENTS.founder : ENTITLEMENTS.insider;
        return { success: this.isInsider() || this.isFounder(), entitlement: entId, tier };
      } catch (err) {
        if (/cancel/i.test(String(err?.errorCode ?? err)))
          return { success: false, cancelled: true };
        console.warn("RevenueCat purchase error:", err);
        return { success: false, error: err };
      }
    }
    // Web Test Store — simulate the appropriate entitlement
    await new Promise((r) => setTimeout(r, 400));
    if (tier === 'founder') this.setEntitlement(ENTITLEMENTS.founder, true);
    else                    this.setEntitlement(ENTITLEMENTS.insider, true);
    return { success: true, tier, entitlement: tier === 'founder' ? ENTITLEMENTS.founder : ENTITLEMENTS.insider };
  }

  purchasePass()    { return this._purchase('monthly'); }
  purchaseYearly()  { return this._purchase('yearly');  }
  purchaseFounder() { return this._purchase('founder'); }

  async restorePass() {
    if (this.purchases) {
      try {
        const info = await this.purchases.getCustomerInfo();
        for (const ent of Object.values(ENTITLEMENTS)) {
          this.setEntitlement(ent, Boolean(info?.entitlements?.active?.[ent]));
        }
      } catch {
        /* keep current state */
      }
      return { success: this.isInsider() || this.isFounder() };
    }
    this.setEntitlement(ENTITLEMENTS.insider, true);
    return { success: true };
  }

  cancelPass() {
    // Test-store convenience only — real Web Billing subs cancel through the
    // RevenueCat customer portal, not client SDK calls.
    this.setSubscribed(false);
    try {
      store()?.removeItem("grunds_subscribed");
      store()?.removeItem("grunds_insider");
    } catch {}
    return { success: true };
  }
}

export const billing = new BillingManager();
