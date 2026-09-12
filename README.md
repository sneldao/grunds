# Grunds — The District

A live 3D coffee district where **players run competing café stands** and **AI patrons
decide where to buy** — real commodity prices, behavioural cohorts, and word-of-mouth
gossip, all visible on the floor. Built at the **Spatial Intelligence + Generative 3D
Hackathon** (Founders Inc., Sept 5) and being rebuilt as a **persistent multiplayer
product on Convex** for the **Convex All Gas Hackathon** (deadline Sept 22).

> *"The Sims gave us households, Football Manager gave us squads — Grunds gives you a
> live micro-economy where real commodity shocks meet behavioural agents, and you can
> watch cause and effect move through a 3D street."*

## Design pillar

**"You can't control demand. You can only be ready for it — faster than the café
across the street."**

The fun is **read → scramble → payoff**, running on three nested clocks:

| Beat | Clock | What it feels like |
|---|---|---|
| **The Read** | hours | Spotting a signal before rivals — the floorplan *is* your chart |
| **The Scramble** | seconds | Overcooked-style triage during a rush: shots, restock, or rescue a regular |
| **The Gamble** | days | Frost hits Minas Gerais — contract beans today or risk tomorrow's spike |

Inspired by **Drug Wars**: a price table players can read, an event deck they can't
predict, and a clock they can't ignore. Depth is emergent from price variance — not
from buttons.

## The four systems

- **The Exchange** — real-world anchoring. Arabica futures drift, frost/drought events
  in growing regions (seeded by Firecrawl news crawls), harvest calendars, forward
  contracts. World events pass through commodity economics into patrons' pockets into
  your till — every link visible in 3D.
- **The Regulars** — the social layer. Patrons are persistent characters with memory;
  word-of-mouth propagates through a friendship graph (visible as 3D conversations).
  Bad reviews spread; regulars hold court and boost reputation.
- **The Roaster's Letter** — the inbox. The supplier writes in character (AgentMail);
  you reply by email to contract beans, restock, or settle debt. Lore-native UI.
- **The Floor** — the 3D scene. Zones (counter, tables, register, retail shelf),
  entity spawning per transaction, gossip bubbles, queue heat. One complete
  interaction loop, demoable in two minutes.

## Cohorts — culture as mechanics, not skin

Diversity lives in the demand curves and gossip networks, not in costumes:

| Cohort | Ritual | Elasticity | Gossip trigger |
|---|---|---|---|
| Commuters (7–9am) | Same order; speed is everything | Low; zero queue patience | "Line took 6 minutes" |
| Creatives (10am–2pm) | Laptop campers, single-origin talk | Price-insensitive, reputation-sensitive | "They switched roasters" |
| Students (2–6pm) | Matcha spike, price-sensitive | High — follow discounts | "Next door is £1 cheaper" |
| Elders (off-peak) | Cappuccino, loyalty, recognition | Want recognition, not novelty | Memory of every mistake |
| Tourists (weekends) | Whatever's on the "best of" list | Follow hype, tip well | Post the latte art |

A price cut wins students but insults the creatives. Each cohort is a different clock
in the day and a different lever that works on them.

**Inflation** enters as a *pressure clock*, not a stat screen: the district
gentrifies — rents and bean costs creep, willingness-to-pay rises but expectations
rise faster. Standing still loses. (Supplier credit is the Drug Wars debt clock,
delivered by the Roaster's Letter.)

## Track alignment

### Spatial Intelligence Hackathon — Gaming & Interactive Worlds (today)

| What judges look for | What Grunds delivers |
|---|---|
| Playable world, one complete interaction loop | Read → scramble → payoff, demoed in 2 minutes |
| Embodied agents in a physical environment | AI patrons with memory, visible on the floor |
| Clearly visible state changes | Transactions spawn entities; frost events visibly shift the drink mix |
| Spatial reasoning | The floorplan is the chart: queues, gossip, zone heat |

Single-player, deterministic, seeded — `transform.py` generates the demand curves.
Planted signals are the narrative arc: the matcha riser, the loaf faller, the 8.2%
cake attach.

### Convex All Gas Hackathon (by Sept 22)

Same world, multiplayer and persistent:

- **Convex**: tables for stands, patrons, opinions, contracts; scheduled functions
  spawn waves and roll events; live queries move the whole district in real time
- **Firecrawl**: nightly crawls of commodity news + real café menus/prices seed the
  Exchange and market realism — **live since Sept 12** (Brazil drought → deck weights)
- **AgentMail**: the Roaster's Letter — in-character briefings with reply-to-command
- **OpenAI**: patron personas that explain their choices in speech bubbles
- Deployed on `convex.site`, public repo, `hackathon.md` build log from day one
  — **live since Sept 12** at https://striped-anaconda-746.convex.site

Prior work disclosed honestly in the build log: "a deterministic café dataset engine
and briefing design (prototype); this build: a live, real-time product on Convex."

## Data layer (exists today)

- **Source**: Maven Analytics "Coffee Shop Sales" — 149k transactions, 3 NYC
  locations, Jan–Jun 2023
- **Transform**: `transform.py` (deterministic, seeded RNG) — one location, 13 weeks
  shifted to end on the most recent Saturday, matcha-café menu overlay, GBP/VAT
- **Output**: `out/square_item_sales.csv` — ~26.5k rows, 286 txns/day, morning peak
  7–11am

### Planted signals (the narrative arc)

| Signal | Pattern | Why it matters in the game |
|---|---|---|
| **RISER** | Iced Matcha Latte 260→671 units/wk (2.6×) | The read: spot it, pre-batch, win the afternoon wave |
| **FALLER** | Miso Banana Loaf 141→59 (−45%) | Dead stock decision: discount, donate, or drop |
| **ATTACH** | Cake attached to only 8.2% of matcha orders | The nudge: bundle mechanics, measurable lift |

## Two-minute demo script

1. Show the floor. Patrons arrive — commuters first, fast and impatient *(the scramble)*
2. The Roaster's Letter: frost event. Bean costs spike on the Exchange *(the gamble)*
3. Pull ONE lever mid-demo: pre-batch matcha / reprice before the student wave *(the read)*
4. Watch the payoff: queue shifts, till ticks, the rival stand visibly starves
5. One gossip moment: a bad review spreads across the floor as patrons chat

Keep one reliable path, visible reset controls, and a fallback recording.

## Hackathon build plan

**Today (spatial, 10:00–18:00)**
1. Zone mapper: each transaction → (zone, time, item, cohort) — `grunds/ingest.py`
2. Patron wave spawner from `transform.py` output — cohorts 1–3 (commuters,
   creatives, students)
3. Three.js floor: 4 zones, entity spawning, queue heat
4. ONE player lever wired in: pre-batch/reprice before the afternoon matcha wave
5. Gossip stub: one visible bad-review propagation
6. Demo polish: reset button, fallback recording, 2-min script locked

**Convex phase (by Sept 22)** — status Sept 12:
1. ~~Fresh repo, `npm create convex`, port signals/zone logic to TypeScript~~ — done:
   `convex/` holds schema, exchange, regulars, letters, apiCache + OpenAI/Firecrawl/
   AgentMail actions, verified end-to-end on a cloud dev deployment
2. ~~The Exchange: scheduled functions + Firecrawl news→event deck (with pity timers)~~ —
   deck + pity timers live server-side; Firecrawl pull live with 6h cache; nightly cron next
3. ~~The Regulars: persistent patron memory + gossip propagation graph~~ — done server-side
4. The Roaster's Letter: AgentMail inbox, reply-to-command mutations — webhook live,
   inbox keys pending
5. All 5 cohorts, supplier credit clock, gentrification drift, cupping events — drift +
   credit live; OpenAI persona prose stubbed until key lands
6. ~~Deploy convex.site, public repo, `hackathon.md`, video, X post~~ — site + repo + log
   live; video + social still to do

## Architecture

```
transform.py          ← deterministic data engine (existing)
        ↓
  square_item_sales.csv
        ↓
  ingest/             ← CSV parser + zone/cohort mapper
        ↓
  spatial/            ← Three.js floor: zones, entity spawner, gossip bubbles
        ↓
  agent/              ← patron decisions + barista agent (read/scramble levers)
        ↓
  precedent/          ← patron memory: opinions persist across runs
        ↓
  exchange/           ← (Convex phase) event deck, price drift, contracts
```

## Design principles

- **Deterministic first**: all numbers computed by code; LLM optional for prose/persona
- **The floorplan is the chart**: the 3D view *is* the interface — no dashboard required
- **Foresight is a skill**: the economy isn't rigged; reads must be legible in hindsight
- **Fairest losses win**: never two catastrophes in a row — pity-timed events
- **Depth in the doc, delight in the demo**: elasticity never appears on screen
- **Demo-reliable**: frozen dataset, one clean path, fallback recording ready

## Getting started

```bash
python3 transform.py          # regenerate deterministic demand data
python3 -m grunds run         # zone/cohort map + wave schedule
python3 -m grunds spatial     # launch the Three.js floor at localhost:8787
node web/test/smoke.mjs              # headless day sim — scramble levers + the queue
node web/test/campaign.mjs           # 5-day campaign — the Gamble hedge + debt clock
node web/test/campaign-tight.mjs      # per-regular opinion + cup-bounded contract expiry
node web/test/regulars-graph.mjs      # friendship graph + opinion contagion
node web/test/gentrification.mjs      # per-day cost creep + cohort expectations
node web/test/rent-sign.mjs           # 'let' → 'lease' → 'sold' rent sign ladder
node web/test/construction.mjs        # day-5 right scaffold + tarp
node web/test/construction-left.mjs   # day-5 left scaffold (district-wide)
node web/test/construction-active.mjs # day-5 drifting dust + low saw loop
node web/test/construction-final.mjs  # day-4 letter line + back-row scaffold + hammer
node web/test/glb-substitution.mjs    # Kenney GLB loader + substitution map
node web/test/game-feel.mjs           # bubbles bounded/clamped, signed numbers, pause, letter keys
```

The floor is a **connected 5-day campaign**, not a closed loop. The three nested clocks
now meet the floor: the Exchange rolls a pity-timer event deck at each dawn (frost on
Minas Gerais, East Africa drought, clean harvest, matcha hype) that moves the bean
benchmark; your cost-of-goods (anchored to `benchmark_corpus.json` — ~30% COGS for a UK
independent) eats the margin shown on an in-world **ticker board**; the **Roaster's
Letter** arrives at each close as a reply-to-command (contract / hold / settle) you
answer from the **mailbox** in the street; **persistent Regulars** carry opinion across
days into a reputation meter that modulates footfall and tips. World events pass through
commodity economics into patrons' pockets into your till — every link visible in 3D.

The diorama: a shader **sky dome** (gradient + sun glow + procedural stars over the day
arc), procedural **district facades** whose windows light up at dusk, a far skyline, a
mailbox, a commodity ticker, and weather mist after a frost — rendered through a
core-Three **post-FX** bloom/vignette/grain pipeline. Controls: drag to look, scroll to
zoom, `1` pre-batch, `2` reprice, `space` pause, `M` sound, `R` reset, `C` camera.
The Roaster's Letter answers to `1`/`2`/`3`. URL params: `?lite`
(no shadows/post-FX, 1x pixels), `?speed=60|300|1200`, `?seed=N` (campaign seed).

Repo structure:

```
grunds/
├── README.md
├── ARCHITECTURE.md
├── EVAL.md
├── pyproject.toml
├── package.json                 # convex + static-hosting (npm run typecheck/build:dist/deploy:site)
├── tsconfig.json
├── convex/                      # live backend (cloud dev deployment, verified end-to-end)
│   ├── schema.ts                # campaigns, marketEvents, regulars, friendships, letters, stands, apiCache
│   ├── gameConfig.ts            # drift, event deck, roster, seeded RNG (ported from web/js/config.js)
│   ├── exchange.ts              # dawns, contracts, debt — drift-then-pity-roll
│   ├── regulars.ts              # seen-marks, expectation pressure, 5% contagion
│   ├── letters.ts               # templated Letter preview + archive
│   ├── apiCache.ts              # TTL response cache (Firecrawl 6h, OpenAI 7d)
│   ├── openai.ts                # enhanceLetter + personaLine (gpt-4o-mini, key-gated)
│   ├── firecrawl.ts             # commodity-news → deck weights (live)
│   ├── agentmail.ts + http.ts   # signed webhook → reply-to-command; /sync/* bridge; static catch-all
│   └── convex.config.ts         # registers @convex-dev/static-hosting
├── tools/build-dist.sh          # web/ → dist/ + schedule snapshot for site upload
├── data/
│   └── coffee_shop_sales.xlsx   # source (deterministic via transform.py)
├── out/
│   └── square_item_sales.csv    # generated export
├── grunds/
│   ├── __init__.py
│   ├── __main__.py              # makes `python3 -m grunds` work
│   ├── ingest.py                # CSV parser + zone/cohort mapper + wave schedule
│   ├── spatial.py               # Three.js floor server (localhost:8787)
│   ├── agent.py                 # patron choice loop + barista levers (stub)
│   ├── precedent.py             # patron memory, opinions, friendship graph (stub)
│   └── eval.py                  # demo-loop scoring
├── web/
│   ├── index.html               # shell, HUD, story overlays (chapters, notebook, letter, receipt)
│   ├── js/
│   │   ├── main.js              # the campaign: loop, economy, story beats, the letter flow, pause, letter keys
│   │   ├── convexSync.js        # optional dawn-mirror to Convex (auto on *.convex.site, ?convex= override)
│   │   ├── world.js             # the diorama + time-of-day director (district, ticker, mailbox, mist, scaffolds)
│   │   ├── sky.js               # custom shader sky dome (gradient + sun + stars) — core-Three only
│   │   ├── postfx.js            # core-Three render-target bloom + vignette + grain
│   │   ├── patrons.js           # instanced characters, queue/balk/defect behaviour, named-Regular hat/bubble
│   │   ├── exchange.js          # the Gamble: seeded pity-timer event deck, bean market, debt clock
│   │   ├── regulars.js          # persistent opinion + friendship graph + 5%/day contagion (the Regulars)
│   │   ├── letter.js            # the Roaster's Letter: driftLine + neighborhoodLine + reply-to-command
│   │   ├── fx.js                # steam/coins/dust/gossip bubbles/3D conversation lines/construction dust
│   │   ├── gentrification.js    # per-day cost creep + matcha price curve + cohort expectation pressure
│   │   ├── loader.js            # async GLB loader with cache + FIFO eviction + placeholder fallback
│   │   ├── camera.js            # cinematic rig: title orbit, crane-in, beat push-ins
│   │   ├── audio.js             # procedural WebAudio: murmur, hiss, till, pad, construction saw + hammer
│   │   ├── config.js            # palette, layout, cohorts, economy, campaign, events, regulars, drift
│   │   └── textures.js          # procedural canvas textures (wood, chalkboard, facade, awning, rent sign, tarp)
│   ├── test/
│   │   ├── smoke.mjs                  # headless day integration test
│   │   ├── campaign.mjs               # 5-day campaign: hedge + debt clock + settle
│   │   ├── campaign-tight.mjs         # per-regular opinion + cup-bounded contract expiry
│   │   ├── regulars-graph.mjs         # friendship graph + opinion contagion
│   │   ├── gentrification.mjs         # per-day cost creep + cohort expectations
│   │   ├── rent-sign.mjs              # 'let' → 'lease' → 'sold' rent sign ladder
│   │   ├── construction.mjs           # day-5 right scaffold + tarp
│   │   ├── construction-left.mjs      # day-5 left scaffold
│   │   ├── construction-active.mjs    # day-5 drifting dust + low saw loop
│   │   ├── construction-final.mjs     # day-4 letter + back-row scaffold + hammer
│   │   ├── glb-substitution.mjs       # Kenney GLB loader + substitution map
│   │   └── game-feel.mjs              # bubbles bounded/clamped, signed numbers, pause, letter keys
│   ├── vendor/three.module.js   # vendored Three.js r160 (demo-reliable, no CDN)
│   └── assets/                  # Kenney CC0 GLB props + SOURCES.md
├── benchmark_corpus.json        # UK café COGS benchmarks (anchors the Exchange math)
├── locality_packs.json          # London district locality data (matcha price ranges)
├── cli.py
└── tests/
```

---

## Recent progress (post-PR #1)

After the connected-campaign PR #1 landed, the build log has been steadily
catching up to the README's promises. Each item below shipped as its own
squash-merge PR with a headless test gate.

- **PR #2 — Phase 0 CC0 props (Kenney)**. The vendored Kenney GLBs that the
  README always promised now sit on the floor: bar, espresso machine, till,
  three tables, nine chairs, three lamps, two planters, retail shelf
  backing, six pastry items, three bar stools, one side table. New
  `web/js/loader.js` (async GLB loader with cache + FIFO eviction + magenta
  placeholder fallback). `web/test/glb-substitution.mjs` (15 assertions).
- **PR #3 — Regulars friendship graph**. Gossip is no longer random: it
  routes through named friends when one is on the floor, and a dashed
  `THREE.LineSegments` is drawn between gossiping regulars' heads. Each
  `REGULAR_ROSTER` entry has a `friends` array (11 undirected edges,
  diameter 2). `Regulars` now has a `friendships` Map, `pickFriendFor`,
  `reachableIn`, and a 5%-per-day `opContagion` step that runs at end of
  day. `web/test/regulars-graph.mjs` (8 assertions).
- **PR #4 — Gentrification drift**. The README's "Inflation enters as a
  *pressure clock*" is now real. New `web/js/gentrification.js`:
  `applyDrift(ex, day)` raises `beanIndex` by +0.025/day (capped at 1.80)
  and sets the day's matcha till price on a 4.80→5.40 curve;
  `applyExpectation(regulars, day)` shifts each seen regular's `op` by
  `day * delta` per cohort (elders -0.02, creatives -0.01, students +0.01,
  tourists +0.01). HUD gets a new `#pressure` line "costs +X% · matcha £Y
  · day Z/5". The Roaster's Letter gets a `driftLine` paragraph on days
  ≥ 2. `exchange.openDay()` applies the drift *before* the event roll
  (the drift is the baseline; the event is the deviation). New
  `web/test/gentrification.mjs` (6 assertions).
- **PRs #5–#9 — Day-5 visual + audible construction story** (5 PRs).
  - A `W.setRentPressure(day)` exposes a rent sign on the right side of
    the street: 'let' (day 1-2), 'lease' (day 3-4), 'sold' (day 5).
  - Three procedural scaffolds materialize on day 5: right facade block
    (x=11), left facade block (x=-10), back-right (x=17). Each carries
    a red-and-white striped "UNDER CONSTRUCTION · SEPT 15" tarp.
  - A `dustSite` particle pool in `fx.js` drifts 80 cream/warm-grey
    particles between the scaffolds on day 5.
  - `audio.js` adds a low procedural saw loop (drone) and a jittered
    wooden tock + metal click (rhythm) on day 5.
  - The Roaster's Letter gets a `neighborhoodLine` paragraph on days
    ≥ 4 ("Both storefronts are scaffolded now. The street is being
    remade — for or against you, that's the question.").
  - 4 new tests: `rent-sign`, `construction`, `construction-left`,
    `construction-active`, `construction-final` (19 assertions total).

The day-5 narrative is now end-to-end: numbers (HUD `#pressure`),
narrative (the Letter), physical (scaffolds + tarps), audible
(saw + hammer), animated (drifting dust). Eleven headless tests run
green on every merge.

## Live on Convex (Sept 12)

The Convex phase shipped as working backend + hosting, not a plan:

- **Linkup**: Deep Research integration (`convex/linkup.ts`) querying global coffee commodity intelligence (weather disruptions, harvest reports, shipping bottlenecks) to dynamically bias the morning event deck with cited source URLs.
- **Nebius**: Applied AI integration (`convex/nebius.ts`) via Token Factory (`meta-llama/Meta-Llama-3.1-70B-Instruct`) for in-character prose generation and responsive patron reaction lines with latency and token telemetry.
- **RevenueCat**: Subscriptions / Web Test Store integration (`web/js/billing.js`) providing sandbox entitlement management for the "Commodity Trader / Futures Pass".
- **Backend** (`convex/`): schema for campaigns, market events, regulars,
  friendships, letters, stands, and an API-response cache; queries +
  mutations for the Exchange (drift-then-pity-roll dawns, contracts,
  debt), the Regulars (seen-marks, expectation pressure, 5% contagion),
  and the Letter (templated preview + archive); actions for OpenAI prose
  (`gpt-4o-mini`, key-gated with 7-day input-hash cache) and Firecrawl
  news→deck seeding (**live**: Brazil drought → `drought_ea` ×1.4, 6h
  cache ≈ 1 search per campaign); a signed AgentMail webhook with
  reply-to-command mutation (inbox keys pending).
- **Hosting**: the floor deploys via `@convex-dev/static-hosting` to
  https://striped-anaconda-746.convex.site (38 files, no bundler — `web/`
  *is* the dist plus a schedule snapshot). The game auto-mirrors each
  dawn to Convex when hosted there (HUD badge flips `● LIVE`).
- **Game feel**: bubbles capped at 10 and clamped on-screen, sign-aware
  numbers ("down 6%", never "up -6%"), `space` or button pauses the sim
  clock, the Letter answers to `1`/`2`/`3`, a day-1 13:00 coach nudges the
  levers before the student wave, beat cameras hold still at 20×, and the
  rival lives — their sign burns with their queue, the camera shows first
  blood, their sales ring coins. Loop tests are RNG-seeded, so the
  12-test gate is deterministic — green 3× straight.
- Still to do: nightly cron wiring, full live-query sync (mirror today),
  Convex Auth, OpenAI + AgentMail keys, prod deploy, video + social.

See `hackathon.md` for the build log.

---

Built at Founders Inc., San Francisco. Sept 5, 2026.
