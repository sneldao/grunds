import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { hashKey } from "./apiCache";
import { NUDGE_MS, REAPER_DEAD_MS, REAPER_STUCK_MS } from "./tripo";

// Hyper3D Rodin — the describe-path builder for franchise stands.
// Proven in-engine (web/assets/hyper3d/proof-stand-present.png): a text
// prompt grows a street-coherent stand that holds its own next to the
// procedural work, so player words route here first and fall back to
// Tripo (franchise.describe) — never the reverse.
//
// Same spine as every other provider: rows live in tripoAssets with
// provider "rodin", keyed `rodin:<hash>`, so status/record/streets,
// the Grove mirror, and persist plumbing work unchanged. The reaper
// dispatches on provider (see crons.ts "rodin-task-reaper").
//
// Lifecycle (mirrors tools/vendor-hyper3d.mjs): POST /rodin (multipart) →
// { uuid, jobs: { subscription_key } }; POST /status { subscription_key }
// → jobs[] all "Done"; POST /download { task_uuid } → file list, pick the
// .glb. Submit 201s can still carry `error` — check the body, not just
// the status code.
//
// Key-gated like tripo/mint: without RODIN_API_KEY generate returns the
// fallback flag and describe falls through to Tripo. Basic access covers
// Gen-2.5-Low + Raw; Medium+ stays queued behind a Business subscription.

const BASE = "https://api.hyper3d.com/api/v2";

// The workhorse: what the in-engine proof stand was grown with. Raw mesh
// presets without an override arrive enormous, so quality_override always
// rides along (never the tier default).
export const RODIN_MODEL = "Gen-2.5-Low";
export const RODIN_MESH_MODE = "Raw";
export const RODIN_FACE_TARGET = 10000;
export const RODIN_MATERIAL = "PBR";

export interface RodinSpec {
  prompt: string;
  model: string; // RODIN_MODEL — lives in the key so a tier change regrows
  modelSeed?: number; // 0–65535 (Rodin range; callers mod their seeds down)
  qualityOverride?: number; // face target; always set, never tier-default
}

// Content-address asset key. `rodin:`-namespaced so a (prompt, seed) pair
// grown here never collides with its Tripo twin — switching providers
// regrows, never clobbers a cached stand.
export function rodinKey(spec: RodinSpec): string {
  const fingerprint = JSON.stringify([
    spec.prompt,
    spec.model,
    spec.modelSeed ?? 0,
    spec.qualityOverride ?? 0,
  ]);
  return `rodin:${hashKey(fingerprint)}`;
}

// taskId packs both Rodin handles: the uuid (for /download) and the
// subscription key (for /status). Internal only — it never leaves the
// server except through staleProcessing → reaper/pollTask, which split it
// back open. by_task lookups use the packed form verbatim.
function packTask(uuid: string, subscriptionKey: string): string {
  return `${uuid}:${subscriptionKey}`;
}
function unpackTask(taskId: string): { uuid: string; subscriptionKey: string } | null {
  const i = taskId.indexOf(":");
  if (i <= 0) return null;
  return { uuid: taskId.slice(0, i), subscriptionKey: taskId.slice(i + 1) };
}

// Public entry point: get-or-create the asset for a spec. Same degradation
// contract as tripo/mint generate — never throws on upstream trouble, every
// failure path returns fallback so describe can try the next builder.
export const generate = action({
  args: {
    prompt: v.string(),
    model: v.string(),
    modelSeed: v.optional(v.number()),
    qualityOverride: v.optional(v.number()),
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
    const spec: RodinSpec = {
      prompt: args.prompt,
      model: args.model,
      modelSeed: args.modelSeed,
      qualityOverride: args.qualityOverride,
    };
    const key = rodinKey(spec);
    const existing = await ctx.runQuery(api.tripo.byKey, { key });
    if (
      existing &&
      existing.provider === "rodin" &&
      (existing.status === "success" || existing.status === "processing")
    ) {
      return { key, created: false, status: existing.status, modelUrl: existing.modelUrl };
    }
    const apiKey = process.env.RODIN_API_KEY;
    if (!apiKey) return { key, created: false, fallback: true, status: "missing" };
    // Daily spend guard (same pattern as tripo/mint): a public endpoint can
    // never burn past the day's task allowance.
    const n = await ctx.runMutation(api.apiCache.claimDaily, { name: "rodin-generate" });
    const budget = Number(process.env.RODIN_DAILY_BUDGET) || 10;
    if (n > budget)
      return { key, created: false, fallback: true, status: "missing", error: "daily-budget" };
    try {
      // Text fields only — no image parts on the describe path (photo
      // prompts stay on Tripo). FormData because /rodin is multipart.
      const form = new FormData();
      form.append("prompt", spec.prompt);
      form.append("tier", spec.model);
      form.append("mesh_mode", RODIN_MESH_MODE);
      form.append("geometry_file_format", "glb");
      form.append("material", RODIN_MATERIAL);
      form.append("quality_override", String(spec.qualityOverride ?? RODIN_FACE_TARGET));
      form.append("seed", String((spec.modelSeed ?? 0) % 65536));
      const res = await fetch(`${BASE}/rodin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        uuid?: string;
        jobs?: { subscription_key?: string };
      };
      const uuid = data.uuid;
      const subscriptionKey = data.jobs?.subscription_key;
      if (!res.ok || data.error || !uuid || !subscriptionKey)
        throw new Error(data.error ?? data.message ?? `rodin ${res.status}`);
      await ctx.runMutation(internal.tripo.markProcessing, {
        provider: "rodin",
        key,
        taskId: packTask(uuid, subscriptionKey),
        prompt: spec.prompt,
        model: spec.model,
        modelSeed: spec.modelSeed,
        faceLimit: spec.qualityOverride,
      });
      return { key, created: true, status: "processing" };
    } catch (e) {
      // Task never started — nothing was billed, so hand the budget slot
      // back; flakes must not starve players.
      await ctx.runMutation(api.apiCache.refundDaily, { name: "rodin-generate" });
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

// One live re-query of a Rodin job: status → (when Done) download → .glb
// URL for applyResult, or null while still in flight / on a transient
// read — callers retry.
async function checkRodinTask(
  apiKey: string,
  uuid: string,
  subscriptionKey: string,
): Promise<{ ok: true; modelUrl?: string } | { ok: false; error: string } | null> {
  const json = async (path: string, body: unknown): Promise<{ status: number; data: any }> => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  try {
    const st = await json("/status", { subscription_key: subscriptionKey });
    if (st.status === 429) return null; // honor the backoff — retry next tick
    const jobs = (st.data?.jobs ?? []) as { status?: string }[];
    if (!jobs.length) return null; // transient — retry next tick
    if (jobs.some((j) => j.status === "Failed"))
      return { ok: false, error: `rodin: ${JSON.stringify(st.data).slice(0, 200)}` };
    if (!jobs.every((j) => j.status === "Done")) return null; // queued / running
    const dl = await json("/download", { task_uuid: uuid });
    const files = (dl.data?.files ?? dl.data?.downloads ?? dl.data?.data ?? dl.data?.list ?? []) as (
      | string
      | { url?: string; glb_url?: string; model_url?: string; download_url?: string }
    )[];
    // Query strings ride on the URLs (uuid + token) — match .glb before
    // any ? or end, same as the vendor tool.
    const glb = files
      .map((f) => (typeof f === "string" ? f : (f.url ?? f.glb_url ?? f.model_url ?? f.download_url ?? "")))
      .find((u) => /\.glb(\?|$)/i.test(u));
    if (!glb) return { ok: false, error: "rodin: download has no .glb url" };
    return { ok: true, modelUrl: glb };
  } catch {
    return null;
  }
}

// Live nudge: a status read on a task past NUDGE_MS asks Rodin directly —
// the player watching a worksite shouldn't wait for the hourly reaper.
export const pollTask = internalAction({
  args: { taskId: v.string() },
  handler: async (ctx, args): Promise<{ done: boolean }> => {
    const apiKey = process.env.RODIN_API_KEY;
    if (!apiKey) return { done: false };
    const parts = unpackTask(args.taskId);
    if (!parts) return { done: true }; // not ours — never retry
    const row = (await ctx.runQuery(internal.tripo.staleProcessing, {}))
      .find((r) => r.taskId === args.taskId && r.provider === "rodin");
    if (!row) return { done: true }; // already terminal
    const age = Date.now() - row.createdAt;
    if (age < NUDGE_MS) return { done: false };
    const r = age > REAPER_DEAD_MS
      ? ({ ok: false, error: "reaper: timed out" } as const)
      : await checkRodinTask(apiKey, parts.uuid, parts.subscriptionKey);
    if (!r) return { done: false };
    await ctx.runMutation(internal.tripo.applyResult, {
      taskId: args.taskId,
      ok: r.ok,
      modelUrl: r.ok ? r.modelUrl : undefined,
      error: r.ok ? undefined : r.error,
    });
    return { done: true };
  },
});

// Reaper backstop (Rodin has no webhooks — polling IS the completion path).
// Hourly cron, same thresholds as the Tripo/Mint reapers.
export const reaper = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; resolved: number; failed: number }> => {
    const apiKey = process.env.RODIN_API_KEY;
    if (!apiKey) return { checked: 0, resolved: 0, failed: 0 };
    const rows = (await ctx.runQuery(internal.tripo.staleProcessing, {}))
      .filter((r) => r.provider === "rodin");
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
      const parts = unpackTask(row.taskId);
      if (!parts) {
        await ctx.runMutation(internal.tripo.applyResult, {
          taskId: row.taskId,
          ok: false,
          error: "rodin: malformed task id",
        });
        failed++;
        continue;
      }
      try {
        const r = await checkRodinTask(apiKey, parts.uuid, parts.subscriptionKey);
        if (!r) continue;
        await ctx.runMutation(internal.tripo.applyResult, {
          taskId: row.taskId,
          ok: r.ok,
          modelUrl: r.ok ? r.modelUrl : undefined,
          error: r.ok ? undefined : r.error,
        });
        if (r.ok) resolved++; else failed++;
      } catch {
        // network blip — leave processing, next tick retries
      }
    }
    return { checked: rows.length, resolved, failed };
  },
});
