import { action, internalAction, mutation, query } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { hashKey } from "./apiCache";

// City Remix (SandBase AI City Remix event): ?city=<name> packs.
//
// A city name is enough to make the district relatable — this is the
// payload. MiniMax M3.1 flash via SandBase's OpenAI-compatible gateway
// (api.sandbase.ai) returns a small locality pack: currency, a typical
// specialty-cup price, real independent café names nearby, a landmark and a
// palette hint. The client dresses the licence and the kit prompts with it;
// the sim itself stays templated and deterministic.
//
// Cached per normalized city for 30 days — real cafés don't churn and a lit
// city should be stable while people share it. Key-gated: no
// SANDBASE_API_KEY → { fallback: true } and the game plays the generic
// district. Daily budget guards the public route the same way Nebius does:
// over budget → fallback, never a broken street.
//
// Note: minimax-m3.1-flash is a reasoning model — completion content lives
// in message.content but the model spends tokens reasoning first, so
// max_tokens needs headroom well past the JSON we ask for.

export const SANDBASE_MODEL = "minimax/minimax-m3.1-flash";
const SANDBASE_ENDPOINT = "https://api.sandbase.ai/v1/chat/completions";
const PACK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SANDBASE_DAILY_BUDGET = 400; // uncached calls/day = new-city creation rate

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
}

export function cityCacheKey(city: string): string {
  // v2 — the pack grew cultural payload (barista/names/district); bumping
  // the version re-mints every city once with the richer schema.
  return `city:pack:v2:${hashKey(normalizeCity(city))}`;
}

export type CityPack = {
  fallback: boolean;
  cached: boolean;
  city: string; // normalized input
  display: string; // "Lisbon, Portugal"
  currency: string;
  price: string | null;
  cafes: string[];
  landmark: string | null;
  palette: string | null;
  line: string | null;
  barista: string | null; // a common local first name for the rival
  names: string[];        // local first names for the walk-in pools
  cast: string[];         // local display names for the canon regulars
  district: string | null; // a real neighbourhood for the ticker label
  error?: string; // surfaced on fallbacks so upstream trouble is diagnosable
};

function fallbackPack(city: string, error?: string): CityPack {
  const display = city.replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toUpperCase());
  return {
    fallback: true, cached: false, city, display,
    currency: "£", price: null, cafes: [], landmark: null, palette: null, line: null,
    barista: null, names: [], cast: [], district: null,
    ...(error ? { error } : {}),
  };
}

// Pull a JSON object out of a completion that may arrive fenced or with a
// reasoning-model preamble. Never throws — the caller falls back.
export function parsePack(raw: string): Record<string, unknown> | null {
  const s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const p = JSON.parse(s.slice(start, end + 1));
    return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function packFrom(city: string, p: Record<string, unknown>): CityPack {
  const base = fallbackPack(city);
  const cafes = Array.isArray(p.cafes)
    ? p.cafes.filter((c): c is string => typeof c === "string").map((c) => c.trim()).filter(Boolean).slice(0, 5)
    : [];
  const str = (k: string) => (typeof p[k] === "string" && (p[k] as string).trim() ? (p[k] as string).trim() : null);
  // M3.1 sometimes honors "number only" literally and emits JSON numbers.
  const price =
    typeof p.price === "number" && Number.isFinite(p.price) ? String(p.price) : str("price");
  const nameList = (k: string) => Array.isArray(p[k])
    ? p[k].filter((c): c is string => typeof c === "string").map((c) => c.trim()).filter((c) => c && c.length <= 14).slice(0, 8)
    : [];
  return {
    ...base,
    fallback: false,
    display: str("display") ?? base.display,
    currency: str("currency") ?? base.currency,
    price,
    cafes,
    landmark: str("landmark"),
    palette: str("palette"),
    line: str("line"),
    barista: str("barista")?.slice(0, 14) ?? null,
    names: nameList("names"),
    cast: nameList("cast"),
    district: str("district")?.slice(0, 40) ?? null,
  };
}

export const pack = action({
  args: { city: v.string() },
  handler: async (ctx, args): Promise<CityPack> => {
    const city = normalizeCity(args.city);
    if (!city) return fallbackPack("the district");
    const key = process.env.SANDBASE_API_KEY;
    if (!key) return fallbackPack(city);

    const cacheKey = cityCacheKey(city);
    const hit = await ctx.runQuery(api.apiCache.cacheGet, { key: cacheKey });
    if (hit) {
      try {
        const cached = { ...packFrom(city, JSON.parse(hit)), cached: true };
        // Cached reads re-light the claim — idempotent, one indexed write.
        await ctx.runMutation(api.city.registerLit, { name: city, display: cached.display });
        return cached;
      } catch { /* corrupt cache row — regenerate below */ }
    }

    return mintPack(ctx, city, args.city);
  },
});

// Force a fresh mint, overwriting the cached pack — internal escape hatch for
// packs the model invented. Same budget claim, same write path as pack.
export const repack = internalAction({
  args: { city: v.string() },
  handler: async (ctx, args): Promise<CityPack> => {
    const city = normalizeCity(args.city);
    if (!city) return fallbackPack("the district");
    return mintPack(ctx, city, args.city);
  },
});

async function mintPack(ctx: ActionCtx, city: string, rawCity: string): Promise<CityPack> {
  const envBudget = Number(process.env.SANDBASE_DAILY_BUDGET);
  const budget = Number.isFinite(envBudget) && envBudget > 0 ? envBudget : SANDBASE_DAILY_BUDGET;
  const used = await ctx.runMutation(api.apiCache.claimDaily, { name: "sandbase" });
  if (used > budget) return fallbackPack(city);

  const key = process.env.SANDBASE_API_KEY;
  if (!key) return fallbackPack(city);

  const prompt = [
    `You build locality data for a stylized coffee-district game. For the city below return ONLY a JSON object — no markdown, no prose:`,
    `{`,
    `  "display": "the city's proper name with country, e.g. \\"Lisbon, Portugal\\"",`,
    `  "currency": "the local currency symbol, e.g. \\"€\\"",`,
    `  "price": "a typical specialty matcha latte or flat white price there, number only",`,
    `  "cafes": ["up to 5 real, independent, currently-trading specialty café names in that city that you are highly confident exist — no chains. Fewer is better than invented; return [] if unsure"],`,
    `  "landmark": "one recognizable small landmark or street-furniture style typical of the city, under 12 words",`,
    `  "palette": "a 3–5 word street palette typical of the city, e.g. \\"whitewash, azulejo blue, terracotta\\"",`,
    `  "line": "one sentence, under 14 words, the city welcoming a new coffee stand to its street",`,
    `  "barista": "one common local first name for a rival café barista there — short, no surname",`,
    `  "names": ["8 common local first names used there — mixed gender, short forms"],`,
    `  "cast": ["8 more common local first names used there, mixed gender, short forms, none repeated from names or barista"],`,
    `  "district": "a well-known central neighbourhood a local would instantly recognise, spelled exactly as locals spell it, e.g. \\"Alfama\\" for Lisbon"`,
    `}`,
    `City: ${rawCity.trim().slice(0, 60)}`,
  ].join("\n");

  try {
    const parsed = await askSandBase(key, prompt);
    if (!parsed.ok) return fallbackPack(city, parsed.error);
    const result = packFrom(city, parsed.json);
    await ctx.runMutation(api.apiCache.cachePut, {
      key: cityCacheKey(city),
      value: JSON.stringify(result),
      ttlMs: PACK_TTL_MS,
    });
    // Join the lit map — first successful pack mints the claim.
    await ctx.runMutation(api.city.registerLit, { name: city, display: result.display });
    return result;
  } catch (e) {
    return fallbackPack(city, `sandbase fetch: ${e instanceof Error ? e.message : "threw"}`);
  }
}

// One SandBase completion → parsed JSON object, or a labelled error the
// caller turns into a fallback.
async function askSandBase(
  key: string,
  prompt: string,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  const res = await fetch(SANDBASE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.SANDBASE_MODEL ?? SANDBASE_MODEL,
      messages: [{ role: "user", content: prompt }],
      // Reasoning-model headroom: M3.1 flash spends a variable
      // reasoning_content budget before emitting content — 1400 starved
      // it to finish_reason "length" with an empty answer. The JSON
      // itself is ~300 tokens; the rest is the model's scratchpad.
      max_tokens: 8000,
      temperature: 0.4,
    }),
  });
  if (!res.ok) return { ok: false, error: `sandbase ${res.status}` };
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  const parsed = raw ? parsePack(raw) : null;
  if (!parsed) return { ok: false, error: `unparseable completion: ${JSON.stringify(data).slice(0, 300)}` };
  return { ok: true, json: parsed };
}

// Backfill `cast` onto a cached pack without re-minting it — the v2 packs
// predate the field, so one small call asks for the eight display names,
// avoiding the pack's own names + barista. Every other field untouched.
export const extendPack = internalAction({
  args: { city: v.string() },
  handler: async (ctx, args): Promise<CityPack> => {
    const city = normalizeCity(args.city);
    if (!city) return fallbackPack("the district");
    const cacheKey = cityCacheKey(city);
    const hit = await ctx.runQuery(api.apiCache.cacheGet, { key: cacheKey });
    if (!hit) return fallbackPack(city, "no cached pack");
    let pack: CityPack;
    try {
      pack = { ...packFrom(city, JSON.parse(hit)), cached: true };
    } catch {
      return fallbackPack(city, "corrupt cache row");
    }
    const key = process.env.SANDBASE_API_KEY;
    if (!key) return pack;

    const envBudget = Number(process.env.SANDBASE_DAILY_BUDGET);
    const budget = Number.isFinite(envBudget) && envBudget > 0 ? envBudget : SANDBASE_DAILY_BUDGET;
    const used = await ctx.runMutation(api.apiCache.claimDaily, { name: "sandbase" });
    if (used > budget) return pack;

    const avoid = [pack.barista, ...pack.names].filter((n): n is string => !!n);
    const prompt = [
      `For ${pack.display}, return ONLY a JSON object — no markdown, no prose:`,
      `{ "cast": ["8 common local first names, mixed gender, short forms"] }`,
      `Do not use any of these names: ${avoid.join(", ") || "none"}.`,
    ].join("\n");

    try {
      const r = await askSandBase(key, prompt);
      if (r.ok) {
        const cast = Array.isArray(r.json.cast)
          ? r.json.cast
              .filter((c): c is string => typeof c === "string")
              .map((c) => c.trim())
              .filter((c) => c && c.length <= 14 && !avoid.some((a) => a.toLowerCase() === c.toLowerCase()))
              .slice(0, 8)
          : [];
        if (cast.length) {
          pack.cast = cast;
          await ctx.runMutation(api.apiCache.cachePut, {
            key: cacheKey,
            value: JSON.stringify(pack),
            ttlMs: PACK_TTL_MS,
          });
        }
      }
      return pack;
    } catch (e) {
      return { ...pack, error: `sandbase fetch: ${e instanceof Error ? e.message : "threw"}` };
    }
  },
});

// A city joins the lit map when its first pack lands — idempotent upsert,
// so replays never bump firstLit or rewrite the display.
export const registerLit = mutation({
  args: { name: v.string(), display: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const existing = await ctx.db
      .query("cities")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (!existing) {
      await ctx.db.insert("cities", { name: args.name, display: args.display, firstLit: Date.now() });
    }
  },
});

// The lit map — every claimed city, oldest first. Small table, plain collect
// (same posture as franchise.streets).
export const list = query({
  args: {},
  handler: async (ctx): Promise<{ cities: { name: string; display: string; firstLit: number }[] }> => {
    const rows = await ctx.db.query("cities").collect();
    rows.sort((a, b) => a.firstLit - b.firstLit);
    return { cities: rows.map((r) => ({ name: r.name, display: r.display, firstLit: r.firstLit })) };
  },
});
