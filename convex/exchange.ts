import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  CAMPAIGN_TUNING,
  DRIFT,
  EVENTS,
  REGULAR_ROSTER,
  priceForDay,
  seededRandom,
} from "./gameConfig";

// The Exchange on Convex — the Gamble clock, server-side.
// Ports web/js/exchange.js + gentrification.js: drift first (baseline creep),
// then the pity-timer event roll (deviation on top).

export const getCampaign = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.campaignId);
  },
});

export const getHistory = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("marketEvents")
      .withIndex("by_campaign_day", (q) => q.eq("campaignId", args.campaignId))
      .collect();
  },
});

export const costPerCup = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) return null;
    const basis = c.contractPrice ?? c.beanIndex;
    return basis * CAMPAIGN_TUNING.beanBaseCost;
  },
});

// Create a campaign + seed its regulars and friendship edges in one mutation
// so the first client never sees a half-built district.
export const createCampaign = mutation({
  args: { seed: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const seed = args.seed ?? 7;
    const now = Date.now();
    const campaignId = await ctx.db.insert("campaigns", {
      seed,
      day: 0,
      beanIndex: 1.0,
      lastTier: undefined,
      matchaPrice: priceForDay(1),
      debt: 0,
      contractPrice: undefined,
      contractUnits: undefined,
      contractFee: undefined,
      till: 0,
      reputation: CAMPAIGN_TUNING.startReputation,
      status: "open",
      createdAt: now,
    });
    for (const r of REGULAR_ROSTER) {
      await ctx.db.insert("regulars", {
        campaignId,
        name: r.name,
        coh: r.coh,
        quirk: r.quirk,
        op: 0.15,
        seen: false,
        served: 0,
        balked: 0,
      });
    }
    const seenPairs = new Set<string>();
    for (const r of REGULAR_ROSTER) {
      for (const f of r.friends) {
        const key = [r.name, f].sort().join("|");
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        await ctx.db.insert("friendships", { campaignId, a: [r.name, f].sort()[0], b: [r.name, f].sort()[1] });
      }
    }
    return campaignId;
  },
});

// Dawn tick: day++, drift (bean creep + matcha curve), pity-timer roll,
// persist the marketEvents row. Deterministic per seed+day.
export const openDay = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) throw new Error("campaign not found");
    if (c.status !== "open") throw new Error("campaign is done");

    const day = c.day + 1;
    const beanAfterDrift = Math.min(DRIFT.maxIndex, c.beanIndex + DRIFT.perDay);
    const matchaPrice = priceForDay(day);

    // Weighted pool with the pity timer: no two catastrophes in a row;
    // after a catastrophe, bias toward recovery (good/calm only).
    const pool: string[] = [];
    for (const [id, e] of Object.entries(EVENTS)) {
      let w = e.weight;
      if (e.tier === "cata" && c.lastTier === "cata") w = 0;
      if (c.lastTier === "cata" && e.tier !== "good" && e.tier !== "calm") w *= 0.35;
      for (let i = 0; i < Math.round(w); i++) pool.push(id);
    }
    const rng = seededRandom(c.seed * 100003 + day * 917);
    const eventId = pool[Math.floor(rng() * pool.length)] ?? "stable";
    const def = EVENTS[eventId];
    const beanIndex = Math.max(0.6, Math.min(2.6, beanAfterDrift + def.dIndex));

    await ctx.db.patch(args.campaignId, {
      day,
      beanIndex,
      lastTier: def.tier,
      matchaPrice,
    });
    await ctx.db.insert("marketEvents", {
      campaignId: args.campaignId,
      day,
      eventId,
      tier: def.tier,
      dIndex: def.dIndex,
      head: def.head,
      line: def.line,
      beanIndexAfter: beanIndex,
    });
    return { day, eventId, tier: def.tier, beanIndex, matchaPrice };
  },
});

// Reply-to-command: lock today's price into a forward contract (debt clock).
export const contractBeans = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) throw new Error("campaign not found");
    if (c.contractUnits !== undefined) return { ok: false as const, why: "already contracted" };
    await ctx.db.patch(args.campaignId, {
      contractPrice: c.beanIndex,
      contractUnits: CAMPAIGN_TUNING.contractUnits,
      contractFee: CAMPAIGN_TUNING.contractFee,
      debt: c.debt + CAMPAIGN_TUNING.contractFee,
    });
    return { ok: true as const, debt: c.debt + CAMPAIGN_TUNING.contractFee };
  },
});

// Burn contract units per cup served. Clears exactly at zero.
export const consumeContract = mutation({
  args: { campaignId: v.id("campaigns"), n: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) throw new Error("campaign not found");
    if (c.contractUnits === undefined) return { consumed: false as const };
    const left = Math.max(0, c.contractUnits - (args.n ?? 1));
    if (left === 0) {
      await ctx.db.patch(args.campaignId, {
        contractPrice: undefined,
        contractUnits: undefined,
        contractFee: undefined,
      });
    } else {
      await ctx.db.patch(args.campaignId, { contractUnits: left });
    }
    return { consumed: true as const, left };
  },
});

export const settleDebt = mutation({
  args: { campaignId: v.id("campaigns"), amount: v.number() },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) throw new Error("campaign not found");
    const paid = Math.min(args.amount, c.debt);
    await ctx.db.patch(args.campaignId, { debt: c.debt - paid });
    return { ok: true as const, paid, debt: c.debt - paid };
  },
});

// Dawn mirror from the static floor: upserts the externally-simulated state
// onto the campaign so the dashboard and leaderboard read live games.
// Only whitelisted sim fields are patched — contracts/debt stay authoritative
// to reply-to-command mutations.
export const mirrorState = mutation({
  args: {
    campaignId: v.id("campaigns"),
    day: v.optional(v.number()),
    beanIndex: v.optional(v.number()),
    matchaPrice: v.optional(v.number()),
    till: v.optional(v.number()),
    reputation: v.optional(v.number()),
    debt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) throw new Error("campaign not found");
    const patch: {
      day?: number;
      beanIndex?: number;
      matchaPrice?: number;
      till?: number;
      reputation?: number;
      debt?: number;
    } = {};
    if (args.day !== undefined) patch.day = args.day;
    if (args.beanIndex !== undefined) patch.beanIndex = args.beanIndex;
    if (args.matchaPrice !== undefined) patch.matchaPrice = args.matchaPrice;
    if (args.till !== undefined) patch.till = args.till;
    if (args.reputation !== undefined) patch.reputation = args.reputation;
    if (args.debt !== undefined) patch.debt = args.debt;
    if (Object.keys(patch).length > 0) await ctx.db.patch(args.campaignId, patch);
    return { ok: true as const };
  },
});
