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
| `spatial` | Three.js floor: **1024 honey-oak floor + slab pavement + aggregate road** (all `anisotropy 8`), **brick facades** (two-tone + mortar, white frames + sill, cornice + shopfront), **9-block skyline**, **512×320 brass-collar ticker**, gossip bubbles + conversation lines, Kenney CC0 props (loader with cross-fade-in), day-5 scaffolds/tarps/dust, chalkboard flash (desaturate + wobble), paused-Brief onboarding + optional day-1 inline coach + calm-open throttling (reactive `#goal` + 3 just-in-time nudges), goal/queue/batch HUD (heartbeat/purr + `tabular-nums` + staggered receipt), **Morning Brief `#brief` (520px linen: 76px sparkline + wire headlines/host/why + 5 pills → `OPEN`) + `phase:'planning'` clock gate**, wave debrief (fanfare/coin rain/crane) + forecast + wire desk (headlines free / tilt gated) + 11:00 offer / 14:55–16:55 incident modals (same modal pause path), bean tape HUD + ticker sparkline + bias glow, living plant (HSL health + wilt), god rays + **motes** + mist, till drawer + stretching shadow, **bollards + street decal**, cat Miso, hover story card + photo mode, scuff decal + awning tie-downs, GLB cross-fade + shadow budget + bounce hemi | today |
| `agent` | Patron decision loop (price/queue/rep) + barista levers (pre-batch/reprice + live inventory/ready-time readout + chalk dust/screech) + named-Regular hat/bubble + wave + friend-graph gossip routing (throttled in calm open) + sitter sip at `dwell==4` + hover→story card (36px probe) + click-to-wave (+0.06 op) + cat spawn/sit/scatter + plant health + till slide | today |
| `precedent` | Patron memory: opinions persist; gossip via named-friend graph; 5%/day `opContagion` (Map<i→op> + `Number.isFinite` guard for sparse rosters); local `analytics.js` (tutorial/lever/balk/debrief/forecast + `desk_opened`/`paywall_shown`/`purchase_success`) + `desk.js` (The Wire — headlines free, tilt on `commodity_insider`) + `billing.js` (RevenueCat Web Billing → Test Store) | today |
| `exchange` | Event deck (frost/harvest/hype, pity timers + Linkup `marketShift` bias clamped 0.2–3×; a `rumour_frost` day triples next-day frost/drought weights — the wire's warning is a real, imperfect signal); gentrification drift (per-day cost creep + matcha 4.80→5.40); forward contracts; supplier debt clock with a £3,500 tab limit; hidden `geshaUnlocked` (`GRUNDS` → £7.80 wink, persists as toast) | today |

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
hammer soundscape. Day 1 reads as curated: 1× inside the paused Morning Brief
with an optional inline coach card + calm-open
throttling (first 12 sim-min half-demand, 07–10 half-demand, gossip 10%) and a goal-first
HUD (goal strip + queue health bar + batch countdown); at 17:00 a wave debrief teaches
the payoff, at 17:30 and on the Z-read a Day-2 forecast earns the replay.

## Morning Brief — the Drug Wars turn (06:00 [PAUSED])

`prepareDay(d)` (also exposed as `openDay`) enters planning at 06:00 without charging or rolling the market. The Brief shows known district pressure and rival posture, then staffing, five procurement choices, optional paid street work, and an itemized cost quote. Idris's prose, the 72px board sparkline, and research sources are secondary details. All variable content scrolls inside the shared modal body; a stable footer holds the summary and Open action. The Brief discloses progressively, driven by state rather than a flag store: a calm day 1 folds the three contract pills under one line (a warn/bad/cata board, an open position, or a live tab springs it open, and a staged contract keeps it open), the dead settle pill never renders, street work and the net-position figure appear from day 2 — street work with a "yesterday N walked" reason line — and Ruth's row appears only when `canChooseStaffing` says she's fading. Disclosure gates rendering only; `stageDayPlan` stays permissive so connected-mode plans aren't shadow-banned. `stageDayPlan` is reversible and atomic. `commitDayPlan` resolves the pure `resolveDecision(snapshot, plan)` against the previous closing board, applies the result once, rolls the new market, and enters trading. Headless tests explicitly stage and commit through the same APIs; only rendering is stubbed. Closing computes the ledger once and leaves the receipt open until `continueFromReview`; Idris's letter is optional review, not a second procurement gate. Day five completes only after its trading and review phases. If net worth is negative at any review — till minus costs minus the outstanding tab — the supplier calls it and the campaign ends `lost` on the spot.

Contracts are price coverage, not stock: 1200/2400/4800 cups for per-cup fees of £0.065/£0.09/£0.115 (£78/£216/£552 at face), plus any announced surcharge, all riding on the supplier tab — which caps at £3,500 (roughly one day of beans at full service — a cap below a day's restock made every hedge compete with the cellar for the same credit) including the day's interest, so a deep enough tab forces a settle (or a hold) before the next hedge. Each prepared cup captures its price and bean cost before consuming coverage; exhausted contracts fall back to spot. The receipt distinguishes operating profit, contract fees, interest, settlement, and realized hedge benefit. Unused cover does not spoil and uncovered cups do not starve — but since the Sept 28 tab conversion, uncovered cups *cost*: dawn sacks ride the same supplier tab (clamped to the £3,500 line — a capped tab buys nothing and the bar pours what's left), and a bone-dry cellar bills **every** cup from the till at 1.5× spot (previously one free emergency sack per day). Starter stock is prepaid before the week (value 0 at reset) so opening pours never bill twice; the receipt splits the day's bean outlay into its tab half (`sackSpend`) and its cash half (`emergencySpend`). The retail price curve is charged, not just displayed.

Baseline bean drift is an increasing daily increment: 0.025 + 0.008 × (day − 1), capped before the market event. Day-two transit shifts morning commuter waves 30 minutes and increases dwell by 30%; quantities are preserved and the source schedule is never mutated. Pitch revaluation adds £150 to the rent floor and 3 percentage points to turnover rent from day three. The £0.18-per-cup supplies surcharge persists from day four. GLASSHOUSE's announced strategy uses the previous day's event tier; its price/cohort pull affects initial customer choice and its speed multiplier affects actual service. Initial rival choices and post-queue defections are counted separately. `OFFERS` (5) + `INCIDENTS` (6, red-tinted) reuse the same modal pause path mid-day so turns compose.

**Managed decisions (connected mode).** When `?convex=` is live, `convexSync.js` runs the week through a per-run serialized queue — `begin → prepare → stage → commit → finish` on `POST /sync/plan`, authenticated by a 32-byte run token the HTTP layer SHA-256s before the internal mutations see it. `convex/decisions.ts` keeps one `dayDecisions` row per campaign-day: `prepare` pins the snapshot, `stage` updates the still-pending plan, `commit` (browser) and `handleInbound` (email, via a thread→`{campaignId, decisionId, day, recipient, postedPlan}` mapping) both funnel into `commitRecord` — first writer wins, every retry or loser re-reads the same committed result. `finish` validates and stores the closing state once (conflicting retries rejected, identical ones idempotent) and upserts the player's `stands` row; `abandon`/reset invalidates the session so delayed writes die. Legacy public mutations (`openDay`, `contractBeans`, `settleDebt`, `mirrorState`, `recordStand`) reject any campaign that has a `planSessions` row. If the endpoint is unreachable the Brief stays in planning with a retryable error; `start a local-only week` (`#brief-offline`) is the explicit opt-out — it disables managed sync and mail for the run rather than silently degrading. Scope note: the simulation stays client-side; the commit record arbitrates *intent*, it is not server-authoritative anti-cheat.

## Exchange — event deck + bias + pity (Sept 27 tune)

`exchange.openDay()` rolls one event from the seeded deck per dawn. The bias
table (`marketEvents` lookups + Linkup `marketShift` clamped 0.2–3×) shifts the
weight of each event before the roll; the **clamp is asymmetric** — a high bias
rides through unclipped, a low bias still floors at 0.2× so the deck never
collapses to "no event ever". A pity timer rolls to a non-disaster event when
two catastrophes land in a row, and the pity is **day-gated** (`day < 4`) so
the first three dawns are learnable but the last two carry the gamble. A
single harvest-calendar multi-roll can stack two back-to-back shocks in
`dayMin >= 1440`; that path stays as the weather clause.

## Time-locked levers (post-commit override cost)

The Morning Brief's commit arms `leversTimeLocked`, and `nextAction.js`'s pure
`leverState(snapshot)` is the single legality/cost source the buttons, the `1`/`2`
keys, and the `#goal` strip all consult — so a disabled button, a refused key,
and the guidance text can never disagree. The current rules:

- A morning **pre-batch buys 40 cups for £40 sealed until 14:00**
  (`batchReservedUntil = 840`); they go live as the wave starts, and a
  mid-morning press is refused while the reserve stands.
- During the wave (14:00–16:00) a press while the batch is at **8 cups or less**
  is a routine **£40 top-up** — no fee, no opinion hit.
- The **first unstaged post-noon change of plan** (`leversTimeLocked` and
  `dayMin ≥ 720`) carries the £4.20 late-switch charge: **£44.20 for a late
  batch** (£40 stock + £4.20), **£4.20 for a late price cut** — and a
  **−0.06 opinion** hit on every named regular either way.
  Pressing the lever you'd already committed is not a switch.
- **Reprice locks prep** (and a standing pre-batch locks reprice); both levers
  refuse after **16:00** (`dayMin ≥ 960`) and outside the trading phase.
- Invalid presses are pure no-ops: nothing is charged and no stock moves.
- A `lever_override` analytics event records the lever name, day, dayMin, and
  remaining till.

The Brief stays the place where the prep actually happens; the override is a
priced escape hatch. `LEVER_OVERRIDE_PRICE = 4.20` and `LEVER_OVERRIDE_GOSSIP
= 0.06` are top-level constants in `main.js` so the price is grep-able.

## Cohort rituals — five rooms, not one

Each cohort now carries a ritual in `config.js → COHORTS`:

| Cohort | Prop rig | Seat | Walk speed | Dwell |
|---|---|---|---|---|
| Commuters | briefcase | table 0 | 2.6 | 0.7× |
| Creatives | laptop + mug | table 1 | 1.7 | 1.6× |
| Students | backpack + notebook | table 2 | 2.0 | 1.0× |
| Elders | cane | table 0 | 1.3 | 1.4× |
| Tourists | camera | table 1 | 1.9 | 0.9× |

The spawn copies `ritualProps / ritualSeat / ritualDwell / ritualSpeed` onto
the patron object; `_afterServe` consults `ritualSeat` before falling back to a
random free seat; the patron's `speed` is `ritualSpeed + jitter`. The 3D rigs
landed in PR-A2 (75abada): 7 real `InstancedMesh`es (briefcase / laptop / mug /
backpack / notebook / cane / camera) at 7 body anchors (rightHip / chestFront /
upperBack / rightHand / leftHand / rightHandGround), zero-scaled at startup and
on `_despawn`, positioned per-frame via `_propKeyFor` + `_placeProp`. The
Sept-28 polish folds laptop/camera into seated poses (lap tilt / eye-level
raise) instead of hanging them in front of a sitting chest. Same five cohorts,
and the floor reads five rooms.

## RevenueCat surface (Ship-a-ton depth)

`web/js/billing.js` is the single client source of truth for entitlement
state. The shape:

- **Two entitlements:** `commodity_insider` (monthly/yearly subscription) and
  `district_founder` (lifetime). The two combine — a founder is *also* an
  insider on the wire desk.
- **Three products:** `monthly` (£4.99), `yearly` (£39.99), `founder` (£99
  one-time). Identifier heuristics in `_pickPackage()` map "monthly_matcha"
  or "yearly_district" to the right tier so the Web Test Store and the
  native SDK converge on the same SKUs.
- **Multi-placement paywall:** `#brief-insider-upsell`, `#offer-insider-upsell`,
  `#verdict-upsell`, `#pc-founder-upsell`. `PAYWALL_PLACEMENTS` table in
  `main.js`; `applyPaywallPlacements()` consults `billing.isInsider()` /
  `isFounder()` and shows the upsell where it fits, not as a blocking modal.
  `billing.onChange()` refreshes the surfaces.
- **Web Customer Center:** `#customer-center` modal — status header (tier
  label, mode), restore button, test-cancel button, portal link, close. The
  tier label contract is `founder > insider > free`; the surface never
  shows an "insider" label when the user is actually a founder.
- **Share-card founder variant:** when `founder` is true, the share card's
  stamp switches from red rubber to a burgundy + brass-border "DISTRICT
  FOUNDER · SEED N" stamp. `founderReplay()` writes a `SEED_OVERRIDE` so
  the founder can replay the week with the same seed.

### Backend sync (Convex)

`convex/revenuecat.ts` mirrors the active entitlement state on every
dashboard event:

- `applyEntitlements` (internal mutation) — upserts one row in
  `entitlements` keyed by `appUserId`, idempotent by `event.id` and
  stale-guarded by `occurredAt` (parsed from `event.date`): a redelivered
  event older than the stored one is dropped, so a delayed webhook can't
  revive a since-expired pass.
- `setEntitlement` (public mutation) — manual upsert for the Web Test
  Store path; inlined to avoid Convex's circular-type cascade. It is a
  self-grant path by construction, so it hard-refuses whenever
  `REVENUECAT_WEBHOOK_SECRET` is configured — real billing turns the
  webhook into the only writer.
- `getEntitlements` (query) — read by the client's `/sync/entitlements`
  boot poll.
- `readEntitlements` (exported helper) — converts a RevenueCat payload
  (`{entitlements: {commodity_insider?: {expires_date_ms?}, district_founder?: {...}}}`)
  to `{insider, founder}` booleans. A one-time entitlement (no
  `expires_date_ms`, the founder tier) is always active; a subscription is
  active iff `expires_date_ms > Date.now()`.

Three HTTP routes (`convex/http.ts`):

- `POST /revenuecat/webhook` — bearer-auth (`REVENUECAT_WEBHOOK_SECRET`),
  returns 503 when unconfigured, 401 on bad bearer, applies the payload.
- `GET /sync/entitlements?appUserId=…` — read for the client.
- `POST /sync/setEntitlement` — manual upsert (used by `billing.js`
  `pushToMirror()` when the Web Test Store's local state needs to
  propagate to Convex); 403 once the webhook secret is configured.

The route is wired but the secret isn't configured — until a real
`REVENUECAT_WEBHOOK_SECRET` lands, the webhook returns 503 by design and
the manual upsert path stays usable for the Web Test Store demo; setting
the secret closes the free-grant path on both surfaces with no code
change. On boot, `billing.configure()` reconciles against the mirror
(adopts mirror grants, never revokes off it — revocation rides the SDK's
`customerInfo`) and pushes Test Store grants so a pass follows the stand
across devices.

**The pitch licence.** Before the floor opens, `#licence` (z-33 paper card over the diorama) signs the player in: name + stand name (pen-line inputs, activate the Sign button; Escape never signs or advances — Sam, THE CORNER CUP), a cosmetic role, and one of four backgrounds carrying a single small perk — `ex-barista` (`perkStaffMul 1.08`), `ex-accountant` (`perkCostMul 0.90` on card fees + every incident payout), `new to the trade` (regulars open at op 0.18), `a market regular` (the Brief whispers the wire's *direction* — the × stays insider). Identity threads `composeLetter` (`Dear Ada,` / `…do, Ada?`), the Morning Brief, nightly + finale receipts, and the Convex owner — `convexSync` reads `ownerName()` live so the district board lists the stand name at the next dawn. Persists via `localStorage` `grunds.identity`; `?skipLicence`/`?skipTutorial`/headless bypass.

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
   inside the paused Morning Brief (day 1 adds an optional inline coach card)
   as the crane settles home, a **reactive
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
   with the live inventory + ready-time readout, chalk dust + screech on reprice) against the
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
  public domain: `grunds.trustfall.xyz` — GoDaddy CNAME → Vercel `grunds-proxy`
  (`deploy/vercel-proxy/vercel.json`, one catch-all rewrite, GET+POST), TLS
  auto-minted, `_vercel` TXT + `grunds` CNAME both required at GoDaddy;
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
```

## October 1 — first-morning orientation (context-first Brief)

The first Morning Brief was a business form; this pass makes it an
orientation. Architecture is unchanged — same `#brief` modal, same pause/inert
contract, same commit pipeline; nothing about economics, constants, or scoring
moved.

- **`orientation.js`** (pure, no deps) exports `firstMorningCopy()` (the settled
  day-1 copy) and `economicsLesson(snapshot)` — one honest line chosen by real
  state: empty/low house stock first, then live debt, then a Ruth staffing
  decision, then yesterday's market tier, else a calm default. Rendered into
  `#brief-learning` from day 2 on (suppressed when a curriculum card covers
  the same tool).
- **Day-1 Brief**: heading "YOUR FIRST MORNING", kicker `Day 1 of 5 · before
  opening`, `#brief-intro` renders stand name via `textContent` plus
  `portraitCanvas` roles for Idris (`creatives`) and Ruth (`commuters`) at 48px.
  `.first-morning` right-aligns a 460px paper over a lightly-blurred café;
  ≤640px it centres full-width.
- **Guided opening** (`guidedOpening = wantTutorial`, `firstPrepChosen`): day-1
  prep renders three full-width choices (batch → deal → wait) with no
  pre-selection; `OPEN THE CAFÉ` and `Enter` are inert until a real pick, and
  keys `1`/`2`/`3` target the choices — never the folded hedge row. Same
  `stagedPrep`/`applyStagedPrep` contract underneath; headless/demo/skip
  bypass the gate and the headless-only `testState({openingGuidance})` seam
  drives it in tests.
- **Progressive disclosure** (superseded by the Oct-1b curriculum — see below):
  `#brief-risk`/`-nut`/`-lots`/`-menu`/`-actions`/`-context` lived inside a
  `#brief-more` drawer on day 1. The day-1 footer (via `updateBriefFooter`)
  shows the chosen prep's cash at opening plus any staged advanced spend —
  contract fee, settlement, tab-funded cellar estimate — computed from the real
  `quoteDayPlan`/`resolveDecision` result; the nut reads "bills counted at
  closing".
- **Coach order**: `coachBegin` only prepares state; the first card ("Ruth has
  the bar…") reveals on the first trading tick after the Brief closes, and a
  once-only craft card quotes the actual served count and a real named walk-in
  when five cups have poured before 11:00. Wave/low-stock pauses unchanged.
- **Goal copy**: `computeNextAction` gets `day` + `guidedOpening` and returns a
  settling beat on calm day-1 mornings; the queue bar says "they may leave",
  and an empty house at close prepends the restock lesson to the receipt
  summary.

Verified by `orientation.mjs` + the focused suites and a full 65-suite
non-balance gate in a fresh mirror (`tsc --noEmit` clean). No browser evidence
was gathered this pass — by instruction — so the first-morning surface is
asserted only through a headless fixture that parses the real `index.html`
markup (no layout, paint, or focus-behavior proof). Commit `f3e0d18` was
published to the existing Convex dev site; HTTP file checks matched the upload
artifact, which does not establish deployed gameplay or engagement.

## October 1b — Morning Brief curriculum + versioned staging

The `#brief-more` drawer is deleted; a flat `#brief-tools` container holds the
slots in order (`brief-new`, `brief-lots`, `brief-menu`, `brief-demand`,
`brief-actions`, `brief-context`, `brief-nut`, `brief-risk`). `curriculum.js`
is pure and DOM-free: `planTools({day, introduced, houseStock, lastPour, debt,
contract, threatToday, threatYesterday, unlockAll})` returns `{visible,
newToday, essentialNew}`. Scheduled discovery is at most one card per day
(coffee ≥2, menu ≥3, street ≥4, insurance ≥5 or any threat/contract); essential
tools (empty/low coffee → `coffee`, live tab → `tab`) bypass the daily limit:
an unintroduced needed coffee takes the day's card, while `tab` and coffee
needs past introduction render as `New ·` notes inside their rows instead. Introductions are
persisted to `localStorage['grunds.curriculum']` only on a successful commit
(`applyCommittedPlan`) and all tools are marked at `campaignClose`;
`unlockAll = headless || demoMode || !wantTutorial`, with
`testState({ curriculum: true })` switching to an in-memory introduced set for
tests. `economicsLesson` returns a `tool` id so the learning line can yield to
a same-tool card. New read-only counters `pouredByLotToday` /
`servedByDrinkToday` feed a receipt `lessons` band rendered by `fx.receipt`
into `#r-lessons`. Day-2+ digit shortcuts `1–5` only reach rendered
`#brief-actions` buttons because hidden tools never render.

`tools/stage-site.mjs` (`npm run stage:site -- --out <dir>`) stages a
release-versioned static artifact outside the repo: copies `web/index.html`,
`web/js`, `web/vendor`, `web/assets` and `api/schedule.json`
(`out/wave_schedule.json` preferred, else `dist/api/schedule.json`), rewrites
every relative `.js` ES-module specifier and the `main.js` script tag with
`?v=<commit>[-dirty-<8 hex>]`, fails closed on unversioned specifiers or
missing targets, and writes `release.json` (version, source commit, schedule
source, per-file SHA-256). It never rebuilds `dist`, uploads, or deploys.

Verified by `curriculum.mjs`, `stage-site.mjs`, the rewritten
`orientation.mjs`, the focused regression list, and a 65-suite non-balance
gate in a fresh mirror (`tsc --noEmit` clean). Code-only verification; no
browser evidence, nothing deployed, human playtests outstanding.

## September 30 — current gameplay pass + verification state

A gameplay-intuitiveness pass landed on top of the depth rebuild. Architecture
is unchanged (vanilla Three.js, `web/` is the dist); the work is contract and
presentation, not balance — the sole quantitative correction is the milk
**delivery scale** bug (the 400-cap starved day 2); no difficulty constants
were retuned:

- **`nextAction.js` `leverState()`** is the one shared ruleset — buttons, keys,
  and the goal strip all read it. `computeNextAction` order: evening/rush
  fast-forward → mail → closed/non-trading → 16:00 status → repriced →
  reserved-batch status → in-wave stock decisions → queue reads → hold.
- **Inline day-1 coach** (`#coach`, `coachBegin/Tick/Pause/Skip`): a paper card
  that owns its own pauses — the 14:00 pause fires before the first reserved
  serve at exactly `dayMin === 840`, low-stock triggers at the real 8-cup
  threshold, and a player-owned pause can never be released by coach dismissal
  or skip. Cleared at close/evening/reset; silent from day 2 on.
- **Honest observation only**: wave cards and the debrief quote live
  `waveServed`/`waveBalked`/`waveBatchServed`/`waveStockoutAt`; the discount
  route describes reduced queue-abandonment odds, not prevented walks.
- **Patron contracts**: rolled drink ids survive identity attachment
  (`p.drink` is always a real `DRINKS` id; `wantsMatcha`, milk, price, and
  points all key off it); walk-ins draw once per face per day; visit outcomes
  and WOM credit apply once per patron per day; `stageLabel` renders
  "warming up" for returning first-timers.
- **Supplies**: milk delivery is `min(4000, max(120, round10(lastMilky·1.1)))`
  — the old 400 ceiling starved day 2 of milk. Cellar restock rides the tab
  with a hard credit cap; the quote prices funded cups via the real
  `resolveDecision` result and says the rest stays unbought.
- **Mobile ≤640px**: `#sys` is a measured row above a 2-column 44px lever
  grid, camera/photo/20×/mute fold behind a More toggle, the coach card is
  bounded between HUD and controls, flavor toasts and the notebook hide while
  guidance is up, and the chapter card yields to the floor.

**Verification state, honestly.** The automated gate evidence is Node fixture
suites plus `tsc --noEmit` — 64 non-balance suites pass in a temp mirror against the
existing `dist` schedule snapshot, including new runtime checks for
stock/order/cost/opinion consistency and coach pause ownership. Exploratory browser checks
(manual desktop batch/discount/pause/receipt, limited 375px phone rects) ran
before the final UI edits and were then stopped at the user's request;
**320px, the wave-state phone layout, physical devices, and the deployed
build are not yet verified**, and human playtests remain outstanding. See
`EVAL.md` for the lead-owned readiness probes and fixed measurement fixtures —
no numerical benchmarks are authored in this pass.

## Character, consequence, and pacing roadmap (adopted Oct 1)

Playtest feedback (lead + user, Oct 1): characters feel like stats, much of each
day passes with nothing to decide, and money comes too easily with no felt
consequence. Grounded causes: only seated patrons open a dossier and it reads
as a stat sheet; hover shows raw opinion numbers; 06:00–11:00 and after 17:00
contain no decisions; incidents cost £18–£60 against ~£4,700/day running costs
and thousands of weekly cups; failure exists (seed-7 queue control without
restocking ended −£697 vs ~+£6–7k with restock + settle) but lands late as
ledger lines, not people.

1. **Meet the cast (shipped `df82b4f`).** Any named person opens a profile card —
   who they are, what they want, their usual, how they feel in words, the last
   thing between you, friends — from the floor (queue or table) or the regulars
   board. One small gesture per person per day with its real effect; the
   uncapped wave exploit is removed.
2. **Consequences through people (shipped `fb787d3`; absence pacing being tuned; empty regular seats still to be surfaced).** Ambient street life — pavement walkers, neighbour door peeks, the bench, park sitters, and Row hub/draw visitors — is on the floor and off the till (`streetLife.js`). Surface the existing
   opinion/footfall model as people: who isn't coming today and why, empty
   regular seats, lost regulars seen at Glasshouse, happy regulars bringing
   named friends, a bad review thinning tomorrow's crowd, street events you
   can see. Scale incidents to the café's real numbers. Landed so far:
   `consequences.js` `planAttendance` (a bad day — yesterday's balk/defect —
   or op < −0.2 → away → returning → lost at dawn), named walkouts on the
   roster, the Brief's "Who's coming in" block, receipt lessons for
   walkouts/companions, and `incidentCost` scaling incidents to the live
   till.
3. **Pacing (shipped `a18bb28`: quiet auto-pace + four non-modal
   moments; a Ruth moment is not yet built).** Either there is a decision, or the clock moves quickly:
   `pace.js` `isQuiet` accelerates the wall-clock rate in decision-free
   windows (`QUIET_MUL = 4`, capped at 20×, HUD `#paceflag`), and `#moment`
   cards surface a returning regular, a regular at the counter, a building
   line, and Sam poaching — non-modal, 45 game-minute lifetimes, priority
   returning > sam > line > counter, one of each per day. Ruth needing a
   call is not yet built.
4. **Economy scale.** Decide between a smaller, intimate café (tens of visible
   customers) and costs scaled to the current crowd — only after 1–3,
   measured before and after with fixed seeds and policies, never eyeballed.

## Soft opening (slice)

A single practice day ahead of the five-day week for eligible players
(`wantTutorial` and not every curriculum tool introduced — veterans,
`?skipTutorial`, demo and headless go straight to the week; headless opts in
with `testState({ softOpening: true })`). The day reuses the day-1 engine
under `softDay` with: a dedicated thinning RNG `softRng = seeded(SEED + 101)`
and `SOFT_MUL = 0.005` on the spawn schedule (no return bonus, ≈59 walk-ins);
cast arrivals restricted to Mara/Pip/Olu (`patrons.markSeenOnly`; Pip only
from 14:00 so she lands with the party) plus guaranteed 08:10 commuter and
12:30 elder spawns; Pip's 11:00 ask rewritten to a 24-student study group
(2 per minute across 14:00–14:12, `offerWaveMul` untouched); counter moments
allowed once per cast regular (up to 3); close at 17:00 with no evening
call; and no Convex contact (`sync.preparePlan`/`commitPlan`/`finishDay`
all skipped). The receipt is a practice ledger — served/walked/takings plus
batch and Pip's-group lines only — with a `Practice money` lesson and an
`open the week →` continue. `beginWeek()` (the continue, or the brief's
`Skip the soft opening →`) snapshots roster `{op, visits, stage, drink,
events}` (events relabelled day 0, rendered `soft opening — …`) and the
walk-in pool heads (pids relabelled `d0-`), runs `reset(true)` for a clean
campaign start, restores the social layer, and opens the `OPENING WEEK`
brief ungated and uncoached (`coachedOpening` spends the day-1 coach on the
first played Day 1). The soft receipt hides Idris's evening letter. Shipped
in `cbdc424` and published to the dev site; days 2–3 of the soft opening are a
later slice, pending a fresh-player check of this one.

The soft morning itself is a two-step `#softintro` modal (owned by the modal
controller, Escape-inert, Enter activates the primary) rather than the
first-morning brief: step 1 is the stand name plus `Step inside` /
`Skip the soft opening` (the latter calls `beginWeek()`), step 2 a Ruth
portrait plus `Open the doors` — which stages hold/no-prep and runs the
normal `commitDayPlan()` path. If Pip's 11:00 ask is accepted, a `plan`
moment (highest priority, expires at 14:00 rather than the 45-minute TTL)
offers the three afternoon choices with costs read live from
`leverState(leverSnapshot())` — Starter batch → `doPrebatch()`, Matcha
deal → `doReprice()`, Wait and see → dismiss — so no second lever
implementation exists. Day-1 choices everywhere (first morning, OPENING
WEEK, veteran) render as one-line choices with a single merged
`what's the difference?` details.

The disclosure rule across the UI is `card = introduction, row = tool`:
staged paper cards (`#softintro`, the three-step `#licence`) introduce, while
collapsed `<details>` rows in the Brief (summary ending `· change ›`,
persisted per drawer) are the tools — the wire row auto-opens only when a
signal is in it.

## Depth rebuild roadmap (adopted Sept 28)

*Historical plan — the per-phase [SHIPPED Sept 28] tags below mark the subset
actually delivered; the roadmap as a whole is not claimed complete, and its
verification tail (human playtests) is still open.*

Playtest verdict: "kinda liked it but didn't love it" — no connection to
specific characters, visuals need craft, the coffee economy needs teeth.
Diagnosis: the game simulates richly but surfaces thinly (opinions move with
no face attached, waste is tracked but never shown, Sam reacts but resets
daily). The fix, applied per pillar below: **surface the simulation.**

Goal: patrons you know by name, a floor with craft in every frame, beans as
the game. Non-goal: changing the core loop (Brief → rush → verdict) or the
stack. Estimate: 4–6 weeks. Phases are dependency-ordered.

### Phase 0 — Art direction lock + portrait generator (2–3 days)

- One-page `ART.md`: target look in words (e.g. "storybook low-poly
  miniature: brass-and-cream, soft rim light"). Every later visual addition
  conforms or is rejected.
- `web/js/portrait.js`: seeded canvas avatars (skin, hair, accessory,
  cohort-palette clothing), deterministic from patron id. Used in toasts,
  dossiers, Regulars board, letters, share cards. Flat vector-ish style
  (coherent with low-poly over painterly).
- Test: `portrait.mjs` — determinism, variant coverage, headless no-GL.

### Phase 1 — Character core: identity, life stages, dossiers (4–6 days) [SHIPPED Sept 28]

- New Convex `patrons` table: `id, name, faceSeed, cohort, drink,
  homeTable, stage, visits, opinion, history[]`. Per-cohort name pools.
  Backfill from the existing Regulars graph so live campaigns keep people.
- Life stages `visitor → first-timer → regular → friend → evangelist`
  (visits + opinion thresholds, demotion on neglect). Stages unlock
  behaviors: arrival memory lines ("Mara's back — 4th visit, still on the
  oat flat white"), friend +1 companion spawns, evangelist word-of-mouth
  into the existing `demand` returnees.
- Dossier: click a seated patron → portrait + generated history assembled
  from `patronEvents` (template + real data, no LLM latency).
- Regulars board in the player center: the surveyable cast list.
- Tests: `patron-arcs.mjs` (transitions incl. demotion, companions,
  evangelist WOM), `dossier.mjs`, backfill test.

### Phase 2 — Econ core: named lots, freshness, Wire-to-shelf (4–5 days) [SHIPPED Sept 28]

- New Convex `lots` table + client inventory. 3 standing lots (Brazilian
  Cerrado workhorse / Ethiopian Yirgacheffe 2× floral / Colombian Huila
  middle) + rotating Wire-driven microlot. Each: `costPerCup, quality,
  affinity{cohort: mul}, stockKg, roastedOn`. Stockouts allowed (teeth).
- Freshness decay: stale lots drag the serving cohort's opinion **with a
  reason string**. The hedge becomes *which coffee*, not *how big*.
- Wire events target specific lots with a 2-day lag (forward-buy before
  "frost in Minas Gerais" lands on the Cerrado price).
- Tests: `lot-economy.mjs`, `wire-lots.mjs`, lot scenarios in
  `balance-policies`.

### Phase 3 — Econ depth: menu, roast, waste (4–5 days) [SHIPPED Sept 28]

- Drink menu: espresso / flat white / filter / matcha (+ seasonal). Recipe
  cost, margin, cohort affinity, **prep time** (slow pourovers at rush =
  throughput tradeoff). Reprice lever graduates into menu pricing.
- Daily roast level per lot (light → dark slider; scorch events join the
  incident rotation). Multiplier tables on existing levers.
- Waste economy: `batchWaste` surfaced on the receipt in red, milk
  spoilage, stale-bean penalties. Pre-batch finally has felt downside.
- Wire existing `trainingSpend` to Ruth's throughput/quality/waste — she
  becomes an investable asset (sets up her Phase 4 arc).
- Tests: `menu-pricing.mjs`, `roast.mjs`, `waste.mjs`.

### Phase 4 — Narrative arcs: Ruth, Idris, Sam (5–7 days) [SHIPPED Sept 28]

Needs Phases 1–3 (arcs bite into systems, not air).

- Ruth: hinted condition (visible slowdown + wondering toast) → diagnosis
  interaction → resolution with real cost (weekend off = short-staffed
  Saturday, but loyalty + she returns with a friend who becomes a regular).
- Idris: multi-letter continuity quoting actual decisions, A/B replies in
  the letter modal (local hold/pass — the AgentMail path carries the same
  body to a real inbox); his tips front-run the Wire
  (loyalty rewarded with alpha).
- Sam's season: cross-week memory (grudge counters + conditional
  chalkboard copy), a mid-week truce offer (split Saturday for guaranteed
  mediocrity vs. play for the lease), finale from cumulative history.
  The rivalry trilogy gave him reflexes; this gives him character.
- Tests: `ruth-arc.mjs`, `idris-arc.mjs`, `sam-season.mjs`.

### Phase 5 — Visual payoff: animation, particles, place (5–8 days) [SHIPPED Sept 28]

- Pose/clip system replacing inline sin-math (walk, sit, sip, celebrate,
  grumble, serve-react) + per-cohort gait (elders shuffle, commuters
  stride). Mood-reactive faces from the portrait set (floor shows opinion).
- One verb per prop: camera flash, laptop glow, cup steam, cane tap.
- One pooled particle system (steam, dust motes, flashes, till sparkles,
  rain). Rain day = event + visuals + demand shift.
- Readable interiors: counter menu board with live Phase-3 prices, Sam's
  chalkboard rendering his actual strategy, the lease sign as a physical
  finale object. Written camera grammar for verdict/lease cinematics.
- Mint district graduates to primary environment when credits land;
  `?classicDistrict` stays the fallback. All additions conform to `ART.md`.

### Phase 6 — Teeth calibration + break-it pass (3–4 days) [SHIPPED Sept 28]

- Week autopsy: verdict receipt gains cause attribution (`web/js/autopsy.js`
  `buildAutopsy` — stale-lot day ranges, waste/compost cups, named coolers,
  balks/defections, negative days). Traceable failure reads as fair, not cruel.
  Test: `week-autopsy.mjs` (7/7).
- Break-it pass: five days same lever/lot — `spawnMax` 1.30 → 1.22 until the
  solved growth line narrows. Human-feel check on every Phase 1–3 constant.
- Stale `game-feel` assertions repaired (branched finale cards, `doReprice(opts)`).
- Full gate + `tsc` clean (deployments: no Convex changes this phase).

### Sequencing + guardrails

- The Ship-a-ton mobile shell is independent of all of this — run it in
  parallel with Phase 0 (one unblocks submission, the other unblocks depth).
- Do NOT build: voice acting (strong text > mediocre TTS at 1/100th the
  cost), photorealism, more than 4 lots / 4 drinks, multiplayer, anything
  reshaping the Brief → rush → verdict loop.
- Cut rule: if a feature doesn't make you know someone, taste something,
  or fear something, it doesn't ship.

## Verification roadmap (adopted Sept 28, post-depth-rebuild)

*Status note (Sept 30): the Sept-30 gameplay pass is covered by the Node
gate described in "September 30 — current gameplay pass + verification state"
above; this roadmap's render/play/browser-proof items remain open, and human
playtests are still pending.*

The depth rebuild shipped all six phases, and the playtest verdict is still
"liked, not loved". The next bottleneck is not features — it is that we cannot
*prove* the game renders, plays, or looks right. 63 headless suites gate every
merge, and every one of them stubs DOM, GL, and audio.

| Claim | Proof it needs | Have it? |
|---|---|---|
| It renders | canvas pixel metrics + viewport screenshots | **no** |
| It plays | a bot driving real input, measuring progression | **no** (headless only) |
| It's good | scorecard + measured metrics | **no** (numeric asserts only) |

`EVAL.md` already concedes the gap honestly: *"Layout geometry and deployed
Convex behavior are not verified"* and *"source-string checks are not layout or
gameplay proof."* This roadmap closes it. Borrowed discipline from
[`majidmanzarpour/threejs-game-skills`](https://github.com/majidmanzarpour/threejs-game-skills)
(MIT); its Three.js advice mostly restates what we already do, sometimes less
well. The value is the verification model, not the rendering tips.

### V0 — Seed the cosmetic RNG (prerequisite, ~½ day)

**This is a real bug, not a nicety.** `web/js/patrons.js` wires an injectable
RNG seam and then bypasses it two lines later:

```js
constructor(..., { random = Math.random, walkins = null } = {}) {
  this.random = random;                          // seam wired up
  const fromLeft = Math.random() < 0.5;          // ← bare global, line 113
  pos: V3(s.x, 0, s.z + (Math.random()-0.5)*1.4), // ← ~10 more in spawn
  speed: ritualSpeed + (Math.random()-0.5)*0.3,
  skin: new THREE.Color(SKIN[(Math.random()*SKIN.length)|0]),
  ...
  if (this.random() < pr) toRival = true;        // ← correct usage, line 163
}
```

Real decisions use `this.random()`; cosmetic state beside them uses the global.
Suites pass only because `campaign.mjs` / `campaign-tight.mjs` /
`balance-policies.mjs` monkeypatch global `Math.random`. Only
`lifecycle-accounting.mjs` exercises the seam itself (`{ random: () => 0.99 }`).

Bare `Math.random` counts: `fx.js` 39, `patrons.js` 25, `textures.js` 16,
`audio.js` 16, `main.js` 8, `world.js` 8. Most are legitimately cosmetic, but
`fx.js` (dust, coins, huffs) **will fail every screenshot diff on particle
jitter alone**. Fix: one shared seeded RNG for cosmetic jitter, seeded from the
campaign seed, masking the cases where jitter is the thing under test.
`textures.js` may stay unseeded if procedural texture noise is generated once
per load rather than per frame — verify before converting it.

### V1 — Bot playtest on real input (~1 day)

We are closer than the borrowed pack's scaffold: `?demo=1` already resolves
brief/offer/evening/letter/paywall modals exactly as a player would,
`__grunds.stats()` publishes ~40 metrics, and `?seed=N` replayable links exist.

Note that Playwright is **already in the project**, just not where the gate
looks: `videos/grunds-demo/scripts/record{,2}.mjs` drive the live site through
licence → Brief → hedge → floor → letter → webhook reply. **Those scripts make
zero assertions and install no `pageerror`/`console` listeners** — they are a
capture pipeline, not a test pipeline, and `playwright` is not a `package.json`
dependency. V1 is mostly redirecting existing machinery at proving things:

- Promote Playwright to a devDependency; add `npm run test:browser`.
- Assert on `__grunds.stats()` progression: frames advance, `served` climbs,
  `phase` walks `planning → trading → review`, day 5 closes, no softlock window
  where frames advance without progress.
- Add `pageerror` + `console` error capture — must be empty for the run.
- Drive real keyboard (`1`/`2`/`space`/`1`–`5`+`Enter`) separately from
  autoplay, so hooks cannot mask broken input.

Two caveats from the pack that cost it failed runs: headless default Chromium
renders on SwiftShader (~4× slower) so its FPS is meaningless — install
`--no-shell chromium` and launch `channel: 'chromium'`; run WebGL at
`workers: 1` or timed phases flake. Headless FPS is a desktop signal only.

### V2 — `renderer.info` budget gate (~½ day)

`renderer.info` is read **nowhere** in `web/` (only inside vendored Three.js).
So the whole performance story — auto-`lite`, dynamic `lite` after 3×>32ms,
shadow budget at `queue>40` — is heuristic on frame time, never on draw calls
or texture memory. Snapshot calls / triangles / geometries / textures /
materials / post passes / DPR at `?lite` and at full quality, worst active-play
view, and fail the gate on regression.

Why now: `textures.js` is 28k of procedural 1024px canvases, and the Ship-a-ton
mobile shell is the stated submission blocker. The mobile contract (≤150 draw
calls, 1 shadow caster, 1024 shadow map, 0–1 post passes) wants measuring
**before** the Capacitor wrap, not after.

### V3 — Named-state screenshot baselines (~1 day)

Small delta from our current hooks (`reset`, `openDay`, `skipToRush`,
`togglePause`, `phase`, `paused`): add `setState(name)` returning an
acknowledged `{ state: name }`, plus an explicit freeze-rendering-continues
hook. Baseline the four hero states — 06:00 Morning Brief, 14:00 rush, 20:40
CLOSING TIME, SOLD finale — desktop and ≤640px mobile. Freeze immediately after
state setup; disable shake and time-dependent post; mask only where the masked
area isn't the assertion. Needs V0 first.

Skip baselining anything particle-dominated where masking would hide the actual
assertion — say which way you went and why.

### V4 — Teeth, measured at both ends (~1 day)

Half of this bookend landed with the Sept 28 tab conversion (see `EVAL.md`):
the scripted floor is no longer "scarped, never dead" — the 2026-09-28 pilot
shows 20 of 80 runs reaching `lost` (every passive-family policy loses 4 of
10 seeds), driven by the per-cup emergency sack and the capped supplier tab.
What is still unmeasured is the **upper bound**: no harness policy ever reaches
`held`+ reliably (engaged lands 2 held of 10).

Add the missing bookend to `balance-policies.mjs`: a **perfect-play optimiser**
upper bound beside a **reaction-delayed** lower bound (~300ms between scripted
steps). If the delayed policy survives as long as the fast one, pressure is
decorative; if perfect play and passive play land within noise, that is the
teeth measurement — and the honest answer to "liked, not loved".

Also worth running on the opening specifically: *"the first 30 seconds contain
no real decision."* We deliberately open with a licence modal, a 3-step
tutorial, half-demand mornings, and a 3.4s crane settle. `first_lever_at_min`
(target <90s) already measures this. Check it rather than assume — calm-open and
decision-density pull opposite ways.

### V5 — Score the scorecard (~1 day)

`ART.md` is stronger art-direction writing than anything in the borrowed pack,
but "conform or be rejected" has no measurement. Score active-play screenshots
on 10 categories against calibration anchors, with `colorEntropyBits` /
`edgeDensity` / `luminance.contrast` as advisory signals needing explanation,
not a higher score. Two of its automatic failures aim straight at "liked, not
loved": bloom or particles standing in for missing authored geometry, and
gameplay roles indistinguishable without a design reason.

Low luminance contrast is expected here and is *legitimate*: `ART.md` holds the
night at `#171310` so brass can glow. Document that as an explained reading.

Phase 5 shipped a pose/gait system gated by numeric assertions. Per-cohort gait
is exactly what needs recorded motion evidence — a still cannot establish
animation quality, and an `assert()` cannot see foot slide.

### Game feel: aligned, missing, and one correction

`camera.js` already implements `shakeMag * shakeT * shakeT` with linear decay
and a cap — that *is* the trauma-squared model, arrived at independently. Audio
pitch variance exists (`playbackRate = 0.7 + Math.random()*0.6`), though via the
unseeded global. Squash exists in `poses.js` for patron poses. What's genuinely
absent, in payoff order:

- **Hitstop** — scale the gameplay delta, keep render/camera/HUD on real delta.
  The "real save" beat already earns fanfare + coin rain + a 3.5s crane; a ~70ms
  freeze as the debrief lands would sell it far harder.
- **Volume-preserving impact squash** on objects (`1/sqrt(s)` counter-scale) —
  `ART.md` locks "squash over snap" but the floor has no object-level squash.
- **FOV punch** on the crane/fanfare beat, and **audio ducking** while hitstop
  holds (the bus compressor already exists).

Governing rule, which our own pillars already agree with: *if feedback hides the
thing the player must react to next, it's a bug, not polish.*

### Explicitly not doing

Physics engine selection, Tripo 3D generation, and action-genre level patterns
don't apply — no physics, procedural + Kenney CC0 by choice, and `ARCHITECTURE.md`
forbids photorealism and any reshape of the Brief → rush → verdict loop. That
pack's pressure toward generated assets contradicts the cut rule above.

Its UI section warns against cream panels, monospace labels, and pill buttons as
generic web defaults. **All three are our locked idiom** (`ART.md`: paper, brass,
stamp; money speaks in mono). The rule defers to art direction on purpose —
noted here so nobody "fixes" the paper-and-brass look.

One fair audit item from it: *never stack multiple large banners over the play
path*, weighed against the growing modal set (brief, offer, incident, letter,
debrief, forecast, receipt, desk, customer center, paywall).
