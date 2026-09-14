import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { CAMPAIGN_TUNING } from "./gameConfig";

// AgentMail inbox for the Roaster's Letter — reply-to-command, server-side.
// The webhook in http.ts verifies the Svix signature and forwards here.
// The email body is parsed for the first command keyword (contract / hold /
// settle) and applied to the campaign, mirroring web/js letter reply
// handling. Every inbound AND outbound is archived into `letters` so
// judges see the audit trail. Thread/recipient → campaign mappings live in
// apiCache (30d) so a reply resolves to the right campaign.

const AGENTMAIL_API = "https://api.agentmail.to/v0";
const MAIL_MAP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
export const sendLetter = action({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    campaignId: v.optional(v.id("campaigns")),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; threadId?: string }> => {
    const sent = await sendMail(args.to, args.subject, args.body);
    if (!sent) return { ok: false };
    if (args.campaignId) {
      await ctx.runMutation(internal.agentmail.recordOutbound, {
        campaignId: args.campaignId,
        to: args.to,
        threadId: sent.threadId ?? "",
        subject: args.subject,
        body: args.body,
      });
    }
    return { ok: true, threadId: sent.threadId };
  },
});

export const recordOutbound = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    to: v.string(),
    threadId: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    const putMap = async (key: string) => {
      const now = Date.now();
      const existing = await ctx.db
        .query("apiCache")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          value: args.campaignId,
          createdAt: now,
          expiresAt: now + MAIL_MAP_TTL_MS,
        });
      } else {
        await ctx.db.insert("apiCache", {
          key,
          value: args.campaignId,
          createdAt: now,
          expiresAt: now + MAIL_MAP_TTL_MS,
        });
      }
    };
    if (args.threadId) await putMap(`agentmail:thread:${args.threadId}`);
    await putMap(`agentmail:rcpt:${args.to.toLowerCase()}`);
    await ctx.db.insert("letters", {
      campaignId: args.campaignId,
      day: c?.day ?? 0,
      head: `SENT: ${args.subject}`.slice(0, 80),
      body: `Posted to ${args.to}\n\n${args.body}`.slice(0, 2000),
    });
  },
});

// Resolve an inbound reply to its campaign — thread mapping first (a reply
// to a letter we sent), then the sender address (a fresh mail from a known
// recipient). Returns the campaignId string or null.
export const resolveThread = internalQuery({
  args: { threadId: v.string(), from: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    const getMap = async (key: string) => {
      const row = await ctx.db
        .query("apiCache")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      return row && row.expiresAt > Date.now() ? row.value : null;
    };
    if (args.threadId) {
      const hit = await getMap(`agentmail:thread:${args.threadId}`);
      if (hit) return hit;
    }
    const addr = args.from.match(/<([^>]+)>/)?.[1] ?? args.from;
    if (addr) {
      const hit = await getMap(`agentmail:rcpt:${addr.toLowerCase()}`);
      if (hit) return hit;
    }
    return null;
  },
});

export const handleInbound = mutation({
  args: {
    campaignId: v.id("campaigns"),
    subject: v.string(),
    body: v.string(),
    from: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) throw new Error("campaign not found");
    const text = `${args.subject}\n${args.body}`.toLowerCase();

    let action: "contract" | "hold" | "settle" = "hold";
    if (/\bcontract\b/.test(text)) action = "contract";
    else if (/\bsettle\b/.test(text)) action = "settle";

    if (action === "contract") {
      if (c.contractUnits === undefined) {
        await ctx.db.patch(args.campaignId, {
          contractPrice: c.beanIndex,
          contractUnits: CAMPAIGN_TUNING.contractUnits,
          contractFee: CAMPAIGN_TUNING.contractFee,
          debt: c.debt + CAMPAIGN_TUNING.contractFee,
        });
      }
    } else if (action === "settle") {
      if (c.debt > 0) await ctx.db.patch(args.campaignId, { debt: 0 });
    }
    const after = await ctx.db.get(args.campaignId);

    await ctx.db.insert("letters", {
      campaignId: args.campaignId,
      day: c.day,
      head: `RE: ${args.subject}`.slice(0, 80),
      body: `Inbound reply (${action})${args.from ? ` from ${args.from}` : ""}: ${args.body}`.slice(0, 2000),
    });
    return { action, ok: true as const, debt: after?.debt ?? c.debt };
  },
});
