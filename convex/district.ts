import { action, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { mintKey } from "./mint";

// The Generative District — district kits (TRIPOTHON.md Tier A).
//
// A District Seed is a shareable world: seed → deterministic kit spec
// (five street-furniture slots, each a precise prompt) → content-keyed
// get-or-create via the active provider (Mint today; Tripo when credits
// land — the keys differ by provider by design, so flipping providers
// re-grows the district rather than clobbering cached rows).
//
// Determinism note: Mint exposes no seed parameters, so "same seed → same
// street" is *key memoization* — the first player on a seed pays for the
// generation, every later player loads the cached rows. The seed never
// changes what the street looks like after the first grow.

export const DISTRICT_SLOTS = ["lantern", "planter", "stall", "sign", "cart"] as const;
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

// Floor read: full kit status for a seed, one query. The client polls this
// while any slot is "processing"; "success" rows cross-fade in on arrival.
export const kit = query({
  args: { seed: v.number() },
  handler: async (ctx, args): Promise<{
    seed: number;
    preset: string;
    slots: Record<
      string,
      { status: string; modelUrl: string | null; previewUrl: string | null }
    >;
  }> => {
    const spec = kitSpecForSeed(args.seed);
    const slots = {} as Record<
      string,
      { status: string; modelUrl: string | null; previewUrl: string | null }
    >;
    for (const slot of DISTRICT_SLOTS) {
      const key = slotKey(slot, spec[slot]);
      const row = await ctx.db
        .query("tripoAssets")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      slots[slot] = row
        ? { status: row.status, modelUrl: row.modelUrl ?? null, previewUrl: row.previewUrl ?? null }
        : { status: "missing", modelUrl: null, previewUrl: null };
    }
    return { seed: args.seed, preset: DISTRICT_PRESET, slots };
  },
});

// Get-or-create the kit: missing/failed slots are generated (Mint),
// processing/success slots are left alone. Idempotent — the first player on
// a seed grows it for everyone. Budget-guarded inside mint.generate.
export const ensure = action({
  args: { seed: v.number() },
  handler: async (ctx, args): Promise<{
    seed: number;
    slots: Record<string, { status: string; modelUrl: string | null; fallback?: boolean; error?: string }>;
  }> => {
    const spec = kitSpecForSeed(args.seed);
    const slots = {} as Record<string, {
      status: string;
      modelUrl: string | null;
      fallback?: boolean;
      error?: string;
    }>;
    for (const slot of DISTRICT_SLOTS) {
      const key = slotKey(slot, spec[slot]);
      const existing = await ctx.runQuery(api.tripo.byKey, { key });
      if (
        existing &&
        (existing.status === "success" || existing.status === "processing")
      ) {
        slots[slot] = { status: existing.status, modelUrl: existing.modelUrl };
        continue;
      }
      const g = await ctx.runAction(api.mint.generate, {
        prompt: spec[slot].prompt,
        name: spec[slot].name,
        preset: DISTRICT_PRESET,
      });
      slots[slot] = {
        status: g.status,
        modelUrl: g.modelUrl ?? null,
        fallback: g.fallback,
        error: g.error,
      };
    }
    return { seed: args.seed, slots };
  },
});
