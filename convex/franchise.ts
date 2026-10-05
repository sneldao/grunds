import { action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { assetKey, type GenerateSpec } from "./tripo";
import { hashKey } from "./apiCache";
import { tripoSlotSeed, TRIPO_MODEL, TRIPO_NEGATIVE } from "./district";

// The Franchise (TRIPOTHON.md Tier B): the player's own words become
// geometry on The Row — and now the WHOLE row is buildable. Three vacant
// storefronts unlock across the campaign (day 3, 4, 5); each one described
// becomes a real Tripo generation that pays a rent line on the day receipt.
// This is the entry's tool-track money shot: gameplay depends on the tool,
// not the other way round.
//
// One franchise per (seed, lot) — the street remembers who built it, and
// every later player on the seed inherits the stands: the "world as a
// gift" mechanic is first-come authorship, not a copy. A failed generation
// lets the player re-describe (new words, new key); a success is locked in.
//
// THE LOT TABLE lives here AND in web/js/config.js (FRANCHISE.lots) —
// Convex can't import the client config, so both copies must agree; the
// test suite pins parity (lot ids, unlock days, rents).

export const FRANCHISE_MODEL = TRIPO_MODEL;
export const FRANCHISE_FACE_LIMIT = 15000; // stand-sized, not a prop
export const FRANCHISE_PROMPT_MAX = 160;

export const FRANCHISE_LOTS = [
  { lot: "14", name: "14 The Row", unlockDay: 3, rent: 15 },
  { lot: "11", name: "11 The Row", unlockDay: 4, rent: 15 },
  { lot: "18", name: "18 The Row", unlockDay: 5, rent: 15 },
] as const;
export type FranchiseLot = (typeof FRANCHISE_LOTS)[number]["lot"];
const lotOf = (id: string) => FRANCHISE_LOTS.find((l) => l.lot === id);

// House frame wrapped around the player's description: keeps the street
// coherent no matter what words they send.
const FRANCHISE_FRAME =
  ", a small street-facing provisions stand on a terraced shopping row, warm honey-oak and brass fittings, folded canvas awning, clean stylized game-ready storefront prop, soft daylight, centered composition, no text, no letters, no numbers, no logos, no watermark, no humans";

// Player words → a safe, generation-ready description. Lowercases, collapses
// whitespace, caps length; requires at least a few real words so "asdf!!!"
// doesn't spend a task. A pasted photo link is a description too — URLs skip
// the word count and route to image-to-model downstream (isImageInput).
export function sanitizeFranchisePrompt(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.replace(/\s+/g, " ").trim().slice(0, FRANCHISE_PROMPT_MAX);
  if (isImageInput(clean)) return clean;
  const words = clean.split(" ").filter((w) => /[a-zA-Z]{2,}/.test(w));
  return words.length >= 3 ? clean : null;
}

// A pasted link is a different kind of description: photo → model instead
// of text → model. The same input field serves both (see describe()).
export function isImageInput(clean: string): boolean {
  return /^https?:\/\/\S+$/i.test(clean);
}

// Deterministic spec: same (seed, lot, prompt) → same seeds → same stand.
// The lot salts the prompt hash so the same words on two lots still grow
// different geometry — the address is part of the stand.
export function franchiseSpec(seed: number, lot: string, prompt: string): GenerateSpec {
  const promptSalt = Number.parseInt(hashKey(`${seed}:${lot}:${prompt}`), 16);
  const spec: GenerateSpec = {
    prompt: `${prompt}${FRANCHISE_FRAME}`,
    model: FRANCHISE_MODEL,
    modelSeed: tripoSlotSeed(seed ^ promptSalt, "stall"),
    textureSeed: tripoSlotSeed(seed ^ promptSalt, "stall", 0x7e57),
    faceLimit: FRANCHISE_FACE_LIMIT,
    pbr: true,
    negativePrompt: TRIPO_NEGATIVE,
  };
  if (isImageInput(prompt)) spec.imageUrl = prompt;
  return spec;
}

// The row in tripoAssets IS the stand; the franchises table only maps
// (seed, lot) → this key, so franchiseKey must equal the key
// tripo.generate writes under — the plain content-addressed assetKey.
export function franchiseKey(seed: number, lot: string, prompt: string): string {
  return assetKey(franchiseSpec(seed, lot, prompt));
}

type LotStatus = {
  lot: string;
  status: string;
  prompt: string | null;
  day: number | null;
  modelUrl: string | null;
  previewUrl: string | null;
};

// Brief read: every built/building stand on this seed's row. Lots nobody
// has described simply don't appear — the client derives vacancy from the
// lot table.
export const status = query({
  args: { seed: v.number() },
  handler: async (ctx, args): Promise<{ lots: LotStatus[] }> => {
    const frs = await ctx.db
      .query("franchises")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .collect();
    const lots: LotStatus[] = [];
    for (const fr of frs) {
      const row = await ctx.db
        .query("tripoAssets")
        .withIndex("by_key", (q) => q.eq("key", fr.key))
        .unique();
      lots.push({
        lot: fr.lot ?? "14",
        status: row?.status ?? "missing",
        prompt: fr.prompt,
        day: fr.day,
        modelUrl: row?.modelUrl ?? null,
        previewUrl: row?.previewUrl ?? null,
      });
    }
    return { lots };
  },
});

// The brief's "send to the builders" button. Sanitizes the words, grows the
// stand through the same content-keyed tripo.generate path the district
// uses, records which key this (seed, lot) lives under. Idempotent: a live
// franchise returns as-is — never re-grows; a locked or taken lot refuses.
export const describe = action({
  args: { seed: v.number(), lot: v.string(), prompt: v.string(), day: v.number() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: string;
    prompt?: string;
    modelUrl?: string | null;
    error?: string;
  }> => {
    const def = lotOf(args.lot);
    if (!def) return { status: "invalid", error: "no such lot on The Row" };
    if (args.day < def.unlockDay)
      return { status: "locked", error: `${def.name} isn't listed yet` };
    const prompt = sanitizeFranchisePrompt(args.prompt);
    if (!prompt) return { status: "invalid", error: "describe it in three words or more" };
    // A live franchise on this lot returns as-is; failed/missing falls
    // through so a new description can grow (actions can't touch ctx.db —
    // the status query is the read).
    const existing = await ctx.runQuery(api.franchise.status, { seed: args.seed });
    const mine = existing.lots.find((l) => l.lot === args.lot);
    if (mine && (mine.status === "success" || mine.status === "processing")) {
      return { status: mine.status, prompt: mine.prompt ?? prompt, modelUrl: mine.modelUrl };
    }
    const spec = franchiseSpec(args.seed, args.lot, prompt);
    const g = await ctx.runAction(api.tripo.generate, {
      prompt: spec.prompt,
      model: spec.model,
      modelSeed: spec.modelSeed,
      textureSeed: spec.textureSeed,
      faceLimit: spec.faceLimit,
      pbr: spec.pbr,
      negativePrompt: spec.negativePrompt,
      imageUrl: spec.imageUrl,
    });
    const key = franchiseKey(args.seed, args.lot, prompt);
    await ctx.runMutation(internal.franchise.record, {
      seed: args.seed,
      lot: args.lot,
      key,
      prompt,
      day: args.day,
    });
    return { status: g.status, prompt, modelUrl: g.modelUrl ?? null, error: g.error };
  },
});

// Upsert the (seed, lot) → franchise-key mapping. New words overwrite the
// pointer; the old asset row stays cached under its own key either way.
export const record = internalMutation({
  args: { seed: v.number(), lot: v.string(), key: v.string(), prompt: v.string(), day: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const rows = await ctx.db
      .query("franchises")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .collect();
    const existing = rows.find((r) => (r.lot ?? "14") === args.lot);
    if (existing) {
      await ctx.db.patch(existing._id, {
        lot: args.lot,
        key: args.key,
        prompt: args.prompt,
        day: args.day,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("franchises", {
        seed: args.seed,
        lot: args.lot,
        key: args.key,
        prompt: args.prompt,
        day: args.day,
        createdAt: Date.now(),
      });
    }
  },
});
