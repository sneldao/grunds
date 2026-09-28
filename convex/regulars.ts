import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { EXPECTATION, clamp, stageFor, CANON_DRINKS } from "./gameConfig";

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
// the floor can flag the mesh (brass-band hat + greeting bubble). Phase 1:
// carries visits/stage so the floor can greet returning faces by history.
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
    return {
      found: true as const,
      name: pick.name,
      coh: pick.coh,
      visits: pick.visits ?? 5,
      stage: pick.stage ?? stageFor(pick.visits ?? 5, pick.op),
      drink: pick.drink ?? CANON_DRINKS[pick.name] ?? "filter",
    };
  },
});

// Phase 1 backfill — patch pre-Phase-1 regular rows (missing identity
// fields) with established-cast defaults. Idempotent: only touches rows
// where the fields are absent. Returns the patched count.
export const ensureIdentityFields = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const regs = await ctx.db
      .query("regulars")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    let patched = 0;
    for (const r of regs) {
      if (
        r.stage !== undefined &&
        r.visits !== undefined &&
        r.faceSeed !== undefined &&
        r.drink !== undefined
      )
        continue;
      const visits = r.visits ?? 5;
      await ctx.db.patch(r._id, {
        stage: r.stage ?? stageFor(visits, r.op),
        visits,
        faceSeed: r.faceSeed ?? r.name,
        drink: r.drink ?? CANON_DRINKS[r.name] ?? "filter",
      });
      patched++;
    }
    return { patched };
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
      const finalOp = next.get(r.name) ?? r.op;
      // Phase 1 — a seen day is a visit; restage against the final opinion.
      // Pre-Phase-1 rows default to 5 visits (the cast starts established).
      const visits = (r.visits ?? 5) + (r.seen ? 1 : 0);
      await ctx.db.patch(r._id, {
        op: finalOp,
        seen: false,
        served: 0,
        balked: 0,
        visits,
        stage: stageFor(visits, finalOp),
        faceSeed: r.faceSeed ?? r.name,
        drink: r.drink ?? CANON_DRINKS[r.name] ?? "filter",
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
