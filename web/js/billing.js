// RevenueCat Web Test Store / Subscription Integration for Grunds.
// Provides "District Insider / Commodity Trader Pass" subscription entitlements.

export const ENTITLEMENT_ID = "commodity_insider";
export const PRODUCT_ID = "rc_district_insider_monthly";

class BillingManager {
  constructor() {
    this.subscribed = localStorage.getItem("grunds_subscribed") === "true";
    this.listeners = new Set();
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

  async purchasePass() {
    // Web Test Store purchase simulation with RevenueCat payload formatting
    try {
      if (window.Purchases && window.Purchases.shared) {
        // Live RevenueCat SDK if configured on window
        const res = await window.Purchases.shared.purchasePackage({
          identifier: "$rc_monthly",
          packageType: "MONTHLY",
          product: { identifier: PRODUCT_ID, priceString: "£4.99" },
        });
        this.subscribed = Boolean(res?.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);
      } else {
        // Test Store Fallback
        await new Promise((r) => setTimeout(r, 400));
        this.subscribed = true;
      }
      localStorage.setItem("grunds_subscribed", String(this.subscribed));
      this.notify();
      return { success: true, entitlement: ENTITLEMENT_ID };
    } catch (err) {
      console.warn("RevenueCat purchase error:", err);
      return { success: false, error: err };
    }
  }

  restorePass() {
    this.subscribed = true;
    localStorage.setItem("grunds_subscribed", "true");
    this.notify();
    return { success: true };
  }

  cancelPass() {
    this.subscribed = false;
    localStorage.removeItem("grunds_subscribed");
    this.notify();
    return { success: true };
  }
}

export const billing = new BillingManager();
