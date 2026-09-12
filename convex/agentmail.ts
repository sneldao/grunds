import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { CAMPAIGN_TUNING } from "./gameConfig";

// AgentMail inbox for the Roaster's Letter — reply-to-command, server-side.
// The webhook in http.ts verifies the secret and forwards here. The email
// body is parsed for the first command keyword (contract / hold / settle)
// and applied to the campaign, mirroring web/js letter reply handling.
// Every inbound is archived into `letters` so judges see the audit trail.

export const handleInbound = mutation({
  args: {
    campaignId: v.id("campaigns"),
    subject: v.string(),
    body: v.string(),
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
      body: `Inbound reply (${action}): ${args.body}`.slice(0, 2000),
    });
    return { action, ok: true as const, debt: after?.debt ?? c.debt };
  },
});
