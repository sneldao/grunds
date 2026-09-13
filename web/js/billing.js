// RevenueCat Web Billing — District Insider Pass subscriptions for Grunds.
// Live path: @revenuecat/purchases-js, loaded from CDN only when a Web Billing
// public API key is configured. Test path: the Web Test Store — same
// entitlement shape, simulated locally, so the paywall demos end-to-end
// before production keys land.
//
// Configure the key via RC_API_KEY below, ?rc=<key>, or localStorage
// 'grunds.rcKey'. Web Billing *public* SDK keys are designed to ship in
// client code — secret keys never enter the repo.

export const ENTITLEMENT_ID = "commodity_insider";
export const PRODUCT_ID = "rc_district_insider_monthly";

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
    this.subscribed = store()?.getItem("grunds_subscribed") === "true";
    this.listeners = new Set();
    this.purchases = null; // live Purchases instance when a key is configured
    this.testKey = false; // test_ key → real SDK, simulated checkout
    this.appUserId = null;
  }

  get mode() {
    if (!this.purchases) return "test store";
    return this.testKey ? "test store · live SDK" : "web billing";
  }

  isSubscribed() {
    return this.subscribed;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this.subscribed);
  }

  setSubscribed(v) {
    this.subscribed = v;
    try {
      store()?.setItem("grunds_subscribed", String(v));
    } catch {
      /* private mode */
    }
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
      this.setSubscribed(Boolean(info?.entitlements?.active?.[ENTITLEMENT_ID]));
    } catch (err) {
      console.warn("RevenueCat init failed — Web Test Store stays active:", err);
      this.purchases = null;
    }
    return this.mode;
  }

  // Live price from the configured offering ("$9.99/mo"), or the display
  // price when the SDK isn't loaded.
  async priceLabel() {
    if (this.purchases) {
      try {
        const off = await this.purchases.getOfferings();
        const pkg = this._pickPackage(off);
        const prod = pkg?.rcBillingProduct ?? pkg?.product;
        const fmt = prod?.currentPrice?.formattedPrice;
        if (fmt) return `${fmt}/mo`;
      } catch {
        /* fall through to display price */
      }
    }
    return "£4.99/mo";
  }

  _pickPackage(offerings) {
    const pkgs = offerings?.current?.availablePackages ?? [];
    return pkgs.find((p) => /month/i.test(p.identifier ?? "")) ?? pkgs[0];
  }

  async purchasePass() {
    if (this.purchases) {
      try {
        const pkg = this._pickPackage(await this.purchases.getOfferings());
        if (!pkg) return { success: false, error: "no offering configured" };
        const { customerInfo } = await this.purchases.purchase({
          rcPackage: pkg,
        });
        this.setSubscribed(
          Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]),
        );
        return { success: this.subscribed, entitlement: ENTITLEMENT_ID };
      } catch (err) {
        if (/cancel/i.test(String(err?.errorCode ?? err)))
          return { success: false, cancelled: true };
        console.warn("RevenueCat purchase error:", err);
        return { success: false, error: err };
      }
    }
    // Web Test Store — same entitlement shape, simulated checkout.
    await new Promise((r) => setTimeout(r, 400));
    this.setSubscribed(true);
    return { success: true, entitlement: ENTITLEMENT_ID };
  }

  async restorePass() {
    if (this.purchases) {
      try {
        const info = await this.purchases.getCustomerInfo();
        this.setSubscribed(Boolean(info?.entitlements?.active?.[ENTITLEMENT_ID]));
      } catch {
        /* keep current state */
      }
      return { success: this.subscribed };
    }
    this.setSubscribed(true);
    return { success: true };
  }

  cancelPass() {
    // Test-store convenience only — real Web Billing subs cancel through the
    // RevenueCat customer portal, not client SDK calls.
    this.setSubscribed(false);
    try {
      store()?.removeItem("grunds_subscribed");
    } catch {
      /* private mode */
    }
    return { success: true };
  }
}

export const billing = new BillingManager();
