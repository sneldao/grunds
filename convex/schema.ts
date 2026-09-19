import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Grunds — The District: persistent multiplayer state.
// Local web/js/* modules remain the headless/local simulator; these tables
// are the server-side source of truth the 3D floor will live-sync against.

export default defineSchema({
  // One campaign run. day is 0 before the first dawn; openDay increments it.
  campaigns: defineTable({
    seed: v.number(),
    day: v.number(),
    beanIndex: v.number(),
    lastTier: v.optional(v.string()),
    matchaPrice: v.number(),
    debt: v.number(),
    contractPrice: v.optional(v.number()),
    contractUnits: v.optional(v.number()),
    contractFee: v.optional(v.number()),
    till: v.number(),
    reputation: v.number(),
    status: v.string(), // "open" | "done"
    createdAt: v.number(),
  }),

  // Dawn event rolls, one row per campaign day. Pity-timed deck, same as local.
  marketEvents: defineTable({
    campaignId: v.id("campaigns"),
    day: v.number(),
    eventId: v.string(),
    tier: v.string(),
    dIndex: v.number(),
    head: v.string(),
    line: v.string(),
    beanIndexAfter: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_day", ["campaignId", "day"]),

  // Named regulars with persistent opinion. Mirrors REGULAR_ROSTER + op state.
  regulars: defineTable({
    campaignId: v.id("campaigns"),
    name: v.string(),
    coh: v.string(),
    quirk: v.string(),
    op: v.number(),
    seen: v.boolean(),
    served: v.number(),
    balked: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_name", ["campaignId", "name"])
    .index("by_campaign_coh", ["campaignId", "coh"]),

  // Undirected friendship edges, stored once per pair (a < b by name).
  friendships: defineTable({
    campaignId: v.id("campaigns"),
    a: v.string(),
    b: v.string(),
  }).index("by_campaign", ["campaignId"]),

  // Roaster's Letter archive — templated today, OpenAI-enhanced next.
  // dir/action/from/createdAt are optional: rows written before the inbox
  // bridge carry none, and the latestInbox query skips them rather than
  // surfacing undated mail.
  letters: defineTable({
    campaignId: v.id("campaigns"),
    day: v.number(),
    head: v.string(),
    body: v.string(),
    dir: v.optional(v.string()), // "in" | "out"
    action: v.optional(v.string()), // inbound command: contract|hold|settle
    from: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_campaign_day", ["campaignId", "day"])
    .index("by_campaign_dir_created", ["campaignId", "dir", "createdAt"]),

  // Player stands — multiplayer till/reputation per campaign. Minimal today,
  // expanded when the floor goes live-sync.
  stands: defineTable({
    campaignId: v.id("campaigns"),
    ownerName: v.string(),
    till: v.number(),
    reputation: v.number(),
  }).index("by_campaign", ["campaignId"]),

  // Tripo-generated assets (Tripothon S1 — the Generative District).
  // Content-addressed: `key` is a hash of the full generation spec, so
  // identical prompts+seeds share one row and generate once. Webhook
  // primary, reaper-cron backstop; `key = "tripo:<djb2>"`.
  tripoAssets: defineTable({
    key: v.string(),
    // "tripo" | "mint" | (future providers) — the table is the provider-
    // agnostic asset spine; the reaper dispatches on this.
    provider: v.string(),
    taskId: v.optional(v.string()),
    status: v.string(), // "processing" | "success" | "failed"
    prompt: v.string(),
    model: v.string(),
    modelSeed: v.optional(v.number()),
    imageSeed: v.optional(v.number()),
    textureSeed: v.optional(v.number()),
    faceLimit: v.optional(v.number()),
    pbr: v.optional(v.boolean()),
    negativePrompt: v.optional(v.string()),
    modelUrl: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_task", ["taskId"]),

  // External-API response cache — token/cost efficiency. Firecrawl news
  // (6h TTL: commodity news moves daily) and OpenAI prose (7d TTL: the
  // deterministic sim replays identical bodies across seeds and days).
  // Values are JSON strings; expired rows are GC'd inline on write.
  apiCache: defineTable({
    key: v.string(),
    value: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_key", ["key"]),
});
