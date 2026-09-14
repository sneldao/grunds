import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { hashKey } from "./apiCache";
import { LINKUP_RESEARCH_QUERY } from "./linkup";

// The wire, merged. /ai/research fans out to two independent pipes —
// Linkup deep research AND Firecrawl's crawled commodity news — dedupes
// their deck shifts per event, *boosts* a shift both pipes agree on
// (corroboration is signal, not duplication), then asks OpenAI to write
// the "why this matters" line the Morning Brief prints under the headline.
//
// The merged payload is cached under research:wire:v1:<query> — the
// server-side dawn roll in exchange.openDay reads that key first, so a
// judge email/CLI campaign tilts off the same merged feed the browser sees.
//
// Fallback chain: no keys → both pipes fall back → fallback:true and the
// seeded pity-timer deck runs untouched. One pipe down → the other still
// tilts. Every stage degrades gracefully.

export const WIRE_TTL_MS = 6 * 60 * 60 * 1000;
export const WIRE_CACHE_KEY = `research:wire:v1:${hashKey(LINKUP_RESEARCH_QUERY)}`;

interface WireSource {
  title: string;
  url: string;
  snippet?: string;
  origin?: string;
}
interface WireShift {
  eventId: string;
  weightMul: number;
  reason: string;
  corroborated?: boolean;
}
export interface WireResearchResult {
  fallback: boolean;
  cached: boolean;
  feed: string[];
  summary: string;
  sources: WireSource[];
  marketShift: WireShift[];
}

function normalizeSources(
  linkup: { title: string; url: string; snippet?: string }[],
  firecrawl: ({ title: string; url: string; snippet?: string } | string)[],
): WireSource[] {
  const seen = new Set<string>();
  const out: WireSource[] = [];
  for (const [origin, list] of [["linkup", linkup], ["firecrawl", firecrawl]] as const) {
    for (const s of list) {
      const src: WireSource = typeof s === "string" ? { title: s, url: s } : s;
      if (!src.url || seen.has(src.url)) continue;
      seen.add(src.url);
      out.push({ ...src, origin });
    }
  }
  return out.slice(0, 6);
}

export const wireResearch = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<WireResearchResult> => {
    if (!args.force) {
      const hit = await ctx.runQuery(api.apiCache.cacheGet, { key: WIRE_CACHE_KEY });
      if (hit) return { ...(JSON.parse(hit) as WireResearchResult), cached: true };
    }

    const [linkup, firecrawl] = await Promise.all([
      ctx.runAction(api.linkup.searchCommodityIntelligence, {}),
      ctx.runAction(api.firecrawl.fetchCommodityNews, {}),
    ]);

    // Merge deck shifts — one entry per eventId; when both pipes flag the
    // same card, the corroboration lifts the weight 15% rather than stacking.
    const shifts = new Map<string, WireShift>();
    for (const s of linkup.marketShift) {
      shifts.set(s.eventId, { ...s, corroborated: false });
    }
    for (const s of firecrawl.suggestions) {
      const prev = shifts.get(s.eventId);
      if (!prev) {
        shifts.set(s.eventId, {
          eventId: s.eventId,
          weightMul: s.weightMul,
          reason: `Crawled desk note — ${s.reason}`,
          corroborated: false,
        });
      } else {
        prev.weightMul = Math.min(3, Math.max(prev.weightMul, s.weightMul) * 1.15);
        prev.corroborated = true;
        prev.reason = `${prev.reason} — corroborated by crawled news`;
      }
    }

    const marketShift = [...shifts.values()].sort((a, b) => b.weightMul - a.weightMul).slice(0, 3);
    const sources = normalizeSources(linkup.sources, firecrawl.sources);

    // OpenAI writes the "why this matters" for the strongest shift — the
    // line the Brief prints under the wire headlines.
    if (marketShift.length && process.env.OPENAI_API_KEY) {
      const top = marketShift[0];
      const heads = sources.slice(0, 3).map((s) => s.title);
      const why = await ctx.runAction(api.openai.wireWhy, {
        eventId: top.eventId,
        headlines: heads,
      });
      if (!why.fallback && why.text) top.reason = why.text;
    }

    const feed = [linkup.fallback ? null : "linkup", firecrawl.fallback ? null : "firecrawl"].filter(
      (x): x is string => !!x,
    );
    const payload: WireResearchResult = {
      fallback: feed.length === 0,
      cached: false,
      feed,
      summary: `wire merged — ${feed.join(" + ") || "no live pipes"} · ${marketShift.length} tilts`,
      sources,
      marketShift,
    };
    await ctx.runMutation(api.apiCache.cachePut, {
      key: WIRE_CACHE_KEY,
      value: JSON.stringify(payload),
      ttlMs: WIRE_TTL_MS,
    });
    return payload;
  },
});

// Nightly refresh alongside the two pipe crons — keeps the merged key warm
// so server-side dawn rolls never read a stale wire.
export const refreshWire = internalAction({
  args: {},
  handler: async (ctx): Promise<{ refreshed: boolean; tilts: number }> => {
    const res: WireResearchResult = await ctx.runAction(api.research.wireResearch, { force: true });
    return { refreshed: !res.fallback, tilts: res.marketShift.length };
  },
});
