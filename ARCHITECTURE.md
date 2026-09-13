# Architecture

Grunds — The District — is a micro-economy simulation rendered as a 3D coffee
district. One deterministic data engine feeds everything; the game layers sit on top.

## Pipeline

```
transform.py ──→ square_item_sales.csv ──→ ingest ──→ spatial ──→ agent ──→ precedent
                                         (CSV)      (zones)  (Three.js) (levers)  (memory)
                                                                      ↓
                                                          exchange (Convex phase: events,
                                                          price drift, contracts, debt)
```

## Systems

| System | Responsibility | Phase |
|---|---|---|
| `ingest` | Parse Square CSV, map each row to (zone, time, item, cohort); emit wave schedules | today |
| `spatial` | Three.js floor: zones (counter, tables, register, retail), entity spawner keyed on time, queue heat, gossip bubbles, Kenney CC0 props, day-5 construction props, drifting dust, conversation lines, chalkboard flash, 3-step tutorial, goal/queue/batch HUD, wave debrief + forecast cards | today |
| `agent` | Patron decision loop (choose stand by price/queue/reputation) + barista levers (pre-batch, reprice, queue-drain prediction) + named-Regular hat/bubble + friend-graph gossip routing + throttled gossip in calm open | today |
| `precedent` | Patron memory: opinions persist across runs; gossip propagates through a named-friend graph; 5%/day opinion contagion along the friendship edges; local analytics (tutorial/lever/balk/debrief/forecast) in `web/js/analytics.js` | today |
| `exchange` | Event deck (frost, harvest, hype) with pity timers + optional bias (Linkup marketShift, clamped 0.2–3×); gentrification drift (per-day cost creep + matcha price curve); forward contracts; supplier debt clock | today |

## Game loop mapping

```
 THE GAMBLE (days)          THE READ (hours)           THE SCRAMBLE (seconds)
 ─────────────────          ────────────────           ──────────────
 exchange events     ──→    wave schedule       ──→    patron spawn ticks
 gentrification drift       cohort signals             barista levers + prediction
 contracts / debt           friend-graph gossip        (queue vs restock vs regular)
 (Roaster's Letter)         (3D lines + debrief)       named-Regular hat + bubble
 forecast (Day 2)           Day-2 preview              calm-open throttling (1×, half-demand)
        ↓                          ↓                          ↓
        └────────── outcomes feed precedent memory (patron opinions) ──────────┘
                                          ↓
                          contagion step pulls each regular 5% toward
                          the mean of their friends' opinions
```

Three nested clocks keep the game never-idle but never exhausting. All outcomes write
back to patron memory — reputation, gossip, regulars, and the friendship graph all
persist across days. The gentrification drift is the *baseline* cost creep; the event
deck is the *deviation* on top. Day 5 the visible scaffolding reads the drift as
physical: three procedural scaffolds + striped tarps, drifting dust, and a low saw +
hammer soundscape. Day 1 reads as curated: 1× with a 3-step tutorial + calm-open
throttling (first 12 sim-min half-demand, 07–10 half-demand, gossip 10%) and a goal-first
HUD (goal strip + queue health bar + batch countdown); at 17:00 a wave debrief teaches
the payoff, at 17:30 and on the Z-read a Day-2 forecast earns the replay.

## Cohorts (behavioural layer)

Culture is mechanics: each cohort has its own arrival wave, elasticity, and gossip
trigger (see README table). `ingest` tags every transaction with a cohort by
hour-of-day and item; `agent` uses cohort rules for patron choice; `precedent`
stores per-patron opinion state.

## Data flow

1. `transform.py` produces a deterministic 13-week Item Sales export (~26.5k rows)
2. `ingest` maps each row to a zone by item category and tags the cohort:
   - Matcha/Coffee → counter · Bakery → retail shelf · Retail → shelf · all → register
   - Cohort by hour: 7–9 commuters · 10–14 creatives · 14–18 students (5 cohorts
     in the local phase, the Convex phase adds 5th + 6th cohorts on the agent)
3. `spatial` spawns entities at zone coordinates per transaction time; gossip
   bubbles + 3D conversation lines render the friendship graph; Kenney CC0
   props place the café interior; day-5 scaffolds + tarps + dust render the
   gentrification visually; the floor opens at 1× through a 3-step tutorial
   with a 3.4s paused crane settle, a goal-first HUD (brass goal strip, queue
   health bar, batch countdown), pulse-until-used levers, a flashing chalkboard,
   and calm-open throttling so new eyes can read before the rush; at 17:00 a
   wave debrief card and at 17:30 a Day-2 forecast teach and tease the replay
4. `agent` patrons pick stands (price, queue length, reputation); named
   Regulars get a brass-band hat + a one-line greeting; the player pulls
   levers (pre-batch/reprice, with a predicted queue drain on press) against
   the wave schedule; gossip is throttled in the calm-open window
5. `precedent` stores (pattern → opinion) pairs; regulars, grudges, and the
   friendship graph persist; a 5%/day `opContagion` step pulls each regular
   toward the mean of their friends' opinions; `web/js/analytics.js` records
   tutorial steps/skips, first lever, every balk, debrief and forecast for the
   playtest (exposed as `__grunds.analytics.summary()`)
6. `exchange` rolls events with pity timers (+ optional Linkup bias) at each
   dawn, applies gentrification drift (per-day cost creep + matcha price curve
   + cohort expectation pressure) *before* the event roll, and settles
   contracts and supplier debt from the Roaster's Letter

## Convex deployment (live since Sept 12)

Backend and hosting are deployed to a cloud dev deployment; the local
simulator (`web/js/*`) remains the deterministic reference and the
headless gate pins both.

Shipped (`convex/`, verified end-to-end against cloud, re-verified Sept 13):

- Tables: `campaigns`, `marketEvents`, `regulars`, `friendships`,
  `letters`, `stands`, `apiCache` — all indexed.
- Dawn tick: `exchange.openDay(bias?)` applies gentrification drift
  (per-day cost creep + matcha curve) *before* the pity-timer event roll —
  same ordering as the local `Exchange`; optional `bias` (marketShift,
  clamped 0.2–3× per event) from Linkup tilts the weighted pool without
  replacing the seeded roll. Deterministic per seed+day. New Sept 13:
  server `openDay` reads the cached Linkup payload from `apiCache`
  (`linkup:research:v1:<hash>`) at the dawn tick — no extra action needed.
- Regulars: `markSeen`/`unsee`, `resolveDay` (expectation pressure, outcome
  delta, 5% friendship contagion), reputation meter.
- Roaster's Letter: templated preview + archive; Nebius Token Factory
  `POST /ai/letter` (`meta-llama/Llama-3.3-70B`, was 3.1 — host
  `api.tokenfactory.nebius.com`, 7-day hash cache) powers the in-character
  Idris rewrite consumed fire-and-forget from the floor (`showLetter` swaps
  to LLM prose mid-letter); OpenAI path remains as a key-gated fallback.
  `intelLine` cites the Linkup wire when sources arrive.
- Firecrawl + Linkup: `fetchCommodityNews` + `searchCommodityIntelligence`
  map live headlines to deck-weight suggestions (6h cache each, ~1 search
  per campaign). New `GET /ai/research` serves the Linkup payload over the
  same plain-fetch bridge; the floor's `convexSync.intel()` feeds the bias
  into the local `Exchange.roll(bias)` so the played game reacts to live
  news too; a day-1 toast names the top market shift.
- AgentMail: signed `/agentmail/webhook` → reply-to-command mutation with
  a `letters` audit trail (inbox keys pending).
- Hosting: `@convex-dev/static-hosting` serves the floor from
  `https://striped-anaconda-746.convex.site` (42 files Sept 13, SPA fallback);
  app routes stay at root (`/sync/*`, `/ai/*`, `/agentmail/*`). The floor
  mirrors each dawn into the campaign row plus a per-owner `stands` row
  (stable `grunds.owner` id, `?stand=` override), polls server state for the
  badge, and the dashboard + `topStands` leaderboard + `GET /sync/stands`
  read live games.
- Scheduled: `commodity-news-refresh` (Firecrawl, 06:00 UTC) +
  `linkup-intel-refresh` (Linkup, 06:15 UTC) keep both 6h caches warm.

Still pending: per-campaign dawn cron (intentionally skipped — no
active-campaign pointer, ticks stay player-driven), Convex Auth (not
required by the hackathon), OpenAI + AgentMail + Linkup keys (Linkup runs
until `LINKUP_API_KEY` lands, then biases the deck for real), production
deploy (iterating on dev until submission week), video + social.

## Audit trail

Every decision logs to `out/audit.jsonl`:
```json
{"ts": "...", "type": "spawn", "cohort": "commuter", "zone": "counter", "ts_of_day": "07:42"}
{"ts": "...", "type": "lever", "action": "prebatch_matcha", "cost": 4.2, "expected_units": 40}
{"ts": "...", "type": "gossip", "from": "patron_17", "to": "patron_23", "opinion": "-0.6"}
{"ts": "...", "type": "exchange_event", "event": "frost_minas", "bean_price_delta": "+18%"}
```
