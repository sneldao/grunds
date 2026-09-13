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
| `spatial` | Three.js floor: zones, queue heat, gossip bubbles + conversation lines, Kenney CC0 props (loader with cross-fade-in), day-5 scaffolds/tarps/dust, chalkboard flash (desaturate + wobble), 3-step tutorial + calm-open throttling, goal/queue/batch HUD (heartbeat/purr + `tabular-nums` + staggered receipt), wave debrief (fanfare/coin rain/crane) + forecast + wire/desk paywall, living plant (HSL health + wilt), god rays + mist, till drawer + stretching shadow, cat Miso, hover story card + photo mode, GLB cross-fade + shadow budget | today |
| `agent` | Patron decision loop (price/queue/rep) + barista levers (pre-batch/reprice + queue-drain prediction + chalk dust/screech) + named-Regular hat/bubble + wave + friend-graph gossip routing (throttled in calm open) + sitter sip at `dwell==4` + hover→story card (36px probe) + click-to-wave (+0.06 op) + cat spawn/sit/scatter + plant health + till slide | today |
| `precedent` | Patron memory: opinions persist; gossip via named-friend graph; 5%/day `opContagion` (Map<i→op> + `Number.isFinite` guard for sparse rosters); local `analytics.js` (tutorial/lever/balk/debrief/forecast + `desk_opened`/`paywall_shown`/`purchase_success`) + `desk.js` (The Wire — gated briefing) + `billing.js` (RevenueCat Web Billing → Test Store) | today |
| `exchange` | Event deck (frost/harvest/hype, pity timers + Linkup `marketShift` bias clamped 0.2–3×); gentrification drift (per-day cost creep + matcha 4.80→5.40); forward contracts; supplier debt clock; hidden `geshaUnlocked` (`GRUNDS` → £7.80 wink, persists as toast) | today |

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
3. `spatial` spawns entities per transaction time; gossip bubbles + 3D
   conversation lines render the friendship graph; Kenney CC0 props (cross-fade
   `opacity 0→1`, headless-aware) place the café; day-5 scaffolds/tarps/dust
   render gentrification; the floor opens at 1× through a 3-step tutorial
   with a 3.4s paused crane settle, a goal-first HUD (brass goal strip, queue
   health bar heartbeat at >10 / purr at ≤5, `tabular-nums` till, batch countdown),
   pulse-until-used levers, a flashing chalkboard (desaturate + wobble +
   chalk dust on reprice) and calm-open throttling; at 17:00 a wave debrief
   (fanfare/coin rain/crane on `saved≥6`, rain on flop) and at 17:30 a Day-2
   forecast teach and tease the replay; glass `mistMat` + `godRay` quote the
   event tier, a till drawer slides + shadow stretches on every sale, a living
   plant (HSL) and a street cat (Miso, once/day 09:30, sits if `<4` / scatters
   if `>10`) make the shop alive; hover→story card + click-to-wave and
   `P` photo mode (golden hour + vignette + shutter) are delight affordances
4. `agent` patrons pick stands (price/queue/rep); named Regulars get a
   brass-band hat + greeting; the player pulls levers (pre-batch/reprice,
   with predicted queue drain, chalk dust + screech on reprice) against the
   wave; gossip is throttled in the calm-open window; sitters sip at
   `dwell==4` (arm/head/lean + steam), the rival leans at `heat>6` and jeers
   at 5 defections, Idris quips at 10:00/12:00 rep checkpoints, and haptics
   (`vibrate(35)` on balk, `[20,30,50]` on wave save) land on phones
5. `precedent` stores (pattern → opinion) + friendship graph; a
   5%/day `opContagion` (Map-guarded, sparse-roster safe) pulls each regular
   toward friends' mean; `web/js/analytics.js` records tutorial/lever/balk/
   debrief/forecast + `desk_opened`/`paywall_shown`/`purchase_success`
   (exposed as `__grunds.analytics.summary()`); `billing.js` gates
   `desk.js` The Wire on `commodity_insider` (HUD `⚡ the wire ↗` when intel
   lands; Letter desklink where the choice happens)
6. `exchange` rolls events with pity timers (+ Linkup `marketShift` bias
   clamped 0.2–3×) at each dawn, applies gentrification drift (cost creep +
   matcha curve + cohort expectation) *before* the roll, and settles
   contracts/debt from the Letter; `GRUNDS` secret sets `geshaUnlocked` and
   flashes £7.80 on the board (persists as a next-day toast)

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
  `https://striped-anaconda-746.convex.site` (43 files Sept 13, SPA fallback — adds `desk.js` + rebuilt `dist`);
  performance: auto-`lite` (`hardwareConcurrency≤4`/`deviceMemory≤4`), dynamic `lite` after 3×>32ms, shadow budget at `queue>40`, GLB cross-fade, `tabular-nums` till + staggered/typewriter receipt, `P` photo + `GRUNDS` secret;
  delight wiring: `world.setPlantHealth`/`setGodRay`/`spawnCat`/`updateCat`/`popTillDrawer`/`_updateDelight`/`jeerRival`, `audio.tick`/`waveFanfare`/`waveRain`/`chalkScreech`/`purr`/`meow`/`shutter`, `fx.chalkDust`/`coinRain`/`victoryBurst` + receipt stagger, `main` haptics + hover card + Idris quips + rival jeer + desk/billing + `requestAnimationFrame(loop)` re-arm discipline;
  app routes stay at root (`/sync/*`, `/ai/*`, `/agentmail/*`). The floor
  mirrors each dawn into the campaign row plus a per-owner `stands` row
  (stable `grunds.owner` id, `?stand=` override), polls server state for the
  badge, and the dashboard + `topStands` leaderboard + `GET /sync/stands`
  read live games.
- Scheduled: `commodity-news-refresh` (Firecrawl, 06:00 UTC) +
  `linkup-intel-refresh` (Linkup, 06:15 UTC) keep both 6h caches warm.

Still pending: per-campaign dawn cron (intentionally skipped — no
active-campaign pointer, ticks stay player-driven), Convex Auth (not
required by the hackathon), AgentMail live inbox (webhook live, keys
pending — templated Letter still authoritative), production deploy
(iterating on dev until submission week), video + social. OpenAI +
Firecrawl + Linkup + Nebius are all live on dev (Linkup bias verified
with 20-source pull; Nebius `Llama-3.3-70B` via Token Factory).

## Audit trail

Every decision logs to `out/audit.jsonl`:
```json
{"ts": "...", "type": "spawn", "cohort": "commuter", "zone": "counter", "ts_of_day": "07:42"}
{"ts": "...", "type": "lever", "action": "prebatch_matcha", "cost": 4.2, "expected_units": 40}
{"ts": "...", "type": "gossip", "from": "patron_17", "to": "patron_23", "opinion": "-0.6"}
{"ts": "...", "type": "exchange_event", "event": "frost_minas", "bean_price_delta": "+18%"}
```
