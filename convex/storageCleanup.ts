import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Storage maintenance (tools/storage-audit.mjs drives these).
//
// App-owned `_storage` has exactly one writer: tripo.persist — every object
// should be reachable from a tripoAssets modelUrl/previewUrl. The serving
// URL carries a UUID encoding of the doc id, so audit resolves each
// _storage id to its URL here (getUrl is the only public way back).
//
// deleteOrphans deletes only ids whose URL no tripoAssets row references —
// the guard runs server-side, so a stale audit list can never drop a live
// asset.

export const storageIdMap = internalAction({
  args: { ids: v.array(v.id("_storage")) },
  handler: async (ctx, args): Promise<{ id: string; url: string | null }[]> => {
    const out: { id: string; url: string | null }[] = [];
    for (const id of args.ids) {
      let url: string | null = null;
      try {
        url = await ctx.storage.getUrl(id);
      } catch {
        url = null; // tombstone — already deleted elsewhere
      }
      out.push({ id, url });
    }
    return out;
  },
});

export const deleteOrphans = internalMutation({
  args: { ids: v.array(v.id("_storage")) },
  handler: async (ctx, args): Promise<{ deleted: number; kept: number }> => {
    const assets = await ctx.db.query("tripoAssets").collect();
    const refs = new Set<string>();
    for (const a of assets)
      for (const u of [a.modelUrl, a.previewUrl]) {
        const m = /\/api\/storage\/([0-9a-f-]+)/i.exec(u ?? "");
        if (m) refs.add(m[1]);
      }
    let deleted = 0, kept = 0;
    for (const id of args.ids) {
      const url = await ctx.storage.getUrl(id).catch(() => null);
      const uuid = url ? /\/api\/storage\/([0-9a-f-]+)/i.exec(url)?.[1] : null;
      if (uuid && refs.has(uuid)) {
        kept++;
        continue;
      }
      await ctx.storage.delete(id);
      deleted++;
    }
    return { deleted, kept };
  },
});
