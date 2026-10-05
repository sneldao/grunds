import { action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { assetKey, type GenerateSpec } from "./tripo";
import { hashKey } from "./apiCache";
import { tripoSlotSeed, TRIPO_MODEL, TRIPO_NEGATIVE } from "./district";

// The Franchise (TRIPOTHON.md Tier B): the player's own words become
// geometry on The Row. Day 3's brief offers the vacant storefront — "the
// lease on 14 The Row" — the player describes the stand they want, and the
// builders (Tripo P1) put it up by the next dawn. It then pays a small
// rent line on the day receipt. This is the entry's tool-track money shot:
// gameplay depends on the tool, not the other way round.
//
// One franchise per district seed — the street remembers who built it,
// same memoization posture as the district kits. A failed generation lets
// the player re-describe (new words, new key); a success is locked in.

export const FRANCHISE_MODEL = TRIPO_MODEL;
export const FRANCHISE_FACE_LIMIT = 15000; // stand-sized, not a prop
export const FRANCHISE_PROMPT_MAX = 160;
export const FRANCHISE_OFFER_DAY = 3;

// House frame wrapped around the player's description: keeps the street
// coherent no matter what words they send.
const FRANCHISE_FRAME =
  ", a small street-facing provisions stand on a terraced shopping row, warm honey-oak and brass fittings, folded canvas awning, clean stylized game-ready storefront prop, soft daylight, centered composition, no text, no letters, no numbers, no logos, no watermark, no humans";

// Player words → a safe, generation-ready description. Lowercases, collapses
// whitespace, caps length; requires at least a few real words so "asdf!!!"
// doesn't spend a task. Pure + exported for tests.
export function sanitizeFranchisePrompt(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.replace(/\s+/g, " ").trim().slice(0, FRANCHISE_PROMPT_MAX);
  const words = clean.split(" ").filter((w) => /[a-zA-Z]{2,}/.test(w));
  return words.length >= 3 ? clean : null;
}

// Deterministic spec: same (seed, prompt) → same seeds → same stand. The
// prompt hash rides the seed derivation so different descriptions grow
// different geometry — your words literally shape the street.
export function franchiseSpec(seed: number, prompt: string): GenerateSpec {
  const promptSalt = Number.parseInt(hashKey(`${seed}:${prompt}`), 16);
  return {
    prompt: `${prompt}${FRANCHISE_FRAME}`,
    model: FRANCHISE_MODEL,
    modelSeed: tripoSlotSeed(seed ^ promptSalt, "stall"),
    textureSeed: tripoSlotSeed(seed ^ promptSalt, "stall", 0x7e57),
    faceLimit: FRANCHISE_FACE_LIMIT,
    pbr: true,
    negativePrompt: TRIPO_NEGATIVE,
  };
}

// The row in tripoAssets IS the stand; the franchises table only maps
// seed → this key, so franchiseKey must equal the key tripo.generate
// writes under — the plain content-addressed assetKey of the spec.
export function franchiseKey(seed: number, prompt: string): string {
  return assetKey(franchiseSpec(seed, prompt));
}

// Brief read: the stand for this seed, or null if nobody has described one.
export const status = query({
  args: { seed: v.number() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: string;
    prompt: string | null;
    day: number | null;
    modelUrl: string | null;
    previewUrl: string | null;
  }> => {
    const fr = await ctx.db
      .query("franchises")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .unique();
    if (!fr) return { status: "missing", prompt: null, day: null, modelUrl: null, previewUrl: null };
    const row = await ctx.db
      .query("tripoAssets")
      .withIndex("by_key", (q) => q.eq("key", fr.key))
      .unique();
    return {
      status: row?.status ?? "missing",
      prompt: fr.prompt,
      day: fr.day,
      modelUrl: row?.modelUrl ?? null,
      previewUrl: row?.previewUrl ?? null,
    };
  },
});

// The brief's "send to the builders" button. Sanitizes the words, grows the
// stand through the same content-keyed tripo.generate path the district
// uses, records which key this seed's franchise lives under. Idempotent:
// a live (success/processing) franchise returns as-is — never re-grows.
export const describe = action({
  args: { seed: v.number(), prompt: v.string(), day: v.number() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: string;
    prompt?: string;
    modelUrl?: string | null;
    error?: string;
  }> => {
    const prompt = sanitizeFranchisePrompt(args.prompt);
    if (!prompt) return { status: "invalid", error: "describe it in three words or more" };
    // A live franchise for this seed returns as-is; failed/missing falls
    // through so a new description can grow (actions can't touch ctx.db —
    // the status query is the read).
    const existing = await ctx.runQuery(api.franchise.status, { seed: args.seed });
    if (existing.status === "success" || existing.status === "processing") {
      return { status: existing.status, prompt: existing.prompt ?? prompt, modelUrl: existing.modelUrl };
    }
    const spec = franchiseSpec(args.seed, prompt);
    const g = await ctx.runAction(api.tripo.generate, {
      prompt: spec.prompt,
      model: spec.model,
      modelSeed: spec.modelSeed,
      textureSeed: spec.textureSeed,
      faceLimit: spec.faceLimit,
      pbr: spec.pbr,
      negativePrompt: spec.negativePrompt,
    });
    const key = franchiseKey(args.seed, prompt);
    await ctx.runMutation(internal.franchise.record, {
      seed: args.seed,
      key,
      prompt,
      day: args.day,
    });
    return { status: g.status, prompt, modelUrl: g.modelUrl ?? null, error: g.error };
  },
});

// Upsert the seed → franchise-key mapping. New words overwrite the pointer;
// the old asset row stays cached under its own key, unbilled either way.
export const record = internalMutation({
  args: { seed: v.number(), key: v.string(), prompt: v.string(), day: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const existing = await ctx.db
      .query("franchises")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        key: args.key,
        prompt: args.prompt,
        day: args.day,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("franchises", {
        seed: args.seed,
        key: args.key,
        prompt: args.prompt,
        day: args.day,
        createdAt: Date.now(),
      });
    }
  },
});
