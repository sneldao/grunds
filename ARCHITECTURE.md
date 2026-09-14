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
| `spatial` | Three.js floor: **1024 honey-oak floor + slab pavement + aggregate road** (all `anisotropy 8`), **brick facades** (two-tone + mortar, white frames + sill, cornice + shopfront), **9-block skyline**, **512×320 brass-collar ticker**, gossip bubbles + conversation lines, Kenney CC0 props (loader with cross-fade-in), day-5 scaffolds/tarps/dust, chalkboard flash (desaturate + wobble), 3-step tutorial + calm-open throttling (reactive `#goal` + 3 just-in-time nudges), goal/queue/batch HUD (heartbeat/purr + `tabular-nums` + staggered receipt), **Morning Brief `#brief` (520px linen: 76px sparkline + wire headlines/host/why + 5 pills → `OPEN`) + `briefPaused` clock gate**, wave debrief (fanfare/coin rain/crane) + forecast + wire desk (headlines free / tilt gated) + 11:00 offer / 14:55–16:55 incident modals (`offerPaused`), bean tape HUD + ticker sparkline + bias glow, living plant (HSL health + wilt), god rays + **motes** + mist, till drawer + stretching shadow, **bollards + street decal**, cat Miso, hover story card + photo mode, scuff decal + awning tie-downs, GLB cross-fade + shadow budget + bounce hemi | today |
| `agent` | Patron decision loop (price/queue/rep) + barista levers (pre-batch/reprice + queue-drain prediction + chalk dust/screech) + named-Regular hat/bubble + wave + friend-graph gossip routing (throttled in calm open) + sitter sip at `dwell==4` + hover→story card (36px probe) + click-to-wave (+0.06 op) + cat spawn/sit/scatter + plant health + till slide | today |
| `precedent` | Patron memory: opinions persist; gossip via named-friend graph; 5%/day `opContagion` (Map<i→op> + `Number.isFinite` guard for sparse rosters); local `analytics.js` (tutorial/lever/balk/debrief/forecast + `desk_opened`/`paywall_shown`/`purchase_success`) + `desk.js` (The Wire — headlines free, tilt on `commodity_insider`) + `billing.js` (RevenueCat Web Billing → Test Store) | today |
| `exchange` | Event deck (frost/harvest/hype, pity timers + Linkup `marketShift` bias clamped 0.2–3×); gentrification drift (per-day cost creep + matcha 4.80→5.40); forward contracts; supplier debt clock; hidden `geshaUnlocked` (`GRUNDS` → £7.80 wink, persists as toast) | today |

## Game loop mapping

```
 THE GAMBLE (days)          THE READ (hours)           THE SCRAMBLE (seconds)
 ─────────────────          ────────────────           ──────────────
 exchange events     ──→    wave schedule       ──→    patron spawn ticks
 gentrification drift       cohort signals             barista levers + prediction
 Morning Brief (06:00)      friend-graph gossip        (queue vs restock vs regular)
 sized hedge / settle       (3D lines + debrief)       11:00 offer + 14:55 incident
 cost sheet (closeDay)      Day-2 preview              named-Regular hat + bubble + calm-open
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

## Morning Brief — the Drug Wars turn (06:00 [PAUSED])

At every `openDay(d)` after the 3-step tutorial, `main.js` builds a one-screen `#brief` before the tick: Idris prose (`forecastForDay` tilted by the same Linkup bias that moves the ticker) with a tape delta vs `tapePrev`, a 76px canvas sparkline from `exchange.history` (today's price en-dashed, red/green by `marketIntel.marketShift`), clickable wire headlines (href + host + why; Nebius gossip voice as copy when available, else a warm “no fresh wire” fallback), and five sized reply pills (`light £11 ~1200` / `standard £22 ~2400` / `heavy £44 ~4800` / `hold` / `settle`) that *stage* on click/1–5 then `commit` on `OPEN FOR DAY →` (`contractBeans(units, fee)` + `contractFeeExtra`, `dismissBriefAndStartDay` resumes at `06:00`). While open, `briefPaused` holds `loop` at 06:00 and skips spawn/hud/dawn logic; `_pricePreview(spot)` precomputes tonight's Letter price so the pills price honestly. Headless + `?skipBrief` never show the Brief — night Letter stays the 5-action API. The nightly `tapeLine` makes the turn explicit (“board up 12% → lock tonight buys tomorrow at ~today; falling → ride spot”), and `OFFERS` (5) + `INCIDENTS` (6, red-tinted) reuse the same `offerPaused` pause path mid-day so turns compose.

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
3. `spatial` renders the district shell + the paused-dawn `#brief`, then spawns entities per transaction time; gossip bubbles + 3D
   conversation lines render the friendship graph; **honey-oak floor + slab
   pavement + aggregate road + awning eyelets** (`1024`, `anisotropy 8`,
   grain/knots/bevel/bollards + `THE DISTRICT` decal + scuff) + **brick
   facades** (two-tone, mortar, framed windows, cornice + brass shopfront) +
   **512×320 brass-collar ticker** + **Morning Brief `#brief` (sparkline + 5 pills)** place the district; Kenney CC0 props
   (cross-fade `opacity 0→1`, headless-aware) place the café; day-5
   scaffolds/tarps/dust render gentrification; the floor opens at 1×
   through a 3-step tutorial with a 3.4s paused crane settle, a **reactive
   `#goal` strip + 3 just-in-time nudges** (queue≥4, first balk, 13:20 price,
   each once/campaign), a queue health bar (heartbeat at >10 / purr at ≤5,
   `tabular-nums` till, batch countdown, pulse-until-used levers), a flashing
   chalkboard (desaturate + wobble + chalk dust on reprice) and calm-open
   throttling; at 17:00 a wave debrief (fanfare/coin rain/crane on
   `saved≥6`, rain on flop) and at 17:30 a Day-2 forecast teach and tease
   the replay; **mist + `godRay` + warm `motes` (180, amber, drift + cycle)**
   quote the event tier (frost `0.22` cold / harvest `0.14` warm), a till
   drawer slides + shadow stretches on every sale, a living plant (HSL) and a
   street cat (Miso, once/day 09:30, sits if `<4` / scatters if `>10`) make
   the shop alive; hover→story card + click-to-wave and `P` photo mode
   (golden hour + vignette + shutter) are delight affordances
4. At `06:00 [PAUSED]` the floor freezes for the Brief (commit the hedge), then `agent` patrons pick stands (price/queue/rep); named Regulars get a
   brass-band hat + greeting; the player pulls levers (pre-batch/reprice,
   with predicted queue drain, chalk dust + screech on reprice) against the
   wave and answers the `11:00` offer / `14:55–16:55` incident (y/n, same pause contract as the Brief); gossip is throttled in the calm-open window; sitters sip at
   `dwell==4` (arm/head/lean + steam), the rival leans at `heat>6` and jeers
   at 5 defections, Idris quips at 10:00/12:00 rep checkpoints, and haptics
   (`vibrate(35)` on balk, `[20,30,50]` on wave save) land on phones
5. `precedent` stores (pattern → opinion) + friendship graph; a
   5%/day `opContagion` (Map-guarded, sparse-roster safe) pulls each regular
   toward friends' mean; `web/js/analytics.js` records tutorial/lever/balk/
   debrief/forecast + `desk_opened`/`desk_opened_free`/`paywall_shown`/
   `purchase_success` (exposed as `__grunds.analytics.summary()`);
   `desk.js` The Wire opens to all — headlines/sources free, deck tilt on
   `commodity_insider` via `billing.js` (HUD `⚡ the wire ↗` when intel
   lands; bean tape click-through; Letter desklink where the choice
   happens; `#desk-edge` invite for free readers)
6. `exchange` at `openDay(d)` applies gentrification drift (cost creep +
   matcha curve + cohort expectation) *before* the pity-timer roll (+ Linkup `marketShift` bias clamped 0.2–3×), stashes `tapePrev` for the tape/sparkline/`tapeLine` delta, mints the `history` for the Brief sparkline, and `history` for the ticker; at `closeDay` it emits the **cost-sheet P&L** (staff+milk+rent+card+sundries → `cOps` → `netWorth`). Sized hedges `contractBeans(units, fee)` burn cup-by-cup via `consume(n)`; `GRUNDS` secret sets `geshaUnlocked` and
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
  performance: auto-`lite` (`hardwareConcurrency≤4`/`deviceMemory≤4`), dynamic `lite` after 3×>32ms, shadow budget at `queue>40`, GLB cross-fade, `tabular-nums` till + staggered/typewriter receipt, `P` photo + `GRUNDS` secret, **bounce hemi 0.22 lifts the bar**;
  delight wiring: `world.setPlantHealth`/`setGodRay`/`setMotes`/`spawnCat`/`updateCat`/`popTillDrawer`/`_updateDelight(now, dt)`/`jeerRival`, `audio.tick`/`waveFanfare`/`waveRain`/`chalkScreech`/`purr`/`meow`/`shutter`, `fx.chalkDust`/`coinRain`/`victoryBurst` + receipt stagger, `main` reactive `#goal` + nudges + haptics + hover card + Idris quips + rival jeer + desk/billing + `requestAnimationFrame(loop)` re-arm discipline;
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
