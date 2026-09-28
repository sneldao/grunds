import { query, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { LOT_CATALOG, STARTER_STOCK } from "./gameConfig";

// Phase 2 — physical coffee inventory, server mirror. Purchases, scheduled
// wire moves, and unlock windows live here; intra-day pours are floor-sim
// (the client cellar in web/js/lots.js is the pour truth, like gossip).

export async function ensureLots(ctx: MutationCtx, campaignId: Id<"campaigns">) {
  const existing = await ctx.db
    .query("lots")
    .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
    .collect();
  const have = new Set(existing.map((r) => r.lotId));
  for (const [lotId, def] of Object.entries(LOT_CATALOG)) {
    if (have.has(lotId)) continue;
    await ctx.db.insert("lots", {
      campaignId,
      lotId,
      stock: STARTER_STOCK[lotId] ?? 0,
      value: (STARTER_STOCK[lotId] ?? 0) * def.unitBase,
      roastedOn: 1,
      priceMul: 1,
      unlocked: !def.microlot,
      unlockUntil: 0,
      hedgedStock: 0,
    });
  }
}

async function getLot(ctx: MutationCtx, campaignId: Id<"campaigns">, lotId: string) {
  return await ctx.db
    .query("lots")
    .withIndex("by_campaign_lot", (q) =>
      q.eq("campaignId", campaignId).eq("lotId", lotId),
    )
    .unique();
}

export const getLots = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lots")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
  },
});

// Buy cups into a lot (mirrors LotsState.buy: cap, unlock gate, roast-date
// rule). Idempotent per call; the client passes the executed cups.
export const buyLot = mutation({
  args: {
    campaignId: v.id("campaigns"),
    lotId: v.string(),
    cups: v.number(),
    unitPrice: v.number(),
    day: v.number(),
    hedgedUnits: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ensureLots(ctx, args.campaignId);
    const row = await getLot(ctx, args.campaignId, args.lotId);
    const def = LOT_CATALOG[args.lotId];
    if (!row || !def || row.unlocked === false || args.cups <= 0) {
      return { cost: 0 as const, cups: 0 as const };
    }
    let room = args.cups;
    if (def.stockCap) room = Math.min(room, Math.max(0, def.stockCap - row.stock));
    if (room <= 0) return { cost: 0 as const, cups: 0 as const };
    const cost = room * args.unitPrice;
    await ctx.db.patch(row._id, {
      stock: row.stock + room,
      value: row.value + cost,
      roastedOn: row.stock < room * 0.2 ? args.day : row.roastedOn,
      hedgedStock: row.hedgedStock + Math.min(room, args.hedgedUnits ?? 0),
    });
    return { cost, cups: room };
  },
});

// Schedule wire moves at event roll (mirrors LotsState.applyWireEvent).
export async function scheduleLotMoves(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
  moves: { lot: string; mul: number; lag: number }[],
  day: number,
) {
  for (const m of moves) {
    await ctx.db.insert("lotMoves", {
      campaignId,
      lot: m.lot,
      mul: m.mul,
      landDay: day + m.lag,
    });
  }
}

// Unlock a microlot window (mirrors the unlock branch of applyWireEvent).
export async function unlockLot(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
  lotId: string,
  untilDay: number,
) {
  await ensureLots(ctx, campaignId);
  const row = await getLot(ctx, campaignId, lotId);
  if (!row) return;
  await ctx.db.patch(row._id, {
    unlocked: true,
    unlockUntil: Math.max(row.unlockUntil, untilDay),
  });
}

// Land due moves + expire microlot windows. Called from exchange.openDay;
// returns report lines for the Brief. Landing a cerrado move shifts supply
// to Panama: the Gesha window opens (mirrors LotsState.resolveDawn).
export async function landDueMoves(ctx: MutationCtx, campaignId: Id<"campaigns">, day: number) {
  await ensureLots(ctx, campaignId);
  const report: string[] = [];
  const moves = await ctx.db
    .query("lotMoves")
    .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
    .collect();
  for (const m of moves) {
    if (m.landDay > day) continue;
    const row = await getLot(ctx, campaignId, m.lot);
    if (row) {
      await ctx.db.patch(row._id, {
        priceMul: Math.round(row.priceMul * m.mul * 100) / 100,
      });
      const def = LOT_CATALOG[m.lot];
      report.push(
        `${def ? def.name : m.lot} ${m.mul >= 1 ? "+" : ""}${Math.round((m.mul - 1) * 100)}% — landed`,
      );
      if (m.lot === "cerrado") {
        await unlockLot(ctx, campaignId, "gesha", day + 2);
        report.push("Panama Gesha unlocked (2d) — supply shifts");
      }
    }
    await ctx.db.delete(m._id);
  }
  const rows = await ctx.db
    .query("lots")
    .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
    .collect();
  for (const r of rows) {
    const def = LOT_CATALOG[r.lotId];
    if (r.unlocked && def?.microlot && r.unlockUntil > 0 && day > r.unlockUntil) {
      await ctx.db.patch(r._id, { unlocked: false, unlockUntil: 0 });
      report.push(`${def.name} window closed`);
    }
  }
  return report;
}
