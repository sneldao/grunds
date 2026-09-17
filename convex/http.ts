import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, components, internal } from "./_generated/api";
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

// Svix signature check — AgentMail signs every webhook HMAC-SHA256 over
// `${svix-id}.${svix-timestamp}.${body}` keyed with the whsec_ secret
// (base64 after the prefix). Verified against the `v1,<b64>` header list.
async function verifySvix(
  secret: string,
  id: string | null,
  ts: string | null,
  sig: string | null,
  body: string,
): Promise<boolean> {
  if (!id || !ts || !sig || !secret.startsWith("whsec_")) return false;
  try {
    const keyBytes = Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const out = await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`),
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(out)));
    return sig.split(" ").some((s) => s.startsWith("v1,") && s.slice(3) === expected);
  } catch {
    return false;
  }
}

export const agentmailWebhook = httpAction(async (ctx, req) => {
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret) return json({ error: "webhook not configured" }, 503);
  const raw = await req.text();

  // Real AgentMail delivery — Svix-signed message.received event.
  if (req.headers.get("svix-id")) {
    const ok = await verifySvix(
      secret,
      req.headers.get("svix-id"),
      req.headers.get("svix-timestamp"),
      req.headers.get("svix-signature"),
      raw,
    );
    if (!ok) return json({ error: "bad signature" }, 401);
    let evt: {
      event_type?: string;
      message?: {
        thread_id?: string; from?: string; to?: string[];
        subject?: string; text?: string; preview?: string;
      };
    };
    try {
      evt = JSON.parse(raw) as typeof evt;
    } catch {
      return json({ error: "bad json" }, 400);
    }
    if (evt.event_type !== "message.received")
      return json({ ignored: evt.event_type ?? "unknown" });
    const m = evt.message ?? {};
    // Never answer ourselves — an ack landing in our own inbox must not
    // re-enter the command loop.
    const self = (process.env.AGENTMAIL_INBOX_ID ?? "").toLowerCase();
    if (self && (m.from ?? "").toLowerCase().includes(self))
      return json({ ignored: "self-delivery" });
    const body = m.text || m.preview || "";
    if (!body) return json({ error: "empty message" }, 400);
    try {
      const campaignId = await ctx.runQuery(internal.agentmail.resolveThread, {
        threadId: m.thread_id ?? "",
        from: m.from ?? "",
      });
      if (!campaignId) return json({ error: "no campaign for this thread" }, 404);
      const result = await ctx.runMutation(api.agentmail.handleInbound, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        campaignId: campaignId as any,
        subject: m.subject ?? "(no subject)",
        body,
        from: m.from,
      });
      // Acknowledge by return post — Idris writes back.
      if (m.from) {
        await ctx.runAction(api.agentmail.sendLetter, {
          to: m.from.replace(/.*<([^>]+)>.*/, "$1"),
          subject: `RE: ${m.subject ?? "your note"}`,
          body: result.action === "contract"
            ? `Done — the beans are locked at today's board. You'll see it on tonight's receipt.\n\n— Idris`
            : result.action === "settle"
              ? `Settled. The slate is clean.\n\n— Idris`
              : `Understood — you ride the spot market. Watch the wire.\n\n— Idris`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          campaignId: campaignId as any,
        });
      }
      return json(result);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "failed" }, 400);
    }
  }

  // Legacy manual path — shared-secret POST for testing without Svix.
  if (req.headers.get("x-webhook-secret") !== secret)
    return json({ error: "unauthorized" }, 401);
  let payload: { campaignId?: string; subject?: string; body?: string };
  try {
    payload = JSON.parse(raw) as typeof payload;
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

// Tripo webhook — task.completed / task.failed / balance.low.
// Tripo signs HMAC-SHA256 over `${t}.${rawBody}` with the whsec_ signing
// secret; header format `t=<unix>,v1=<hex>`. Same verification discipline as
// verifySvix: verify before acting, 5-minute replay window, idempotent apply.
async function verifyTripo(
  secret: string,
  sig: string | null,
  body: string,
): Promise<boolean> {
  if (!sig) return false;
  const parts: Record<string, string> = {};
  for (const p of sig.split(",")) {
    const i = p.indexOf("=");
    if (i > 0) parts[p.slice(0, i)] = p.slice(i + 1);
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // replay guard
  try {
    const keyHex = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const keyBytes = Uint8Array.from(
      keyHex.match(/.{1,2}/g) ?? [],
      (b) => parseInt(b, 16),
    );
    if (keyBytes.length === 0) return false;
    const key = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const out = await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(`${t}.${body}`),
    );
    const hex = Array.from(new Uint8Array(out))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex === v1.toLowerCase();
  } catch {
    return false;
  }
}

export const tripoWebhook = httpAction(async (ctx, req) => {
  const secret = process.env.TRIPO_WEBHOOK_SECRET;
  if (!secret) return json({ error: "webhook not configured" }, 503);
  const raw = await req.text();
  if (!(await verifyTripo(secret, req.headers.get("tripo-webhook-signature"), raw)))
    return json({ error: "bad signature" }, 401);
  let evt: {
    type?: string;
    data?: {
      task_id?: string;
      status?: string;
      output?: { model_url?: string; rendered_image_url?: string };
    };
  };
  try {
    evt = JSON.parse(raw) as typeof evt;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const type = evt.type;
  if (type === "balance.low") return json({ noted: "balance.low" });
  if (type !== "task.completed" && type !== "task.failed")
    return json({ ignored: type ?? "unknown" });
  const d = evt.data ?? {};
  if (!d.task_id) return json({ error: "missing task_id" }, 400);
  // Idempotent + fast: applyResult patches at most one row and drops unknown
  // task ids (Tripo retries non-2xx, so we always answer 2xx once verified).
  await ctx.runMutation(internal.tripo.applyResult, {
    taskId: d.task_id,
    ok: type === "task.completed",
    modelUrl: d.output?.model_url,
    previewUrl: d.output?.rendered_image_url,
    error: type === "task.failed" ? `webhook: ${d.status ?? "failed"}` : undefined,
  });
  return json({ ok: true });
});

// The Generative District — read the kit for a seed (floor polls this),
// or grow it: get-or-create the missing slots (budget-guarded in
// mint.generate; the first player on a seed pays, the rest load the cache).
// Read-only + idempotent, so no auth — same posture as /sync/*.
export const districtKit = httpAction(async (ctx, req) => {
  const seed = Number(new URL(req.url).searchParams.get("seed") ?? 7);
  if (!Number.isFinite(seed) || seed < 0) return json({ error: "bad seed" }, 400);
  return json(await ctx.runQuery(api.district.kit, { seed }));
});

export const districtEnsure = httpAction(async (ctx, req) => {
  const seed = Number(new URL(req.url).searchParams.get("seed") ?? 7);
  if (!Number.isFinite(seed) || seed < 0) return json({ error: "bad seed" }, 400);
  return json(await ctx.runAction(api.district.ensure, { seed }));
});

// Post the letter to a real inbox — the client sends the composed letter
// plus a recipient; replies resolve back to this campaign via the thread
// mapping recorded in agentmail.sendLetter.
export const mailLetter = httpAction(async (ctx, req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let payload: { to?: string; subject?: string; body?: string; campaignId?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!payload.to || !payload.body || !payload.to.includes("@"))
    return json({ error: "to and body required" }, 400);
  try {
    const result = await ctx.runAction(api.agentmail.sendLetter, {
      to: payload.to.slice(0, 200),
      subject: (payload.subject ?? "A note from your roaster").slice(0, 200),
      body: payload.body.slice(0, 4000),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      campaignId: payload.campaignId as any,
    });
    return json(result, result.ok ? 200 : 503);
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

export const syncStands = httpAction(async (ctx, req) => {
  const id = new URL(req.url).searchParams.get("campaignId");
  if (!id) return json({ error: "campaignId required" }, 400);
  try {
    const stands = await ctx.runQuery(api.stands.topStands, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      campaignId: id as any,
      limit: 8,
    });
    return json({ stands });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 400);
  }
});

export const aiLetter = httpAction(async (ctx, req) => {
  let payload: { body?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!payload.body) return json({ error: "body required" }, 400);
  try {
    const result = await ctx.runAction(api.nebius.enhanceLetterNebius, {
      body: payload.body.slice(0, 4000),
    });
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 400);
  }
});

export const aiGossip = httpAction(async (ctx, req) => {
  let payload: { name?: string; cohort?: string; context?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!payload.name || !payload.context)
    return json({ error: "name and context required" }, 400);
  try {
    const result = await ctx.runAction(api.nebius.regularGossipNebius, {
      name: payload.name.slice(0, 40),
      cohort: (payload.cohort ?? "regular").slice(0, 40),
      context: payload.context.slice(0, 600),
    });
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 400);
  }
});

export const aiResearch = httpAction(async (ctx) => {
  try {
    // the merged wire: Linkup + Firecrawl pipes, OpenAI "why this matters"
    const result = await ctx.runAction(api.research.wireResearch, {});
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "failed" }, 400);
  }
});

const http = httpRouter();
http.route({ path: "/agentmail/webhook", method: "POST", handler: agentmailWebhook });
http.route({ path: "/agentmail/letter", method: "POST", handler: mailLetter });
http.route({ path: "/sync/state", method: "GET", handler: syncState });
http.route({ path: "/sync/snapshot", method: "POST", handler: syncSnapshot });
http.route({ path: "/sync/stands", method: "GET", handler: syncStands });
http.route({ path: "/ai/letter", method: "POST", handler: aiLetter });
http.route({ path: "/ai/gossip", method: "POST", handler: aiGossip });
http.route({ path: "/ai/research", method: "GET", handler: aiResearch });
http.route({ path: "/district/kit", method: "GET", handler: districtKit });
http.route({ path: "/district/ensure", method: "POST", handler: districtEnsure });

// Static floor (uploaded dist/): exact routes above win, everything else
// falls back to index.html. App URLs stay at root — no /api prefix move.
registerStaticRoutes(http, components.staticHosting);

export default http;
