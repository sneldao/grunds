import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { CAMPAIGN_TUNING } from "./gameConfig";

// The Roaster's Letter on Convex — templated prose today, OpenAI action next.
// Ports web/js/letter.js composeLetter(s) so the inbox reads identically
// whether the 3D floor or a live-sync client renders it.

const gbp = (n: number) => "£" + Math.max(0, n).toFixed(2);

function trendPhrase(rose: number): string {
  if (rose > 0.18) return "up hard";
  if (rose > 0.04) return "up warily";
  if (rose < -0.05) return "easing";
  return "flat";
}

export const previewLetter = query({
  args: {
    campaignId: v.id("campaigns"),
    sold: v.number(),
    balked: v.number(),
    defections: v.number(),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) return null;
    const lastEvent = await ctx.db
      .query("marketEvents")
      .withIndex("by_campaign_day", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .first();
    return buildLetter({
      day: c.day,
      index: c.beanIndex,
      debt: c.debt,
      reputation: c.reputation,
      hasContract: c.contractUnits !== undefined,
      costPerCup:
        (c.contractPrice ?? c.beanIndex) * CAMPAIGN_TUNING.beanBaseCost,
      eventHead: lastEvent?.head,
      eventLine: lastEvent?.line,
      eventTier: lastEvent?.tier,
      sold: args.sold,
      balked: args.balked,
      defections: args.defections,
    });
  },
});

export const listLetters = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("letters")
      .withIndex("by_campaign_day", (q) => q.eq("campaignId", args.campaignId))
      .collect();
  },
});

export const saveLetter = mutation({
  args: {
    campaignId: v.id("campaigns"),
    sold: v.number(),
    balked: v.number(),
    defections: v.number(),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.campaignId);
    if (!c) throw new Error("campaign not found");
    const lastEvent = await ctx.db
      .query("marketEvents")
      .withIndex("by_campaign_day", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .first();
    const letter = buildLetter({
      day: c.day,
      index: c.beanIndex,
      debt: c.debt,
      reputation: c.reputation,
      hasContract: c.contractUnits !== undefined,
      costPerCup:
        (c.contractPrice ?? c.beanIndex) * CAMPAIGN_TUNING.beanBaseCost,
      eventHead: lastEvent?.head,
      eventLine: lastEvent?.line,
      eventTier: lastEvent?.tier,
      sold: args.sold,
      balked: args.balked,
      defections: args.defections,
    });
    const id = await ctx.db.insert("letters", {
      campaignId: args.campaignId,
      day: c.day,
      head: letter.head,
      body: letter.body,
    });
    return { id, ...letter };
  },
});

function buildLetter(s: {
  day: number;
  index: number;
  debt: number;
  reputation: number;
  hasContract: boolean;
  costPerCup: number;
  eventHead?: string;
  eventLine?: string;
  eventTier?: string;
  sold: number;
  balked: number;
  defections: number;
}): { head: string; body: string } {
  const rose = s.index - 1;
  const ratio = s.balked / Math.max(1, s.sold);
  const performance =
    ratio < 0.05
      ? `You held the floor. ${s.sold} cups out the door, ${s.balked} walked. The regulars saw it.`
      : ratio < 0.15
        ? `A workable day — ${s.sold} served, ${s.balked} balked. ${s.defections} crossed to the chain.`
        : ratio < 0.3
          ? `A rough one. ${s.balked} balked, ${s.defections} crossed the road. They're talking.`
          : `The wave broke you. ${s.balked} balked, ${s.defections} to the chain. Word travels.`;
  const debt =
    s.debt <= 0
      ? "You owe me nothing. Rare sight."
      : `You're carrying ${gbp(s.debt)} in credit. It rolls on at closing unless you settle.`;
  const reputation =
    s.reputation >= 80
      ? "The regulars are telling their friends. Word of mouth is doing my job for me."
      : s.reputation >= 65
        ? "The regulars are steady. Steady won't survive a bad bean year alone."
        : s.reputation >= 45
          ? "The regulars are cool. A cold market and a cool room is a bad combination."
          : "The regulars have given up on you. I'd move fast.";
  const drift =
    s.day <= 1
      ? ""
      : (() => {
          const pct = Math.round((s.index - 1) * 100);
          if (s.day === 2)
            return `The district is moving. The board is up ${pct}% on Monday. Hold or hedge — your call.`;
          if (pct >= 10)
            return `Costs are up ${pct}% on opening day. The list knows — they're already at the door.`;
          if (pct >= 5)
            return `Costs are creeping. ${pct}% up on day one. The elders are watching the chalkboard.`;
          return "";
        })();
  const neighborhood =
    s.day === 4
      ? `Two of the storefronts across the road have a For Lease sign up. The street's moving.`
      : s.day >= 5
        ? `Both storefronts are scaffolded now. The street is being remade — for or against you, that's the question.`
        : "";
  const greeting =
    s.eventTier === "cata"
      ? "I'm writing before the market and I'm already sorry."
      : s.eventTier === "bad"
        ? "Bad news off the belt this morning."
        : s.eventTier === "good"
          ? "Good morning. I bring you a break for once."
          : s.eventTier === "warn"
            ? "A quiet morning — too quiet. Listen to this."
            : "Morning. Quiet on the board.";
  const body = [
    `Day ${s.day} of ${CAMPAIGN_TUNING.days}. ${greeting}`,
    s.eventLine ?? "",
    "",
    `The board's at ${s.index.toFixed(2)} — ${trendPhrase(rose)} on the spot.`,
    `At this price you're laying down a forty-run for ${gbp(s.costPerCup * 40)}.`,
    performance,
    debt,
    drift,
    neighborhood,
    reputation,
    "",
    "What do you want to do?",
  ].join("\n");
  return { head: s.eventHead ?? "A NOTE FROM YOUR ROASTER", body };
}
