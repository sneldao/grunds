import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { hashKey } from "./apiCache";
import { chat } from "./openai";

// Stand spec expansion — the Franchise's AI half. The player's words become
// a structured character card (name, cuisine, crowd, hours, signature, quirk)
// that the deterministic sim consumes as working logic. Cached 7d by prompt
// hash like the prose actions; every failure returns { fallback: true } and
// the client falls back to its seeded classifier — play never blocks.
export const SPEC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const COHORTS = ["commuters", "creatives", "students", "elders", "tourists"];
const TIERS = ["cheap", "mid", "premium"];

// Validate the model's JSON into the shape web/js/standSpec.js normalizeSpec
// expects. Anything unrecognised drops; numbers clamp; enums whitelist.
export function sanitizeStandSpec(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = (x: unknown, n: number) =>
    typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, n) : "";
  let daypart: number[] | null = null;
  if (Array.isArray(o.daypart) && o.daypart.length === 2 &&
      o.daypart.every((n) => Number.isFinite(n))) {
    const a = Math.max(0, Math.min(1440, Math.round(o.daypart[0] as number)));
    const b = Math.max(0, Math.min(1440, Math.round(o.daypart[1] as number)));
    if (b > a) daypart = [a, b];
  }
  const pull = Number.isFinite(o.pull) ? Math.max(0, Math.min(0.3, o.pull as number)) : 0;
  const out: Record<string, unknown> = {
    name: s(o.name, 48),
    cuisine: s(o.cuisine, 32),
    archetype: s(o.archetype, 24) || null,
    cohort: COHORTS.includes(o.cohort as string) ? o.cohort : null,
    daypart,
    pull,
    priceTier: TIERS.includes(o.priceTier as string) ? o.priceTier : null,
    signature: s(o.signature, 48),
    quirk: s(o.quirk, 90),
    source: "llm",
  };
  if (!out.name && !out.cuisine && !out.cohort && !out.daypart && !out.pull) return null;
  return out;
}

// One JSON object, nothing else. The prompt is tight; the reply is parsed
// defensively — a chatty model still yields a usable card or a clean miss.
export const expand = action({
  args: { prompt: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ fallback: boolean; cached: boolean; spec: unknown }> => {
    const prompt = String(args.prompt || "").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!prompt) return { fallback: true, cached: false, spec: null };
    const key = `spec:v1:${hashKey(prompt)}`;
    if (!args.force) {
      const hit: string | null = await ctx.runQuery(api.apiCache.cacheGet, { key });
      if (hit) {
        try { return { fallback: false, cached: true, spec: JSON.parse(hit) }; }
        catch { /* fall through to a fresh call */ }
      }
    }
    try {
      const { text } = await chat(
        `You are the character writer for a coffee-district sim. A player described a street stand in a few words. Answer with ONE JSON object and nothing else — no markdown, no prose — with keys: name (a short stand name, ≤6 words, title case), cuisine (≤4 words), archetype (one of: nightEats, studyHall, thirdPlace, singleOrigin, grabAndGo, pastry, community, market), cohort (one of: commuters, creatives, students, elders, tourists — who it pulls), daypart ([startMin, endMin] in minutes 360–1260 the crowd comes, or null for all day), pull (0.12–0.28 how strongly it pulls that cohort), priceTier (cheap|mid|premium), signature (its one famous item, ≤5 words), quirk (one flavour detail, ≤12 words). Match the words honestly; a ramen bar pulls students late, a wine bar pulls creatives afternoons.\n\nWords: ${prompt}`,
        320,
      );
      const m = text.match(/\{[\s\S]*\}/);
      const spec = sanitizeStandSpec(m ? JSON.parse(m[0]) : null);
      if (spec) {
        await ctx.runMutation(api.apiCache.cachePut, {
          key, value: JSON.stringify(spec), ttlMs: SPEC_TTL_MS,
        });
        return { fallback: false, cached: false, spec };
      }
      return { fallback: true, cached: false, spec: null };
    } catch {
      return { fallback: true, cached: false, spec: null };
    }
  },
});
