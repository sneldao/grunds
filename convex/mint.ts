import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { hashKey } from "./apiCache";
import { REAPER_STUCK_MS, REAPER_DEAD_MS } from "./tripo";

// Mint (mint.gg) — the no-credits-contingency provider for the Generative
// District (TRIPOTHON.md §3). Same provider-agnostic contract as tripo.ts:
// content-addressed rows in `tripoAssets`, get-or-create, reaper polling.
//
// Differences from Tripo that matter for design:
// - No webhooks → the reaper IS the completion path (poll LRO, backoff-safe).
// - No seed parameters → determinism comes from key memoization (generate
//   once per seed, cache forever), not API-level reproducibility.
// - Output is Three.js-friendly out of the box: Y-up +Z-forward GLB,
//   optimized GLB, preview + thumbnail images, bounds.
//
// Verified live 2026-09-15: balance via GET /v1/usage; credit estimates via
// POST /v1/pricing:estimate (model fast ≈248, standard ≈798; pack/5 fast
// ≈1240). Base https://api.mint.gg, `Authorization: Bearer`.

const BASE = "https://api.mint.gg";

export type MintPreset = "fast" | "standard" | "production";

export interface MintSpec {
  prompt: string;
  name?: string;
  preset: MintPreset;
  imageUrl?: string; // public HTTPS reference for visual guidance
}

// Content key: identical spec → identical row → generated once. Preset is in
// the key so a future standard-preset re-roll is a new row, not a clobber.
export function mintKey(spec: MintSpec): string {
  const fingerprint = JSON.stringify([
    spec.prompt,
    spec.name ?? "",
    spec.preset,
    spec.imageUrl ?? "",
  ]);
  return `mint:${hashKey(fingerprint)}`;
}

// Account credits (console: platform.mint.gg).
export const balance = action({
  args: {},
  handler: async (ctx): Promise<{
    fallback: boolean;
    totalAvailable?: number;
    creditsUsed?: number;
  }> => {
    const key = process.env.MINT_API_KEY;
    if (!key) return { fallback: true };
    try {
      const res = await fetch(`${BASE}/v1/usage`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) throw new Error(`mint ${res.status}`);
      const data = (await res.json()) as {
        credits?: { totalAvailable?: number };
        apiUsage?: { creditsUsed?: number };
      };
      return {
        fallback: false,
        totalAvailable: data.credits?.totalAvailable,
        creditsUsed: data.apiUsage?.creditsUsed,
      };
    } catch {
      return { fallback: true };
    }
  },
});

// Advisory credit estimate — free, creates no operation. Use for kit sizing.
export const estimate = action({
  args: { preset: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{
    fallback: boolean;
    estimatedTotal?: number;
    requiredToStart?: number;
  }> => {
    const key = process.env.MINT_API_KEY;
    if (!key) return { fallback: true };
    try {
      const res = await fetch(`${BASE}/v1/pricing:estimate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operation: "model_generation",
          generationPreset: args.preset ?? "fast",
        }),
      });
      if (!res.ok) throw new Error(`mint ${res.status}`);
      const data = (await res.json()) as {
        credits?: { estimatedTotal?: number; requiredToStart?: number };
      };
      return {
        fallback: false,
        estimatedTotal: data.credits?.estimatedTotal,
        requiredToStart: data.credits?.requiredToStart,
      };
    } catch {
      return { fallback: true };
    }
  },
});

// Public entry: get-or-create a model for a spec. Same degradation contract
// as tripo.generate — every failure path returns a status the floor can fall
// back from; the game is always playable.
export const generate = action({
  args: {
    prompt: v.string(),
    name: v.optional(v.string()),
    preset: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
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
    const spec: MintSpec = {
      prompt: args.prompt,
      name: args.name,
      preset: (args.preset as MintPreset) ?? "fast",
      imageUrl: args.imageUrl,
    };
    const key = mintKey(spec);
    const existing = await ctx.runQuery(api.tripo.byKey, { key });
    if (
      existing &&
      existing.provider === "mint" &&
      (existing.status === "success" || existing.status === "processing")
    ) {
      return { key, created: false, status: existing.status, modelUrl: existing.modelUrl };
    }
    const apiKey = process.env.MINT_API_KEY;
    if (!apiKey) return { key, created: false, fallback: true, status: "missing" };
    // Daily spend guard (same pattern as tripo.generate / Nebius).
    const n = await ctx.runMutation(api.apiCache.claimDaily, { name: "mint-generate" });
    const budget = Number(process.env.MINT_DAILY_BUDGET) || 10;
    if (n > budget)
      return { key, created: false, fallback: true, status: "missing", error: "daily-budget" };
    try {
      const body: Record<string, unknown> = {
        prompt: spec.prompt,
        generationPreset: spec.preset,
      };
      if (spec.name) body.name = spec.name;
      if (spec.imageUrl) body.imageUrl = spec.imageUrl;
      const res = await fetch(`${BASE}/v1/models:generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        id?: string;
        status?: string;
        detail?: string;
        title?: string;
      };
      if (!res.ok || !data.id)
        throw new Error(data.detail ?? data.title ?? `mint ${res.status}`);
      await ctx.runMutation(internal.tripo.markProcessing, {
        provider: "mint",
        key,
        taskId: data.id,
        prompt: spec.prompt,
        model: `mint-${spec.preset}`,
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

// Poll one Mint long-running operation to a terminal state.
// auto mode runs straight to the asset; on success, fetch the model record
// for its GLB + preview URLs. `billing_required` is left alone (rare with
// 33k credits; would mean a human resolves billing then resumes).
async function pollMint(
  apiKey: string,
  operationId: string,
): Promise<
  | { done: false }
  | { done: true; ok: true; modelUrl: string | null; previewUrl: string | null }
  | { done: true; ok: false; error: string }
> {
  const res = await fetch(`${BASE}/v1/operations/${operationId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`mint op ${res.status}`);
  const op = (await res.json()) as {
    status?: string;
    error?: { message?: string } | string;
    resource?: { id?: string };
    assets?: {
      glbUrl?: string | null;
      optimizedGlbUrl?: string | null;
      previewImageUrl?: string | null;
      thumbnailUrl?: string | null;
    } | null;
  };
  if (op.status !== "succeeded" && op.status !== "partially_succeeded") {
    if (op.status === "failed" || op.status === "canceled")
      return {
        done: true,
        ok: false,
        error:
          op.status +
          (typeof op.error === "string" ? `: ${op.error}` : op.error?.message ? `: ${op.error.message}` : ""),
      };
    return { done: false }; // queued/running/preview_ready/billing_required
  }
  // The operation carries the final assets directly — read them first.
  const a = (op.assets ?? {}) as {
    glbUrl?: string | null;
    optimizedGlbUrl?: string | null;
    previewImageUrl?: string | null;
    thumbnailUrl?: string | null;
  };
  if (a.glbUrl || a.optimizedGlbUrl || a.previewImageUrl) {
    return {
      done: true,
      ok: true,
      // optimizedGlbUrl first — game budget; glbUrl is the full-fidelity file.
      modelUrl: a.optimizedGlbUrl ?? a.glbUrl ?? null,
      previewUrl: a.previewImageUrl ?? a.thumbnailUrl ?? null,
    };
  }
  // Fallback: fetch the model record for its asset stage.
  const modelId = op.resource?.id;
  if (!modelId) return { done: false };
  const mres = await fetch(`${BASE}/v1/models/${modelId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!mres.ok) throw new Error(`mint model ${mres.status}`);
  const model = (await mres.json()) as {
    assets?: {
      glbUrl?: string | null;
      optimizedGlbUrl?: string | null;
      previewImageUrl?: string | null;
      thumbnailUrl?: string | null;
    }[];
  };
  const m = model.assets?.[0] ?? {};
  return {
    done: true,
    ok: true,
    modelUrl: m.optimizedGlbUrl ?? m.glbUrl ?? null,
    previewUrl: m.previewImageUrl ?? m.thumbnailUrl ?? null,
  };
}

// Reaper backstop (Mint has no webhooks — this is the completion path).
// Hourly cron; thresholds shared with the Tripo reaper for consistency.
export const reaper = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; resolved: number; failed: number }> => {
    const apiKey = process.env.MINT_API_KEY;
    if (!apiKey) return { checked: 0, resolved: 0, failed: 0 };
    const rows = (await ctx.runQuery(internal.tripo.staleProcessing, {}))
      .filter((r) => r.provider === "mint");
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
      if (now - row.createdAt < REAPER_STUCK_MS) continue;
      try {
        const r = await pollMint(apiKey, row.taskId);
        if (!r.done) continue;
        if (r.ok) {
          await ctx.runMutation(internal.tripo.applyResult, {
            taskId: row.taskId,
            ok: true,
            modelUrl: r.modelUrl ?? undefined,
            previewUrl: r.previewUrl ?? undefined,
          });
          resolved++;
        } else {
          await ctx.runMutation(internal.tripo.applyResult, {
            taskId: row.taskId,
            ok: false,
            error: `mint: ${r.error}`,
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

// Debug/ops: force-poll a specific operation now (skips the stuck threshold)
// so the first taste-calibration asset doesn't wait for the hourly cron.
export const pollNow = internalAction({
  args: { operationId: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.MINT_API_KEY;
    if (!apiKey) return { fallback: true };
    const r = await pollMint(apiKey, args.operationId);
    if (r.done) {
      await ctx.runMutation(internal.tripo.applyResult, {
        taskId: args.operationId,
        ok: r.ok,
        modelUrl: r.ok ? r.modelUrl ?? undefined : undefined,
        previewUrl: r.ok ? r.previewUrl ?? undefined : undefined,
        error: r.ok ? undefined : `mint: ${r.error}`,
      });
    }
    return r.done
      ? { done: true, ok: r.ok }
      : { done: false };
  },
});
