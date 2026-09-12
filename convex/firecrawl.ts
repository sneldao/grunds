import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { hashKey } from "./apiCache";

// Firecrawl seed for the Exchange event deck — server-side only, key-gated.
// Without FIRECRAWL_API_KEY this returns { fallback: true } and the game
// keeps its seeded pity-timer deck. With a key, it searches commodity coffee
// news and maps headlines to deck-weight suggestions the nightly tick can
// apply (frost/drought talk → catastrophe weight up; clean harvest → down).
//
// Cost control: responses are cached 6h per query (commodity news moves
// daily, not per dawn), so a 5-day campaign costs ~1 search, not 5.
// Pass force: true to bypass the cache for a fresh pull.

export const FIRECRAWL_TTL_MS = 6 * 60 * 60 * 1000;

export interface DeckSuggestion {
  eventId: string;
  weightMul: number;
  reason: string;
}

const KEYWORD_MAP: { pattern: RegExp; eventId: string; weightMul: number }[] = [
  { pattern: /frost|freeze|cold front/i, eventId: "frost_minas", weightMul: 1.6 },
  { pattern: /drought|dry|rains failed|short rains/i, eventId: "drought_ea", weightMul: 1.4 },
  { pattern: /bumper|record harvest|clean harvest|surplus/i, eventId: "harvest_good", weightMul: 1.5 },
  { pattern: /matcha|viral|shortage.*matcha|ceremonial/i, eventId: "hype_matcha", weightMul: 1.4 },
  { pattern: /rumour|rumor|forecast.*cold|threat/i, eventId: "rumour_frost", weightMul: 1.3 },
];

export const fetchCommodityNews = action({
  args: { query: v.optional(v.string()), force: v.optional(v.boolean()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ fallback: boolean; cached: boolean; suggestions: DeckSuggestion[]; sources: string[] }> => {
    const query = args.query ?? "arabica coffee frost drought harvest market";
    const cacheKey = `firecrawl:v1:${hashKey(query)}`;
    if (!args.force) {
      const hit = await ctx.runQuery(api.apiCache.cacheGet, { key: cacheKey });
      if (hit) {
        const parsed = JSON.parse(hit) as {
          suggestions: DeckSuggestion[];
          sources: string[];
        };
        return { fallback: false, cached: true, ...parsed };
      }
    }
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) return { fallback: true, cached: false, suggestions: [], sources: [] };
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, limit: 5 }),
      });
      if (!res.ok) throw new Error(`firecrawl ${res.status}`);
      const data = (await res.json()) as {
        data?: { title?: string; url?: string; snippet?: string }[];
      };
      const items = data.data ?? [];
      const suggestions: DeckSuggestion[] = [];
      const sources: string[] = [];
      for (const item of items) {
        const text = `${item.title ?? ""} ${item.snippet ?? ""}`;
        if (item.url) sources.push(item.url);
        for (const rule of KEYWORD_MAP) {
          if (rule.pattern.test(text)) {
            suggestions.push({
              eventId: rule.eventId,
              weightMul: rule.weightMul,
              reason: (item.title ?? "headline").slice(0, 90),
            });
            break;
          }
        }
      }
      const payload = { suggestions, sources: sources.slice(0, 5) };
      await ctx.runMutation(api.apiCache.cachePut, {
        key: cacheKey,
        value: JSON.stringify(payload),
        ttlMs: FIRECRAWL_TTL_MS,
      });
      return { fallback: false, cached: false, ...payload };
    } catch {
      return { fallback: true, cached: false, suggestions: [], sources: [] };
    }
  },
});

// Nightly refresh for the cron: forces a fresh pull into the cache so dawn
// rolls always read news no older than ~24h. No args — the cron owns it.
export const refreshCommodityNews = internalAction({
  args: {},
  handler: async (ctx): Promise<{ refreshed: boolean; suggestions: number }> => {
    const fresh: {
      fallback: boolean;
      cached: boolean;
      suggestions: DeckSuggestion[];
      sources: string[];
    } = await ctx.runAction(api.firecrawl.fetchCommodityNews, {
      query: "arabica coffee frost drought harvest market",
      force: true,
    });
    return {
      refreshed: !fresh.fallback,
      suggestions: fresh.fallback ? 0 : fresh.suggestions.length,
    };
  },
});
