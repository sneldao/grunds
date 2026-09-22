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
| `spatial` | Three.js floor: **1024 honey-oak floor + slab pavement + aggregate road** (all `anisotropy 8`), **brick facades** (two-tone + mortar, white frames + sill, cornice + shopfront), **9-block skyline**, **512×320 brass-collar ticker**, gossip bubbles + conversation lines, Kenney CC0 props (loader with cross-fade-in), day-5 scaffolds/tarps/dust, chalkboard flash (desaturate + wobble), 3-step tutorial + calm-open throttling (reactive `#goal` + 3 just-in-time nudges), goal/queue/batch HUD (heartbeat/purr + `tabular-nums` + staggered receipt), **Morning Brief `#brief` (520px linen: 76px sparkline + wire headlines/host/why + 5 pills → `OPEN`) + `phase:'planning'` clock gate**, wave debrief (fanfare/coin rain/crane) + forecast + wire desk (headlines free / tilt gated) + 11:00 offer / 14:55–16:55 incident modals (same modal pause path), bean tape HUD + ticker sparkline + bias glow, living plant (HSL health + wilt), god rays + **motes** + mist, till drawer + stretching shadow, **bollards + street decal**, cat Miso, hover story card + photo mode, scuff decal + awning tie-downs, GLB cross-fade + shadow budget + bounce hemi | today |
| `agent` | Patron decision loop (price/queue/rep) + barista levers (pre-batch/reprice + queue-drain prediction + chalk dust/screech) + named-Regular hat/bubble + wave + friend-graph gossip routing (throttled in calm open) + sitter sip at `dwell==4` + hover→story card (36px probe) + click-to-wave (+0.06 op) + cat spawn/sit/scatter + plant health + till slide | today |
| `precedent` | Patron memory: opinions persist; gossip via named-friend graph; 5%/day `opContagion` (Map<i→op> + `Number.isFinite` guard for sparse rosters); local `analytics.js` (tutorial/lever/balk/debrief/forecast + `desk_opened`/`paywall_shown`/`purchase_success`) + `desk.js` (The Wire — headlines free, tilt on `commodity_insider`) + `billing.js` (RevenueCat Web Billing → Test Store) | today |
| `exchange` | Event deck (frost/harvest/hype, pity timers + Linkup `marketShift` bias clamped 0.2–3×; a `rumour_frost` day triples next-day frost/drought weights — the wire's warning is a real, imperfect signal); gentrification drift (per-day cost creep + matcha 4.80→5.40); forward contracts; supplier debt clock with a £1,500 tab limit; hidden `geshaUnlocked` (`GRUNDS` → £7.80 wink, persists as toast) | today |

## Game loop mapping

```
 THE GAMBLE (days)          THE READ (hours)           THE SCRAMBLE (seconds)
 ─────────────────          ────────────────           ──────────────
 exchange events     ──→    wave schedule       ──→    patron spawn ticks
 gentrification drift       cohort signals             barista levers + prediction
 pitch licence (boot)       identity → name/stand      role + one-perk background
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

`prepareDay(d)` (also exposed as `openDay`) enters planning at 06:00 without charging or rolling the market. The Brief shows known district pressure and rival posture, then staffing, five procurement choices, optional paid street work, and an itemized cost quote. Idris's prose, the 72px board sparkline, and research sources are secondary details. All variable content scrolls inside the shared modal body; a stable footer holds the summary and Open action. The Brief discloses progressively, driven by state rather than a flag store: a calm day 1 folds the three contract pills under one line (a warn/bad/cata board, an open position, or a live tab springs it open, and a staged contract keeps it open), the dead settle pill never renders, street work and the net-position figure appear from day 2 — street work with a "yesterday N walked" reason line — and Ruth's row appears only when `canChooseStaffing` says she's fading. Disclosure gates rendering only; `stageDayPlan` stays permissive so connected-mode plans aren't shadow-banned. `stageDayPlan` is reversible and atomic. `commitDayPlan` resolves the pure `resolveDecision(snapshot, plan)` against the previous closing board, applies the result once, rolls the new market, and enters trading. Headless tests explicitly stage and commit through the same APIs; only rendering is stubbed. Closing computes the ledger once and leaves the receipt open until `continueFromReview`; Idris's letter is optional review, not a second procurement gate. Day five completes only after its trading and review phases. If net worth is negative at any review — till minus costs minus the outstanding tab — the supplier calls it and the campaign ends `lost` on the spot.

Contracts are price coverage, not stock: 1200/2400/4800 cups for per-cup fees of £0.065/£0.09/£0.115 (£78/£216/£552 at face), plus any announced surcharge, all riding on the supplier tab — which caps at £1,500 including the day's interest, so a deep enough tab forces a settle (or a hold) before the next hedge. Each prepared cup captures its price and bean cost before consuming coverage; exhausted contracts fall back to spot. The receipt distinguishes operating profit, contract fees, interest, settlement, and realized hedge benefit. Unused cover does not spoil and uncovered cups do not starve. The retail price curve is charged, not just displayed.

Baseline bean drift is an increasing daily increment: 0.025 + 0.008 × (day − 1), capped before the market event. Day-two transit shifts morning commuter waves 30 minutes and increases dwell by 30%; quantities are preserved and the source schedule is never mutated. Pitch revaluation adds £150 to the rent floor and 3 percentage points to turnover rent from day three. The £0.18-per-cup supplies surcharge persists from day four. GLASSHOUSE's announced strategy uses the previous day's event tier; its price/cohort pull affects initial customer choice and its speed multiplier affects actual service. Initial rival choices and post-queue defections are counted separately. `OFFERS` (5) + `INCIDENTS` (6, red-tinted) reuse the same modal pause path mid-day so turns compose.

**Managed decisions (connected mode).** When `?convex=` is live, `convexSync.js` runs the week through a per-run serialized queue — `begin → prepare → stage → commit → finish` on `POST /sync/plan`, authenticated by a 32-byte run token the HTTP layer SHA-256s before the internal mutations see it. `convex/decisions.ts` keeps one `dayDecisions` row per campaign-day: `prepare` pins the snapshot, `stage` updates the still-pending plan, `commit` (browser) and `handleInbound` (email, via a thread→`{campaignId, decisionId, day, recipient, postedPlan}` mapping) both funnel into `commitRecord` — first writer wins, every retry or loser re-reads the same committed result. `finish` validates and stores the closing state once (conflicting retries rejected, identical ones idempotent) and upserts the player's `stands` row; `abandon`/reset invalidates the session so delayed writes die. Legacy public mutations (`openDay`, `contractBeans`, `settleDebt`, `mirrorState`, `recordStand`) reject any campaign that has a `planSessions` row. If the endpoint is unreachable the Brief stays in planning with a retryable error; `start a local-only week` (`#brief-offline`) is the explicit opt-out — it disables managed sync and mail for the run rather than silently degrading. Scope note: the simulation stays client-side; the commit record arbitrates *intent*, it is not server-authoritative anti-cheat.

**The pitch licence.** Before the tutorial, `#licence` (z-33 paper card over the diorama) signs the player in: name + stand name (pen-line inputs, activate the Sign button; Escape never signs or advances — Sam, THE CORNER CUP), a cosmetic role, and one of four backgrounds carrying a single small perk — `ex-barista` (`perkStaffMul 1.08`), `ex-accountant` (`perkCostMul 0.85` on card fees + every incident payout), `new to the trade` (regulars open at op 0.25), `a market regular` (the Brief whispers the wire's *direction* — the × stays insider). Identity threads `composeLetter` (`Dear Ada,` / `…do, Ada?`), nightly + finale receipts, the tutorial's first title, and the Convex owner — `convexSync` reads `ownerName()` live so the district board lists the stand name at the next dawn. Persists via `localStorage` `grunds.identity`; `?skipLicence`/`?skipTutorial`/headless bypass.

**Ruth — the staff layer.** Ruth loses 0.14 condition per worked shift, plus 0.08 for peak queues above 50 and 0.06 for more than 60 balks. Below 0.55 on day two onward, the Brief offers work, home, or apprentice cover. Home saves the wage, runs the solo bar at 0.7x, and restores 0.45 condition; apprentice cover costs a £2,040 temp day rate plus £12 training and £0.04 extra supplies per served cup, runs at 1.05x before the identity perk, and restores 0.25. Home and apprentice modes prevent Ruth's exhaustion crisis and incompatible sick call. Working below 0.35 slows dawn pace; working below 0.2 risks an afternoon crisis — asleep at the counter (`staffMul 0.5`) or snapping at a regular (`adjustOpinions −0.2`). No roster, no morale meter — the fiction carries the state; `staff_sent_home`/`staff_pushed`/`staff_crisis` land in analytics.

## Delight spine — director + vitality (Sept 19)

Five delight features share one architecture rule: `world.updateTimeOfDay`,
`sky.update`, and `audio.update` overwrite their targets with absolute values
every frame, so any added modulation must run **after** them, read-modify-write.
`web/js/director.js` is that seam: `add(id, apply) / remove(id) / update(ctx)`
with `ctx = {dt, now, dayMin, night, vitality}`, replace-by-id, try/catch per
layer, wired in `main.js loop()` right after the time-of-day calls.

- **`vitality.js`** — `0.65·awareness + 0.35·(reputation/100)`, lerped ×0.02/frame.
  Recomputed at `openDay`/`closeDay`/`applyReply`. **Skin, not mechanics:** it
  drives director layers (pendant/lamp/window/sign glow), `sky.update(t, sun, mood)`
  (sun intensity + star visibility), and `audio.setMood(v)` (murmur + pad gain) —
  and provably never touches `demand.spawnMul()`, which already carries the
  numbers (`vitality.mjs` pins this numerically).
- **`nextAction.js` + `halo.js`** — one pure priority rule (queue≥6 & !prebatched
  → batch · morning window & !repriced → price · `mailPending` → mail · wait)
  renders *both* the `#goal` strip text and the brief row, and after ~5 s of no
  user intent a camera-invariant ground ring pulses under the target object
  (`shouldHalo` predicate is pure/headless; the mesh never builds headless or
  under reduced-motion, which keeps a faint static ring). Words and light
  cannot drift apart because they read the same function.
- **`kitArrival.js`** — `districtGen.tick()` now tracks grown vs pending slots
  and fires `onGrown(slots)` exactly once; the beat rolls a cart in from
  x+14 (~2.4 s ease-out + bob), lights the five lanterns 0.6 s apart via a
  `kitGlow` director layer on the decaying pulses, then fanfare + toast. A
  pre-warmed seed (7) loads quietly; classic/headless never see it
  (`kit-arrival.mjs`).
- **`mailTheater.js` + the inbox mirror** — `letters` gained
  `dir`/`action`/`from`/`createdAt` and index `by_campaign_dir_created`;
  `agentmail.latestInbox` + `GET /agentmail/inbox` (read-only httpAction) let
  the client poll for Idris's reply while a posted letter is pending. On
  arrival: flag lerps up, `audio.knock3()` triple tap, an envelope sprite drops
  from the mailbox to the pavement, halo retargets. **Mirror rule:**
  `handleInbound` (server) is the only applier of contract/hold/settle — the
  client never re-applies (`mail-inbox.mjs` asserts no `runMutation` in the
  route and no `applyReply` in the arrival path).
- **`shareCard.js`** — `doPhoto` captures *after* `postfx.render(now)` (the
  renderer has no `preserveDrawingBuffer`, so a bare `drawImage` would lose
  bloom/vignette), cover-crops the snapshot into a 1280×720 cream-paper card
  with double rule, brass corners, caption band and a rotated red rubber stamp
  (`textures.js` SOLD-stamp idiom), then offers `↓ save · 𝕏 share · ⧉ copy` —
  Web Share Level 2 where the OS supports it, X-intent and clipboard
  independently (`share-card.mjs`).

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
   (golden hour + post-FX-correct **stamped share card** — save / Web Share L2
   / copy) are delight affordances, joined by the idle-time **guidance halo**
   and the vitality glow the block wears
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
6. `exchange.openDay(bias?)` runs *inside* `commitDayPlan` — after the staged
   plan resolves — applying the increasing daily drift increment and matcha
   curve *before* the pity-timer roll (+ Linkup `marketShift` bias clamped
   0.2–3×), stashing `tapePrev` for the tape/sparkline/`tapeLine` delta and
   minting `history` for the Brief sparkline and the ticker; at `closeDay` it
   emits the **cost-sheet P&L** (staff+milk+rent+card+sundries → `cOps` → `netWorth`).
   Sized hedges burn cup-by-cup via `consumeContract` — price coverage, not
   stock; exhausted cover falls back to spot. `GRUNDS` secret sets `geshaUnlocked` and
   flashes £7.80 on the board (persists as a next-day toast)
7. Demand (`web/js/demand.js`, pure/deterministic): awareness 0..1 multiplies
   the wave spawn 0.18×–1.3× via `spawnMul()`, decays 0.055/close (+0.04 on
   catastrophes); loyalty is reputation as a return rate (`Regulars.returnRate`,
   12% at rep 62, capped 35%) — yesterday's served × rate reappear spread
   across today's waves. Reputation also scales footfall ±1.4%/point from 62,
   and days that balk >6%/>15% of served sour the named regulars (−0.05/−0.10).
   Routine chalk contributes its awareness gain
   automatically. Sampling (£40) and sponsorship (£160, day three onward) are
   reversible paid choices until commitment; their gains arrive at closing for
   tomorrow. Paid marketing is disabled on day five. Staffing, sampling,
   training, sponsorship, supplier fees, and interest all appear in the plan
   quote and reconcile to closing accounts. Tape prints `street ●●●○○`;
   receipt prints awareness; verdicts talk back under 0.35.

## Convex deployment (live since Sept 12)

Backend and hosting are deployed to a cloud dev deployment; the local
simulator (`web/js/*`) remains the deterministic reference and the
headless gate pins both. This is a historical deployment: the new
`planSessions`/`dayDecisions` decision schema and managed protocol in this
change have only been tested locally (mocked DB/HTTP) and require a
coordinated backend + frontend deployment. Native Convex codegen was not
run for this change — `convex/_generated/api.d.ts` was updated by hand and
may differ from future generated output.

Shipped (`convex/`, verified end-to-end against cloud, re-verified Sept 13):

- Tables: `campaigns`, `marketEvents`, `regulars`, `friendships`,
  `letters`, `stands`, `apiCache` — all indexed.
- Dawn tick: `exchange.openDay(bias?)` applies gentrification drift
  (per-day cost creep + matcha curve) *before* the pity-timer event roll —
  same ordering as the local `Exchange`; optional `bias` (marketShift,
  clamped 0.2–3× per event) from Linkup tilts the weighted pool without
  replacing the seeded roll. Deterministic per seed+day. New Sept 13:
  server `openDay` reads the merged wire cache from `apiCache`
  (`research:wire:v1:<hash>`, falling back to `linkup:research:v1:<hash>`)
  at the dawn tick — no extra action needed.
- Regulars: `markSeen`/`unsee`, `resolveDay` (expectation pressure, outcome
  delta, 5% friendship contagion), reputation meter.
- Roaster's Letter: templated preview + archive; Nebius Token Factory
  `POST /ai/letter` (`meta-llama/Llama-3.3-70B`, was 3.1 — host
  `api.tokenfactory.nebius.com`, 7-day hash cache) powers the in-character
  Idris rewrite consumed fire-and-forget from the floor (`showLetter` swaps
  to LLM prose mid-letter); OpenAI path remains as a key-gated fallback.
  `intelLine` cites the Linkup wire when sources arrive.
- The Wire — merged sponsor feed (`convex/research.ts`): `GET /ai/research`
  fans out to Linkup `searchCommodityIntelligence` (Deep Search, 6h cache)
  and Firecrawl `fetchCommodityNews` (search crawl → `KEYWORD_MAP` deck
  suggestions, 6h cache), merges both source lists with `origin` tags, and
  unions the `marketShift` suggestions per `eventId` — corroborating pipes
  lift a tilt ~15% instead of stacking. OpenAI `wireWhy` (`gpt-4o-mini`,
  7-day input-hash cache, key-gated) writes the ≤25-word "why this matters"
  line under the lead tilt. Merged payload caches at
  `research:wire:v1:<hash>`; `refreshWire` runs on cron so dawn reads are
  warm. Each pipe falls back independently — a dead key degrades to the
  other pipe, never to an error.
- AgentMail — the roaster is a real mailbox (`grunds-roaster@agentmail.to`):
  the letter modal gains a "post this letter" row (sync-gated) that POSTs
  `/agentmail/letter` → `sendLetter` mails the exact rendered body + a
  reply-to-command footer, records thread + recipient → campaign mappings
  in `apiCache` (30d), and archives outbound in `letters`. Replies hit
  `/agentmail/webhook` — real Svix signature verification
  (`verifySvix`, HMAC-SHA256 over `id.ts.body`) → `message.received` →
  `resolveThread` (thread id, else sender address) → `handleInbound`
  (contract/hold/settle applied to the campaign) → Idris sends an
  acknowledgement by return post. Self-delivery guarded. Verified
  end-to-end: letter delivered → "contract" reply applied (debt +£22,
  2400 units locked) → ack received → full audit in `letters`. Sept 19:
  `letters` rows carry `dir`/`action`/`from`/`createdAt` (+
  `by_campaign_dir_created` index); `latestInbox` behind read-only
  `GET /agentmail/inbox` mirrors the mailbox so the client can stage the
  reply's arrival — server `handleInbound` remains the only applier.
- Hosting: `@convex-dev/static-hosting` serves the floor from
  `https://striped-anaconda-746.convex.site` (43 files Sept 13, SPA fallback — adds `desk.js` + rebuilt `dist`);
  performance: auto-`lite` (`hardwareConcurrency≤4`/`deviceMemory≤4`), dynamic `lite` after 3×>32ms, shadow budget at `queue>40`, GLB cross-fade, `tabular-nums` till + staggered/typewriter receipt, `P` photo + `GRUNDS` secret, **bounce hemi 0.22 lifts the bar**;
  delight wiring: `world.setPlantHealth`/`setGodRay`/`setMotes`/`spawnCat`/`updateCat`/`popTillDrawer`/`_updateDelight(now, dt)`/`jeerRival`, `audio.tick`/`waveFanfare`/`waveRain`/`chalkScreech`/`purr`/`meow`/`shutter`, `fx.chalkDust`/`coinRain`/`victoryBurst` + receipt stagger, `main` reactive `#goal` + nudges + haptics + hover card + Idris quips + rival jeer + desk/billing + `requestAnimationFrame(loop)` re-arm discipline;
  app routes stay at root (`/sync/*`, `/ai/*`, `/agentmail/*`). On managed
  runs the floor writes closing state through `sync.finishDay` (which also
  upserts the per-owner `stands` row, stable `grunds.owner` id, `?stand=`
  override), polls server state for the badge, and the dashboard +
  `topStands` leaderboard + `GET /sync/stands` read live games.
- Scheduled: `commodity-news-refresh` (Firecrawl, 06:00 UTC) +
  `linkup-intel-refresh` (Linkup, 06:15 UTC) + `wire-merge-refresh`
  (merged wire, 06:30 UTC — reads the freshly-warmed caches).

Still pending: per-campaign dawn cron (intentionally skipped — no
active-campaign pointer, ticks stay player-driven), Convex Auth (not
required by the hackathon), production deploy
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
