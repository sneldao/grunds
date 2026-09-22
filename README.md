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
- **Firecrawl**: commodity-news crawls feed the merged Wire — **live since Sept 13**
  (Brazil drought → `drought_ea` corroborated tilt)
- **AgentMail**: the roaster is a real mailbox — post the letter to your inbox,
  reply `contract`/`hold`/`settle`, and it plays your move (verified end-to-end)
- **OpenAI**: `gpt-4o-mini` writes the Wire's "why this matters" line —
  crawls become a one-line analyst read a player can act on
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
   AgentMail actions, verified end-to-end on a cloud dev deployment; the
   `planSessions`/`dayDecisions` decision protocol is deployed there too —
   `npm run deploy:site` pushed the functions (new `dayDecisions`/`planSessions`
   indexes) and re-uploaded the static site together
2. ~~The Exchange: scheduled functions + Firecrawl news→event deck (with pity timers)~~ —
   deck + pity timers live server-side; Firecrawl pull live with 6h cache; nightly cron next
3. ~~The Regulars: persistent patron memory + gossip propagation graph~~ — done server-side
4. ~~The Roaster's Letter: AgentMail inbox, reply-to-command mutations~~ — live
   end-to-end: `grunds-roaster@agentmail.to` sends the letter, signed webhook plays
   reply commands, Idris acks by return post
5. All 5 cohorts, supplier credit clock, gentrification drift, cupping events — drift +
   credit live; `wireWhy` live on the OpenAI chain (primary key → compatible fallback)
6. ~~Deploy convex.site, public repo, `hackathon.md`, video, X post~~ — site + repo + log
   live; demo video v1 rendered (`videos/grunds-demo`, renders gitignored); social still to do

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
node web/test/intel.mjs               # Linkup deck bias (clamped), pity under bias, citations
node web/test/behavioral.mjs          # decoy anchoring, pastry/cacao attachments, tip jar social proof
node web/test/share.mjs               # Z-read share cards, campaign badges, replayable seed links
node web/test/desk.mjs                # District Insider Pass: entitlement gates the wire, purchase/restore flows
node web/test/agency.mjs              # Drug Wars turn — Morning Brief at 06:00, sized hedge, 11:00 offer + cost sheet
node web/test/identity.mjs            # pitch licence — modal, name threading (letter/receipt/board), perks, skip paths
node web/test/demand.mjs              # awareness decay + street-work payback + loyalty return rate
node web/test/district.mjs            # generative district: seed→kit gate, fallbacks, slot contract
node web/test/vitality.mjs            # vitality spine: bounds, lerp, spawnMul untouched (skin only)
node web/test/kit-arrival.mjs         # kit-arrival beat: onGrown fires once, classic/headless never
node web/test/next-action.mjs         # next-action priority + #goal renders from the same module
node web/test/halo.mjs                # guidance halo: shouldHalo predicate, idle timer, reduced motion
node web/test/mail-inbox.mjs          # Idris inbox mirror: latestInbox, /agentmail/inbox, arrival theater
node web/test/share-card.mjs          # stamped print share card: layout, composition order, doPhoto wiring
node web/test/modals.mjs              # modal a11y: focus trap, stack z-order/inert, shortcut routing
node web/test/lifecycle-accounting.mjs # planning→trading→review lifecycle, per-cup hedge accounting, reconciled P&L
node --experimental-vm-modules web/test/decisions.mjs  # managed decision protocol: resolver, Convex handlers (mock DB), client lifecycle
node web/test/balance-policies.mjs    # diagnostic policy comparison across fixed seeds (fresh-process replay)
```

The floor is a **connected 5-day campaign**, not a closed loop. The three nested clocks
now meet the floor: the Exchange rolls a pity-timer event deck at each dawn (frost on
Minas Gerais, East Africa drought, clean harvest, matcha hype) that moves the bean
benchmark; your cost-of-goods (anchored to `benchmark_corpus.json` — ~30% COGS for a UK
independent) eats the margin shown on an in-world **ticker board**; the **Roaster's
Letter** arrives at each close for review — on connected runs you can post the
morning's plan to Idris's real inbox and answer by email (contract / hold / settle),
with replies committing through the same day-scoped record as the browser;
**persistent Regulars** carry opinion across
days into a reputation meter that modulates footfall and tips. World events pass through
commodity economics into patrons' pockets into your till — every link visible in 3D.

The diorama: a shader **sky dome** (gradient + sun glow + procedural stars over the day
arc), **brick district facades** (two-tone bricks + mortar, framed windows, cornice + brass shopfront) whose windows light up at dusk, a 9-block far skyline, a
mailbox, a **512×320 brass-collar ticker** with linen grain, weather mist + **warm dust motes (180, amber) in sun-shaft god rays after a frost or harvest**, **7 bollards** + a *THE DISTRICT* street decal, and a
street **cat Miso** that walks once a day — rendered through a
core-Three **post-FX** bloom/vignette/grain pipeline (auto-disabled on low-RAM/low-core + dynamic shadow budget at `queue>40` + GLB cross-fade-in). Controls: `1` pre-batch, `2` reprice, `space` pause — title prints the live set.
Morning Brief answers to `1`/`2`/`3`/`4`/`5` → `Enter`. Hidden delight: type `GRUNDS` for Gwen's gesha reserve. URL params: `?lite`
(no shadows/post-FX, 1× pixels, now also auto on ≤4 cores / ≤4GB), `?speed=60|300|1200` (default 1×; headless stays 5×),
`?seed=N` (campaign seed), `?skipLicence` (bypass the pitch licence — defaults), `?skipTutorial`/`?notutorial` (bypass licence + 3-step onboarding).

Onboarding: new players sign the **pitch licence** (name + stand + role + a one-perk
background — activate the Sign button; Escape never signs or advances), then land at 1× through a 3-step tutorial (Read 14:00 / Lever 1+2 /
Keep 5 vs GLASSHOUSE, `Enter`/`Space`/`Esc`) then a 3.4s paused crane settle; day-1
mornings are half-demand and gossip-throttled so eyes settle before the queue reads.
The HUD is goal-first: a brass goal strip, a queue health bar (ok/warm/hot + "queue
7/12 — watch it", **heartbeat at >10 and purr glow at ≤5**), a bean tape, and a batch countdown; levers pulse until first use and the
chalkboard flashes on press (with a chalk-dust puff and `screech` on reprice). At 06:00 the **Morning Brief** pauses the floor for the day's hedge (sparkline + wire + 5 pills); at 11:00 a regular pauses it again for a y/n ask. At 17:00 a **14:00 wave debrief** card shows saved cups
and `~£` vs GLASSHOUSE — a real save pops fanfare + a 3.5s counter crane + coin rain;
an flop falls as a soft rain. At 17:30 and on day-1 close a **Day-2 forecast**
toast + receipt stripe preview the next day's board to earn the replay. A local `analytics.js` tracks
`tutorial_step/skip/complete`, `first_lever_at_min`, every balk, debrief and forecast
for the 5-question playtest (`__grunds.analytics.summary()`).

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
│   ├── schema.ts                # campaigns, marketEvents, regulars, friendships, letters, stands, apiCache, planSessions, dayDecisions
│   ├── gameConfig.ts            # drift, event deck, roster, seeded RNG (ported from web/js/config.js)
│   ├── exchange.ts              # dawns, contracts, debt — drift-then-pity-roll (rejects writes to managed campaigns)
│   ├── decisions.ts             # managed per-day commit records — begin/prepare/stage/commit/finish/abandon, browser+email first-writer arbitration
│   ├── regulars.ts              # seen-marks, expectation pressure, 5% contagion
│   ├── letters.ts               # templated Letter preview + archive
│   ├── apiCache.ts              # TTL response cache (Firecrawl 6h, OpenAI 7d)
│   ├── openai.ts                # enhanceLetter + personaLine (gpt-4o-mini, key-gated)
│   ├── firecrawl.ts             # commodity-news → deck weights (live)
│   ├── agentmail.ts + http.ts   # Svix-signed webhook → thread-mapped reply-to-command (frozen posted plan) + latestInbox mirror; /sync/* bridge incl. /sync/plan token ops; static catch-all
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
│   │   ├── director.js          # per-frame layered-modulation registry (runs after world/sky/audio overwrite)
│   │   ├── vitality.js          # 0.65·awareness + 0.35·reputation — audiovisual skin, never the numbers
│   │   ├── nextAction.js        # pure priority rule: the one next move (batch/price/mail/wait)
│   │   ├── halo.js              # camera-invariant ground ring on the next-action target when idle
│   │   ├── kitArrival.js        # cart-rolls-in + lanterns-light beat when a generated kit finishes growing
│   │   ├── mailTheater.js       # Idris reply arrives: poll /agentmail/inbox, knock, flag, dropped envelope
│   │   ├── shareCard.js         # stamped-print 1280×720 photo card (paper border + rubber seed stamp)
│   │   ├── demand.js            # awareness stock (decay + street work) + loyalty return rate
│   │   ├── economy.js           # shared sale price / operating costs / hedge terms / plan quote
│   │   ├── rival.js             # GLASSHOUSE strategy: price posture, cohort draw, service speed
│   │   ├── staffing.js          # Ruth/apprentice staffing predicates + crisis eligibility
│   │   ├── modals.js            # shared modal controller: focus trap, inert stack, top-layer keys
│   │   ├── decision.js          # pure resolveDecision(snapshot, plan) — local + managed commit path
│   │   ├── districtGen.js       # seed → generated 3D kit cross-fade (?classicDistrict / failure → procedural)
│   │   ├── convexSync.js        # optional connected mode (auto on *.convex.site, ?convex= override): managed plan queue + Linkup intel + inbox poll
│   │   ├── analytics.js         # local playtest analytics (tutorial/lever/balk/debrief/forecast) + localStorage + console
│   │   ├── desk.js + billing.js # The Wire research desk (headlines free, tilt on District Insider) + RevenueCat Web Billing
│   │   ├── world.js             # the diorama + time-of-day director (district, ticker, mailbox, mist, scaffolds) + chalkboard flash
│   │   ├── sky.js               # custom shader sky dome (gradient + sun + stars) — core-Three only
│   │   ├── postfx.js            # core-Three render-target bloom + vignette + grain
│   │   ├── patrons.js           # instanced characters, queue/balk/defect behaviour, named-Regular hat/bubble
│   │   ├── exchange.js          # the Gamble: seeded pity-timer event deck + optional bias (Linkup), bean market, debt clock
│   │   ├── regulars.js          # persistent opinion + friendship graph + 5%/day contagion (the Regulars)
│   │   ├── letter.js            # the Roaster's Letter: driftLine + neighborhoodLine + intelLine + reply-to-command
│   │   ├── fx.js                # steam/coins/dust/gossip bubbles/3D conversation lines/construction dust + debrief card + forecast slot
│   │   ├── gentrification.js    # per-day cost creep + matcha price curve + cohort expectation pressure
│   │   ├── loader.js            # async GLB loader with cache + FIFO eviction + placeholder fallback
│   │   ├── camera.js            # cinematic rig: title orbit, crane-in, beat push-ins, calm-gated + reduced-motion breath
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
│   │   ├── game-feel.mjs              # bubbles bounded/clamped, signed numbers, pause, letter keys
│   ├── intel.mjs                  # Linkup deck bias (clamped), pity under bias, citations
│   ├── behavioral.mjs             # decoy anchoring, pastry/cacao attachments, tip jar social proof
│   └── share.mjs                  # Z-read share cards, campaign badges, replayable seed links + outcome framing
│   │   (…plus demand, district, vitality, kit-arrival, next-action, halo,
│   │      mail-inbox, share-card, modals, decisions, lifecycle-accounting — full list with one-liners in the test
│   │      commands above)
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
    `construction-active`, `construction-final` (19 assertions total, canvases now 1024 including `setLineDash` stubs).

The day-5 narrative is now end-to-end: numbers (HUD `#pressure` + goal +
queue bar + batch countdown + `tabular-nums` till + bean **tape**), narrative (the **Morning Brief at 06:00 [PAUSED]** + the Letter + 14:00 wave debrief +
Day-2 forecast + The Wire desk + sized hedge + cost sheet), physical (honey-oak floor + slab pavement + aggregate road + awning eyelets + facades/cornice/shopfront + bollards/decal + scaffolds/tarps + chalkboard flash + till drawer + shadow + arcing coins + sipping sitters + motes/god rays), audible
(saw + hammer + till/coins + 90Hz clock tick at 1× + chalk screech + fanfare/rain + 38Hz purr + meow + shutter), animated (drifting dust + 3D conversation
lines + cat Miso + living plant + god rays + rival lean/jeer + photo vignette). Onboarding lands at 1× with a 3-step tutorial + calm-open throttling;
**06:00 Drug Wars turn** pauses the floor for the Morning Brief (sparkline + wire headlines + 5 sized pills → `OPEN FOR DAY`); `analytics.js` measures every brief choice, balk and first lever for the playtest. Performance is intent: auto- + dynamic-`lite` (no shadows/post-FX on weak devices, shadow budget at `queue>40`), GLB cross-fade, `tabular-nums` + staggered receipt typewriter. **30/30**
headless tests run green on every merge (new `vitality/kit-arrival/next-action/halo/mail-inbox/share-card` are the delight-pass gates).

## Live on Convex (Sept 12–19)

The Convex phase shipped as working backend + hosting, not a plan:

- **Linkup**: Deep Research integration (`convex/linkup.ts`) querying global coffee commodity intelligence (weather disruptions, harvest reports, shipping bottlenecks) to dynamically bias the morning event deck with cited source URLs — nightly `linkup-intel-refresh` cron (06:15 UTC) keeps the 6h cache warm; the floor fetches once per session via `convexSync.intel()` and threads `marketShift` (clamped 0.2–3×) through the pity-timer roll on both client and server (`exchange.openDay(bias)`), cited in the Letter via `intelLine` and surfaced as a day-1 toast.
- **Nebius**: Applied AI integration (`convex/nebius.ts`) via Token Factory (`meta-llama/Llama-3.3-70B-Instruct`, was 3.1 — host moved to `api.tokenfactory.nebius.com`) for in-character prose generation and responsive patron reaction lines with latency and token telemetry; new `POST /ai/letter` (`convex/http.ts`) serves `enhanceLetterNebius` (7-day hash cache), consumed fire-and-forget from `main.js` `showLetter()` (templated letter swaps to LLM prose with `— Idris · Llama-3.3-70B · {latency}ms`).
- **RevenueCat**: Subscriptions / Web Test Store + live Web Billing (`web/js/billing.js` → `@revenuecat/purchases-js` CDN 1.47.3 when `?rc=`/localStorage/`RC_API_KEY`) — the District Insider Pass buys the *edge* on **The Wire** research desk (`web/js/desk.js`): the desk is open to everyone — headlines + sources + a why-it-matters line are free (the USP is never paywalled); `commodity_insider` unlocks the quantitative deck tilt (× multipliers + per-card reasoning). Free readers get a `#desk-edge` footer invite, not a blocking modal. HUD gains `⚡ the wire ↗` when intel lands; the bean tape clicks through; the Letter grows a desklink where the choice happens. Modal: 3 perks, live `formattedPrice`, restore + dismiss + mode badge. Analytics: `paywall_shown` / `desk_opened` / `desk_opened_free` / `purchase_success`. Gate adds `desk.mjs`.
- **District leaderboard + research bridge**: new `GET /sync/stands`, `GET /ai/research`, `POST /ai/letter` in `convex/http.ts`; nightly `commodity-news-refresh` + `linkup-intel-refresh` crons; local `apiCache` table backs both.
- **Backend** (`convex/`): schema for campaigns, market events, regulars,
  friendships, letters, stands, and an API-response cache; queries +
  mutations for the Exchange (drift-then-pity-roll dawns, contracts,
  debt), the Regulars (seen-marks, expectation pressure, 5% contagion),
  and the Letter (templated preview + archive); `GET /ai/research` serves
  the merged Wire — Linkup Deep Search + Firecrawl crawls unioned per
  event (corroboration lifts a tilt ~15%), with OpenAI `wireWhy`
  (`gpt-4o-mini`, 7-day hash cache) writing the "why this matters" line;
  AgentMail runs the Roaster's Letter as a real mailbox — `/agentmail/letter`
  posts it to a player inbox, Svix-signed `/agentmail/webhook` resolves the
  reply (thread/recipient → campaign) and plays contract/hold/settle, with
  an Idris ack by return post and the whole correspondence in `letters`.
- **Hosting**: the floor deploys via `@convex-dev/static-hosting` to
  https://striped-anaconda-746.convex.site (38 files, no bundler — `web/`
  *is* the dist plus a schedule snapshot). When hosted there the game runs
  the managed decision protocol — each day's plan commits through
  `POST /sync/plan`, day-scoped and retry-safe (HUD badge flips `● LIVE`).
- **Game feel**: bubbles capped at 10 and clamped on-screen, sign-aware
  numbers ("down 6%", never "up -6%" — now `tabular-nums` so the till never jitters), `space` or button pauses the sim
  clock, the Brief answers to `1`–`5` + `Enter`; `P`/`📷` freezes a golden-hour **stamped print** — a 1280×720 share card (cream paper border, cover-cropped post-FX snapshot, a rotated red "GRUNDS · SEED N" rubber stamp) with a `↓ save · 𝕏 share · ⧉ copy` action row (Web Share Level 2 where available, X-intent + clipboard fallbacks); type `GRUNDS` for Gwen's £7.80 gesha wink. A day-1 12:00 coach nudges the
  levers before the student wave (was 13:00), beat cameras hold still at 20×
  and breath is calm-gated 7s + `prefers-reduced-motion`-aware, and the rival
  lives — their sign burns with their queue, **leans -0.08rad at heat>6 and jeers at 5 defections via `world.jeerRival()`**, the camera shows first blood,
  their sales ring coins. The day opens at **1×** with a **3-step tutorial**
  (Read 14:00 / Lever 1+2 / Keep 5, `Enter`/`Space`/`Esc` + Skip, `?skipTutorial`
  bypass) and a 3.4s paused crane settle; day-1 mornings are half-demand and
  gossip-throttled. The HUD is **goal-first** (brass goal strip + queue health
  bar + batch countdown + **heartbeat at >10, purr glow at ≤5**), levers pulse until first use and the chalkboard
  flashes on press with a predicted queue delta ("12 → ~6 by 14:00") + chalk dust + `screech` (desaturate + wobble). At 17:00
  a **14:00 wave debrief** card teaches the payoff (`saved ~£XX` vs GLASSHOUSE) — **a real save explodes** (`waveFanfare` rising triad + `coinRain` 10–22 + 3.5s crane + card pop + haptics), a flop falls as a soft `waveRain`.
  At 17:30 and on the day-1 Z-read a Day-2 forecast earns the replay. The week closes in three beats: a CLOSING TIME card at 20:40, the day-5 Z-read
  (with a district leaderboard block when live), then a SOLD finale — the
  camera visits the sold storefronts before the verdict receipt lands. That
  receipt now **prints line-by-line (30ms) and typewrites the verdict (18ms/char)**, and the till counts with `tabular-nums`. The
  shop is alive: **sitters sip at `dwell==4`** (arm/head/lean + steam puff), **Miso the street cat** walks `spawnL→door→tables` once/day ~09:30 (sits if `queue<4`, scatters if >10, meows via `world._onCatMeow`), a **living plant** tints HSL lush→brown with queue health, **god rays** and **mist** quote the event tier, and a **till drawer** slides + stretches its shadow on every sale.
  Hover a patron → story card (op ♥, friends, wave); click to wave. GLASSHOUSE keeps staff silhouettes moving behind glass that runs pale by
  day and amber after dark; new weeks open with a crane swoop home. HUD text
  renders at ~5Hz so 20× stays smooth. The verdict receipt carries a
  seed-challenge share button with outcome framing ("Held the line — 320
  served, 12 walked" beats "£42"). Mix runs through a bus compressor (older
  WebAudio guarded — pad now pre-warms `0→0.02 in 600ms` so Day 1 isn't silent, clock `tick` at 1×, `purr` at ≤5 queue); phones get a ≤640px layout with `touch-action: none`
  and width-aware bubble clamping + queue heartbeat / purr; grain/pulse/breath/`heartbeat`/`purr` respect
  `prefers-reduced-motion` (and breath/haptics scale with the media query). Local `analytics.js` tracks tutorial steps,
  first lever, every balk, debrief and forecast for the playtest
  (`__grunds.analytics.summary()` + boot 5-question script). Loop tests are
  RNG-seeded, so the **26-test** gate is deterministic.
- **Drug Wars turn**: `main.js` Morning Brief at `06:00` (`#brief` 520px linen: Idris prose + 76px sparkline + wire headlines/host/why + 5 pills; `phase:'planning'` freezes `loop`, `stageDayPlan` is reversible, `commitDayPlan` resolves the day through the shared pure `resolveDecision` *before* the market rolls — on connected runs the server's per-day commit record arbitrates browser vs email, first writer wins, retries return the same result); `OFFERS` (5) at `11:00` — same modal pause path, each with a real payoff; `INCIDENTS` (6) `14:55–16:55` days 2+ (red tint, rotated) and a **cost-sheet P&L** at `closeDay` (staff+milk+rent+card+sundries + contract fees + interest + realized hedge benefit). Outcomes are measured by the reproducible policy comparison, not a promised profit target. `agency.mjs` Drug Wars gate.
- **The pitch licence**: before the tutorial, the district office hands you a licence — your name, the stand's name, a title (`the new owner` / `the manager` / `the name on the lease`), and a background with one small perk (`ex-barista` paces the bar ~8%, `ex-accountant` trims fees & payouts 15%, `new to the trade` warms the regulars, `a market regular` hears the wire's lean in the Brief). Signing is explicit activation only — the Sign button; Escape never signs or advances; the signature threads the letter (*Dear Ada… what do you want to do, Ada?*), both receipts, the tutorial greeting, and the Convex district board (`grunds.owner` reads live). Persists via `localStorage`; `?skipLicence` bypasses.
- **Ruth, your barista**: one named staffer, one hidden `baristaCondition` — Ruth loses 0.14 condition per worked shift (+0.08 for peak queues above 50, +0.06 for 60+ balks). Below 0.55 from day two, the Brief offers work / home / apprentice cover: home saves the wage, runs the bar at 0.7×, restores 0.45; apprentice cover costs £65 wage + £12 training + £0.04 extra supplies a cup, runs 1.05×, restores 0.25. Push on keeps pace now and risks her breaking mid-shift (asleep at the counter, or snapping at a regular — rep hit). Home/apprentice days prevent the crisis and the sick-call incident. No roster, no morale meter — the fiction carries the state.
- **Delight pass (Sept 19) — five features, one spine**: `web/js/director.js` runs ordered modulation layers *after* `world.updateTimeOfDay`/`sky.update`/`audio.update` overwrite their targets each frame (read-modify-write, replace-by-id, try/catch per layer). **Vitality** (`vitality.js`: `0.65·awareness + 0.35·reputation/100`, lerped) is the audiovisual skin only — pendants, lamps, windows and the sign dim and brighten, the sky's sun and stars follow, the street murmur and pad sink with it — and provably never touches `demand.spawnMul()`. **Guidance halo** (`nextAction.js` + `halo.js`): one pure priority rule feeds both the brass `#goal` strip and a pulsing ground ring under the right object (chalkboard, mailbox, till) after ~5s idle — the words and the light cannot drift apart. **Kit arrival beat** (`kitArrival.js` + `districtGen.onGrown`): when a seed's generated kit finishes growing on a first visit, a cart rolls in and the lanterns light one by one before the toast. **Idris's letter arrives as theater**: `letters` gains `dir`/`action`/`from`/`createdAt` + a `by_campaign_dir_created` index; `latestInbox` + a read-only `GET /agentmail/inbox` mirror the mailbox for the client; `mailTheater.js` polls it, triple-knocks, raises the flag and drops an envelope on the pavement — the server's `handleInbound` stays the only applier (mirror ≠ second writer). **Stamped share card** (`shareCard.js`): `doPhoto` now captures *after* `postfx.render`, so the printed card carries the same bloom and vignette the player saw. Six new test suites pin all of it.
- **Performance**: auto-`lite` (`hardwareConcurrency≤4`/`deviceMemory≤4`), dynamic `lite` after 3×>32ms frames, shadow budget at `queue>40`, GLB cross-fade (`opacity 0→1`), RAF slot discipline (`requestAnimationFrame(loop)` re-arms first, receipt + loader use `setTimeout` in headless so the game loop isn't stolen), `tabular-nums` till, staggered receipt — fixed two real regressions (reputation `NaN` via sparse `opContagion`, RAF steal at close) — both caught by the headless gate.
- **Managed decision protocol + modal system**: connected runs play the same week through `convexSync`'s per-run queue (`begin → prepare → stage → commit → finish` over `POST /sync/plan`, 32-byte run token hashed server-side). The Brief stages the plan, `OPEN` commits it — `decisions.ts` holds an immutable per-day record, so a browser click and an Idris email reply race to one winner and every retry returns that result; `finishDay` mirrors the closing state and upserts the stand. A lost response is safe to retry, a reset abandons the run and rotates the token, and `start a local-only week` is an explicit choice — never a silent fallback. Local simulation stays client-side (the commit record is not an anti-cheat boundary). Modals share one controller (`modals.js`): focus trap + wrap, stacked inert underlayers with real z-order, Escape/shortcut routing to the top layer only, focus restored on close.
- Still to do: Convex Auth, Nebius voicing of the 11:00 ask (gossip pipe already serves it), prod deploy, social post + submission. Demo video v1 lives in `videos/grunds-demo` — recorded gameplay + HyperFrames; `npm run render` re-renders, captures/renders are gitignored.

See `hackathon.md` for the build log.

---

Built at Founders Inc., San Francisco. Sept 5, 2026.
