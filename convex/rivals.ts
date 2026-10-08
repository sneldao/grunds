import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Async rivals — the seed-scoped ghost. publishRivalDay upserts one
// rivalWeeks row per (seed, owner) and patches in the day's closing tally,
// so a week reads day-by-day as it happens. rivalFor hands the next player
// on the seed somebody else's week to race: prefer a finished ledger, then
// the busiest partial; never your own row.

const dayEntry = v.object({
  day: v.number(),
  served: v.number(),
  till: v.number(),
  rep: v.number(),
});

export const publishRivalDay = mutation({
  args: {
    seed: v.number(),
    owner: v.string(),
    standName: v.string(),
    playerName: v.string(),
    day: dayEntry,
    status: v.union(v.literal("open"), v.literal("done")),
    netWorth: v.optional(v.number()),
    reputation: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = args.owner.slice(0, 40);
    const rows = await ctx.db
      .query("rivalWeeks")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .collect();
    const row = rows.find((r) => r.owner === owner);
    const days = row ? row.days.filter((d) => d.day !== args.day.day) : [];
    days.push(args.day);
    days.sort((a, b) => a.day - b.day);
    const weekServed = days.reduce((s, d) => s + d.served, 0);
    const patch = {
      standName: args.standName.slice(0, 40),
      playerName: args.playerName.slice(0, 24),
      days,
      weekServed,
      status: args.status,
      netWorth: args.netWorth,
      reputation: args.reputation,
      updatedAt: Date.now(),
    };
    if (row) {
      await ctx.db.patch(row._id, patch);
      return row._id;
    }
    return await ctx.db.insert("rivalWeeks", { seed: args.seed, owner, ...patch });
  },
});

export const rivalFor = query({
  args: { seed: v.number(), owner: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("rivalWeeks")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .collect();
    const others = rows.filter((r) => r.owner !== args.owner && r.days.length > 0);
    if (!others.length) return null;
    // A finished week outranks a partial one; ties break on cups poured,
    // then recency — the liveliest opponent the street remembers.
    others.sort((a, b) =>
      (b.status === "done" ? 1 : 0) - (a.status === "done" ? 1 : 0)
      || b.weekServed - a.weekServed
      || b.updatedAt - a.updatedAt);
    const g = others[0];
    return {
      owner: g.owner,
      standName: g.standName,
      playerName: g.playerName,
      days: g.days,
      weekServed: g.weekServed,
      netWorth: g.netWorth,
      reputation: g.reputation,
      status: g.status,
    };
  },
});
