import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { hashKey } from "./apiCache";

// Linkup Deep Research for Grunds — server-side only, key-gated.
// Uses Linkup's search API (https://api.linkup.so/v1/search) to query live
// coffee commodity market trends, shipping news, and harvest reports.
// The search findings dynamically influence the market deck weights and are
// cited with live source URLs in the Roaster's Letter.
//
// Cost control: responses cached 6h by query in apiCache table.

export const LINKUP_TTL_MS = 6 * 60 * 60 * 1000;

export interface CommodityResearchResult {
  fallback: boolean;
  cached: boolean;
  query: string;
  summary: string;
  sources: { title: string; url: string; snippet?: string }[];
  marketShift: { eventId: string; weightMul: number; reason: string }[];
}

const RESEARCH_KEYWORDS: { pattern: RegExp; eventId: string; weightMul: number; reason: string }[] = [
  { pattern: /frost|freeze|minas gerais|cold snap/i, eventId: "frost_minas", weightMul: 1.7, reason: "Brazil frost intelligence reported via Linkup Deep Search" },
  { pattern: /drought|dry weather|east africa|rainfall shortage/i, eventId: "drought_ea", weightMul: 1.5, reason: "East Africa drought alert detected via Linkup Deep Search" },
  { pattern: /record harvest|bumper crop|surplus|arabica supply up/i, eventId: "harvest_good", weightMul: 1.6, reason: "Record harvest projection confirmed via Linkup Deep Search" },
  { pattern: /matcha surge|viral matcha|ceremonial supply/i, eventId: "hype_matcha", weightMul: 1.5, reason: "Matcha demand surge tracked via Linkup Deep Search" },
  { pattern: /shipping delay|port congestion|freight rate/i, eventId: "rumour_frost", weightMul: 1.4, reason: "Supply chain bottleneck reported via Linkup Deep Search" },
];

export const searchCommodityIntelligence = action({
  args: { query: v.optional(v.string()), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<CommodityResearchResult> => {
    const query = args.query ?? "global arabica coffee commodity prices drought harvest news";
    const cacheKey = `linkup:research:v1:${hashKey(query)}`;

    if (!args.force) {
      const hit = await ctx.runQuery(api.apiCache.cacheGet, { key: cacheKey });
      if (hit) {
        const parsed = JSON.parse(hit) as CommodityResearchResult;
        return { ...parsed, cached: true };
      }
    }

    const key = process.env.LINKUP_API_KEY;
    if (!key) {
      return {
        fallback: true,
        cached: false,
        query,
        summary: "Linkup API key not configured. Using deterministic coffee commodity models.",
        sources: [],
        marketShift: [],
      };
    }

    try {
      const res = await fetch("https://api.linkup.so/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          depth: "standard",
          outputType: "searchResults",
        }),
      });

      if (!res.ok) throw new Error(`linkup ${res.status}`);

      const data = (await res.json()) as {
        results?: { name?: string; url?: string; snippet?: string }[];
      };

      const results = data.results ?? [];
      const sources = results.slice(0, 5).map((r) => ({
        title: r.name ?? "Market Intelligence Source",
        url: r.url ?? "",
        snippet: r.snippet,
      }));

      const marketShift: CommodityResearchResult["marketShift"] = [];
      for (const r of results) {
        const combined = `${r.name ?? ""} ${r.snippet ?? ""}`;
        for (const kw of RESEARCH_KEYWORDS) {
          if (kw.pattern.test(combined)) {
            marketShift.push({
              eventId: kw.eventId,
              weightMul: kw.weightMul,
              reason: `${kw.reason}: ${(r.name ?? "").slice(0, 80)}`,
            });
            break;
          }
        }
      }

      const payload: CommodityResearchResult = {
        fallback: false,
        cached: false,
        query,
        summary: `Linkup Deep Research processed ${results.length} market sources.`,
        sources,
        marketShift,
      };

      await ctx.runMutation(api.apiCache.cachePut, {
        key: cacheKey,
        value: JSON.stringify(payload),
        ttlMs: LINKUP_TTL_MS,
      });

      return payload;
    } catch {
      return {
        fallback: true,
        cached: false,
        query,
        summary: "Linkup search request failed, falling back to local market deck.",
        sources: [],
        marketShift: [],
      };
    }
  },
});

export const refreshLinkupIntelligence = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; marketShifts: number }> => {
    const res: CommodityResearchResult = await ctx.runAction(
      api.linkup.searchCommodityIntelligence,
      { force: true },
    );
    return {
      success: !res.fallback,
      marketShifts: res.marketShift.length,
    };
  },
});
