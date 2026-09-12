import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, components } from "./_generated/api";
import { registerStaticRoutes } from "@convex-dev/static-hosting";

// HTTP surface: AgentMail webhook + a tiny sync bridge for the static floor.
// The Three.js frontend ships with no bundler and no npm client, so it talks
// to Convex over plain fetch: POST snapshots at each dawn, GET state to poll.
// All endpoints degrade loudly (4xx with JSON) rather than silently.

const json = (obj: unknown, status = 200): Response =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const agentmailWebhook = httpAction(async (ctx, req) => {
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret) return json({ error: "webhook not configured" }, 503);
  if (req.headers.get("x-webhook-secret") !== secret)
    return json({ error: "unauthorized" }, 401);
  let payload: { campaignId?: string; subject?: string; body?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!payload.campaignId || !payload.body)
    return json({ error: "campaignId and body required" }, 400);
  try {
    const result = await ctx.runMutation(api.agentmail.handleInbound, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      campaignId: payload.campaignId as any,
      subject: payload.subject ?? "(no subject)",
      body: payload.body,
    });
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 400);
  }
});

export const syncState = httpAction(async (ctx, req) => {
  const id = new URL(req.url).searchParams.get("campaignId");
  if (!id) return json({ error: "campaignId required" }, 400);
  try {
    const campaign = await ctx.runQuery(api.exchange.getCampaign, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      campaignId: id as any,
    });
    if (!campaign) return json({ error: "not found" }, 404);
    return json({ campaign });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 400);
  }
});

export const syncSnapshot = httpAction(async (ctx, req) => {
  let payload: {
    campaignId?: string;
    seed?: number;
    day?: number;
    beanIndex?: number;
    matchaPrice?: number;
    till?: number;
    reputation?: number;
    debt?: number;
    owner?: string;
  };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asId = (id: string): any => id;
    let campaignId = payload.campaignId;
    if (campaignId) {
      const campaign = await ctx.runQuery(api.exchange.getCampaign, {
        campaignId: asId(campaignId),
      });
      if (!campaign) return json({ error: "not found" }, 404);
    } else {
      campaignId = await ctx.runMutation(api.exchange.createCampaign, {
        seed: payload.seed ?? 7,
      });
    }
    await ctx.runMutation(api.exchange.mirrorState, {
      campaignId: asId(campaignId),
      day: payload.day,
      beanIndex: payload.beanIndex,
      matchaPrice: payload.matchaPrice,
      till: payload.till,
      reputation: payload.reputation,
      debt: payload.debt,
    });
    if (payload.till !== undefined || payload.reputation !== undefined) {
      await ctx.runMutation(api.stands.recordStand, {
        campaignId: asId(campaignId),
        ownerName: (payload.owner ?? "house-stand").slice(0, 40),
        till: payload.till ?? 0,
        reputation: payload.reputation ?? 62,
      });
    }
    return json({ campaignId, mirrored: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 400);
  }
});

const http = httpRouter();
http.route({ path: "/agentmail/webhook", method: "POST", handler: agentmailWebhook });
http.route({ path: "/sync/state", method: "GET", handler: syncState });
http.route({ path: "/sync/snapshot", method: "POST", handler: syncSnapshot });

// Static floor (uploaded dist/): exact routes above win, everything else
// falls back to index.html. App URLs stay at root — no /api prefix move.
registerStaticRoutes(http, components.staticHosting);

export default http;
