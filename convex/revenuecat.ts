// convex/revenuecat.ts — PR-4e
//
// Entitlement mirror. RevenueCat webhooks (and the manual `setEntitlement`
// mutation, used by Capacitor / restore paths) upsert one row per
// appUserId in the `entitlements` table. The client polls
// /sync/entitlements?appUserId=… on boot to reconcile localStorage-billing
// state, so the Insider / Founder perks survive a hard reset or a device
// hop.
//
// Webhook signature: RevenueCat sends `Authorization: Bearer <secret>`
// and the body itself is a JSON event:
//   { event: { type, id, app_user_id, entitlements: {...} } }
//
// We verify the bearer against `REVENUECAT_WEBHOOK_SECRET`. The handler is
// idempotent — re-delivery of the same event id is a no-op.
//
// Until a real key is configured, the webhook returns 503 (server
// unconfigured) and the manual `setEntitlement` path stays usable for the
// Web Test Store demo.

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const ENT_INSIDER  = "commodity_insider";
const ENT_FOUNDER  = "district_founder";

const isActive = (ent: { expires_date_ms?: number } | undefined) => {
  if (!ent) return false;
  if (ent.expires_date_ms == null) return true;     // one-time (founder) — never expires
  return ent.expires_date_ms > Date.now();
};

// Mirror the active entitlements off a RevenueCat event payload.
export function readEntitlements(ev: { entitlements?: Record<string, { expires_date_ms?: number } | undefined> }) {
  const e = ev.entitlements ?? {};
  return {
    insider: isActive(e[ENT_INSIDER]),
    founder: isActive(e[ENT_FOUNDER]),
  };
}

// Internal mutation — used by the webhook and the manual upsert path.
export const applyEntitlements = internalMutation({
  args: {
    appUserId: v.string(),
    insider: v.boolean(),
    founder: v.boolean(),
    source: v.string(),
    eventId: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.appUserId) throw new Error("appUserId required");
    // idempotency: if eventId already applied to a row, skip
    if (args.eventId) {
      const dup = await ctx.db
        .query("entitlements")
        .withIndex("by_user", (q) => q.eq("appUserId", args.appUserId))
        .first();
      if (dup && dup.eventId === args.eventId) return { idempotent: true };
    }
    const existing = await ctx.db
      .query("entitlements")
      .withIndex("by_user", (q) => q.eq("appUserId", args.appUserId))
      .first();
    // ordering: a redelivered event older than what we already stored must
    // not revive a since-expired (or since-changed) entitlement state.
    if (
      existing?.occurredAt != null &&
      args.occurredAt != null &&
      args.occurredAt < existing.occurredAt
    ) {
      return { stale: true };
    }
    const row = {
      appUserId: args.appUserId.slice(0, 120),
      insider: args.insider,
      founder: args.founder,
      updatedAt: Date.now(),
      source: args.source,
      eventId: args.eventId,
      occurredAt: args.occurredAt,
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { updated: true };
    }
    await ctx.db.insert("entitlements", row);
    return { inserted: true };
  },
});

// Public mutation — manual upsert for the Web Test Store demo (localStorage
// state propagating to Convex so a second device can restore it). This is a
// self-grant path by construction: it MUST vanish the moment real billing is
// live, so it hard-refuses when REVENUECAT_WEBHOOK_SECRET is configured —
// that secret only exists on deployments wired to take money, where the
// webhook is the sole writer. Logic is inlined (rather than calling the
// internal mutation) so the public surface doesn't depend on the internal
// module's resolved types — Convex compiles each module in isolation, and a
// self-referential call makes the handler's return type implicit-any, which
// then cascades into any caller.
export const setEntitlement = mutation({
  args: {
    appUserId: v.string(),
    insider: v.boolean(),
    founder: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ updated: boolean; inserted: boolean }> => {
    if (process.env.REVENUECAT_WEBHOOK_SECRET)
      throw new Error("manual entitlement grants are disabled while RevenueCat webhooks are configured");
    const appUserId = args.appUserId.slice(0, 120);
    const existing = await ctx.db
      .query("entitlements")
      .withIndex("by_user", (q) => q.eq("appUserId", appUserId))
      .first();
    const row = {
      appUserId,
      insider: args.insider,
      founder: args.founder,
      updatedAt: Date.now(),
      source: "manual",
      occurredAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { updated: true, inserted: false };
    }
    await ctx.db.insert("entitlements", row);
    return { updated: false, inserted: true };
  },
});

export const getEntitlements = query({
  args: { appUserId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("entitlements")
      .withIndex("by_user", (q) => q.eq("appUserId", args.appUserId))
      .first();
    return row
      ? {
          appUserId: row.appUserId,
          insider: row.insider,
          founder: row.founder,
          updatedAt: row.updatedAt,
        }
      : { appUserId: args.appUserId, insider: false, founder: false, updatedAt: 0 };
  },
});
