import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { hashKey } from "./apiCache";

// Nebius Token Factory Applied AI integration for Grunds.
// Uses Nebius AI Studio's OpenAI-compatible inference endpoint (https://api.studio.nebius.ai/v1)
// to power in-character prose generation for the Roaster's Letter and dynamic patron
// gossip dialogues, complete with execution latency and token metrics.
//
// Offline/Fallback safe: if NEBIUS_API_KEY is unset, falls back seamlessly to deterministic templates.

export const DEFAULT_NEBIUS_MODEL = "meta-llama/Meta-Llama-3.1-70B-Instruct";
export const NEBIUS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface NebiusInferenceResult {
  fallback: boolean;
  cached: boolean;
  model: string;
  text: string;
  latencyMs: number;
  tokensUsed?: number;
}

async function nebiusChat(
  prompt: string,
  maxTokens: number,
): Promise<{ text: string; latencyMs: number; tokensUsed: number }> {
  const key = process.env.NEBIUS_API_KEY;
  if (!key) throw new Error("no key");
  const model = process.env.NEBIUS_MODEL ?? DEFAULT_NEBIUS_MODEL;

  const t0 = Date.now();
  const res = await fetch("https://api.studio.nebius.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.75,
    }),
  });

  const latencyMs = Date.now() - t0;
  if (!res.ok) throw new Error(`nebius ${res.status}`);

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty completion");

  return {
    text,
    latencyMs,
    tokensUsed: data.usage?.total_tokens ?? 0,
  };
}

async function cachedNebiusChat(
  ctx: ActionCtx,
  cacheKey: string,
  prompt: string,
  maxTokens: number,
  templated: string,
  force: boolean,
): Promise<NebiusInferenceResult> {
  const model = process.env.NEBIUS_MODEL ?? DEFAULT_NEBIUS_MODEL;
  if (!force) {
    const hit: string | null = await ctx.runQuery(api.apiCache.cacheGet, { key: cacheKey });
    if (hit) {
      return { fallback: false, cached: true, model, text: hit, latencyMs: 0 };
    }
  }

  try {
    const { text, latencyMs, tokensUsed } = await nebiusChat(prompt, maxTokens);
    await ctx.runMutation(api.apiCache.cachePut, {
      key: cacheKey,
      value: text,
      ttlMs: NEBIUS_TTL_MS,
    });
    return { fallback: false, cached: false, model, text, latencyMs, tokensUsed };
  } catch {
    return { fallback: true, cached: false, model, text: templated, latencyMs: 0 };
  }
}

// Generate an enhanced Roaster's Letter using Nebius Token Factory inference
export const enhanceLetterNebius = action({
  args: { body: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<NebiusInferenceResult> => {
    return await cachedNebiusChat(
      ctx,
      `nebius:letter:v1:${hashKey(args.body)}`,
      `You are Idris, a London coffee roaster writing to a café owner you supply. Rewrite this day-note in your voice in under 120 words. Keep every number and fact intact. No headers, no sign-off.\n\n${args.body}`,
      220,
      args.body,
      args.force ?? false,
    );
  },
});

// Generate dynamic regular reactions using Nebius Token Factory inference
export const regularGossipNebius = action({
  args: {
    name: v.string(),
    cohort: v.string(),
    context: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<NebiusInferenceResult> => {
    const templated = `${args.name}: ${args.context}`;
    return await cachedNebiusChat(
      ctx,
      `nebius:gossip:v1:${hashKey(`${args.name}|${args.cohort}|${args.context}`)}`,
      `You are ${args.name}, a regular in a London specialty café (${args.cohort}). React to this current district situation: "${args.context}". Return one short, punchy sentence under 14 words. No quotes, no emoji.`,
      40,
      templated,
      args.force ?? false,
    );
  },
});
