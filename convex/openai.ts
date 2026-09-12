import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { hashKey } from "./apiCache";

// OpenAI prose for the District — server-side only, key-gated.
// Without OPENAI_API_KEY both actions return the templated input unchanged
// ({ fallback: true }) so the floor plays identically offline. With a key,
// the Roaster's Letter gets a one-paragraph in-character rewrite and patrons
// get one-line persona bubbles. Deterministic sim first, LLM prose second.
//
// Token efficiency: prompts are tight (220/40 max tokens on gpt-4o-mini)
// and every completion is cached 7d by input hash — the deterministic sim
// replays identical letter bodies across seeds and days, so repeat prose
// costs zero tokens. Pass force: true to bypass the cache.

export const DEFAULT_MODEL = "gpt-4o-mini";
export const OPENAI_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function chat(prompt: string, maxTokens: number): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("no key");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty completion");
  return text;
}

type ProseResult = { fallback: boolean; cached: boolean; model: string; text: string };

async function cachedChat(
  ctx: ActionCtx,
  cacheKey: string,
  prompt: string,
  maxTokens: number,
  templated: string,
  force: boolean,
): Promise<ProseResult> {
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  if (!force) {
    const hit: string | null = await ctx.runQuery(api.apiCache.cacheGet, { key: cacheKey });
    if (hit) return { fallback: false, cached: true, model, text: hit };
  }
  try {
    const text = await chat(prompt, maxTokens);
    await ctx.runMutation(api.apiCache.cachePut, {
      key: cacheKey,
      value: text,
      ttlMs: OPENAI_TTL_MS,
    });
    return { fallback: false, cached: false, model, text };
  } catch {
    return { fallback: true, cached: false, model, text: templated };
  }
}

// Rewrite the templated Roaster's Letter body in the roaster's voice.
// Falls back to the input body when no key is configured or the call fails.
export const enhanceLetter = action({
  args: { body: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<ProseResult> => {
    return await cachedChat(
      ctx,
      `openai:letter:v1:${hashKey(args.body)}`,
      `You are Idris, a warm but blunt London coffee roaster writing to a café owner you supply. Rewrite this day-note in your voice in under 120 words. Keep every number and fact exactly as written. No headers, no sign-off.\n\n${args.body}`,
      220,
      args.body,
      args.force ?? false,
    );
  },
});

// One-line speech bubble for a named regular reacting to the day.
export const personaLine = action({
  args: {
    name: v.string(),
    quirk: v.string(),
    mood: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ProseResult> => {
    const templated = `${args.name}: ${args.mood}`;
    return await cachedChat(
      ctx,
      `openai:persona:v1:${hashKey(`${args.name}|${args.quirk}|${args.mood}`)}`,
      `You are ${args.name}, a London café regular (${args.quirk}). React to: ${args.mood}. One short sentence, under 15 words, no quotes, no emoji.`,
      40,
      templated,
      args.force ?? false,
    );
  },
});
