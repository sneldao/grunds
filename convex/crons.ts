import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// District ticks. The news refresh keeps the Exchange event-deck seed no
// older than ~24h (cached 6h per query, refreshed nightly). Per-campaign
// dawn rolls stay player-driven — no active-campaign pointer, no fake ticks.
const crons = cronJobs();

crons.daily(
  "commodity-news-refresh",
  { hourUTC: 6, minuteUTC: 0 },
  internal.firecrawl.refreshCommodityNews,
  {},
);

crons.daily(
  "linkup-intel-refresh",
  { hourUTC: 6, minuteUTC: 15 },
  internal.linkup.refreshLinkupIntelligence,
  {},
);

// the merged wire refreshes last — it reads both pipes' fresh caches
crons.daily(
  "wire-merge-refresh",
  { hourUTC: 6, minuteUTC: 30 },
  internal.research.refreshWire,
  {},
);

// Tripo backstop: webhooks are primary, this re-queries tasks stuck in
// "processing" (lost delivery) and times out the hopeless ones (1h).
// Hourly is deliberate — a lost webhook costs minutes of polling lag at most,
// and the floor's fallback never blocks play.
crons.hourly(
  "tripo-task-reaper",
  { minuteUTC: 15 },
  internal.tripo.reaper,
  {},
);

// Mint operations (no webhooks — polling IS the completion path).
crons.hourly(
  "mint-operation-reaper",
  { minuteUTC: 45 },
  internal.mint.reaper,
  {},
);

export default crons;
