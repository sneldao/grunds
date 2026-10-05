import { action, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { mintKey } from "./mint";
import { assetKey, type GenerateSpec } from "./tripo";

// The Generative District — district kits (TRIPOTHON.md Tier A).
//
// A District Seed is a shareable world: seed → deterministic kit spec
// (five street-furniture slots, each a precise prompt) → content-keyed
// get-or-create, provider-routed: Tripo first, Mint as the proven fallback.
// Keys differ by provider by design (`mintKey` vs `tripo.assetKey`), so a
// slot already grown by Mint stays cached under its mint key and is never
// re-grown; un-grown slots go to Tripo. Both may coexist for one seed.
//
// Determinism note: Tripo slots carry a `model_seed`/`texture_seed` derived
// from (district seed, slot), so a Tripo district is reproducible at the API
// level. Mint exposes no seed parameters — there "same seed → same street"
// is *key memoization* (generate once, cache forever).

// Slot order is load-bearing: kitSpec consumes rng draws in array order,
// so new slots MUST be appended or every existing seed's prompts shift.
export const DISTRICT_SLOTS = ["lantern", "planter", "stall", "sign", "cart", "fountain"] as const;
export type SlotName = (typeof DISTRICT_SLOTS)[number];

export const DISTRICT_PRESET = "fast"; // ≈198 credits final per slot (calibrated)

// Word banks — culture as mechanics, carried into the prompts. Descriptors
// are silhouette-first: what the judge sees at 10 m in the diorama.
const WORDS: Record<SlotName, string[]> = {
  lantern: [
    "a brass art-nouveau street lantern on a short cast-iron column",
    "a vintage black-iron street lamp with a warm glass globe",
    "a low round ceramic street lantern on a stone base",
  ],
  planter: [
    "a square cast-iron planter with a lush monstera plant",
    "a wooden planter box overflowing with lavender and small white flowers",
    "a stacked terracotta planter with bamboo and ferns",
    "a round stone planter with a flowering hydrangea",
  ],
  stall: [
    "a small flower-market stall with a folded canvas canopy",
    "a corner bakery stall with a canvas awning and stacked tin boxes",
    "a lemonade trolley stall with a striped canvas canopy",
    "a small pastry stall with a canvas awning and a round glass dome",
  ],
  sign: [
    "a small hand-painted oak district sign on two posts with a brass coffee-cup emblem",
    "a weathered wooden street sign with a round copper coffee-cup plate",
    "a small chalkboard garden sign on a post with a brass frame",
    "a small copper district plaque on an oak post",
  ],
  cart: [
    "a wooden bagel vendor cart on four small wheels",
    "a vintage tea trolley with a brass kettle and stacked cups",
    "a pastel pastry cart with a small striped awning",
    "a hot-cross bun cart with a folded canvas hood",
  ],
  // The hero slot — the one stand-out piece per street, grown on the newer
  // P2 pipeline (the taste-calibration A/B from TRIPOTHON.md §6). Stand-scale
  // face budget; the slot sits across the road beside the franchise stand.
  fountain: [
    "a small two-tier stone fountain with brass spouts and a round basin",
    "a cast-iron drinking fountain with a brass dome and a small basin",
    "a low octagonal stone fountain with a carved centre column",
  ],
};

const PALETTES = [
  "warm honey-oak and brass",
  "walnut and cream with brass",
  "oak and sage green with brass",
  "oak and terracotta with brass",
];

// House style block (TRIPOTHON.md §7) — appended to every kit prompt.
// "no text/letters" is load-bearing: generators fake gibberish lettering.
const HOUSE_STYLE =
  "clean stylized game-ready prop, small-scale street furniture, soft daylight, centered composition, no text, no letters, no numbers, no logos, no watermark, no humans";

// Deterministic PRNG (mulberry32) — identical seed → identical kit spec,
// on every machine, in every deployment.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

// seed → five precise prompts + names. Pure; export for the offline
// pre-warm tool (tools/mint-pipeline.mjs) and future tests.
export function kitSpecForSeed(seed: number): Record<SlotName, { prompt: string; name: string }> {
  const rng = mulberry32(Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9);
  const palette = pick(rng, PALETTES);
  const spec = {} as Record<SlotName, { prompt: string; name: string }>;
  for (const slot of DISTRICT_SLOTS) {
    const desc = pick(rng, WORDS[slot]);
    spec[slot] = {
      prompt: `${desc}, ${palette} fittings, ${HOUSE_STYLE}`,
      name: `${slot} · district ${seed}`,
    };
  }
  return spec;
}

export function slotKey(slot: SlotName, spec: { prompt: string; name: string }): string {
  return mintKey({ prompt: spec.prompt, name: spec.name, preset: DISTRICT_PRESET });
}

// Tripo spec for a slot. P1 is the low-poly game-pipeline workhorse;
// face limits follow TRIPOTHON.md §7 scale discipline (stall is the one
// stand-sized piece). Negative prompt = the house-style negative block.
export const TRIPO_MODEL = "tripo-p1";
export const TRIPO_NEGATIVE =
  "blurry, broken mesh, duplicated parts, watermark, logo, text, letters, humans";
const TRIPO_FACE_LIMIT: Record<SlotName, number> = {
  lantern: 8000,
  planter: 8000,
  stall: 12000,
  sign: 8000,
  cart: 10000,
  fountain: 15000,
};

// The hero slot runs the newer P-series pipeline; everything else stays on
// the calibrated P1 workhorse. Model lives in the spec so assetKey differs —
// a model change grows a fresh row, never clobbers a cached one.
const TRIPO_SLOT_MODEL: Partial<Record<SlotName, string>> = {
  fountain: "tripo-p2",
};

// (district seed, slot) → stable positive int32 seed. Distinct salts keep
// geometry and texture seeds independent.
export function tripoSlotSeed(seed: number, slot: SlotName, salt = 0): number {
  const idx = DISTRICT_SLOTS.indexOf(slot);
  const rng = mulberry32((Math.imul(seed | 0, 2654435761) ^ Math.imul(idx + 1, 0x85ebca6b) ^ salt) >>> 0);
  return 1 + Math.floor(rng() * 2147483646);
}

export function tripoSpecForSlot(
  seed: number,
  slot: SlotName,
  spec: { prompt: string; name: string },
): GenerateSpec {
  return {
    prompt: spec.prompt,
    model: TRIPO_SLOT_MODEL[slot] ?? TRIPO_MODEL,
    modelSeed: tripoSlotSeed(seed, slot),
    textureSeed: tripoSlotSeed(seed, slot, 0x7e57),
    faceLimit: TRIPO_FACE_LIMIT[slot],
    pbr: true,
    negativePrompt: TRIPO_NEGATIVE,
  };
}

export function tripoSlotKey(seed: number, slot: SlotName, spec: { prompt: string; name: string }): string {
  return assetKey(tripoSpecForSlot(seed, slot, spec));
}

export type Provider = "tripo" | "mint";
type SlotRow = {
  status: string;
  provider?: string;
  modelUrl?: string | null;
  previewUrl?: string | null;
} | null;

const live = (r: SlotRow) => !!r && (r.status === "success" || r.status === "processing");

// Dual-key read: which provider's row represents this slot. A success under
// either key wins (Tripo preferred when both exist); then processing; then
// whatever row exists (failed); else null → "missing".
export function pickSlotRow(
  mintRow: SlotRow,
  tripoRow: SlotRow,
): { provider: Provider; row: NonNullable<SlotRow> } | null {
  const order: [Provider, SlotRow][] = [["tripo", tripoRow], ["mint", mintRow]];
  for (const want of ["success", "processing"]) {
    for (const [provider, row] of order) if (row && row.status === want) return { provider, row };
  }
  for (const [provider, row] of order) if (row) return { provider, row };
  return null;
}

// Which providers ensure() should try for a slot, in order. [] = leave it
// alone (success/processing under either key — idempotent, never re-grow).
// Tripo first; if Tripo already failed this slot asynchronously and Mint
// hasn't, Mint goes first so a Tripo outage can't pin a slot to "failed".
export function providerOrder(mintRow: SlotRow, tripoRow: SlotRow): Provider[] {
  if (live(mintRow) || live(tripoRow)) return [];
  if (tripoRow?.status === "failed" && mintRow?.status !== "failed") return ["mint", "tripo"];
  return ["tripo", "mint"];
}

// A generate() result that didn't start or find a live task → try the next
// provider (missing key, daily budget, safety refusal, upstream error).
export function shouldFallBack(g: { fallback?: boolean; status: string } | null | undefined): boolean {
  return !g || !!g.fallback || (g.status !== "success" && g.status !== "processing");
}

// Floor read: full kit status for a seed, one query. The client polls this
// while any slot is "processing"; "success" rows cross-fade in on arrival.
export const kit = query({
  args: { seed: v.number() },
  handler: async (ctx, args): Promise<{
    seed: number;
    preset: string;
    slots: Record<string, KitSlot>;
  }> => {
    const spec = kitSpecForSeed(args.seed);
    const slots = {} as Record<string, KitSlot>;
    const byKey = (key: string) =>
      ctx.db.query("tripoAssets").withIndex("by_key", (q) => q.eq("key", key)).unique();
    for (const slot of DISTRICT_SLOTS) {
      const mintRow = await byKey(slotKey(slot, spec[slot]));
      const tripoRow = await byKey(tripoSlotKey(args.seed, slot, spec[slot]));
      const hit = pickSlotRow(mintRow, tripoRow);
      slots[slot] = hit
        ? {
            status: hit.row.status,
            provider: hit.provider,
            modelUrl: hit.row.modelUrl ?? null,
            previewUrl: hit.row.previewUrl ?? null,
            prompt: spec[slot].prompt,
          }
        : { status: "missing", provider: null, modelUrl: null, previewUrl: null, prompt: spec[slot].prompt };
    }
    return { seed: args.seed, preset: DISTRICT_PRESET, slots };
  },
});

type KitSlot = {
  status: string;
  provider: Provider | null;
  modelUrl: string | null;
  previewUrl: string | null;
  prompt: string;
};

// Get-or-create the kit: missing/failed slots are generated (Tripo first,
// Mint fallback), processing/success slots under either provider key are
// left alone. Idempotent — the first player on a seed grows it for
// everyone. Budget-guarded inside each provider's generate. Never throws on
// provider trouble: an un-grown slot reads "missing" → classic stand-in.
export const ensure = action({
  args: { seed: v.number() },
  handler: async (ctx, args): Promise<{
    seed: number;
    slots: Record<string, EnsureSlot>;
  }> => {
    const spec = kitSpecForSeed(args.seed);
    const slots = {} as Record<string, EnsureSlot>;
    for (const slot of DISTRICT_SLOTS) {
      const tripoSpec = tripoSpecForSlot(args.seed, slot, spec[slot]);
      const mintRow = await ctx.runQuery(api.tripo.byKey, { key: slotKey(slot, spec[slot]) });
      const tripoRow = await ctx.runQuery(api.tripo.byKey, { key: assetKey(tripoSpec) });
      const order = providerOrder(mintRow, tripoRow);
      if (!order.length) {
        const hit = pickSlotRow(mintRow, tripoRow)!;
        slots[slot] = { status: hit.row.status, provider: hit.provider, modelUrl: hit.row.modelUrl ?? null };
        continue;
      }
      const errors: string[] = [];
      let result: EnsureSlot = { status: "missing", provider: null, modelUrl: null, fallback: true };
      for (const provider of order) {
        let g: { status: string; modelUrl?: string | null; fallback?: boolean; error?: string } | null;
        try {
          g =
            provider === "tripo"
              ? await ctx.runAction(api.tripo.generate, tripoSpec)
              : await ctx.runAction(api.mint.generate, {
                  prompt: spec[slot].prompt,
                  name: spec[slot].name,
                  preset: DISTRICT_PRESET,
                });
        } catch (e) {
          g = null;
          errors.push(`${provider}: ${(e as { message?: string } | null)?.message ?? "generate threw"}`);
        }
        if (g && !shouldFallBack(g)) {
          result = { status: g.status, provider, modelUrl: g.modelUrl ?? null };
          break;
        }
        if (g?.error) errors.push(`${provider}: ${g.error}`);
        result = { status: g?.status ?? "missing", provider: null, modelUrl: null, fallback: true };
      }
      if (errors.length) result.error = errors.join("; ");
      slots[slot] = result;
    }
    return { seed: args.seed, slots };
  },
});

type EnsureSlot = {
  status: string;
  provider: Provider | null;
  modelUrl: string | null;
  fallback?: boolean;
  error?: string;
};
