import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { commitRecord } from "./decisions";
import { quoteDayPlan } from "../web/js/economy.js";
import { modifiersForDay } from "../web/js/gentrification.js";
import type { Id } from "./_generated/dataModel";
import type { DecisionPlan, HedgeChoice } from "../web/js/decision.js";

// AgentMail inbox for the Roaster's Letter — reply-to-command, server-side.
// The webhook in http.ts verifies the Svix signature and forwards here.
// The email body is parsed for the first command keyword (contract / hold /
// settle) and applied to the campaign, mirroring web/js letter reply
// handling. Every inbound AND outbound is archived into `letters` so
// judges see the audit trail. Thread/recipient → campaign mappings live in
// apiCache (30d) so a reply resolves to the right campaign.

const AGENTMAIL_API = "https://api.agentmail.to/v0";
const MAIL_MAP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const planV = v.object({
  hedge: v.union(
    v.literal("hold"),
    v.literal("settle"),
    v.literal("contract_light"),
    v.literal("contract"),
    v.literal("contract_heavy"),
  ),
  staffing: v.union(v.literal("work"), v.literal("home"), v.literal("apprentice")),
  marketing: v.object({ sample: v.boolean(), sponsor: v.boolean() }),
});

function cleanAddress(addr: string): string | null {
  const a = String(addr).trim().toLowerCase();
  if (!a || a.length > 200 || /[\r\n]/.test(a) || !a.includes("@")) return null;
  return a;
}

export async function sendMail(
  to: string,
  subject: string,
  text: string,
): Promise<{ threadId?: string; messageId?: string } | null> {
  const key = process.env.AGENTMAIL_API_KEY;
  const inbox = process.env.AGENTMAIL_INBOX_ID;
  if (!key || !inbox) return null;
  const res = await fetch(
    `${AGENTMAIL_API}/inboxes/${encodeURIComponent(inbox)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, subject, text }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { thread_id?: string; message_id?: string };
  return { threadId: data.thread_id, messageId: data.message_id };
}

// POST the Roaster's Letter to a real inbox. The client passes the letter
// body it just rendered, so the email reads identically to the on-paper
// letter. Thread + recipient mappings are recorded so the reply resolves.
export const sendLetter = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    campaignId: v.optional(v.id("campaigns")),
    decisionId: v.optional(v.id("dayDecisions")),
    day: v.optional(v.number()),
  },
  returns: v.object({ ok: v.boolean(), threadId: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const sent = await sendMail(args.to, args.subject, args.body);
    if (!sent) return { ok: false };
    if (args.campaignId) {
      await ctx.runMutation(internal.agentmail.recordOutbound, {
        campaignId: args.campaignId,
        decisionId: args.decisionId,
        day: args.day ?? 0,
        to: args.to,
        threadId: sent.threadId ?? "",
        subject: args.subject,
        body: args.body,
      });
    }
    return { ok: true, threadId: sent.threadId };
  },
});

export const sendPlanMail = internalAction({
  args: { tokenHash: v.string(), decisionId: v.id("dayDecisions"), to: v.string() },
  returns: v.object({ ok: v.boolean(), why: v.optional(v.string()), threadId: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const to = cleanAddress(args.to);
    if (!to) return { ok: false, why: "bad address" };
    const row = await ctx.runQuery(internal.decisions.authorizeDecision, {
      tokenHash: args.tokenHash,
      decisionId: args.decisionId,
    });
    if (!row) return { ok: false, why: "unauthorized" };
    const p = row.plan;
    const s = row.snapshot;
    const q = quoteDayPlan({
      day: row.day, hedge: p.hedge, staffing: p.staffing, marketing: p.marketing,
      debt: s.debt, extraFee: s.extraFee, modifiers: modifiersForDay(row.day),
    });
    const committed = q.fixedMinimum + q.contractFee + q.interest;
    const lines = [
      `Day ${row.day} — your posted plan`,
      ``,
      `hedge: ${p.hedge} · staffing: ${p.staffing} · sample: ${p.marketing.sample ? "yes" : "no"} · sponsor: ${p.marketing.sponsor ? "yes" : "no"}`,
      `board ${s.index.toFixed(2)} · tab ${s.debt.toFixed(2)}${s.contract ? ` · contract ${s.contract.units} cups @ ${s.contract.price.toFixed(2)}` : ""}`,
      `committed minimum ${committed.toFixed(2)} · fixed subtotal ${q.fixedMinimum.toFixed(2)} · contract fee ${q.contractFee.toFixed(2)} · interest ${q.interest.toFixed(2)} · settlement ${q.settlement.toFixed(2)}`,
      `training ${q.training.toFixed(2)} · sampling ${q.sampling.toFixed(2)} · sponsor ${q.marketing.toFixed(2)}`,
      ``,
      `Reply with contract_light, contract, contract_heavy, hold, or settle on the first line; staffing and street work use the plan above.`,
      ``,
      `— Idris`,
    ];
    const subject = `GRUNDS — day ${row.day} plan`;
    const sent = await sendMail(to, subject, lines.join("\n"));
    if (!sent) return { ok: false, why: "send failed" };
    await ctx.runMutation(internal.agentmail.recordOutbound, {
      campaignId: row.campaignId,
      decisionId: args.decisionId,
      day: row.day,
      to,
      threadId: sent.threadId ?? "",
      subject,
      body: lines.join("\n"),
      postedPlan: p,
    });
    return { ok: true, threadId: sent.threadId };
  },
});

export const recordOutbound = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    decisionId: v.optional(v.id("dayDecisions")),
    day: v.optional(v.number()),
    to: v.string(),
    threadId: v.string(),
    subject: v.string(),
    body: v.string(),
    postedPlan: v.optional(planV),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const recipient = cleanAddress(args.to);
    if (!recipient) return null;
    const mapping = JSON.stringify({
      campaignId: args.campaignId,
      decisionId: args.decisionId ?? null,
      day: args.day ?? 0,
      recipient,
      postedPlan: args.postedPlan ?? null,
    });
    if (args.threadId) {
      const key = `agentmail:thread:${args.threadId}`;
      const existing = await ctx.db
        .query("apiCache")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { value: mapping, createdAt: now, expiresAt: now + MAIL_MAP_TTL_MS });
      } else {
        await ctx.db.insert("apiCache", { key, value: mapping, createdAt: now, expiresAt: now + MAIL_MAP_TTL_MS });
      }
    }
    await ctx.db.insert("letters", {
      campaignId: args.campaignId,
      day: args.day ?? 0,
      head: `SENT: ${args.subject}`.slice(0, 80),
      body: `Posted to ${args.to}\n\n${args.body}`.slice(0, 2000),
      dir: "out",
      decisionId: args.decisionId,
      createdAt: now,
    });
    return null;
  },
});

// Resolve an inbound reply to its campaign — thread mapping first (a reply
// to a letter we sent), then the sender address (a fresh mail from a known
// recipient). Returns the campaignId string or null.
export const resolveThread = internalQuery({
  args: { threadId: v.string(), from: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      campaignId: v.id("campaigns"),
      decisionId: v.union(v.null(), v.id("dayDecisions")),
      day: v.number(),
      recipient: v.string(),
      postedPlan: v.union(v.null(), planV),
    }),
  ),
  handler: async (ctx, args) => {
    if (!args.threadId) return null;
    const row = await ctx.db
      .query("apiCache")
      .withIndex("by_key", (q) => q.eq("key", `agentmail:thread:${args.threadId}`))
      .unique();
    if (!row || row.expiresAt <= Date.now()) return null;
    let m: { campaignId?: string; decisionId?: string | null; day?: number; recipient?: string; postedPlan?: unknown };
    try {
      m = JSON.parse(row.value) as typeof m;
    } catch {
      return null;
    }
    if (!m.campaignId || !m.decisionId || typeof m.day !== "number" || !m.recipient) return null;
    const addr = cleanAddress(args.from.match(/<([^>]+)>/)?.[1] ?? args.from);
    if (!addr || addr !== m.recipient) return null;
    const pp = m.postedPlan;
    const postedPlan = pp && typeof pp === "object" && !Array.isArray(pp)
      && typeof (pp as { hedge?: unknown }).hedge === "string"
      && typeof (pp as { staffing?: unknown }).staffing === "string"
      && typeof (pp as { marketing?: { sample?: unknown } }).marketing === "object"
      ? pp as DecisionPlan
      : null;
    return {
      campaignId: m.campaignId as Id<"campaigns">,
      decisionId: m.decisionId as Id<"dayDecisions">,
      day: m.day,
      recipient: m.recipient,
      postedPlan,
    };
  },
});

const COMMAND = /^(contract_light|contract_heavy|contract|hold|settle)[.!]?$/i;

function parseCommand(body: string): string | null {
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith(">") || /wrote:$/i.test(t)) return null;
    const m = t.match(COMMAND);
    return m ? m[1].toLowerCase() : null;
  }
  return null;
}

export const handleInbound = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    decisionId: v.id("dayDecisions"),
    day: v.number(),
    subject: v.string(),
    body: v.string(),
    from: v.optional(v.string()),
    deliveryId: v.optional(v.string()),
    postedPlan: v.optional(planV),
  },
  returns: v.object({
    ok: v.boolean(),
    why: v.optional(v.string()),
    action: v.optional(v.string()),
    duplicate: v.optional(v.boolean()),
    source: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) return { ok: false, why: "campaign not found" };
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || decision.campaignId !== args.campaignId || decision.day !== args.day)
      return { ok: false, why: "decision mismatch" };
    const session = await ctx.db.get(decision.sessionId);
    if (!session || session.phase === "abandoned" || session.expiresAt <= Date.now() || session.day !== args.day)
      return { ok: false, why: "stale decision" };
    if (decision.status === "committed")
      return { ok: true, action: decision.result?.plan.hedge, duplicate: true, source: decision.source };
    const command = parseCommand(args.body);
    if (!command) return { ok: false, why: "no command" };
    const base = (args.postedPlan ?? decision.plan) as DecisionPlan;
    const plan: DecisionPlan = { hedge: command as HedgeChoice, staffing: base.staffing, marketing: { ...base.marketing } };
    const committed = await commitRecord(ctx, decision, plan, "email");
    if (!committed.ok) return { ok: false, why: committed.why };
    await ctx.db.insert("letters", {
      campaignId: args.campaignId,
      day: args.day,
      head: `RE: ${args.subject}`.slice(0, 80),
      body: `Inbound reply (${command})${args.from ? ` from ${args.from}` : ""}: ${args.body}`.slice(0, 2000),
      dir: "in",
      action: command,
      from: args.from?.slice(0, 200),
      decisionId: args.decisionId,
      deliveryId: args.deliveryId,
      createdAt: Date.now(),
    });
    return { ok: true, action: command, duplicate: false, source: "email" };
  },
});

// Newest inbound reply for a campaign, older-than `after` — the client polls
// this to learn that Idris answered. `dir:"in"` rows only; pre-migration rows
// (no createdAt) never surface. Returns null when the box is empty.
export const latestInbox = query({
  args: { campaignId: v.id("campaigns"), after: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const after = args.after ?? 0;
    const rows = await ctx.db
      .query("letters")
      .withIndex("by_campaign_dir_created", (q) =>
        q.eq("campaignId", args.campaignId).eq("dir", "in"),
      )
      .order("desc")
      .take(20);
    for (const r of rows) {
      if (typeof r.createdAt === "number" && r.createdAt > after) {
        return {
          head: r.head,
          body: r.body,
          action: r.action ?? null,
          day: r.day,
          createdAt: r.createdAt,
        };
      }
    }
    return null;
  },
});
