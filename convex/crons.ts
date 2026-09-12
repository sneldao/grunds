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

export default crons;
