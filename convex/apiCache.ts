import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Tiny TTL cache over apiCache. Actions reach it via runQuery/runMutation.
// Reads ignore expired rows; writes GC up to 50 expired rows inline so the
// table stays flat without a cron.

export const cacheGet = query({
  args: { key: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    const row = await ctx.db
      .query("apiCache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (!row) return null;
    if (row.expiresAt <= Date.now()) return null;
    return row.value;
  },
});

export const cachePut = mutation({
  args: { key: v.string(), value: v.string(), ttlMs: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("apiCache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        createdAt: now,
        expiresAt: now + args.ttlMs,
      });
    } else {
      await ctx.db.insert("apiCache", {
        key: args.key,
        value: args.value,
        createdAt: now,
        expiresAt: now + args.ttlMs,
      });
    }
    const stale = await ctx.db.query("apiCache").take(50);
    for (const row of stale) {
      if (row.expiresAt <= now) await ctx.db.delete(row._id);
    }
  },
});

// Daily spend guard: bumps a UTC-date counter stored in the same table
// (26h TTL) and returns the new count. Actions claim a slot before any
// uncached upstream call; over-budget claims get the templated fallback,
// so a public endpoint can never burn past the day's allowance.
export const claimDaily = mutation({
  args: { name: v.string() },
  handler: async (ctx, args): Promise<number> => {
    const now = Date.now();
    const key = `budget:${args.name}:${new Date().toISOString().slice(0, 10)}`;
    const row = await ctx.db
      .query("apiCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const count = (row && row.expiresAt > now ? Number(row.value) || 0 : 0) + 1;
    const expiresAt = now + 26 * 60 * 60 * 1000;
    if (row) {
      await ctx.db.patch(row._id, { value: String(count), expiresAt });
    } else {
      await ctx.db.insert("apiCache", {
        key,
        value: "1",
        createdAt: now,
        expiresAt,
      });
    }
    return count;
  },
});

// Hand a claimed slot back when the upstream call failed without billing
// (e.g. Mint's safety check refusing at creation — a refund-free flake that
// must not eat the day's budget, which exists to cap real spend).
export const refundDaily = mutation({
  args: { name: v.string() },
  handler: async (ctx, args): Promise<number> => {
    const now = Date.now();
    const key = `budget:${args.name}:${new Date().toISOString().slice(0, 10)}`;
    const row = await ctx.db
      .query("apiCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!row || row.expiresAt <= now) return 0;
    const count = Math.max(0, (Number(row.value) || 0) - 1);
    await ctx.db.patch(row._id, { value: String(count) });
    return count;
  },
});

// Deterministic string hash (djb2, hex) for cache keys. Not cryptographic —
// just a compact fingerprint so identical sim outputs share cached prose.
export function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
