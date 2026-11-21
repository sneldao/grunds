import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { assetKey, NUDGE_MS, type GenerateSpec } from "./tripo";
import { RODIN_FACE_TARGET, RODIN_MODEL, rodinKey, type RodinSpec } from "./rodin";
import { hashKey } from "./apiCache";
import { tripoSlotSeed, TRIPO_MODEL, TRIPO_NEGATIVE } from "./district";

// The Franchise (TRIPOTHON.md Tier B): the player's own words become
// geometry on The Row — and now the WHOLE row is buildable. Three vacant
// storefronts unlock across the campaign (day 3, 4, 5); each one described
// becomes a real generation — Rodin first, Tripo fallback — that pays a
// rent line on the day receipt.
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
  // The Pitch — the sandbox lease. Day-1 pitch-side pop-up so a judge (or a
  // curious player) can describe a stand in the first minute instead of
  // waiting for the Row leases. No rent, no purpose picker — its spec IS
  // its effect. `sandbox` is informational; the client hides the picker.
  { lot: "pitch", name: "The Pitch", unlockDay: 1, rent: 0, sandbox: true },
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

// Cheap content hygiene for a permanent shared street: the obvious slurs
// and profanity stay off deeds and out of provider prompts. Whole-word
// matching so "a class act" and "assam tea counter" survive.
const FRANCHISE_BLOCKLIST = new RegExp(
  `\\b(${[
    "fuck", "fucking", "shit", "cunt", "cock", "dick", "pussy", "whore",
    "slut", "bitch", "nigger", "nigga", "faggot", "kike", "spic", "chink",
    "retard", "rape", "rapist", "nazi", "hitler", "porn", "penis",
    "vagina", "tits", "jizz", "cum",
  ].join("|")})\\b`,
  "i",
);

// Player words → a safe, generation-ready description. Lowercases, collapses
// whitespace, caps length; requires at least a few real words so "asdf!!!"
// doesn't spend a task. A pasted photo link is a description too — URLs skip
// the word count and route to image-to-model downstream (isImageInput).
export function sanitizeFranchisePrompt(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.replace(/\s+/g, " ").trim().slice(0, FRANCHISE_PROMPT_MAX);
  if (isImageInput(clean)) return clean;
  const words = clean.split(" ").filter((w) => /[a-zA-Z]{2,}/.test(w));
  return words.length >= 3 && !FRANCHISE_BLOCKLIST.test(clean) ? clean : null;
}

// A pasted link is a different kind of description: photo → model instead
// of text → model. The same input field serves both (see describe()).
// https only, no userinfo, a dotted hostname — the PROVIDER fetches the
// image, but a tidy check keeps obviously-bad input off the wire.
export function isImageInput(clean: string): boolean {
  try {
    const u = new URL(clean);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".");
  } catch {
    return false;
  }
}

// The builder's signature — a short name on the deeds, shown in the
// Streets gallery and to every later player who inherits the stand.
// Optional; anonymous builds stay anonymous (absent, not ""). A blocked
// signature just falls back to anonymous rather than failing the describe.
export function sanitizeByline(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const clean = raw.replace(/\s+/g, " ").trim().slice(0, 24);
  // A signature needs letters — punctuation-only isn't a name.
  return /[a-zA-Z0-9]/.test(clean) && !FRANCHISE_BLOCKLIST.test(clean) ? clean : undefined;
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

// Rodin twin of franchiseSpec: same house-framed words (the frame is what
// keeps the street coherent, whatever the builder), Rodin-flavoured seeds
// and face budget. Same (seed, lot, prompt) → same rodinKey, so a
// re-described stand reuses its row instead of spending again. Rodin seeds
// are 0–65535, so the slot seeds mod down.
export function rodinSpec(seed: number, lot: string, prompt: string): RodinSpec {
  return {
    prompt: `${prompt}${FRANCHISE_FRAME}`,
    model: RODIN_MODEL,
    modelSeed: tripoSlotSeed(seed ^ Number.parseInt(hashKey(`${seed}:${lot}:${prompt}`), 16), "stall") % 65536,
    qualityOverride: RODIN_FACE_TARGET,
  };
}

// (seed, lot) → the key rodin.generate writes under. `rodin:`-namespaced,
// so the first Rodin describe of old words grows a fresh row next to the
// Tripo twin instead of clobbering it.
export function rodinFranchiseKey(seed: number, lot: string, prompt: string): string {
  return rodinKey(rodinSpec(seed, lot, prompt));
}

// What the stand is FOR, chosen deliberately on the lease card — not
// inferred from the words and never part of the asset key, so the same
// geometry can serve any purpose. Absent (legacy rows) means no bonus:
// the stand still pays its plain £15 rent.
export const FRANCHISE_PURPOSES = ["draw", "community", "rent"] as const;

// How many times a standing build can be renovated before the Row settles
// on it. Bounded churn keeps the shared street stable under drive-bys —
// original build + two renovations.
export const FRANCHISE_REMODEL_MAX = 2;

type LotStatus = {
  lot: string;
  status: string;
  prompt: string | null;
  day: number | null;
  purpose: string | null;
  byline: string | null;
  spec: unknown;
  standName: string | null;
  modelUrl: string | null;
  previewUrl: string | null;
  remodelCount: number;
};

// The spec column is a JSON card written by standSpec.expand (or absent on
// legacy/polyfork rows — the client falls back to its seeded classifier).
// Parse defensively: a corrupt row degrades to "no spec", never a throw.
function specOf(fr: { spec?: string }): { spec: unknown; standName: string | null } {
  if (!fr.spec) return { spec: null, standName: null };
  try {
    const p = JSON.parse(fr.spec);
    if (!p || typeof p !== "object") return { spec: null, standName: null };
    const name = typeof (p as Record<string, unknown>).name === "string"
      ? String((p as Record<string, unknown>).name).slice(0, 48) : null;
    return { spec: p, standName: name };
  } catch {
    return { spec: null, standName: null };
  }
}

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
      if (fr.hidden) continue; // curated off the Row — the lot reads vacant
      const row = await ctx.db
        .query("tripoAssets")
        .withIndex("by_key", (q) => q.eq("key", fr.key))
        .unique();
      const sp = specOf(fr);
      lots.push({
        lot: fr.lot ?? "14",
        status: row?.status ?? "missing",
        prompt: fr.prompt,
        day: fr.day,
        purpose: fr.purpose ?? null,
        byline: fr.byline ?? null,
        spec: sp.spec,
        standName: sp.standName,
        modelUrl: row?.modelUrl ?? null,
        previewUrl: row?.previewUrl ?? null,
        remodelCount: fr.remodelCount ?? 0,
      });
    }
    return { lots };
  },
});

// Live status: the plain read plus a nudge — a lot still "processing"
// past NUDGE_MS asks Tripo for the answer itself, so a stand described at
// the morning brief can arrive while the player is still trading rather
// than waiting on the hourly reaper. Read-only-looking, same shape back.
export const statusLive = action({
  args: { seed: v.number() },
  handler: async (ctx, args): Promise<{ lots: LotStatus[] }> => {
    const tasks = await ctx.runQuery(internal.franchise.processingTasks, { seed: args.seed });
    const now = Date.now();
    for (const t of tasks) {
      if (now - t.createdAt >= NUDGE_MS) {
        // The nudge dispatches on the row's provider — a Rodin task asks
        // Rodin, a Tripo task asks Tripo.
        if (t.provider === "rodin")
          await ctx.runAction(internal.rodin.pollTask, { taskId: t.taskId });
        else await ctx.runAction(internal.tripo.pollTask, { taskId: t.taskId });
      }
    }
    return ctx.runQuery(api.franchise.status, { seed: args.seed });
  },
});

// Processing lots on a seed → the asset row's task id + age, for the
// nudge. Actions can't touch the db, so this is a query.
export const processingTasks = internalQuery({
  args: { seed: v.number() },
  handler: async (ctx, args): Promise<{ lot: string; taskId: string; createdAt: number; provider: string }[]> => {
    const frs = await ctx.db
      .query("franchises")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .collect();
    const out: { lot: string; taskId: string; createdAt: number; provider: string }[] = [];
    for (const fr of frs) {
      if (fr.hidden) continue;
      const row = await ctx.db
        .query("tripoAssets")
        .withIndex("by_key", (q) => q.eq("key", fr.key))
        .unique();
      if (row?.status === "processing" && row.taskId)
        out.push({ lot: fr.lot ?? "14", taskId: row.taskId, createdAt: row.createdAt, provider: row.provider });
    }
    return out;
  },
});

// The brief's "send to the builders" button. Sanitizes the words, grows the
// stand through the same content-keyed tripo.generate path the district
// uses, records which key this (seed, lot) lives under. Idempotent: a live
// franchise returns as-is — never re-grows; a locked or taken lot refuses.
export const describe = action({
  args: {
    seed: v.number(),
    lot: v.string(),
    prompt: v.string(),
    day: v.number(),
    purpose: v.optional(v.string()),
    byline: v.optional(v.string()),
    // Escape hatch: `tripo` skips the Rodin attempt (mirrors the
    // ?district=tripo routing). Absent means Rodin first, Tripo fallback.
    builder: v.optional(v.string()),
    // Renovation: only honoured on a lot whose build already succeeded —
    // the same pipeline runs new words under a new key and the record
    // patch preserves the original deed (byline) + purpose. A describe
    // without the flag on a built lot still returns the stand as-is.
    remodel: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: string;
    prompt?: string;
    purpose?: string | null;
    byline?: string | null;
    spec?: unknown;
    standName?: string | null;
    claimed?: boolean;
    remodeled?: boolean;
    modelUrl?: string | null;
    error?: string;
  }> => {
    const def = lotOf(args.lot);
    if (!def) return { status: "invalid", error: "no such lot on The Row" };
    if (args.day < def.unlockDay)
      return { status: "locked", error: `${def.name} isn't listed yet` };
    const purpose = args.purpose ?? null;
    if (purpose !== null && !(FRANCHISE_PURPOSES as readonly string[]).includes(purpose))
      return { status: "invalid", error: "unknown purpose" };
    const byline = sanitizeByline(args.byline) ?? null;
    const prompt = sanitizeFranchisePrompt(args.prompt);
    if (!prompt) return { status: "invalid", error: "describe it in three words or more" };
    // A live franchise on this lot returns as-is; failed/missing falls
    // through so a new description can grow (actions can't touch ctx.db —
    // the status query is the read). The one exception: `remodel` lets a
    // built stand be renovated — new words, new asset, same lot and the
    // same deeds (the original byline stays on the record).
    const existing = await ctx.runQuery(api.franchise.status, { seed: args.seed });
    const mine = existing.lots.find((l) => l.lot === args.lot);
    const renovating = args.remodel === true && mine?.status === "success";
    if (renovating && mine.remodelCount >= FRANCHISE_REMODEL_MAX)
      return {
        status: "settled",
        prompt: mine.prompt ?? undefined, purpose: mine.purpose ?? null, byline: mine.byline ?? null,
        error: "the Row has settled on that stand — it stays as the builder left it",
      };
    if (mine && (mine.status === "success" || mine.status === "processing") && !renovating) {
      return {
        status: mine.status,
        prompt: mine.prompt ?? prompt,
        purpose: mine.purpose ?? null,
        byline: mine.byline ?? null, // the deeds keep the builder's signature
        spec: mine.spec ?? null,
        standName: mine.standName ?? null,
        claimed: false, // the lot was already spoken for — nothing new written
        modelUrl: mine.modelUrl,
      };
    }
    // The words also become a character card — the LLM reads them once and
    // the card is stored on the row, where it drives the stand's pull on
    // the floor for every later player too. Image prompts skip it (a URL
    // has no words to read); every failure is a clean miss and the client
    // falls back to its seeded classifier.
    const specRes = isImageInput(prompt)
      ? null
      : await ctx.runAction(api.standSpec.expand, { prompt }).catch(() => null);
    const specJson =
      specRes && !specRes.fallback && specRes.spec ? JSON.stringify(specRes.spec) : undefined;
    const specObj = specRes && !specRes.fallback ? (specRes.spec as Record<string, unknown> | null) : null;
    // Player words grow through Rodin first (in-engine proof stands on the
    // pavement); photo prompts stay on Tripo — image-to-3D is its path and
    // unproven on Rodin. A Rodin miss (no key, budget, upstream) falls
    // through to the Tripo call below, so the chain is Rodin → Tripo →
    // the client's instant archetype — a described lot is never left empty.
    if (!isImageInput(prompt) && args.builder !== "tripo") {
      const rspec = rodinSpec(args.seed, args.lot, prompt);
      const r = await ctx.runAction(api.rodin.generate, {
        prompt: rspec.prompt,
        model: rspec.model,
        modelSeed: rspec.modelSeed,
        qualityOverride: rspec.qualityOverride,
      });
      if (!r.fallback) {
        const key = rodinFranchiseKey(args.seed, args.lot, prompt);
        await ctx.runMutation(internal.franchise.record, {
          seed: args.seed,
          lot: args.lot,
          key,
          prompt,
          day: args.day,
          purpose: purpose ?? undefined,
          byline: byline ?? undefined,
          spec: specJson,
          remodel: renovating || undefined,
        });
        return {
          status: r.status, prompt,
          purpose: renovating ? (mine?.purpose ?? purpose) : purpose,
          byline: renovating ? (mine?.byline ?? byline) : byline,
          spec: specObj,
          standName: typeof specObj?.name === "string" ? specObj.name.slice(0, 48) : null,
          claimed: true, remodeled: renovating || undefined, modelUrl: r.modelUrl ?? null, error: r.error,
        };
      }
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
    // A failed generation must never demolish a standing build: on a
    // renovation the row is only repointed when a real task (or cached
    // result) exists — otherwise the old stand stays up and the builders
    // can simply be asked again.
    const claimable = g.status === "success" || g.status === "processing";
    if (!renovating || claimable) {
      await ctx.runMutation(internal.franchise.record, {
        seed: args.seed,
        lot: args.lot,
        key,
        prompt,
        day: args.day,
        purpose: purpose ?? undefined,
        byline: byline ?? undefined,
        spec: specJson,
        remodel: renovating || undefined,
      });
    }
    return {
      status: g.status, prompt,
      purpose: renovating ? (mine?.purpose ?? purpose) : purpose,
      byline: renovating ? (mine?.byline ?? byline) : byline,
      spec: specObj,
      standName: typeof specObj?.name === "string" ? specObj.name.slice(0, 48) : null,
      claimed: claimable, remodeled: renovating || undefined, modelUrl: g.modelUrl ?? null, error: g.error,
    };
  },
});

// Upsert the (seed, lot) → franchise-key mapping. New words overwrite the
// pointer; the old asset row stays cached under its own key either way.
// `remodel` marks a renovation of a standing build: the lease's declared
// purpose and the builder's signature survive (the deeds read "built by X,
// renovated day N" — an unsigned deed may be signed by the renovator) and
// the renovation counter climbs toward FRANCHISE_REMODEL_MAX.
export const record = internalMutation({
  args: {
    seed: v.number(),
    lot: v.string(),
    key: v.string(),
    prompt: v.string(),
    day: v.number(),
    purpose: v.optional(v.string()),
    byline: v.optional(v.string()),
    spec: v.optional(v.string()),
    remodel: v.optional(v.boolean()),
  },
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
        purpose: args.remodel ? (existing.purpose ?? args.purpose) : args.purpose,
        byline: args.remodel ? (existing.byline ?? args.byline) : args.byline,
        spec: args.spec,
        // The counter only climbs when the words actually changed — a
        // "renovation" identical to the standing build is a free no-op
        // (content-addressed: same words → same key → same stand).
        ...(args.remodel && args.key !== existing.key ? { remodelCount: (existing.remodelCount ?? 0) + 1 } : {}),
        hidden: undefined,       // a re-described lot is fresh authorship — clears any curation flag
        hiddenReason: undefined,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("franchises", {
        seed: args.seed,
        lot: args.lot,
        key: args.key,
        prompt: args.prompt,
        day: args.day,
        purpose: args.purpose,
        byline: args.byline,
        spec: args.spec,
        createdAt: Date.now(),
      });
    }
  },
});

// The Streets gallery index: every seed that has a stand on its Row, with
// the deeds (prompt, purpose, signature, preview). Bounded: the response
// runs ~6 KB per stand (spec cards are heavy), so cap the read rather than
// grow the payload forever — 240 stands ≈ 60 full streets, newest first.
const STREETS_MAX_STANDS = 240;
export const streets = query({
  args: {},
  handler: async (ctx): Promise<{ seeds: { seed: number; stands: LotStatus[] }[] }> => {
    const frs = await ctx.db.query("franchises").order("desc").take(STREETS_MAX_STANDS);
    const bySeed = new Map<number, LotStatus[]>();
    for (const fr of frs) {
      if (fr.hidden) continue; // hidden stands leave the gallery too
      const row = await ctx.db
        .query("tripoAssets")
        .withIndex("by_key", (q) => q.eq("key", fr.key))
        .unique();
      const sp = specOf(fr);
      const ls: LotStatus = {
        lot: fr.lot ?? "14",
        status: row?.status ?? "missing",
        prompt: fr.prompt,
        day: fr.day,
        purpose: fr.purpose ?? null,
        byline: fr.byline ?? null,
        spec: sp.spec,
        standName: sp.standName,
        modelUrl: null,            // gallery shows previews, not GLBs
        previewUrl: row?.previewUrl ?? null,
        remodelCount: fr.remodelCount ?? 0,
      };
      const arr = bySeed.get(fr.seed) ?? [];
      arr.push(ls);
      bySeed.set(fr.seed, arr);
    }
    return {
      seeds: [...bySeed.entries()]
        .map(([seed, stands]) => ({
          seed,
          stands: stands.sort((a, b) => a.lot.localeCompare(b.lot)),
        }))
        .sort((a, b) => a.seed - b.seed),
    };
  },
});

// Admin curation: pull a stand off the Row (or put it back). The app has
// no auth surface, so this rides a shared secret in the deployment env —
// set ROW_MOD_TOKEN before use. A hidden lot reads vacant everywhere
// (status/streets skip it) and can be re-described; re-describing clears
// the flag in `record`.
export const setHidden = mutation({
  args: {
    token: v.string(),
    seed: v.number(),
    lot: v.string(),
    hidden: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    if (!process.env.ROW_MOD_TOKEN || args.token !== process.env.ROW_MOD_TOKEN)
      return { ok: false, error: "bad token" };
    const rows = await ctx.db
      .query("franchises")
      .withIndex("by_seed", (q) => q.eq("seed", args.seed))
      .collect();
    const fr = rows.find((r) => (r.lot ?? "14") === args.lot);
    if (!fr) return { ok: false, error: "no stand on that lot" };
    await ctx.db.patch(fr._id, {
      hidden: args.hidden ? true : undefined,
      hiddenReason: args.hidden ? args.reason : undefined,
    });
    return { ok: true };
  },
});
