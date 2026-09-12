import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { EXPECTATION, clamp } from "./gameConfig";

// The Regulars on Convex — persistent opinion + friendship contagion.
// Ports web/js/regulars.js + gentrification.js applyExpectation.
// Contagion: each regular pulls 5% toward the mean of friends' opinions.

const CONTAGION = 0.05;

export const listRegulars = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("regulars")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
  },
});

export const getReputation = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const regs = await ctx.db
      .query("regulars")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    if (regs.length === 0) return 62;
    const m = regs.reduce((s, r) => s + r.op, 0) / regs.length;
    return Math.round(clamp(62 + m * 38, 0, 100));
  },
});

export const listFriendships = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("friendships")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
  },
});

// Mark one unseen regular of a cohort as present today. Returns the pick so
// the floor can flag the mesh (brass-band hat + greeting bubble).
export const markSeen = mutation({
  args: { campaignId: v.id("campaigns"), cohort: v.string() },
  handler: async (ctx, args) => {
    const cands = await ctx.db
      .query("regulars")
      .withIndex("by_campaign_coh", (q) =>
        q.eq("campaignId", args.campaignId).eq("coh", args.cohort),
      )
      .collect();
    const unseen = cands.filter((r) => !r.seen);
    if (unseen.length === 0) return { found: false as const };
    const pick = unseen[Math.floor(Math.random() * unseen.length)];
    await ctx.db.patch(pick._id, { seen: true });
    return { found: true as const, name: pick.name, coh: pick.coh };
  },
});

export const unsee = mutation({
  args: { campaignId: v.id("campaigns"), name: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("regulars")
      .withIndex("by_campaign_name", (q) =>
        q.eq("campaignId", args.campaignId).eq("name", args.name),
      )
      .unique();
    if (row) await ctx.db.patch(row._id, { seen: false });
    return { ok: true as const };
  },
});

// End-of-day: expectation pressure (day * cohort delta on seen regulars),
// then outcome delta on seen regulars, then one contagion round.
// Must run before the next openDay so gossip spreads the pressure.
export const resolveDay = mutation({
  args: {
    campaignId: v.id("campaigns"),
    day: v.number(),
    served: v.number(),
    balked: v.number(),
    defections: v.number(),
    priced: v.boolean(),
  },
  handler: async (ctx, args) => {
    const regs = await ctx.db
      .query("regulars")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    const edges = await ctx.db
      .query("friendships")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    const happy = clamp(args.served / 60, 0, 1);
    const afterDay: Map<string, number> = new Map();
    for (const r of regs) {
      if (!r.seen) {
        afterDay.set(r.name, r.op);
        continue;
      }
      let op = r.op + (EXPECTATION[r.coh] ?? 0) * args.day;
      op += (happy - 0.5) * 0.1;
      if (args.balked > args.served * 0.18) op -= 0.05;
      if (args.defections > 8) op -= 0.03;
      if (args.priced && r.coh === "students") op += 0.04;
      afterDay.set(r.name, clamp(op, -1, 1));
    }

    // Two-pass contagion along the friendship edges.
    const adj = new Map<string, string[]>();
    for (const r of regs) adj.set(r.name, []);
    for (const e of edges) {
      adj.get(e.a)?.push(e.b);
      adj.get(e.b)?.push(e.a);
    }
    const next = new Map<string, number>();
    for (const r of regs) {
      const friends = adj.get(r.name) ?? [];
      if (friends.length === 0) {
        next.set(r.name, afterDay.get(r.name) ?? r.op);
        continue;
      }
      const mean =
        friends.reduce((s, f) => s + (afterDay.get(f) ?? 0), 0) / friends.length;
      const cur = afterDay.get(r.name) ?? r.op;
      next.set(r.name, clamp(cur + (mean - cur) * CONTAGION, -1, 1));
    }

    for (const r of regs) {
      await ctx.db.patch(r._id, {
        op: next.get(r.name) ?? r.op,
        seen: false,
        served: 0,
        balked: 0,
      });
    }

    const ops = [...next.values()];
    const reputation = Math.round(
      clamp(62 + (ops.reduce((s, x) => s + x, 0) / Math.max(1, ops.length)) * 38, 0, 100),
    );
    await ctx.db.patch(args.campaignId, { reputation });
    return { reputation };
  },
});
