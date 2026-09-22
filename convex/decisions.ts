import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { DecisionPlan } from "../web/js/decision.js";
import { v } from "convex/values";
import { resolveDecision } from "../web/js/decision.js";
import { createCampaignState } from "./exchange";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const snapshotV = v.object({
  day: v.number(),
  index: v.number(),
  debt: v.number(),
  contract: v.union(
    v.null(),
    v.object({ price: v.number(), units: v.number(), fee: v.number() }),
  ),
  extraFee: v.number(),
  staffCondition: v.number(),
});
const hedgeV = v.union(
  v.literal("hold"),
  v.literal("settle"),
  v.literal("contract_light"),
  v.literal("contract"),
  v.literal("contract_heavy"),
);
const staffingV = v.union(v.literal("work"), v.literal("home"), v.literal("apprentice"));
const planV = v.object({
  hedge: hedgeV,
  staffing: staffingV,
  marketing: v.object({ sample: v.boolean(), sponsor: v.boolean() }),
});
const stateV = v.object({
  index: v.number(),
  debt: v.number(),
  contract: v.union(
    v.null(),
    v.object({ price: v.number(), units: v.number(), fee: v.number() }),
  ),
  till: v.number(),
  rep: v.number(),
  matchaPrice: v.number(),
});
const resultV = v.object({
  ok: v.boolean(),
  plan: v.object({
    hedge: hedgeV,
    staffing: staffingV,
    marketing: v.object({ sample: v.boolean(), sponsor: v.boolean() }),
  }),
  index: v.number(),
  debt: v.number(),
  contract: v.union(
    v.null(),
    v.object({ price: v.number(), units: v.number(), fee: v.number() }),
  ),
  extraFee: v.number(),
  fee: v.number(),
  interest: v.number(),
  settlement: v.number(),
});

async function requireSession(ctx: QueryCtx | MutationCtx, tokenHash: string) {
  const session = await ctx.db
    .query("planSessions")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!session) return null;
  if (session.expiresAt <= Date.now()) return null;
  if (session.phase === "abandoned") return null;
  return session;
}

async function requireDecision(
  ctx: QueryCtx | MutationCtx,
  session: Doc<"planSessions">,
  day: number,
) {
  const decision = await ctx.db
    .query("dayDecisions")
    .withIndex("by_campaign_day", (q) =>
      q.eq("campaignId", session.campaignId).eq("day", day),
    )
    .unique();
  if (!decision || decision.sessionId !== session._id) return null;
  return decision;
}

function sameSnapshot(
  a: { index: number; debt: number; extraFee: number; staffCondition: number; contract: { price: number; units: number; fee: number } | null },
  b: { index: number; debt: number; extraFee: number; staffCondition: number; contract: { price: number; units: number; fee: number } | null },
) {
  if (a.index !== b.index || a.debt !== b.debt || a.extraFee !== b.extraFee || a.staffCondition !== b.staffCondition) return false;
  if ((a.contract === null) !== (b.contract === null)) return false;
  if (a.contract && b.contract)
    return a.contract.price === b.contract.price && a.contract.units === b.contract.units && a.contract.fee === b.contract.fee;
  return true;
}

export async function commitRecord(
  ctx: MutationCtx,
  decision: Doc<"dayDecisions">,
  plan: DecisionPlan,
  source: "browser" | "email",
) {
  if (decision.status === "committed")
    return { ok: true as const, result: decision.result, duplicate: true as const, source: decision.source };
  const result = resolveDecision(decision.snapshot, plan);
  if (!result.ok) return { ok: false as const, why: result.why };
  await ctx.db.patch(decision._id, {
    status: "committed",
    plan: result.plan,
    result,
    source,
    committedAt: Date.now(),
  });
  await ctx.db.patch(decision.sessionId, { phase: "trading" });
  await ctx.db.patch(decision.campaignId, {
    debt: result.debt,
    contractPrice: result.contract ? result.contract.price : undefined,
    contractUnits: result.contract ? result.contract.units : undefined,
    contractFee: result.contract ? result.contract.fee : undefined,
  });
  return { ok: true as const, result, duplicate: false as const, source };
}

export const begin = internalMutation({
  args: { tokenHash: v.string(), seed: v.optional(v.number()) },
  returns: v.object({
    ok: v.boolean(),
    why: v.optional(v.string()),
    campaignId: v.optional(v.id("campaigns")),
    day: v.optional(v.number()),
    phase: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!/^[a-f0-9]{64}$/.test(args.tokenHash)) return { ok: false, why: "bad token" };
    if (args.seed !== undefined && (!Number.isFinite(args.seed) || !Number.isInteger(args.seed)))
      return { ok: false, why: "bad seed" };
    const existing = await ctx.db
      .query("planSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (existing) {
      if (existing.expiresAt <= Date.now() || existing.phase === "abandoned")
        return { ok: false, why: "expired or abandoned" };
      return { ok: true, campaignId: existing.campaignId, day: existing.day, phase: existing.phase };
    }
    const campaignId = await createCampaignState(ctx, args.seed ?? 7);
    await ctx.db.insert("planSessions", {
      tokenHash: args.tokenHash,
      campaignId,
      day: 0,
      phase: "review",
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return { ok: true, campaignId, day: 0, phase: "review" };
  },
});

export const prepare = internalMutation({
  args: { tokenHash: v.string(), snapshot: snapshotV, plan: planV },
  returns: v.object({
    ok: v.boolean(),
    why: v.optional(v.string()),
    decisionId: v.optional(v.id("dayDecisions")),
    day: v.optional(v.number()),
    status: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.tokenHash);
    if (!session) return { ok: false, why: "no session" };
    const day = args.snapshot.day;
    if (session.phase === "review") {
      if (day !== session.day + 1) return { ok: false, why: "wrong day" };
    } else if (session.phase === "planning") {
      if (day !== session.day) return { ok: false, why: "wrong day" };
    } else if (session.phase === "trading") {
      if (day !== session.day) return { ok: false, why: "wrong day" };
    } else {
      return { ok: false, why: "not plannable" };
    }
    const existing = await requireDecision(ctx, session, day);
    if (existing) {
      if (!sameSnapshot(existing.snapshot, args.snapshot))
        return { ok: false, why: "conflicting snapshot" };
      return { ok: true, decisionId: existing._id, day, status: existing.status };
    }
    if (session.phase === "trading") return { ok: false, why: "not prepared" };
    const check = resolveDecision(args.snapshot, args.plan);
    if (!check.ok) return { ok: false, why: check.why };
    const decisionId = await ctx.db.insert("dayDecisions", {
      campaignId: session.campaignId,
      day,
      sessionId: session._id,
      status: "pending",
      snapshot: args.snapshot,
      plan: check.plan,
      createdAt: Date.now(),
    });
    await ctx.db.patch(session._id, { day, phase: "planning" });
    return { ok: true, decisionId, day, status: "pending" };
  },
});

export const stage = internalMutation({
  args: { tokenHash: v.string(), day: v.number(), plan: planV },
  returns: v.object({
    ok: v.boolean(),
    why: v.optional(v.string()),
    decisionId: v.optional(v.id("dayDecisions")),
    day: v.optional(v.number()),
    status: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.tokenHash);
    if (!session) return { ok: false, why: "no session" };
    if (session.phase !== "planning" || session.day !== args.day)
      return { ok: false, why: "not plannable" };
    const decision = await requireDecision(ctx, session, args.day);
    if (!decision) return { ok: false, why: "not prepared" };
    if (decision.status === "committed")
      return { ok: true, decisionId: decision._id, day: args.day, status: "committed" };
    const check = resolveDecision(decision.snapshot, args.plan);
    if (!check.ok) return { ok: false, why: check.why };
    await ctx.db.patch(decision._id, { plan: check.plan });
    return { ok: true, decisionId: decision._id, day: args.day, status: "pending" };
  },
});

export const commit = internalMutation({
  args: { tokenHash: v.string(), day: v.number(), plan: planV },
  returns: v.object({
    ok: v.boolean(),
    why: v.optional(v.string()),
    decisionId: v.optional(v.id("dayDecisions")),
    day: v.optional(v.number()),
    source: v.optional(v.string()),
    duplicate: v.optional(v.boolean()),
    result: v.optional(resultV),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.tokenHash);
    if (!session) return { ok: false, why: "no session" };
    if (args.day < session.day) return { ok: false, why: "stale decision" };
    if (args.day !== session.day || (session.phase !== "planning" && session.phase !== "trading"))
      return { ok: false, why: "not committable" };
    const decision = await requireDecision(ctx, session, args.day);
    if (!decision) return { ok: false, why: "not prepared" };
    if (decision.status === "committed") {
      await ctx.db.patch(session._id, { phase: "trading" });
      return {
        ok: true,
        decisionId: decision._id,
        day: args.day,
        source: decision.source,
        duplicate: true,
        result: decision.result,
      };
    }
    const check = resolveDecision(decision.snapshot, args.plan);
    if (!check.ok) return { ok: false, why: check.why };
    const committed = await commitRecord(ctx, decision, check.plan, "browser");
    if (!committed.ok) return { ok: false, why: committed.why };
    await ctx.db.patch(session._id, { phase: "trading" });
    return {
      ok: true,
      decisionId: decision._id,
      day: args.day,
      source: "browser",
      duplicate: false,
      result: committed.result,
    };
  },
});

function validState(s: {
  index: number; debt: number; contract: { price: number; units: number; fee: number } | null;
  till: number; rep: number; matchaPrice: number;
}) {
  if (!Number.isFinite(s.index) || s.index < 0.6 || s.index > 2.6) return false;
  if (!Number.isFinite(s.debt) || s.debt < 0) return false;
  if (!Number.isFinite(s.till) || !Number.isFinite(s.rep) || s.rep < 0 || s.rep > 100) return false;
  if (!Number.isFinite(s.matchaPrice) || s.matchaPrice < 4.2 || s.matchaPrice > 5.4) return false;
  if (s.contract !== null) {
    const c = s.contract;
    if (typeof c !== "object") return false;
    if (!Number.isFinite(c.price) || c.price < 0.6 || c.price > 2.6) return false;
    if (!Number.isInteger(c.units) || c.units <= 0 || c.units > 4800) return false;
    if (!Number.isFinite(c.fee) || c.fee < 0) return false;
  }
  return true;
}

function sameState(
  a: { index: number; debt: number; contract: { price: number; units: number; fee: number } | null; till: number; rep: number; matchaPrice: number },
  b: { index: number; debt: number; contract: { price: number; units: number; fee: number } | null; till: number; rep: number; matchaPrice: number },
) {
  if (a.index !== b.index || a.debt !== b.debt || a.till !== b.till || a.rep !== b.rep || a.matchaPrice !== b.matchaPrice) return false;
  if ((a.contract === null) !== (b.contract === null)) return false;
  if (a.contract && b.contract)
    return a.contract.price === b.contract.price && a.contract.units === b.contract.units && a.contract.fee === b.contract.fee;
  return true;
}

export const finish = internalMutation({
  args: { tokenHash: v.string(), day: v.number(), state: stateV, ownerName: v.optional(v.string()) },
  returns: v.object({
    ok: v.boolean(),
    why: v.optional(v.string()),
    phase: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.tokenHash);
    if (!session) return { ok: false, why: "no session" };
    if (!Number.isInteger(args.day) || args.day < 1 || args.day > 5)
      return { ok: false, why: "bad day" };
    if (session.day !== args.day) return { ok: false, why: "wrong day" };
    if (!validState(args.state)) return { ok: false, why: "bad state" };
    const decision = await requireDecision(ctx, session, args.day);
    if (session.phase === "review" || session.phase === "done") {
      if (!decision || !decision.closingState || !sameState(decision.closingState, args.state))
        return { ok: false, why: "conflicting finish" };
      return { ok: true, phase: session.phase };
    }
    if (session.phase !== "trading") return { ok: false, why: "not trading" };
    if (!decision || decision.status !== "committed")
      return { ok: false, why: "not committed" };
    const s = args.state;
    await ctx.db.patch(decision._id, { closingState: s });
    await ctx.db.patch(session.campaignId, {
      day: args.day,
      beanIndex: s.index,
      debt: s.debt,
      contractPrice: s.contract ? s.contract.price : undefined,
      contractUnits: s.contract ? s.contract.units : undefined,
      contractFee: s.contract ? s.contract.fee : undefined,
      till: s.till,
      reputation: s.rep,
      matchaPrice: s.matchaPrice,
      status: args.day >= 5 ? "done" : "open",
    });
    const ownerName = (args.ownerName ?? "").trim().slice(0, 40);
    if (ownerName) {
      const stand = await ctx.db
        .query("stands")
        .withIndex("by_campaign_owner", (q) =>
          q.eq("campaignId", session.campaignId).eq("ownerName", ownerName),
        )
        .unique();
      if (stand) await ctx.db.patch(stand._id, { till: s.till, reputation: s.rep });
      else await ctx.db.insert("stands", { campaignId: session.campaignId, ownerName, till: s.till, reputation: s.rep });
    }
    const phase = args.day >= 5 ? "done" : "review";
    await ctx.db.patch(session._id, { phase });
    return { ok: true, phase };
  },
});

export const abandon = internalMutation({
  args: { tokenHash: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("planSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (session && session.phase !== "abandoned")
      await ctx.db.patch(session._id, { phase: "abandoned" });
    return { ok: true };
  },
});

export const authorizeDecision = internalQuery({
  args: { tokenHash: v.string(), decisionId: v.id("dayDecisions") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("dayDecisions"),
      campaignId: v.id("campaigns"),
      day: v.number(),
      snapshot: snapshotV,
      plan: planV,
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.tokenHash);
    if (!session) return null;
    const row = await ctx.db.get(args.decisionId);
    if (!row || row.sessionId !== session._id) return null;
    if (row.status !== "pending" || session.phase !== "planning" || row.day !== session.day)
      return null;
    return {
      _id: row._id,
      campaignId: row.campaignId,
      day: row.day,
      snapshot: row.snapshot,
      plan: row.plan,
      status: row.status,
    };
  },
});
