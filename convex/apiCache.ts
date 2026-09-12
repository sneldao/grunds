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

// Deterministic string hash (djb2, hex) for cache keys. Not cryptographic —
// just a compact fingerprint so identical sim outputs share cached prose.
export function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
