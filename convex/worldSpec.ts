import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { hashKey } from "./apiCache";
import { chat } from "./openai";

// World spec expansion — `?world=<words>` becomes the district's character.
// Same snapshot posture as marketSnapshot/weatherSnapshot: the client
// resolves synchronously from cache or its seeded classifier; this action
// is the background LLM pass whose result serves the NEXT campaign.
// Cached 7d by prompt hash; every failure is a clean fallback.
export const WORLD_SPEC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CLIMATES = ["fair", "heat", "rain", "crisp"];
const COHORTS = ["commuters", "creatives", "students", "elders", "tourists"];
// The event deck the spec may bias — mirrors web/js/config.js EVENTS ids.
const EVENT_IDS = [
  "frost_minas", "drought_ea", "harvest_good", "stable",
  "hype_matcha", "rumour_frost", "rain_soak",
];

const s = (x: unknown, n: number) =>
  typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, n) : "";

// Strict validator — the model's JSON or nothing usable. Bands mirror
// web/js/worldSpec.js so client and server can never disagree on limits.
export function sanitizeWorldSpec(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const bias: Record<string, number> = {};
  if (o.bias && typeof o.bias === "object") {
    for (const [id, mul] of Object.entries(o.bias as Record<string, unknown>)) {
      if (EVENT_IDS.includes(id) && Number.isFinite(mul)) {
        bias[id] = Math.max(0.3, Math.min(2.5, mul as number));
      }
    }
  }
  const demandMul = Number.isFinite(o.demandMul)
    ? Math.max(0.85, Math.min(1.15, o.demandMul as number)) : 1;
  const rivalName = s(o.rivalName, 24).toUpperCase();
  const origin = ["colombia", "eastAfrica", "brazil", "none"].includes(o.origin as string)
    ? o.origin : null;
  const out: Record<string, unknown> = {
    name: s(o.name, 48),
    line: s(o.line, 140),
    climate: CLIMATES.includes(o.climate as string) ? o.climate : null,
    bias,
    demandMul,
    rivalName: rivalName || null,
    origin,
  };
  if (!out.name && !out.line && !out.climate && !Object.keys(bias).length &&
      demandMul === 1 && !out.rivalName && !out.origin) return null;
  return out;
}

export const expand = action({
  args: { prompt: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ fallback: boolean; cached: boolean; spec: unknown }> => {
    const prompt = String(args.prompt || "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!prompt) return { fallback: true, cached: false, spec: null };
    const key = `worldspec:v1:${hashKey(prompt)}`;
    if (!args.force) {
      const hit: string | null = await ctx.runQuery(api.apiCache.cacheGet, { key });
      if (hit) {
        try { return { fallback: false, cached: true, spec: JSON.parse(hit) }; }
        catch { /* fresh call */ }
      }
    }
    try {
      const { text, model } = await chat(
        `You are the world-builder for a coffee-district sim. A player described the street they want in a few words. Answer with ONE JSON object and nothing else — keys: name (what to call their street, ≤6 words), line (one flavour sentence ≤20 words), climate (fair|heat|rain|crisp or null), bias (object mapping event ids to weight multipliers 0.3–2.5; allowed ids: ${EVENT_IDS.join(", ")} — e.g. a rainy street boosts rain_soak, a hungry street boosts hype_matcha), demandMul (0.85–1.15 overall footfall lean), rivalName (a short name for the rival chain across the road, ≤4 words uppercase, or null), origin (colombia|eastAfrica|brazil|none or null — the coffee-origin identity that fits the street, or null). Match the words honestly; keep it small and coherent.\n\nWords: ${prompt}`,
        340,
      );
      const m = text.match(/\{[\s\S]*\}/);
      const spec = sanitizeWorldSpec(m ? JSON.parse(m[0]) : null);
      if (spec) {
        // Provenance rides the card — the Brief credits the model that
        // shaped the street, so keep the real provider name on the spec.
        spec.model = model;
        await ctx.runMutation(api.apiCache.cachePut, {
          key, value: JSON.stringify(spec), ttlMs: WORLD_SPEC_TTL_MS,
        });
        return { fallback: false, cached: false, spec };
      }
      return { fallback: true, cached: false, spec: null };
    } catch {
      return { fallback: true, cached: false, spec: null };
    }
  },
});
