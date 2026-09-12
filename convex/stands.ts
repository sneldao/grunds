import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Stands leaderboard — one row per (campaign, owner). The floor mirrors its
// till + reputation each dawn under a stable owner name (localStorage), so
// the dashboard shows every café racing through the same week.

export const recordStand = mutation({
  args: {
    campaignId: v.id("campaigns"),
    ownerName: v.string(),
    till: v.number(),
    reputation: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("stands")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    const row = rows.find((r) => r.ownerName === args.ownerName);
    if (row) {
      await ctx.db.patch(row._id, { till: args.till, reputation: args.reputation });
      return row._id;
    }
    return await ctx.db.insert("stands", {
      campaignId: args.campaignId,
      ownerName: args.ownerName.slice(0, 40),
      till: args.till,
      reputation: args.reputation,
    });
  },
});

export const topStands = query({
  args: { campaignId: v.id("campaigns"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("stands")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    rows.sort((a, b) => b.till - a.till);
    return rows.slice(0, args.limit ?? 10).map((r) => ({
      ownerName: r.ownerName,
      till: Math.round(r.till * 100) / 100,
      reputation: r.reputation,
    }));
  },
});
