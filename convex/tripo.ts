import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { hashKey } from "./apiCache";

// Tripo v3 — the spine of the Tripothon S1 "Generative District" (TRIPOTHON.md).
//
// Key-gated: without TRIPO_API_KEY every public surface returns a fallback
// flag and the floor keeps its classic Kenney/procedural district. The game
// is always playable — completeness beats spectacle.
//
// Determinism: `key` is a content hash of the full generation spec
// (prompt + model + all seeds + limits), so identical inputs share one row
// and generate exactly once — district kits are generated per seed, cached
// forever, and reused across players.
//
// Completion: the signed webhook (http.tripoWebhook) is primary; the
// tripo-task-reaper cron is the backstop for lost deliveries.
//
// Docs: https://developers.tripo3d.ai (v3, openapi.tripo3d.ai)

const BASE = "https://openapi.tripo3d.ai/v3";

// The live API requires dated model versions (the docs' short names are
// rejected). Map the short, readable spec names to the pinned versions so
// prompts stay stable and re-generations are reproducible.
// Verified against the live API 2026-09-15.
export const MODEL_IDS: Record<string, string> = {
  "tripo-p1": "P1-20260311",
  "tripo-p2": "P2-20260801",
  "tripo-v2.5": "v2.5-20250123",
  "tripo-v3.0": "v3.0-20250812",
  "tripo-v3.1": "v3.1-20260211",
};

function resolveModel(model: string): string {
  if (MODEL_IDS[model]) return MODEL_IDS[model];
  if (/^(P1|P2|v\d)\./.test(model) || /^P\d-\d{8}$/.test(model)) return model;
  throw new Error(`unknown tripo model '${model}' (use ${Object.keys(MODEL_IDS).join(" | ")})`);
}

// Reaper thresholds: webhooks normally land within a few minutes; re-query
// anything still processing after 10 min, give up after 1h (failed tasks
// are refunded, so a lost task only costs the row, not credits).
export const REAPER_STUCK_MS = 10 * 60 * 1000;
export const REAPER_DEAD_MS = 60 * 60 * 1000;

export interface GenerateSpec {
  prompt: string;
  model: string; // "tripo-p1" (low-poly, our workhorse) | "tripo-v3.1" (hero)
  modelSeed?: number;
  imageSeed?: number;
  textureSeed?: number;
  faceLimit?: number;
  pbr?: boolean;
  negativePrompt?: string;
}

// Content-address asset key. Deterministic across calls and deployments.
export function assetKey(spec: GenerateSpec): string {
  const fingerprint = JSON.stringify([
    spec.prompt,
    spec.model,
    spec.modelSeed ?? 0,
    spec.imageSeed ?? 0,
    spec.textureSeed ?? 0,
    spec.faceLimit ?? 0,
    spec.pbr ?? true,
    spec.negativePrompt ?? "",
  ]);
  return `tripo:${hashKey(fingerprint)}`;
}

// Floor read at boot: one spec key → status + URLs, or null (never generated).
// The client polls this while status is "processing"; "success" ships the
// cross-fade-in, anything else takes the classic stand-in.
export const byKey = query({
  args: { key: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: string;
    provider: string;
    taskId: string | null;
    modelUrl: string | null;
    previewUrl: string | null;
    error: string | null;
  } | null> => {
    const row = await ctx.db
      .query("tripoAssets")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (!row) return null;
    return {
      status: row.status,
      provider: row.provider,
      taskId: row.taskId ?? null,
      modelUrl: row.modelUrl ?? null,
      previewUrl: row.previewUrl ?? null,
      error: row.error ?? null,
    };
  },
});

// Ops read: account credits (console also shows this; cheap, high limit).
export const balance = action({
  args: {},
  handler: async (ctx): Promise<{
    fallback: boolean;
    balance?: number;
    frozen?: number;
  }> => {
    const key = process.env.TRIPO_API_KEY;
    if (!key) return { fallback: true };
    try {
      const res = await fetch(`${BASE}/account/balance`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = (await res.json()) as {
        code: number;
        data?: { balance?: number; frozen?: number };
      };
      if (data.code !== 0) throw new Error(`tripo code ${data.code}`);
      return {
        fallback: false,
        balance: data.data?.balance,
        frozen: data.data?.frozen,
      };
    } catch {
      return { fallback: true };
    }
  },
});

// Public entry point: get-or-create the asset for a spec. Never throws on
// upstream trouble — every failure path returns a status the floor can fall
// back from (missing key / over daily budget / API error).
export const generate = action({
  args: {
    prompt: v.string(),
    model: v.string(),
    modelSeed: v.optional(v.number()),
    imageSeed: v.optional(v.number()),
    textureSeed: v.optional(v.number()),
    faceLimit: v.optional(v.number()),
    pbr: v.optional(v.boolean()),
    negativePrompt: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    key: string;
    created: boolean;
    fallback?: boolean;
    status: string;
    modelUrl?: string | null;
    error?: string;
  }> => {
    const spec: GenerateSpec = {
      prompt: args.prompt,
      model: args.model,
      modelSeed: args.modelSeed,
      imageSeed: args.imageSeed,
      textureSeed: args.textureSeed,
      faceLimit: args.faceLimit,
      pbr: args.pbr,
      negativePrompt: args.negativePrompt,
    };
    const key = assetKey(spec);
    const existing = await ctx.runQuery(api.tripo.byKey, { key });
    if (
      existing &&
      (existing.status === "success" || existing.status === "processing")
    ) {
      return { key, created: false, status: existing.status, modelUrl: existing.modelUrl };
    }
    const apiKey = process.env.TRIPO_API_KEY;
    if (!apiKey) return { key, created: false, fallback: true, status: "missing" };
    // Daily spend guard (same pattern as the Nebius prose budget): a public
    // endpoint can never burn past the day's task allowance. Failed tasks
    // refund credits, so re-rolls only consume this budget on success.
    const n = await ctx.runMutation(api.apiCache.claimDaily, { name: "tripo-generate" });
    const budget = Number(process.env.TRIPO_DAILY_BUDGET) || 50;
    if (n > budget)
      return { key, created: false, fallback: true, status: "missing", error: "daily-budget" };
    try {
      const body: Record<string, unknown> = {
        prompt: spec.prompt,
        model: resolveModel(spec.model),
        pbr: spec.pbr ?? true,
      };
      if (spec.modelSeed !== undefined) body.model_seed = spec.modelSeed;
      if (spec.imageSeed !== undefined) body.image_seed = spec.imageSeed;
      if (spec.textureSeed !== undefined) body.texture_seed = spec.textureSeed;
      if (spec.faceLimit !== undefined) body.face_limit = spec.faceLimit;
      if (spec.negativePrompt) body.negative_prompt = spec.negativePrompt;
      const res = await fetch(`${BASE}/generation/text-to-model`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        code: number;
        message?: string;
        data?: { task_id?: string };
      };
      const taskId = data.data?.task_id;
      if (!res.ok || data.code !== 0 || !taskId)
        throw new Error(data.message ?? `tripo ${res.status}`);
      await ctx.runMutation(internal.tripo.markProcessing, {
        provider: "tripo",
        key,
        taskId,
        prompt: spec.prompt,
        model: spec.model,
        modelSeed: spec.modelSeed,
        imageSeed: spec.imageSeed,
        textureSeed: spec.textureSeed,
        faceLimit: spec.faceLimit,
        pbr: spec.pbr,
        negativePrompt: spec.negativePrompt,
      });
      return { key, created: true, status: "processing" };
    } catch (e) {
      return {
        key,
        created: false,
        fallback: true,
        status: "missing",
        error: e instanceof Error ? e.message : "generate failed",
      };
    }
  },
});

// Reaper backstop: re-query tasks stuck in "processing" (lost webhook).
// Internal — driven by the cron, never public.
export const reaper = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; resolved: number; failed: number }> => {
    const apiKey = process.env.TRIPO_API_KEY;
    if (!apiKey) return { checked: 0, resolved: 0, failed: 0 };
    const rows = (await ctx.runQuery(internal.tripo.staleProcessing, {}))
      .filter((r) => r.provider === "tripo");
    let resolved = 0;
    let failed = 0;
    const now = Date.now();
    for (const row of rows.slice(0, 25)) {
      if (now - row.createdAt > REAPER_DEAD_MS) {
        await ctx.runMutation(internal.tripo.applyResult, {
          taskId: row.taskId,
          ok: false,
          error: "reaper: timed out",
        });
        failed++;
        continue;
      }
      if (now - row.createdAt < REAPER_STUCK_MS) continue; // webhook likely on its way
      try {
        const res = await fetch(`${BASE}/tasks/${row.taskId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = (await res.json()) as {
          code: number;
          data?: {
            status?: string;
            output?: { model_url?: string; rendered_image_url?: string };
          };
        };
        const t = data.data;
        if (!t || data.code !== 0) continue; // transient — retry next tick
        if (t.status === "success") {
          await ctx.runMutation(internal.tripo.applyResult, {
            taskId: row.taskId,
            ok: true,
            modelUrl: t.output?.model_url,
            previewUrl: t.output?.rendered_image_url,
          });
          resolved++;
        } else if (t.status === "failed" || t.status === "cancelled" || t.status === "banned") {
          await ctx.runMutation(internal.tripo.applyResult, {
            taskId: row.taskId,
            ok: false,
            error: `reaper: ${t.status}`,
          });
          failed++;
        }
      } catch {
        // network blip — leave processing, next tick retries
      }
    }
    return { checked: rows.length, resolved, failed };
  },
});

// Rows the reaper should look at: processing with a task id (actions can't
// touch the db — the reaper runs this as a query).
export const staleProcessing = internalQuery({
  args: {},
  handler: async (ctx): Promise<{
    provider: string;
    taskId: string;
    createdAt: number;
  }[]> => {
    const all = await ctx.db.query("tripoAssets").collect();
    return all
      .filter((r) => r.status === "processing" && r.taskId)
      .map((r) => ({
        provider: r.provider,
        taskId: r.taskId as string,
        createdAt: r.createdAt,
      }));
  },
});

// Insert-or-advance a row to "processing" with a fresh task id (re-rolls
// reuse the failed row so the key stays the content-addressed identity).
export const markProcessing = internalMutation({
  args: {
    provider: v.string(),
    key: v.string(),
    taskId: v.string(),
    prompt: v.string(),
    model: v.string(),
    modelSeed: v.optional(v.number()),
    imageSeed: v.optional(v.number()),
    textureSeed: v.optional(v.number()),
    faceLimit: v.optional(v.number()),
    pbr: v.optional(v.boolean()),
    negativePrompt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("tripoAssets")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "processing",
        taskId: args.taskId,
        provider: args.provider,
        modelUrl: undefined,
        previewUrl: undefined,
        error: undefined,
        createdAt: now,
      });
    } else {
      await ctx.db.insert("tripoAssets", {
        key: args.key,
        provider: args.provider,
        taskId: args.taskId,
        status: "processing",
        prompt: args.prompt,
        model: args.model,
        modelSeed: args.modelSeed,
        imageSeed: args.imageSeed,
        textureSeed: args.textureSeed,
        faceLimit: args.faceLimit,
        pbr: args.pbr,
        negativePrompt: args.negativePrompt,
        createdAt: now,
      });
    }
  },
});

// Terminal result from webhook or reaper. Idempotent: same task id may be
// delivered twice (Tripo retries); patching the same value is harmless.
// Unknown task ids are dropped silently (dedupe by design).
export const applyResult = internalMutation({
  args: {
    taskId: v.string(),
    ok: v.boolean(),
    modelUrl: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const rows = await ctx.db
      .query("tripoAssets")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    for (const row of rows) {
      if (row.status !== "processing") continue; // already terminal
      if (args.ok) {
        await ctx.db.patch(row._id, {
          status: "success",
          modelUrl: args.modelUrl,
          previewUrl: args.previewUrl,
          error: undefined,
        });
      } else {
        await ctx.db.patch(row._id, {
          status: "failed",
          error: args.error ?? "generation failed",
          modelUrl: undefined,
          previewUrl: undefined,
        });
      }
    }
  },
});
