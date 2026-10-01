# Hackathon log

- **Project:** Grunds
- **Event:** Convex All Gas Hackathon
- **What it does:** A live 3D coffee-district economy game where players run café stands and AI patrons with persistent memory buy based on cohorts, commodity events, and gossip.
- **Live app:** https://striped-anaconda-746.convex.site
- **Repo:** https://github.com/sneldao/grunds
- **Frontend:** Convex static hosting
- **Convex deployment:** https://striped-anaconda-746.convex.cloud
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions (live: /ai/letter, /ai/research, /ai/gossip, /sync/*, /agentmail/webhook, /agentmail/inbox, /district/kit, /district/ensure, /tripo/webhook), crons, static hosting
- **Auth:** none
- **AI models:** meta-llama/Llama-3.3-70B-Instruct via Nebius Token Factory (live), gpt-4o-mini via OpenAI (`wireWhy` — the Wire's "why this matters" line; provider chain `OPENAI_*` → `OPENAI_FALLBACK_*` so any OpenAI-compatible endpoint covers outages; falls back empty when key-gated), Mint (mint.gg) 3D model generation (`convex/mint.ts` → `tripoAssets`, powering the generative district; the Tripo v3 adapter `convex/tripo.ts` is wired + key-ready but idle pending credits)
- **Started:** 2026-09-05T20:48:27Z
- **Last updated:** 2026-10-01T12:50:20Z

## Log

### 2026-10-01 - working tree - staged soft morning (uncommitted, on a8b0b53)

- **`#softintro` replaces the soft-day brief**: a two-step owned modal — step 1 shows the stand name with `Step inside` + `Skip the soft opening` (→ `beginWeek()`), step 2 Ruth's portrait (`portraitCanvas('ruth','commuters',72)`) with `Open the doors` staging hold/no-prep through the normal `commitDayPlan()` path. Progress dots (2, current filled), a 260ms fade-and-rise between steps (off under `prefers-reduced-motion`), Enter fires the primary, Escape is inert. The 14:00 plan question no longer leaks before Pip asks. The soft coach intro is trimmed to `Watch the first orders and notice who comes in.`
- **`plan` moment on accepted Pip ask**: highest moment priority (`plan: -1`), expires at `dayMin >= 840` instead of the 45-minute TTL, live costs from `leverState(leverSnapshot())` — Starter batch → `doPrebatch()`, Matcha deal → `doReprice()` (`· £x.xx extra` only when the reprice fee applies), Wait and see dismisses. Buttons for unavailable levers are omitted; a `what's the difference?` details carries the merged explainer.
- **One-line Day-1 choices everywhere**: `firstMorningCopy()` choices are now title + one line (`£40.00 now · 40 cups ready at 14:00, served faster` / `£4.20 a cup · they'll wait longer` / `Every cup made to order — decide later`), guided tag kept on Starter batch, and the old change-of-mind details merged into one `what's the difference?` block — applied to the first-morning, OPENING WEEK, and veteran briefs.
- Verified in a fresh mirror: `soft-opening` 79 checks, focused battery (orientation/moments/coach/modals/curriculum/lifecycle-accounting/time-locked-levers) and the full 72-suite non-balance gate all exit 0; `tsc --noEmit` and `git diff --check` clean; `secret_scan` clean. No commits/deploys/browser.

### 2026-10-01 - cbdc424 - soft opening slice

- **One practice day before the week** (`softDay` on the day-1 engine): eligible new players get a soft opening — thinned crowd via a dedicated `softRng = seeded(SEED + 101)` with `SOFT_MUL = 0.005` (~59 walk-ins, no return bonus), cast restricted to Mara/Pip/Olu (`patrons.markSeenOnly`; guaranteed commuter at 08:10 → Mara, elder at 12:30 → Olu; Pip is held for the study group so the first party member is her), Pip's 11:00 ask rewritten (`"Mind if the study group lands at 14:00? Twenty-four of us — all matcha."`, 24 students at 2/min across 14:00–14:12, `offerWaveMul` left at 1), counter moments once per cast regular instead of once per day, and close at 17:00 with no evening call or incident.
- **Practice ledger + `beginWeek()`**: the soft receipt carries only served/walked/takings plus batch and group lines — no ops/nut/debt/net-worth/forecast — leads lessons with `Practice money — today's takings don't count toward the week.`, and offers `open the week →`. `beginWeek()` (also wired to the brief's `Skip the soft opening →`) snapshots roster `{op, visits, stage, drink, events}` — events relabelled day 0, rendered `soft opening — …` in dossiers/board/cast history — and the walk-in pool heads (pids relabelled `d0-`), then `reset(true)` rebuilds the tested fresh start, restores the social layer (`walkins.day = 0` so `ensureDay(1)` carries known faces), and lands on the `OPENING WEEK` brief ungated with `coachedOpening` spent — the day-1 coach only ever runs on the first played Day 1. The soft day never touches Convex (`preparePlan`/`commitPlan`/`finishDay` all skipped) and nothing economic carries.
- **Coverage**: new `soft-opening.mjs` — 45 checks incl. the [35,90] walk-in band on seed 7, cast-only tagging and arrival times, 24-party accept vs zero decline, receipt shape, `beginWeek` byte-equal to a fresh `reset()` on the ledger fields, skip parity, and the all-tools-introduced bypass. Full non-balance gate in `/tmp/grunds-test-mirror15`: 71 suites green; `tsc --noEmit`, `git diff --check`, `secret_scan` clean. Lead review added one fix: the soft receipt hides Idris's evening letter (its reply buttons could stage contracts on a practice day the week then wipes), with a matching check (46 total).
- **Deploy**: `cbdc424` pushed to `origin/main` and published to the existing **dev** deployment `striped-anaconda-746` (deployment ID `2a5619bc-4500-45b2-bc1c-0dfac3bb8497`, `?v=cbdc424`, 71 files + `release.json`) after the full non-balance gate on the committed tree; HTTP checks of index (incl. the skip button), main/regulars/patrons/identity/cast, schedule, and `release.json` matched the artifact. Backend and production untouched.
- **Limitations**: crowd size measured only on the seed-7 fixture with Pip declined (60 served, £226.80); real-time length is an estimate (~1½ min at 1×); carried opinions' effect on week footfall is unmeasured; no browser evidence; soft days 2–3 wait on a fresh-player check of this one.

### 2026-10-01 - a18bb28 - quiet auto-pacing + in-day moments (roadmap step 3)

- **`web/js/pace.js` (new, pure)**: `isQuiet(s)` — quiet iff trading, unpaused, open, no modal, no card shown or queued, settled (day ≥ 2 or the day-1 coach done/skipped/09:00+), and in a decision-free window (before 11:00, or after the 11:00 ask until 13:30, or 16:00–17:00 when no incident is pending). `QUIET_MUL = 4` → the loop derives `effSpeed = min(1200, speed × 4)` while quiet; only wall-clock tick rate changes. A `#paceflag` HUD line reads `quiet — time moves faster` while active. Headless needs `testState({ pace: true })`.
- **`#moment` card** (`index.html`, same paper style and corner as `#coach`): four non-modal moments, never pausing the clock — **returning regular** (`… is back. Giving you another chance after …`, with `Say hello`/`Leave it`), **regular at the counter** (once/day before 10:30, `Say hello`/`Meet ${name}`/`Leave it`), **line building** (once/day before 14:00 at queue ≥ 6, `Cut matcha to …` via `doReprice` when the lever is legal + `Ride it out`), **Sam takes a regular** (on a cast `defected` walkout, `Got it`). Priority returning > sam > line > counter; queued not dropped; each expires unshown after 45 game-minutes; a visible card hides on any button and counts as `cardVisible` for quiet pacing. `moment_shown`/`moment_action` analytics; headless needs `testState({ moments: true })`.
- **Economic neutrality**: quiet pace only changes how many `tick()`s a frame runs. While quiet (and in headless `testState({ moveTick: true })`), `patrons.update` steps once per tick at the base rate's wall-time per game-minute instead of once per frame — walking cost per game-minute is rate-invariant, so a fixed-seed day is bit-identical with pace on vs off (asserted in `moments.mjs` on served/balked/till/netToday).
- **Coverage**: new `pace.mjs` (pure truth table — settled gate, modal/shown-card/queued-moment, window edges 659/660 · 809/810 · 959/960/1019/1020, `incidentPending`) and `moments.mjs` (real triggers, exact copy, once/day, priority order, 45-minute pending + shown expiry, `Say hello` +0.06 once, `Cut matcha` charges the `leverState` cost, no clock pause, pace identity). Full non-balance gate in `/tmp/grunds-test-mirror13`; `tsc --noEmit`, `git diff --check`, `secret_scan` clean.
- **Measured** (lead probe, seeds 7/42/101, moments on and never clicked): 380–426 of 900 minutes a day run quiet (mean 415); a modelled 1× day drops from ~270 s to ~174–185 s. An earlier draft gated on a line of ≤3, which applied only 40–130 minutes a day because the line exceeds ten people ~70% of the time — the rule now keys off pending decisions.
- **Deploy**: `a18bb28` pushed to `origin/main` and published to the existing **dev** deployment `striped-anaconda-746` (deployment ID `5c167421-4d3d-472b-bd20-8ccf00dc6dbd`, `?v=a18bb28`, 71 files + `release.json`) after a 70-suite gate on the committed tree; HTTP checks of index, main/pace/consequences/cast, schedule, and `release.json` matched the artifact. Backend and production untouched.
- **Limitations**: no browser evidence; during quiet windows `patrons.update` runs ~QUIET_MUL more times per frame (movement per game-minute is unchanged, but it is the heaviest per-frame work — worth a low-end perf sanity check).

### 2026-10-01 - 02febc2 - absence trigger: personal experience, not mood

- **`consequences.js` `planAttendance` retuned**: measurement showed dawn opinions live in −0.06..+0.32 so the op < −0.2 trigger never fired. The trigger is now personal experience — `hadBadDay(r, day)` (an own `balked`/`defected` event on `day − 1`) OR op < −0.2: present → `away`; `away` → `returning` (the second-chance day, unconditional); `returning` → `lost` on a repeat walkout/defection or still-unhappy, else `present`; `lost` sticky. `absentReason` still comes from the real last event; the generic line is only for the op path.
- **Reset history fix** (same tree): `reset()` now restores roster constructor defaults (`visits 5`, `stage 'regular'`, canon drink, `events []`, `_lastOutcomeDay`/`_lastWalkoutDay` cleared) and `WalkinPool.reset()` rebuilds the pool fresh (`day −1`, empty heads/byPid/drawn) — no more last-week dossiers or stale bad-day reasons on a new campaign.
- **Coverage**: `consequences.mjs` rewritten for the new trigger (bad-day away, returning → present after a clean/no-event day, returning → lost on repeat walkout, op path intact); `lifecycle-accounting.mjs` Step-2 fixture now drives the arc through real `noteWalkout` events (no op forcing), asserts reset clears roster + walk-in history and a fresh-campaign profile reads `You haven’t met properly yet.`. Focused reruns + `tsc --noEmit` + `git diff --check` clean.
- **Deploy**: `02febc2` published to the existing **dev** deployment `striped-anaconda-746` (deployment ID `d0d688d6-cfe8-49b4-a279-508d56744078`) as a `?v=02febc2` versioned artifact after a 68-suite non-balance gate on the committed tree. HTTP checks matched the artifact.

### 2026-10-01 - fb787d3 - consequences through people (roadmap step 2)

- **Named walkouts** (`regulars.js` `noteWalkout` + `main.js` balk/defect handlers): a cast regular who balks or defects now records `{day, outcome, stayed:false}` on `r.events` and takes the same opinion deltas walk-ins already had (−0.08 balked / −0.12 defected, clamped), once per regular per day (`_lastWalkoutDay`); `patrons.js` `unsee` on defect is unchanged.
- **Attendance state machine** (`web/js/consequences.js` new, pure): `planAttendance(roster, {day})` runs at dawn (day ≥ 2, deterministic): op < −0.2 → `away` one day → `returning` (a second chance regardless of op) → `lost` the next unhappy dawn, `lost` is sticky for the campaign. `absentReason` comes from the real last event (`balked`/`defected`/generic). `markSeen` filters `away`/`lost` so they never spawn as themselves; once per day a `lost` regular tags the first rival-bound spawn of their cohort (`p.regularName`/`hasHat`/`pname`/`faceSeed`/`lostGlimpse`, display only — no seen, no opinion, no events). `absence`/`absentReason`/`justLost`/`_defectShown` reset on campaign reset.
- **Who's coming in** (`#brief-people`, after `#brief-learning`, day ≥ 2): away (`${name} isn’t coming in today — ${reason}.`), returning (`giving you another chance`), newly lost (`has started going to Glasshouse.`, one day only via `justLost`), companions from yesterday (`patrons.companionsToday` recorded when `broughtFriend` is set), and footfall lines only when |pct| ≥ 3 off `regulars.footfallMul`.
- **Receipt lessons**: cast walkouts derive from real `r.events` (`walked out of the line.` / `crossed to Glasshouse.`); companions today (`${name} brought ${friend}.`).
- **Profiles/board**: `ABSENCE_WORD` maps away/returning/lost to words in `profileView` and board rows; `Say hello` disables to `Not in today.` for away/lost (returning stays greetable — the recovery path).
- **Incidents scale to the till** (`incidentCost(base, share, till) = max(base, round(share·till/5)·5)`): plumber 0.05, agency cover 0.06 (both Ruth variants), card dongle 0.03, inspector 0.04, solicitor settle 0.06 + contest 0.14 (replaces fixed £140, same 50% logic via `solicitorCharge`), supplier COD 0.04, re-roast 0.02. Cost computed once in `showIncident` and used verbatim in line/effect/yes copy and `accept()`; `perkCostMul` still applies; decline effects and the +£18 supplier fee unchanged.
- **Coverage**: new pure `consequences.mjs` (14 checks — state machine, reasons, incident floors/rounding); `lifecycle-accounting.mjs` gained a Step-2 fixture driving Mara away → returning → lost across days 2–5 with brief lines, markSeen skip, a real once-per-day walkout on the receipt, incident copy == charged amount, and a forced rival-bound spawn asserting the lost glimpse touches nothing. Full non-balance gate: 68 suites pass in `/tmp/grunds-test-mirror8` (logs `/tmp/grunds-step2-logs/gate/`); `tsc --noEmit`, `git diff --check`, `secret_scan` clean. Captures: `/tmp/grunds-step2-logs/brief-people-{away,returning,lost}.txt`, `receipt-lessons-walkout.txt`.
- **Measured** (lead probe, seeds 7/42/101/202/555, restock + settle, decline vs accept incidents; before = `df82b4f`): incidents now £155–£300 (was £18–£60); accepting every incident costs ~£651 of five-day net worth on average and moved one run from "held" to "scarped"; named regulars recorded 11 walkouts (was 0). No regular stayed away in those runs — the unhappy ones crossed the threshold only on day 5.
- **Deploy**: `fb787d3` pushed to `origin/main`; release-versioned artifact (`?v=fb787d3`, 70 files + `release.json`, schedule from the existing `dist/api/schedule.json`) published to the existing **dev** deployment `striped-anaconda-746` (deployment ID `43b691f1-4f6c-4868-8bd9-4c5be87cab4c`) after a 68-suite gate on the committed tree. HTTP checks: index loads `main.js?v=fb787d3`; main/consequences/regulars/patrons/cast/curriculum, schedule, and `release.json` match the artifact. Backend and production untouched.
- **Limitations**: no browser evidence; the lost-glimpse cohort match is display-only (no toast yet); incident scaling uses the till at the moment the card opens; absence pacing still to be tuned.

### 2026-10-01 - df82b4f - cast profiles (roadmap step 1)

- **Meet the cast** (`web/js/cast.js` new + `main.js`, `index.html`): per the adopted character/consequence/pacing roadmap (`ARCHITECTURE.md`), the dossier is now a profile card — any named person (cast roster or walk-in head) opens it from a floor click (queue or table) or from a regulars-board row, which are now real ≥44px buttons stacking the dossier over the board. `cast.js` is pure: `CAST_PROFILES` (lead-authored bio + want per roster name), `walkinProfile` (stage/cohort copy), `profileView` → heading/name/stage/bio/wants/usual/feeling-in-words/lastBetween/friends/history.
- **One gesture per person per day**: the card's `Say hello` applies the existing +0.06 wave effect once per person per day (cast `r.op` or walk-in `head._op`, clamped to 1, tracked in a `greetedToday` Set cleared in `prepareDay`/`reset`); the uncapped click-to-wave opinion bump is removed — identity-less patrons still get the bubble with no opinion change. The hover card drops raw `op` numbers for `name · stage`, feeling words, friends, and `click to meet them`.
- **Coverage**: new pure `cast.mjs`; `dossier.mjs` updated to the new contract; `orientation.mjs` drives the real dossier DOM — board row → profile → `Say hello` (+0.06 exactly once) → Escape back to the board, plus walk-in `A NEW FACE` profile. Pre-deploy gate on the committed tree: 67 non-balance suites pass, `tsc --noEmit` clean.
- **Deploy**: `c2e4684` and `df82b4f` pushed to `origin/main`; the first release-versioned artifact (`npm run stage:site`, version `df82b4f`, 69 files + `release.json`, schedule from the existing `dist/api/schedule.json`) published to the existing **dev** deployment `striped-anaconda-746` at https://striped-anaconda-746.convex.site (deployment ID `a813c824-f829-4413-b2be-6b33e0740f70`). HTTP checks: index loads `./js/main.js?v=df82b4f`; main/cast/curriculum/orientation/modals/patrons/three modules, schedule, and `release.json` all returned 200 with SHA-256 matching the artifact. Backend and production untouched. No browser evidence; deployed gameplay and human engagement remain unverified.

### 2026-10-01 - c2e4684 - Morning Brief curriculum + versioned staging

- **Curriculum disclosure** (`web/js/curriculum.js` new + `main.js`, `index.html`): the `#brief-more` drawer is deleted; a flat `#brief-tools` stack introduces one tool at a time — coffee day 2, menu day 3, street day 4, insurance day 5 (or immediately on any market threat/contract), each as a single "New today" card with character-voiced copy plus `favoured by` lines computed from `LOT_CATALOG`. Need beats schedule: an unintroduced empty/low house takes the day's `coffee` card itself; a live `tab` surfaces as a `New ·` note inside its row regardless of the daily limit. Introductions persist to `localStorage['grunds.curriculum']` only on successful commit; campaign close marks every tool so veterans see the full brief next run. `unlockAll = headless || demo || !wantTutorial` keeps all fixtures on every control; `testState({ curriculum: true })` drives the gated path headlessly.
- **Receipt lessons**: new read-only counters `pouredByLotToday` / `servedByDrinkToday` feed a `lessons` band between the receipt summary and ledger — day 1 quotes the real `ops.total` running cost, the coffee-intro day quotes actual cups poured and stock left for the house lot.
- **Release-versioned staging** (`tools/stage-site.mjs` + `npm run stage:site -- --out <dir>`): copies `web/` runtime files + `api/schedule.json` (prefers `out/wave_schedule.json`, else `dist/api/schedule.json`), stamps `?v=<commit>[-dirty-<hash>]` on every relative `.js` import and the `main.js` tag, fails closed on unversioned/missing specifiers, and writes `release.json` with per-file SHA-256s. No build, network, or deploy — fixes the 4-hour unversioned-JS cache on the live host.
- **Coverage**: new `curriculum.mjs` (22 checks) + `stage-site.mjs` (16 checks), `orientation.mjs` rewritten for the slot-based brief on real markup, modals/lifecycle disclosure assertions adapted; 65-suite non-balance gate green in `/tmp/grunds-test-mirror5` (logs `/tmp/grunds-curriculum-logs/`); `tsc --noEmit`, `git diff --check`, `secret_scan` clean.
- **Limitations**: Node fixtures only — no browser evidence this pass, nothing deployed, human playtests remain outstanding. Day-2 coffee takes the full "Your coffee" card even though the fixture drains the day-1 sack (need + unintroduced → card, not a note).

### 2026-10-01 - f3e0d18 - first-morning orientation pass

- **Context-first day 1** (`web/js/orientation.js` new + `main.js`, `index.html`): the first Brief is "YOUR FIRST MORNING" — stand name, Idris/Ruth portrait rows (existing `portraitCanvas`, creatives/commuters, 48px), the Glasshouse/Sam rivalry framed as secondary, and the afternoon's aim. `.first-morning` right-aligns a 460px paper over a lighter backdrop so the paused café stays visible; the economics surface (nut, cellar, menu, hedges, wire, letter) regroups under a collapsed `#brief-more` — "Explore the full plan" on day 1, "More planning details" after.
- **One meaningful choice**: day-1 prep renders three full-width paper buttons — starter batch (recommended) / matcha deal / wait and see — with real cost + trade-off copy. Guided opening (`guidedOpening = wantTutorial`, `firstPrepChosen`) holds `Enter`/`OPEN THE CAFÉ` inert until a real pick; `1`/`2`/`3` select the prep choice and never reach the folded hedges; the choice stays changeable until open. Headless/demo/`?skipTutorial` keep the ungated path; `commitDayPlan` is untouched and a headless `testState({openingGuidance})` seam drives the gate in tests.
- **Progressive economics**: `economicsLesson()` picks one true line by real state (empty/low house → tab → staffing → yesterday's market → calm default) and force-opens the full-plan drawer when urgent so stored closed prefs can't hide a dry cellar. Day-1 footer (`updateBriefFooter`) shows the plan's opening cash plus any staged advanced spend — contract fee, settlement, credit-capped cellar estimate — while the nut reads "bills counted at closing". An empty house at close prepends the restock lesson to the receipt summary.
- **Coach order + honest wording**: `coachBegin` prepares state only; the first card ("Ruth has the bar — watch the room") reveals on the first tick after the Brief closes, and a once-only craft card quotes the real served count before 11:00. The goal strip gets a settling beat on calm day-1 mornings (`computeNextAction` now reads `day` + `guidedOpening`), the queue bar says "they may leave", and the title screen reads "A café to make your own…" with `STEP INSIDE`.
- **Coverage**: new `orientation.mjs` parses the actual `index.html` markup into a simplified element tree (document order, `details.open`, closed-fold visibility, real `activeElement`) — heading/kicker/intro/forecast, drawer containment, disabled OPEN, Enter no-op, key routing, commit → 40 reserved cups at 840, day-2 normal brief, urgent drawer override. `coach.mjs` updated for the deferred-intro contract and new choice DOM. Full non-balance gate: 65 suites pass in a fresh mirror (`/tmp/grunds-test-mirror4`, logs `/tmp/grunds-orientation-logs/`); rendered primary-surface capture at `/tmp/grunds-orientation-logs/first-morning-visible.txt`; `tsc --noEmit` clean.
- **Deploy**: commit `f3e0d18` pushed to `origin/main`; 67 static files published to the existing **dev** deployment `striped-anaconda-746` at https://striped-anaconda-746.convex.site (deployment ID `23af3631-cb16-4bed-84c9-7975a8ed133e`). Built from current `web/` plus the existing `dist/api/schedule.json` snapshot without regenerating data or changing `dist/`. HTTP-only checks of the root, main/orientation/modals/nextAction/config modules, schedule, Three.js module, and coffee GLB all returned 200 with SHA-256 matching the upload artifact. Backend functions/schema and production were untouched.
- **Limitations**: Node fixtures only — no browser automation or capture this pass (standing instruction); the first-morning layout and mobile variant are unverified in a real browser, HTTP publication checks do not establish deployed gameplay. Human playtests remain outstanding.

### 2026-09-30 - 880b3e1 - gameplay-intuitiveness pass

- **One lever ruleset** (`web/js/nextAction.js` `leverState`, `main.js`): buttons, `1`/`2` keys, and the goal strip share one legality+cost source — a morning pre-batch reserves 40 cups for 14:00 (`batchReservedUntil`), an in-wave press at ≤8 cups is a routine £40 top-up, the first unstaged post-noon strategy change charges £44.20 for a late batch (£40 + £4.20) or £4.20 for a late price cut plus a regular-warmth hit either way, reprice locks prep, levers close at 16:00, and invalid presses cost nothing.
- **Onboarding**: licence → paused Morning Brief → optional non-modal day-1 coach card (`#coach`, `coachBegin/Tick/Pause/Skip`) that pauses at exactly `dayMin === 840` before the first reserved serve and at the real 8-cup low-stock threshold; coach-owned vs user-owned pauses are tracked so dismissal/skip never stomps a player pause, and coach state clears at close/evening/reset.
- **Honest feedback + believable patrons**: wave cards and the debrief quote live `waveServed`/`waveBalked`/`waveBatchServed`/`waveStockoutAt` (discount copy describes reduced queue-abandonment odds, not prevented walks); rolled drink ids survive identity attachment with `wantsMatcha`/milk/price consistent; walk-ins draw once per face per day; stage labels read "warming up". Milk delivery corrected to `min(4000, max(120, round10(lastMilky·1.1)))` — the old 400 cap starved day 2.
- **Readability**: `#sys` sits as a measured row above a 2-column 44px lever grid on ≤640px, extras fold behind a More toggle, the coach card is bounded between HUD and controls, one speech bubble at a time (gossip conversations still run when display-blocked), warning toasts dedupe, and paywall/sponsor strips stay hidden in normal play. `npm run preview:local` serves `web/` + the existing `dist` schedule on 127.0.0.1:8766 with no ingest step.
- **Coverage**: new `coach.mjs` and `lever-state.mjs` runtime suites (live `PatronSystem` — real drink ids, milk/price/points, reservation sealed at 839 and consumed at 840, £0 invalid presses, the exact £44.20 late batch); lifecycle-accounting now stages a verified cerrado-restock + settle plan on days 2–5 and reconciles `netToday − sackSpend`. Gate: 64 non-balance suites + the five focused re-runs pass in a temp mirror against the existing `dist` schedule; `tsc --noEmit` clean. Mechanical checks only — not engagement proof.
- **Deploy**: gameplay commit `880b3e1` pushed to `origin/main`; 66 static files published to the existing **dev** deployment `striped-anaconda-746` with static-hosting deployment ID `d3307ba8-790d-43f3-95b5-f8d0803e2d6f`. The fresh upload directory used current `web/` source plus the existing `dist/api/schedule.json` snapshot; local `out/` deletions and `dist/` were untouched. No backend functions/schema or production deployment changed. HTTP-only checks of the root, main/nextAction/menu/patrons/config/world modules, schedule, Three.js module, and coffee GLB all returned 200 with SHA-256 matching the upload artifact.
- **Limitations**: browser QA was stopped at the user's request — earlier desktop flows and limited 375px phone rects were checked, but the final 320px/wave-state phone layout, physical devices, and deployed gameplay remain unverified; human playtests are outstanding. Published at `https://striped-anaconda-746.convex.site` for playtesting only, not an approved submission. Submissions/store/mobile-shell/upsell work stays paused pending the EVAL readiness gate.

### 2026-09-28 - working tree - bean economy tab conversion + teeth reconcile

- **Model change** (`web/js/main.js`, `lots.js`, `exchange.js`): dawn sacks now ride the supplier tab (clamped to the £1,500 credit line — a capped tab buys nothing and the bar pours what's left); a bone-dry cellar bills **every** cup from the till at 1.5× spot (was: one free emergency sack/day); starter stock is prepaid before the week (`value: 0` at reset) so opening pours never bill twice; emergency pours carry `lotId` for the cascade report. New receipt counters: `sackSpend` (tab half) / `emergencySpend` (cash half) of the day's bean outlay — the Idris Gesha hold stays cash on `beanSpend` alone. `closeDay` nets matcha-only cogs; sacks ride `exchange.debt`, which the verdict nets once.
- **Reconcile fix** (`web/test/balance-policies.mjs`, `lot-economy.mjs`): the harness was double-adding emergency + batch spend to a till that is already net of both; the day row is now `netToday − sackSpend` and the receipt mirror `till − cogs − ops − fee − interest` (settlement is balance-sheet-neutral). Deterministic `--single` replays verify the ledger to 1e-7.
- **Teeth, measured**: full 80-run pilot under the new model — 20 of 80 runs reach `lost` (every passive-family policy loses 4 of 10 seeds); engaged still leads (£1,695 mean, 2 held), reckless worst. Pre-conversion the scripted floor never reached `lost`. Capture `out/review-balance-2026-09-28.json`, fingerprint `dadbeeb20604340eefa573fc9003b334464272685b611a734d461383b0564367`.
- **Stale suites repaired** (test-only): `campaign.mjs` hedge assert rewritten to the locked-sack metric (`hedgeSavings − fee`: hold 0 vs contract +306); `campaign-tight.mjs` now plays the settle-when-in-debt competent line (net £3,199); `identity.mjs` pins the rebalanced `PERK_VALUES` table; `intel.mjs` pins the asymmetric 0.2×-floor bias clamp; `modals.mjs` + `decisions.mjs` stubs gained `addEventListener`; `decisions.mjs` resolves NodeNext `./foo.js → foo.ts` imports.
- **Gate:** 62 suites + balance-policies green, `tsc` clean. `.gitignore` now excludes agent tool dirs (`.commandcode/`, `.claude/`, `.cursor/`, etc.); stray `_main-dbg.js` removed.
- **Deploy:** client-side change, no Convex function edits — `npm run deploy:site` pushed static hosting (66 files) to `https://striped-anaconda-746.convex.site`; live `main.js` carries `sackSpend`, `lots.js` the prepaid-starter-stock note. Committed `f4150a0` + `258682a` pushed to `origin/main`.

### 2026-09-28 - Phase 6 shipped: teeth calibration (autopsy + break-it pass)

- **Week autopsy** (`web/js/autopsy.js` new, pure/DOM-free): `buildAutopsy(campaignDays, snapshot) → string[]` — stale-lot day ranges (`stale Yirgacheffe days 3–4 (20 cups)`), waste + compost cup totals, top-3 named coolers (per-day `opDrops`, end-of-week snapshot fallback), balk/defect counts, negative days, non-empty fallback. `main.js` counts stale/scorched cups by lot at serve time, snapshots dawn-day-1 opinions, pushes one cause record per `closeDay` (take-home stamped after ops), renders `lost because:` + `…` continuation rows into the `campaignClose` verdict receipt, rewinds on `reset()`.
- **Stale game-feel assertions fixed** (`web/test/game-feel.mjs`, test-only): finale now asserts the branched `FOR LEASE`/`SOLD`/`DEUCE` cards (PR-B3 replaced the single SOLD line); `doReprice` regex accepts `(opts = {})`. `PASS` restored.
- **Break-it pass** (caps only): `CAMPAIGN.demand.spawnMax` 1.30 → 1.22 — headless probes showed growth/queue policies leading every seed (e.g. seed 7 growth 19432 vs passive 18257); the cap shrinks the growth edge ~4–6% (~1175 → ~600) without touching levers, lots, or verbs. Same-lot-5-days noted as harness-blind (policy sim never stages a top-up, so the house default pours everything) — true per-cup emergency billing is logged follow-up, out of caps scope.
- **Gate:** week-autopsy 7/7 + game-feel `PASS` + weekly-stakes 4/4 + waste 6/6 + lot-economy 14/14 + menu-pricing + roast + Phase-5 suites (pose-clips/prop-verbs/readable-place) + visible-rivalry 13/13 green; smoke relational holds (prep/price-cut beat cold bar); `tsc` clean.
- **Deploy:** `npx convex deploy` → functions live on `descriptive-ram-190.convex.cloud`; `npm run upload:site` → 66 files live at `https://striped-anaconda-746.convex.site`. GitHub push blocked (403 for `thisyearnofear` → `sneldao/grunds`); commits `3e1b8c3` + `a63d3c3` staged locally, awaiting push with rights.

### 2026-09-28 - Phase 5 shipped: visual payoff (poses, verbs, place)

- **Pose/clip system** (`web/js/poses.js` new, pure): GAIT per cohort (elders 0.70 freq / 0.28 swing shuffle, commuters 1.15 / 0.70 stride), walk/sit/sip/celebrate/grumble/serveReact clips, moodFor shared with portraits, samplePose precedence walk→sit→sip→react. `patrons.js` update() samples one pose; phase rate scales by gait; serve→0.9s mood react (+0.2 op), balk→grumble (−0.08 op). Prop sway per gait.
- **Prop verbs + unified particles** (`fx.js` + `portrait.js`): steam/puff/coin/flash/sparkle/rain verbs behind `_guarded` lite caps (flash ≤6); legacy aliases kept. Floor fires camera flash (sitting tourists), laptop glow, cup steam, cane tap — rare, try/caught, never breaks the frame. `moodForOp` export (±0.2, NaN→flat) shares one vocabulary with poses.
- **Readable place** (`textures.js` + `world.js` + `rival.js` + `camera.js` + `config.js`): `drawMenu` full 4-drink board (prices + 86 struck in neg + matcha cut), `W.setMenu` primary (`setMatchaPrice` wrapper kept); Sam board maps keys→display names (BALANCED/PRICE WAR/GUEST ROASTER/EXPRESS BAR); `rentSign` gains forlease/deuce + `W.setLeaseFinale` re-bakes the physical sign at campaignClose; `EVENTS.rain_soak` (tier rain, 0.82× demand) + `W.setRain` streak layer + grey mist, shafts off; `SHOTS{verdict,lease,debrief,rivalReact,newbuild}` + `rig.shot/queueShot`, finale through the grammar.
- **Gate:** pose-clips 10/10 + prop-verbs 4/4 + readable-place 5/5 green; all Phase 1–4 suites re-verified; smoke relational holds; rent-sign/cameo/reactivity green; `tsc` clean. game-feel's 2 fails (SOLD card, notebook) pre-exist on the Phase-4 base.

### 2026-09-28 - Phase 4 shipped: narrative arcs (Ruth, Idris, Sam's season)

- **Ruth's arc** (`web/js/main.js`): condition `< 0.45` past day 1 toasts once (`ruthNoticed`), the Brief staffing row gains `ask her what's wrong` → cause reads yesterday (`balked > 50` = rush, else opens) → `promise her tomorrow off` locks `ruthRestDay` (clamped to the week). Rest morning forces `home` staffing; the morning after, `ruthReturned` promotes a walk-in head to visits 5 / regular. All four flags reset on campaign restart.
- **Idris's arc** (`web/js/letter.js` + `main.js`): `buildIdrisMemory(snap)` quotes real state — last hedge vs board move, settled tabs, ignored `rumour_frost` rides, house lot roast/age, top regular (visits > 5), loyalty at 2+ covers. Five guarded lines in `composeLetter` (silent when `s.idris` absent — old snapshots never crash). Letter modal gains the only A/B in the game: `renderIdrisAsk` offers a 60-cup Gesha hold at board when the window is open, till-checked, once (`idrisHeldSack`). Loyalty alpha: `frost_minas` + 2 covers opens Gesha a day early. Ledger (`contractsTaken/settledCount/ignoredAdvice/heldSack/lastHedge`) resets on restart.
- **Sam's season** (`main.js` + `patrons.js`): `samGrudge {cuts,preps,snubs}` tallies all week from `rivalReact` (headless still skips), chalkboard counts the season from 2 incidents (`TRY HARDER`). Day-3 pre-wave truce beat: split Saturday (ceasefire: `truceCeasefire` gates both rival-spawn + 70% walk-out defection paths, Saturday volume ×0.92) vs play on (+1 snub). Finale prints the season row + ceasefire row; a snubbed Sam breaks DEUCE ties. Season rewinds on reset.
- **Gate:** ruth-arc 6/6 + sam-season 7/7 + idris-arc 8/8 green; touched suites (agency, lot-economy, visible-rivalry) adjusted for grown windows/new serve args, all green; full Phase 1–3 suites re-verified (menu-pricing, roast, waste, patron-arcs, dossier, wire-lots); smoke relational holds; `tsc` clean.

### 2026-09-28 - Phase 3 shipped: econ depth (menu, roast, waste, Ruth's skill)
- **`web/js/menu.js` (new):** 4 drinks (espresso 1pt → filter 3pt → matcha 4pt), cohort order weights (matcha ≈24%, wave intact), ±£1 price bands, 86 board (matcha never 86'd), adaptive milk delivery (wave-sized day 1, history-sized after).
- **Bar spends drink points** (filter is the throughput trap), tickets price by drink at counter + register, milky orders need milk stock (dry bar balks, flagged once).
- **Roast program:** per-lot 1–5 stepper in the cellar (ideal-distance quality), scorch incident (£18 re-roast vs serve-dark-all-day), dawn clears scorch.
- **Ruth's skill:** cumulative training → +bar points, halves sour nudges at 1, nurses beans at 2. Compost (age>3, finale-binding) + milk tipping print on the receipt.
- **Gate:** menu-pricing 9 + roast 9 + waste 6 green; full suite green ex 5 pre-existing; smoke holds after a real catch (day-1 milk floor 120 starved the sim — wave-sized delivery fixed it, balks back to ~310); balance-policies green in 81s; tsc clean. Two legacy-safety fixes: milk guards skip ctx objects without milk fields, drink falls back to wantsMatcha.
- Deployed dev + prod + site (functions changed).

### 2026-09-28 - Phase 2 shipped: econ core (named lots, freshness, wire-to-shelf)
- **`web/js/lots.js` (new):** 4-lot catalog (Cerrado £0.95 / Huila £1.30 == legacy baseline / Yirgacheffe £1.90 / Gesha £3.20 microlot capped at 60), freshness curve (1 → 0.85 → stale past day 2), serve nudges (affinity-scaled warmth, flat stale penalty + reason strings), adaptive restock (yesterday +25%), stock cascade + emergency sack, wire schedule with landing lags, frost-aftermath Gesha unlock.
- **Bean engine swap:** `purchaseCup(kind)` — matcha keeps legacy math, other cups pour the house lot under cash-basis books (dawn top-up is the expense, poured cups carry display cost like batch prep). Contracts cover top-ups at the locked price.
- **Brief cellar picker + commit** (house pills with price/stock/freshness, restock/double/skip, staged like stagedPrep), stale sours roster opinions with namedrop toasts, Gesha easter-egg tie-in (GRUNDS code unlocks the microlot).
- **Server mirror:** `lots` + `lotMoves` tables, `lots.ts` (ensure/buy/schedule/land), `openDay` lands moves + returns lotReport, `gameConfig` LOT mirror.
- **Gate:** lot-economy 14/14 + wire-lots 7/7 green; full suite green ex 5 pre-existing; smoke relational holds (de-flaked frames 950 → 1150 after proving wall-clock flake with back-to-back runs); balance-policies green incl. determinism + ledger reconciliation; tsc clean.
- Deployed dev + prod + site (functions changed).

### 2026-09-28 - Phase 1 shipped: character core (identity, stages, dossiers, board)
- **`web/js/identity.js` (new):** stage machine (visitor → evangelist, visits + op gates, demote-one-from-earned), per-cohort walk-in name/drink pools, deterministic `WalkinPool` (24 heads/day, known faces carry), memory lines, dossier text, companion gate, WOM math.
- **Floor:** spawn attaches identity (canon roster or pool draw), friends bring a +1 (one-level recursion guard), greetings speak from history, sitters stay-mark their last event, clicks on sitters open dossiers.
- **Board + dossier modals** (`#regulars`, `#dossier`, HUD `☕ regulars` button, mood-mapped portraits), hover names the relationship.
- **Server mirror:** `regulars` gains optional stage/visits/faceSeed/drink/homeTable, `resolveDay` restages post-contagion (exact client mirror), `markSeen` returns history, `ensureIdentityFields` backfills. Canon drinks quirk-derived both sides.
- **Gate:** patron-arcs 17/17 + dossier 9/9 green; full suite green ex 5 pre-existing; smoke relational holds (companions shift absolute balks); balance-policies green (~200s); tsc clean. Two real catches: demotion collapsed history (fixed: demote from earned stage) and a stray-brace syntax break.
- Deployed dev + prod + site (functions changed).

### 2026-09-28 - Playtest verdict + depth rebuild adopted
A few people played the prod build. Verdict: "kinda liked it but didn't love
it" — no connection to specific characters, storytelling didn't land, visuals
need more craft, and the economy needs more teeth (especially the coffee
itself). Diagnosis: the game simulates richly but surfaces thinly — opinions
move with no face attached, waste is tracked but never shown, Sam reacts but
resets daily. Decision: build the long-term depth version, not cheap fixes.
The full 6-phase plan (art lock + portraits → character core → lot economy →
menu/roast/waste → Ruth/Idris/Sam arcs → visual payoff → calibration,
4–6 weeks, mobile shell in parallel with Phase 0) is now the roadmap in
`ARCHITECTURE.md` ("Depth rebuild roadmap"). Guiding rule: surface the
simulation — if a feature doesn't make you know someone, taste something, or
fear something, it doesn't ship.

### 2026-09-28 - Working tree - Morning-prep polish: radio picker + seated prop poses
Two residual nits from the PR-A1/A2 session, closed.
- **Radio-style staged prep:** the Brief's two independent prep toggles become a three-pill radio (`hold steady` / `pre-batch 40 cups` / `cut matcha to £4.20`) — clicking sets `stagedPrep` atomically, so only one lever is ever staged. `applyStagedPrep()` simplifies to two direct fires (the conflict-warning toasts were dead code once both-keys-true became impossible). Hint copy updated to "pick one morning lever". `web/test/brief-staged-prep.mjs` gains a radio-exclusivity test.
- **Seated prop poses:** `_placeProp()` takes `propKey + sitting` — a seated creative's laptop drops to lap height and tilts forward (-0.55), a seated tourist's camera rises to eye level (+0.18), instead of both hanging in front of the chest. Standing pose unchanged. `web/test/cohort-prop-rigs.mjs` gains two sitting-pose tests.
- **Gate:** fast suites green (5 pre-existing failures — decisions/game-feel/identity/intel/modals — verified identical on the clean tree), `tsc --noEmit` clean, balance-policies green.

### 2026-09-27 (evening) - 6cd6e2f + 8dafcf1 - The rivalry trilogy + Sam's reactive cameo
- **PR-B1 visible rivalry:** the brief shows yesterday's served counts side-by-side, Sam's chalkboard strategy, a mid-day "you vs Sam" line, and a week-end verdict receipt. `web/test/visible-rivalry.mjs`.
- **PR-B2 reactive AI:** player pre-batch makes Sam grind harder (+1.5 rival credit), player reprice makes him undercut by £0.10 on his chalkboard — `rivalReactLog` replays it tomorrow morning. `web/test/rival-reactivity.mjs`.
- **PR-B3 weekly stakes:** `campaignClose` computes cServed vs cRivalServed + cRivalChoices — player wins → FOR LEASE on Sam's spot; Sam wins → Sam absorbs; tie → DEUCE. `web/test/weekly-stakes.mjs`.
- **Sam's reactive cameo (8dafcf1):** when the player undercuts, Sam's silhouette walks to his chalkboard and flips it on camera (`W.rivalReactUntil` ~1.9s window, sine-pulse lean, camera push-in, BOARD FLIPPED chapter card). Pre-batch react stays invisible by design. `web/test/sam-reactive-cameo.mjs`.
- **PR-A1 + PR-A2 (75abada):** brief-staged prep UI (two toggle pills, `stagedPrep = {batch, reprice}`, fired at commit with `asPlanned: true`) and cohort prop rigs (7 real InstancedMeshes, 7 body anchors, zero-scaled at startup + `_despawn`). `web/test/brief-staged-prep.mjs`, `web/test/cohort-prop-rigs.mjs`.

### 2026-09-27 - Working tree - The RevenueCat depth pass + Ship-a-ton surface
Eleven PRs in one stretch — each with its own headless suite. Gate grew **30 → 41 headless suites / 88 new assertions**, `tsc --noEmit` clean, all changes staged for the next deploy.
- **Game-design tunes:** asymmetric bias clamp (low-side floor only, high-side rides through), pity timer day-gated to `<4` so the first three dawns are learnable. `web/test/clamp-asymmetry.mjs`.
- **Perk balance:** `ex-accountant` 0.85 → 0.90, `newcomer` opWarm 0.25 → 0.18 — actual measured spread £132 (well below the £1,500 wrecking threshold). `web/test/perk-balance.mjs`.
- **Time-locked levers:** once the Morning Brief commits, the prep / reprice levers lock for the day. Mid-rush presses route through `chargeLeverOverride()`: **£4.20 from the till + −0.06 opinion on every named regular**. Refused when till can't cover. `web/test/time-locked-levers.mjs`.
- **Cohort rituals:** `COHORTS` table gains `props / seat / dwellMul / walkSpeed`. Each cohort has a unique primary prop (briefcase / laptop+mug / backpack+notebook / cane / camera). `_afterServe` prefers the cohort's seat before random. Floor reads five rooms by walk speed + dwell alone; rig meshes landed in 75abada (PR-A2) with seated laptop/camera poses in the Sept-28 polish. `web/test/cohort-rituals.mjs`, `web/test/cohort-prop-rigs.mjs`.
- **Per-beat sponsor captions:** five `.beat-powered` slots (`#brief-powered`, `#offer-powered`, `#wave-powered`, `#evening-powered`, `#verdict-powered`) wired at the actual beats. `web/test/sponsor-captions.mjs`.
- **`?demo=1` autoplay:** showfloor-screen self-running demo — resolves the seven modals with a 1.5s grace, auto-fires `doPhoto()` at dayMin 1080, yields to any keypress. `web/test/showfloor-autoplay.mjs`.
- **RevenueCat depth (Ship-a-ton surface):**
  - `billing.js` rewrite: `ENTITLEMENTS`, `PRODUCTS`, `TIER_PRICING` map; multi-tier pricing (monthly £4.99 / yearly £39.99 / founder £99); `_pickPackage()` with identifier heuristics so the Web Test Store and the native SDK converge on the same SKUs.
  - **Founder entitlement** (`district_founder`): `founderReplay()` writes a `SEED_OVERRIDE` so the founder can replay the week with the same seed; share-card founder variant (gold-leaf stamp + "DISTRICT FOUNDER · SEED N").
  - **Multi-placement paywall:** `#brief-insider-upsell`, `#offer-insider-upsell`, `#verdict-upsell`, `#pc-founder-upsell` — wired to `billing.onChange()`. Not blocking modals, upsell strips at the decision points.
  - **Web Customer Center** `#customer-center`: status header, restore, test-cancel, portal link. Tier-label contract `founder > insider > free`.
  - **Convex backend sync** (`convex/revenuecat.ts` + new `entitlements` table + three new HTTP routes): `POST /revenuecat/webhook` (bearer-auth, returns 503 when unconfigured), `GET /sync/entitlements`, `POST /sync/setEntitlement`. Idempotent by `event.id`. `web/test/revenuecat-sync.mjs`.
- **Honest Ship-a-ton read:** the RevenueCat **surface** is submission-ready. What gates the submission is the **mobile shell** — Capacitor wrap, App Store / Play Store listing, native SDK. None of that needs new game logic; it's a wrap + a listing + a SDK swap.
- **Gate:** `node --test web/test/<name>.mjs` for each new suite (11 new), `tsc --noEmit` clean. `convex/_generated/api.d.ts` updated to register `revenuecat` module.

### 2026-09-22 - Working tree - The new-shop arc: consequence made legible
Playtest critique answered: the stand read as making money automatically — no felt costs, no slow open.
- **Quiet open:** `CAMPAIGN.demand.start` 0.55 → 0.28 — day-1 spawn ≈0.65× (was ≈0.9×), a trickle of curious walk-ins instead of a going concern; street work now visibly buys tomorrow's crowd. Day-1 letter reframed: "the street doesn't know your name — a few will try you on a whim."
- **The nut (`#brief-nut`):** the Morning Brief prints the fixed daily bill before a cup pours — wage £96 + pitch £180+ + sundries £48 = £324 — against what's in hand ("you're £N in hand / underwater"), computed live from the campaign ledger.
- **First-timers:** patrons the Regulars graph doesn't know (`regularIdx < 0`) are counted through the served/balked event stream — "a first-timer — the street's trying you" / "a first-timer walked — first impressions travel" toasts (2/day caps) plus two receipt lines: "first-timers N tried · M walked out" and "word of mouth ~R back tomorrow" from the demand return-rate.
- Gate 27/27, `tsc` clean, deployed and verified live (`config.js` serves `start: 0.28`).

### 2026-09-22 - Working tree - The demo re-cut: the Sep-19 build on camera
- **`videos/grunds-demo/scripts/record2.mjs` (new):** three more scripted Playwright passes against the live site. `d-halo` idles the floor until the brass halo pulses under the same target the goal strip names. `e-photo-card` presses `p`, waits out the bake, then drives the `pc-save` download so `capture/assets/share-card.png` is the real `buildShareCard` output — the composition shows the card itself, not a mockup. `f-letter-theater` plays a full day at 20×, posts the letter to the second AgentMail inbox, then fires an inbound reply through the `/agentmail/webhook` shared-secret path — the reply lands mid-read and the letter grows a "✉ Idris replied" line while the flag/knock/envelope play behind the modal.
- **Recording hardening:** Playwright's video finalize hung on `ctx.close()` with a saturated encode (one ~28-minute hang silently ate the theater tail). Both record scripts now race context/browser close against a watchdog and screenshot the end state to `capture/shots/`, so a hung pipe can't eat the evidence.
- **The new cut:** `index.html` rebuilt to 108 s across 11 beats — title → licence → brief → 20× day → halo → letter post → reply theater → wire desk → live board → photo mode → the stamped card → end card. `npm run check` clean; rendered `renders/grunds-demo_2026-09-22_02-48-00.mp4` (48.7 MB, 1:48). The full sponsor loop is now on camera: Firecrawl wire → OpenAI why → Convex live state → AgentMail round-trip.

### 2026-09-19 - 534eef6 - The delight pass: five durable features, one architecture spine
Five committed features (206a5a4 → 534eef6), each with its own headless suite — the gate grew 20 → 26/26, `tsc` clean, functions + site redeployed and verified live.
- **Vitality spine (206a5a4):** `web/js/director.js` — a per-frame layer registry that runs strictly AFTER `world.updateTimeOfDay`/`sky.update` (every modulation target is rewritten each frame; layers read-modify-write, never cache). `web/js/vitality.js`: 0.65·awareness + 0.35·reputation as a smoothed 0–1 signal that dims lamps, sky sun/stars, and the audio murmur/pad — audiovisual skin only, provably never touching `demand.spawnMul` (no mechanical double-count, test-enforced).
- **Idle guidance (bdaad4a):** `web/js/nextAction.js` is the single next-action source feeding the `#goal` strip and the brief row, so text and pointer can't drift; `web/js/halo.js` pulses a brass ground ring at the chalkboard / street / mailbox after 4.5 s of no intent (pure `shouldHalo` predicate; keyboard intent counted too).
- **Kit arrival beat (ccc7334):** `districtGen.js` gained a `grown` signal — `onGrown` fires exactly once when every successful slot has placed; `web/js/kitArrival.js` plays it: cart rolls in from off-street, pendant/lamp lights strike slot-by-slot, fanfare + "the block got its kit" toast. A kit already grown at load stays a quiet crossfade (policy lives in main.js, districtGen stays game-state-free). Reduced motion → toast + soft fanfare, no motion.
- **Letter arrives as theater (c4f3284, Convex):** `letters` gains `dir/action/from/createdAt` + the `by_campaign_dir_created` index; `agentmail.latestInbox` (after-cursor, pre-migration rows never surface) served by a read-only `GET /agentmail/inbox` — handleInbound stays the only writer of the mechanical move (mirror ≠ second rule). Client: `sync.inbox()` self-throttled ~8 s while a posted letter is pending → `web/js/mailTheater.js` lerps the mailbox flag up, `audio.knock3()` (refactored `_hammerTap` scheduling), drops an envelope sprite (`letterSprite()` bake), toasts; armed on post, disarmed at dawn so the wait never crosses onto a live floor. Proved end-to-end on the dev deployment: seeded inbound reply → round-trip through the route → cursor suppresses it.
- **Stamped share card (534eef6):** photo mode now captures via `postfx.render` before `drawImage` (fixing a real bug — printed cards silently skipped bloom + vignette) and bakes a 1280×720 card in `web/js/shareCard.js`: cream stock + rng grain, double rule + brass corners (rent-sign idiom), cover-cropped snapshot, caption band, rotated red "GRUNDS · SEED N" rubber stamp — pure on an injected 2D context, so a recording stub asserts paper→pixels→band→stamp order. `#photo-actions` row: ↓ save (seeded filename) / 𝕏 share (Web Share Level 2 with files, X-intent fallback, cancel-aware) / ⧉ copy caption — each degrading independently; the dim holds until an action or 6 s.

### 2026-09-19 - Working tree - The unblockable district: classic escape hatch, kit pre-warm, budget refunds
- **`?classicDistrict` built** (aliases `?noDistrict`/`?nogen`): `districtGen.js` gains a pure `districtOptOut()` gate threaded from `main.js` — an explicit opt-out makes zero network calls, so any judge/offline demo plays the procedural street. New `web/test/district.mjs` (20 assertions) pins the gate, the headless/no-GL/no-base fallbacks, and the slot contract; gate **20/20**, `tsc` clean, site re-uploaded.
- **`tools/mint-pipeline.mjs` (new):** pre-warms district kits through the live `district:ensure`/`district:kit` path (shared prompt source with `convex/district.ts`), kicking the `mint:reaper` action on demand instead of the hourly cron; writes `out/district-manifest.json`. Hero seed 7 verified 5/5 grown + cached; photo-mode captions now carry the seed.
- **Convex fix — spend guard honesty:** `apiCache.refundDaily` (new mutation) returns a daily budget slot when an upstream generation fails *unbilled* (Mint's safety check began refusing new-seed creation at task start — seed 11/23 kits stuck `missing`, classic stand-in holds by design); wired into `mint.generate` + `tripo.generate` catch paths and verified live (counter stays 0 across repeated flakes). `MINT_DAILY_BUDGET` 25→40. Convex features: mutations, actions, crons untouched.

### 2026-09-17 - c8fc9fa - Demand stocks: awareness decays, street work buys it back, loyalty returns
- **`web/js/demand.js` (new):** two stocks, one funnel. Awareness (0..1) multiplies wave spawn rate (0.4×–1.3×); it decays every `closeDay` (extra on catastrophe events) and dawn-staged street work buys it back — chalk (free), sampling (costs cups), sponsor (£ from till, unlocks day 3+), committed the next morning.
- **Loyalty is reputation re-explained as a return rate:** `Demand.returnRateFor(reputation)` (+ `regulars.js` live-stock version) — a share of yesterday's served reappear at today's dawn, spread across the waves. HUD tape shows awareness pips (●●●○○); the receipt prints the decay/gain trace.
- Pure + deterministic — the sim owns commit timing, the module owns the numbers. New `web/test/demand.mjs` pins every constant through `CAMPAIGN.demand`; gate **19/19**, `tsc` clean.

### 2026-09-17 - 3695bf1 - The generative district goes live (seed-7 kit) + Morning Brief disclosure pass
- **Seed → street, deployed:** `convex/district.ts` + `web/js/districtGen.js` — a mulberry32 seed derives a deterministic 5-slot kit spec (silhouette-first word banks, house style, no-text guard); `/district/kit` + `/district/ensure` serve content-keyed get-or-create via `convex/mint.ts` (Mint, `MINT_DAILY_BUDGET=25`). Seed 7 pre-warmed 5/5, GLBs URL-verified; fresh seeds read `missing` and self-grow on first visit.
- **Provider-agnostic spine:** `tripoAssets` gains a `provider` field — Mint generates today, the Tripo v3 adapter (`convex/tripo.ts`, `verifyTripo` webhook + reaper cron) flips in if credits land (Sep 18 gate). Mint has no seed params, so District Seed determinism is key memoization: generate once per seed, cache forever — same seed, same street.
- **Client cross-fades** generated GLBs over the procedural base with per-slot scale normalization; `?classicDistrict` + failure fallback keep the demo unblockable.
- **Morning Brief progressive disclosure:** news-only letter (sizing paragraph + wire citation de-duped into buttons/wire), wire folded into `<details>`, `decide — size the position` over the commit row — plus an honesty fix: day 1 no longer prints a phantom "Spot closed up N%" (the tape needs a yesterday).
- Agency + smoke PASS, live; gate 18/18 at this commit. Tripothon build log started alongside: `TRIPOTHON-LOG.md`, plan in `TRIPOTHON.md`.

### 2026-09-15 - The demo video: real gameplay, sponsor loop end-to-end
The three-minute cap needed the product, not a pitch reel — so `videos/grunds-demo` is a HyperFrames composition assembled from Playwright-recorded live gameplay at 1920×1080, not mockups.
- **`scripts/record.mjs`** drives the real site through three clips: (a) licence → tutorial → Morning Brief → hedge → floor, (b) a full day at 20× → Roaster's Letter → "post this letter to…" (AgentMail), (c) the Wire desk with `linkup`/`firecrawl` origin tags. Recording gotchas that mattered: `#open` stays `disabled` until the GLBs place (DOM clicks on disabled buttons are silent no-ops), and Playwright's actionability wait stalls on the animating overlays — direct `el.click()` evals everywhere.
- **`index.html`** sequences six trimmed segments (~95s) under Iowan caption cards: licence → brief → the day at 20× → the letter and its post row → the wire desk → the live district board → end card with the `convex.site` URL and the sponsor roll. Music bed is a synthesized pad (ffmpeg) — voiceover deliberately held until the cut is approved.
- **A real bug fell out of recording:** typing an email into the post row fired global game keys — the `r` in an address ran `reset()` and wiped the campaign mid-keystroke. `main.js`'s keydown handler now returns early when the target is an input/textarea (after the licence gate, which still owns Enter-to-sign inside its own fields). Verified live: the letter stays open while `[redacted inbox]` types in.
- Gate unchanged (18/18), `npm run check` clean (0 findings), deployed with the fix.

### 2026-09-14 - The roaster is a real mailbox — AgentMail end-to-end
AgentMail goes from half-wired webhook to the demo's best sponsor story: the Roaster's Letter is now literal post.
- **Provisioned the roaster inbox** ([redacted inbox], "Idris Grunds") + a real `message.received` webhook (`ep_3JKWZvxq…`, Svix-signed, inbox-filtered) pointed at `/agentmail/webhook`.
- **Send path:** `POST /agentmail/letter` → `agentmail.sendLetter` mails the exact letter body the player sees (+ a `reply: contract · hold · settle` footer), records thread + recipient → campaign mappings (apiCache, 30d) and archives outbound in `letters`. The letter modal gains a paper-styled "post this letter to…" row (sync-gated; address persists in `grunds.mail`).
- **Reply path:** the webhook now verifies real Svix signatures (`verifySvix` — HMAC-SHA256 over `id.ts.body` with the `whsec_` key), parses `message.received`, resolves the campaign via `resolveThread` (thread id → sender address fallback), applies `handleInbound` (contract/hold/settle), and **Idris acknowledges by return post** — "Done — the beans are locked at today's board." Self-delivery guarded against ack loops; the legacy shared-secret path stays for manual tests.
- **Verified with real mail:** letter delivered to a second AgentMail inbox → replied "contract — lock me in" → campaign updated live (debt +£22 fee, 2400 units locked at 1.25) → ack received in the player's inbox → all three pieces of correspondence in `letters`.
- Gate **18/18** (`intel.mjs` new MAIL block), `tsc` clean, functions + site live.

### 2026-09-14 - The Wire: Firecrawl + OpenAI join the loop
The All Gas judge brief wants OpenAI, Firecrawl, and AgentMail doing real work — two of those pipes were built but dormant (`/ai/research` served Linkup only; OpenAI was dead code). Now the sponsor chain is literal: **Firecrawl crawls → Linkup searches → OpenAI explains → Convex serves → the player reads it at dawn.**
- **`convex/research.ts` (new):** `wireResearch` fans out to both pipes in parallel, merges source lists with `origin` tags (`linkup` / `firecrawl`), and unions `marketShift` suggestions per `eventId` — when both pipes flag the same event the tilt lifts ~15% as `corroborated` instead of stacking multiplicatively. OpenAI `wireWhy` (`gpt-4o-mini`, ≤25 words, 7-day input-hash cache) writes the "why this matters" line under the lead tilt. Merged payload caches at `research:wire:v1:<hash>`; each pipe falls back independently — a dead key degrades to the other pipe, never an error.
- **Firecrawl graduates to rich sources:** crawled items now carry `{title, url, snippet}` (with a `titleFromUrl` slug fallback for titleless results) so the Brief and the desk can link them properly, and keyword-mapped suggestions stay `KEYWORD_MAP`-driven.
- **Server + client consume the merge:** `exchange.openDay` reads `research:wire:v1:` first, `linkup:research:v1:` as fallback; `GET /ai/research` routes to the merged action; crons now run Firecrawl 06:00 → Linkup 06:15 → `wire-merge-refresh` 06:30 UTC so dawn reads a warm cache; Brief + desk rows print the origin tag (`… · stir-tea-coffee.com · firecrawl`).
- **Verified live:** `GET /ai/research` on prod returns `feed:["linkup","firecrawl"]`, a `drought_ea` corroborated tilt (Linkup 1.5 × 1.15 = 1.725), and firecrawl-origin headlines; `why` fills once `OPENAI_API_KEY` lands — the field degrades to `""` cleanly until then.
- Gate **18/18** (`intel.mjs` new WIRE block: fan-out, corroboration, wireWhy, merge cache key, origin tags), `tsc` clean, functions + site deployed.

### 2026-09-14 - The pitch licence: sign yourself into the week
A playtester asked for a personalisation stage — a name, a role. The caveat we kept: it's friction at the worst possible point, so it's a fiction beat, not a form, and one keystroke signs it.
- **`#licence` before the tutorial:** a district-office paper card over the diorama — pen-line inputs for name + stand name (defaults: Sam, THE CORNER CUP), a cosmetic role (`the new owner` / `the manager` / `the name on the lease`), and four backgrounds with one small perk each — `ex-barista` (bar +8%), `ex-accountant` (fees & payouts −15% — card fees *and* every incident `accept`), `new to the trade` (regulars open warmer, op 0.25), `a market regular` (the Brief whispers the wire's *direction* — qualitative only, the × stays insider).
- **The signature threads the fiction:** `composeLetter` opens `Dear Ada,` and closes `…what do you want to do, Ada?`; nightly + finale receipts print the stand; tutorial step 1 titles `WATCH THE CLOCK, ADA`; and `convexSync` now reads `ownerName()` live so `localStorage` `grunds.owner` = the stand name lands on the district board at the next mirror.
- **The caveats held:** Enter/Escape signs with defaults (no required typing), ~10 seconds, `localStorage` `grunds.identity` pre-fills on return visits, `?skipLicence`/`?skipTutorial`/headless all bypass — the harness never stalls.
- Gate **18/18** — new `identity.mjs` proves the modal, the threading (letter salutation + close, receipts, owner), all four perks, and the skip paths. `tsc` clean, site uploaded.

### 2026-09-14 - Ruth: the staff layer, kept thin on purpose
The ask was staff management — tired baristas, morale contagion, away days, holidays. The honest answer for a 5-day arc: one face, one hidden stat, no roster. Morale needs time to compound; a week gives it two beats.
- **One named barista, one hidden `baristaCondition` (0–1):** a worked shift drains −0.14 (+0.08 on a `peakQueue>50` day, +0.06 on a `balked>60` day); a sent-home day recovers +0.45. Never a meter — the fiction carries it.
- **The Brief carries the choice:** under 0.55 (day 2+), `#brief-staff` appears in the Morning Brief — *send her home* (`staffMul 0.7` solo bar today, her `staffDayRate` saved on tonight's cost sheet, +0.45 at close) vs *push on* (full pace now, deeper drain). Both branches are real trades — mercy buys quiet days, denial buys risk.
- **Neglect has teeth:** below 0.35 her legs slow the dawn bar to 0.8×; pushed under 0.2 she breaks mid-afternoon — a coin toss between *asleep on the back counter* (`staffMul 0.5`, the bar crawls) and *snapping at a regular* (`adjustOpinions −0.2`, the room goes cold).
- **The incident table reads her state:** the sick-call is hers now — she can't phone in sick on a day you already sent her home (rotation slides to the next incident), and at <0.4 condition the call isn't a sick day, it's a warning shot with a −60% decline. Named in the table as `Ruth, your barista`.
- **Two Brief bugs fixed in the same pass:** the letter at dawn read post-reset zeros — `lastDayStats` captured at `closeDay` now feeds the snap (`sold: null` on day 1 prints an opening-day line instead of "0 cups"); and the tutorial crane-settle timer could unpause the floor *behind* an open Brief — now guarded on `#brief.show`.
- Gate **17/17** (`agency.mjs` RUTH block: condition gate, both branches, crisis, incident interplay, reset), `tsc` clean.

### 2026-09-14 - The Drug Wars turn: a real dawn, a real hedge, real consequences
Playtesters nailed it: beautiful but no turns — info, plan, and execute all blurred while the clock ran. Now dawn *pauses* so every headline becomes a priced position, and midday asks you to choose a person.
- **Morning Brief — `06:00 [PAUSED]` (#brief, the Drug Wars turn):** at every `openDay(d)` after the tutorial, `main.js` builds a one-screen brief: Idris's prose (`forecastForDay`, tilted by the same Linkup bias that moves the ticker) with tape delta, a **76px bean sparkline** from `exchange.history` (en-dashed today's price, red/green by `marketIntel.marketShift`), clickable wire headlines (host + one-line why — Nebius gossip voice when available) or a warm “no fresh wire” fallback, and **five sized reply pills** (`light £11 ~1200` / `standard £22 ~2400` / `heavy £44 ~4800` / `hold` / `settle`) that stage then commit on `OPEN FOR DAY →`. While `#brief` is open the floor is frozen (`briefPaused`); `dismissBriefAndStartDay` commits `contractBeans(units, fee)` + `contractFeeExtra` and resumes at `06:00`. Night Letter still owns `settle` + next-day drift preview; day is the hedge, night is the debt. `?skipBrief` / `_pricePreview(spot)` / headless-safe (Brief never opens in tests; 5-action Letter stays the API). `agency.mjs` now gates `BRIEF + sparkline + staged commit`.
- **Sizing is the position (the real agency fix):** `LETTER` 4→5 actions, `exchange.contractBeans(units, fee)` now parameterized with `CONTRACT.pricePerCup`, `contractFeeExtra` riding from the COD incident; `consume(n)` burns cup-by-cup so a thin day wastes heavy stock and a thick day starves a light order — that's the Drug Wars feel. Nightly `tapeLine` makes the turn explicit (“board up 12% → lock tonight buys tomorrow at ~today; falling → ride spot”).
- **Incident economy tightened in the same pass:** `INCIDENTS` (days 2+, 14:55–16:55, red-tinted) rotate `(seed+day)%6`: plumber (£45 or +60% balks), sick barista (£55 or −40% prep), dead card machine (£25 or −20% sales), inspector (£30 or −6 rep), solicitor coin toss (£60 or 50/50 £140 at 16:30), COD (£40 or +£18 on next contract). `CAMPAIGN` cost sheet every closeDay: staff £96+£0.62/cup, milk £0.42/cup, rent 12% of till (£180 floor), card 2.6%, sundries £48 → headless no-lever `£31,130 → ~£8.9k net` (~28% margin). Knobs `staffMul/balkMul/cashOnly/contractFeeExtra/solicitorAt` all reset at dawn.
- **Midday dialogue:** `OFFERS` (5, `config.OFFERS` + `W.rivalHeat`) at `11:00` (`isHeadless`/`tutorialActive` gated): Pip wave bonus, Esther free-forever tag, Olu payout, Gwen gesha prebatch, Mara queue-gated rival steal — each y/n in the same `offerPaused` pause path with `analytics.offer_*` / `gossipOfferNudge` (rotating Nebius line when available).
- Gate **17/17**, `tsc` clean, `dist` 43 — `agency.mjs` now the Drug Wars gate (brief + sizing + offers + cost).

### 2026-09-14 - The floor bites back: operating costs + daily incidents
Two pieces of honesty the fantasy needed: the game was all upside, and the
ending number (£31k/week) felt like a jackpot, not a café.
- **The cost sheet (`CAMPAIGN` ops constants):** every closeDay now computes
  a real P&L — staff (£96/day + £0.62/cup), milk+cups (£0.42/cup),
  turnover-linked pitch rent (12% of till, £180 floor), card fees (2.6%),
  sundries (£48/day). Receipt prints all five lines; `cOps` accumulates and
  `netWorth` subtracts it. A headless no-lever campaign: **£31,130 → £8,862**
  (~28% margin — a real café's band, still a strong week).
- **Incidents (`INCIDENTS`, days 2+, post-wave 14:55–16:55):** the same
  pause-and-decide modal as the regular's ask, but these *cost* — plumber
  (£45 or +60% walk-outs), sick barista (£55 cover or bar −40% speed), dead
  card machine (£25 dongle or a fifth of sales die at the till), inspector
  (£30 or −6 rep), solicitor's letter (£60 settle or a 50/50 £140 coin toss
  deferred to 16:30), supplier COD (£40 or +£18 on the next contract).
  Seed-offset rotation; day 1 stays clean for onboarding; red-tinted modal
  variant; `incident_paid`/`incident_risked` analytics.
- **New sim knobs:** `patrons.staffMul` (prep-point throttle), `patrons.balkMul`
  (patience throttle), `regulars.adjustOpinions`, `cashOnly` sale-loss
  fraction, `contractFeeExtra` (rides the next contract), `solicitorAt`
  deferred resolution — all reset per dawn/campaign.
- **Your letter sizing kept:** light/standard/heavy/hold/settle now 5 actions
  (keys 1–5); `agency.mjs` updated for the new ids + incident/cost assertions.
- Gate **17/17**, `tsc` clean, site re-uploaded.

### 2026-09-14 - Inverted wire + ticker board
The paywall was hiding the USP — free players could never *see* the news move prices. Inverted:
- **Desk opens for everyone** (`desk.js renderDesk(intel, subscribed)`): summary + clickable source headlines (real links, `rel=noopener`, host caption) + a free "why this matters" line from the lead shift. Only the quantitative **deck tilt** (× multipliers + per-card reasoning + card names) gates on `commodity_insider` — free readers see a placeholder row naming the boundary.
- **Invite, don't block:** new `#desk-edge` footer in the desk offers `peek the edge →` to non-subscribers (opens the paywall, tracks `paywall_shown`); opens tracked separately as `desk_opened` vs `desk_opened_free`.
- **Ticker board upgrade (`world.js`):** the in-world brass board now draws a **sparkline of the bean-index history** (line + dots + lo/hi labels, today's index included) and a **bias glow** — the board tints warm when the wire amplifies a bad card, green when it loads a good one (`bias` passed price-directional from `updateTicker`, EVENTS tier-aware). `· WIRE` badge + "tap the wire for sources" caption when a tilt is active.
- Paywall perks reworded to sell the gated edge, not the now-free sources. `desk.mjs` updated to assert the inversion. Gate 17/17, `tsc` clean, site re-uploaded.

### 2026-09-14 - Agency pass: the tape, sized contracts, letter stakes, the regular's ask
Playtesters' second pass: "no real dialogue or interactivity mid-day, no sense the market is a thing I can read or act on." The Drug Wars loop — information → plan → execute — existed but was illegible. Five fixes, one coherent change: **make the market a visible object, then make decisions about it sized and personal.**
- **The Tape (`#tape`):** a new HUD line shows `beans 1.15 ↑ +15% · EAST AFRICA SHORT RAINS · wire ↗` — current index, day-over-day delta vs `tapePrev` (stashed at dawn), direction arrow, event name. Clickable → opens the Wire desk when `marketIntel` exists. The market is now a number you *watch*, not a hidden die roll.
- **Letter stakes (`letter.js tapeLine`):** the nightly letter now names the day's spot move (`Spot closed up 15% — ...`) and says what it implies (rising board → lock tonight buys tomorrow at today's price; falling → ride spot). The information→plan→execute turn is now explicit in the fiction.
- **Free market visibility:** the tape + event + wire *scent* hint are free — news visibly moves prices for every player. The paid desk keeps cited sources, exact multipliers, and card names. Information asymmetry stays buyable; basic comprehension doesn't.
- **Sized contracts:** letter now offers four replies — `contract` (light: ½ units, ½ fee — covers the wave), `contract_deep` (2× units, 2× fee — rides into tomorrow), `hold`, `settle`. `exchange.contractBeans(units, fee)` parameterized; the position still burns cup-by-cup and clears at quota. Keys 1–4.
- **The regular's ask (`#offer` modal):** once per day at 11:00 a named regular pauses the floor and makes an offer — Y accepts, N/Esc declines, each with a real simulated consequence: Pip's study group (+22% demand at 14:00), Esther's stamp card (£15 now, her cups free forever), Olu's bridge club (£9 at 12:30 + 4 patrons), Gwen's gesha (20 units for £6.40 into prebatch), Mara's office run (£28 at 15:00 *if* queue < 6 — else they go to GLASSHOUSE). Rotates `(day-1) % 5`; headless-gated so tests don't stall on the pause.
- **Tests/build:** new `web/test/agency.mjs` proves tape wiring, sized contract math, 4-reply letter with delta line, and all five offers' deferred consequences. Gate **17/17**, `tsc` clean, site re-uploaded. (No Convex changes — the `/ai/gossip` route from the prior pass now serves the ask's voice.)

### 2026-09-13 - Delight craft pass: performance + every 10ms detail
The game already read clearly — now it *feels* made. A 4-bucket craft pass: lock 60fps, add weight, add time, add life. No new currencies, no new levers — just the payoff moment you just made legible, made intentional. Two real regressions caught and fixed in the same pass:
- **P0 performance lock (no new systems, pure feel):** `?lite` now auto-enables on `hardwareConcurrency≤4` or `deviceMemory≤4` (no shadows/post-FX without asking); **dynamic lite** trips after 3 frames >32ms mid-wave → kills `shadowMap` + `postfx`; **shadow budget** at `queue>40` disables shadows to save fill-rate at 14:00; `loader.js` GLBs **cross-fade `opacity 0→1` over 400ms** on `place()` resolve (headless-aware `setTimeout` so the main loop's single RAF slot is never stolen); `audio.js` pad **pre-warms `0→0.02 in 600ms →0.055`** so Day 1 isn't silent.
- **Weight (things have mass):** tiny **till drawer** (0.62×0.06 box under register) slides +0.38m for 420ms on every `sale()` plus a **stretching shadow plane** (`scale 1→1.35`, opacity 0→0.18) driven by `world._updateDelight(now)` lerp 0.22; **coins arc** with `vy 0.9–1.4 → gravity` + a `spinZ` 2–3.2 rad encoded as horizontal drift; chalk `screech 1200→900Hz` + 10 chalk huffs now paired with **menu desaturate + 1.02 board wobble** on `flashChalk`.
- **Time (the clock is felt):** `#till` now `font-variant-numeric: tabular-nums` so digits don't jitter; `fx.receipt` **staggers line-by-line at 30ms** (till *prints*) and **typewrites the verdict at 18ms/char** with a `prefers-reduced-motion` bypass; at `1×` a soft **90Hz clock tick** throttles to 0.9s (`audio.tick()`), felt not heard.
- **Life (the shop breathes):** sitters now **sip at `dwell==4`** — arm lifts 0.6rad, head dips -0.04m, lean -0.14, steam puff from `fx.steam`; **street cat Miso** (`world.cat` capsule+head+tail) walks `spawnL→door→tables` at 1.1m/s once/day ~09:30 (`world.spawnCat`/`updateCat`), sits 8s if `queue<4`, scatters if >10 while sitting, meows once per sit via `audio.meow()`; **living plant** (3 spheres over the right planter at -2.2,6.6) tints HSL `0.28→0.10` lush→brown, wilts scale/wilt + emissive when `queue≤5`, driven every HUD tick via `world.setPlantHealth(queue)` + `audio.purr()` 38Hz sine; **rival leans** -0.08rad when `rivalHeat>6` + **jeers** on 5 defections via `world.jeerRival()` (2.2s emissive pulse); **Idris quips** at 10:00 rep≥80 praise / 12:00 rep<62 warn from `COPY.idrisQuips`; **weather as mood** ties `mistMat` + `godRay` quad (18×14 translucent) to `event.tier` (frost 0.22 grey-blue, harvest 0.14 warm shafts).
- **Payoff juice (14:00 now explodes):** at the 17:00 debrief, `saved≥6` → `audio.waveFanfare(saved)` rising major triad (pitch tracks saved) + `rig.focus(counter)` 3.5s crane + `fx.coinRain` 10–22 coins + `fx.victoryBurst` card pop + haptics `[20,30,50]` + `setPlantHealth`; flop → `audio.waveRain` + 35ms buzz. `doReprice()` puffs `fx.chalkDust` + `audio.chalkScreech()`.
- **Coherence & respect:** hover a patron → **story card** (`nearestPatronAt` projects every `inQueue`/`sit` patron, 36px radius, shows `Mara — flat white · op ♥0.42 · friends: Dev, Olu`; click to wave → `+0.06` op + bubble + 20ms haptic); `P` / 📷 **photo mode** freezes at golden hour (`dayMin=1080`, `world.updateTimeOfDay`), renders to 720×405 canvas with vignette + caption, downloads `grunds-day1.png`, `audio.shutter()` click+thump; `GRUNDS` secret → **Gwen gesha £7.80** flashes 4.2s then reverts, persists as a next-day toast (`exchange.geshaUnlocked`); queue bar now **heartbeats** at >10 and **purrs** at ≤5; `@media (prefers-reduced-motion: reduce)` now also kills `heartbeat`/`purr` + vignette.
- **Two regressions fixed (would have shipped broken):** (1) **`reputation NaN` → `campaign-tight` filtered `regulars[]` (`Tomas`/`Yuki` out), then `opContagion` indexed by sparse `r.i` into a dense array → `undefined op` → `NaN` contagion → `reputation NaN` → `footfallMul NaN` → dawn spawns killed the loop.** Fixed `regulars.js:opContagion` to use `Map<i→op>` + `find(rr.i===f)` + `Number.isFinite` guard.** (2) **RAF steal at campaign close → `fx.receipt` used `requestAnimationFrame` inside the row loop. Headless harness owns the single RAF slot (`rafCb = cb`) — one extra RAF overwrote `loop` → `runFrames` saw `null`. Fixed with `isHeadless` branch (sync + `setTimeout` stagger).** Verified headless before/after.
- **Tests/build:** gate **16/16**, `tsc` clean, `dist` 43 files (`web/js/desk.js` now shipped). `smoke`: cold 555→433 balks with levers holds.

### 2026-09-13 - Calm open, tutorial, payoff legibility, analytics & polish
P0 design fix for "looks crazy on launch / don't know what to do" — pacing, onboarding, and payoff all made legible, plus the measurement and replay hooks that prove it:
- **Calm open (pacing):** default speed **1× (60)** for new players (`?speed=300/1200` still honored, headless stays at 5×); day-1 first 12 sim-min demand ×0.5 + morning (<10:00) ×0.52 so the queue trickles while eyes settle; gossip throttled to 10% in the calm window (35%→14% at 20× otherwise); `WALK_MUL` eased to 1/3/6; camera breath muted 7s after `crane()` (`_calm` factor 0.25→1) — street reads as curated, not handheld.
- **3-step tutorial (paused start):** `OPEN` → 3-step card overlay (Read 14:00 / Lever 1+2 / Keep 5 vs GLASSHOUSE, `Enter`/`Space`/`Esc` + Skip) → 3.4s paused crane settle before first tick; bypassed via `?skipTutorial`/`?notutorial`/headless; bypassed sim still gates on `!tutorialActive`.
- **Goal-first HUD:** new brass `#goal` strip ("Keep the queue under 5 · 14:00… Hit 1 to batch"), `#queuebar` health bar (ok/warm/hot + "queue 7/12 — watch it"), `#batchcount` pulse on change; levers pulse `attention` until first use on day 1; chalkboard flashes brass/matcha via new `world.flashChalk(kind)` + `W.menuMat` emissive.
- **Lever prediction on press:** `doPrebatch()` shows `Chalkboard: 12 → ~6 by 14:00 with 40 warm cups` and flips the goal bar to live status; `doReprice()` toasts "New price holds the line" — `-£4.20` now reads as investment.
- **14:00 wave debrief (payoff):** new `fx.debriefCard()` at 17:00 (dayMin≥1020, once/day) — `14:00 — THE WAVE` with `balk / served` vs counterfactual `Without it: ~Z would have walked · saved ~£XX` and a verdict (`You held the line.` / `Try 1 before noon tomorrow`); also toasts saved cups.
- **Day-2 forecast (replay hook):** toast at 17:30 day 1 (`Forecast Day 2: … board 1.05 · matcha £4.95 — you'll choose at closing`) + brass `#r-forecast` stripe on the day-1 Z-read receipt — preview is truthful (`priceForDay(2)`, `drift.perDay`).
- **Notebook earlier + coach earlier:** notebook pinned at 06:01 day 1 (read arrives before the rush); day-1 coach moved to **12:00** (was 13:00), halfway between noon reading and 14:00 wave.
- **Analytics (playtest measurement):** new `web/js/analytics.js` — offline-first, localStorage, `__grunds.analytics.summary()`; events `tutorial_step/skip/complete`, `first_lever_at_min`, `lever_batch/reprice`, `day1_balk`/`balk` (throttled in console), `wave_debrief_shown`, `forecast_shown`; boot prints 5-question script (`time-to-first-lever <90s`, `% who press 1/2 before 14:00`, `can they say win condition`).
- **Share virality framing:** `share.js` now leads with outcomes the player caused (`Held the line — 320 served, 12 walked (4%)` / `Beat GLASSHOUSE`) not just `£42`; `campaignClose()` passes `served`,`balked`,`beatGlasshouse`.
- **Mobile + a11y:** `touch-action:none` already; `index.html` adds `@media (prefers-reduced-motion: reduce)` killing grain/pulse; `camera.js` breath scales to 0 under `prefers-reduced-motion`; distal HUD `#district` + receipt `#r-stands` leaderboard surface (`refreshStands()` after each dawn/close/finale); `__grunds.analytics` exposed for console QA.
- **Convex parity:** `convex/exchange.ts` `openDay(bias)` + `convex/linkup.ts` `LINKUP_RESEARCH_QUERY` export; server `openDay` reads cached Linkup `marketShift` (clamped 0.2–3×) inside the pity-timer roll; `convex/http.ts` adds `/sync/stands`, `/ai/letter`, `/ai/research`; `convex/crons.ts` adds `linkup-intel-refresh` 06:15 UTC; `convex/nebius.ts` host migrated to `api.tokenfactory.nebius.com` + model `Llama-3.3-70B`.
- **Tests/build:** `web/test/intel.mjs` (bias frequency + pity under bias + citation + route/cron/consumer wiring); `game-feel` coach gate widened to 720|780; loop gate now checks `tutorialActive`; gate **15/15**, `tsc` clean, `dist` 42 files.

### 2026-09-13 - Nebius Token Factory goes live
Wired the Applied AI integration end-to-end ahead of the Burning Token
submission (Applied AI · Nebius challenge):
- Migrated `convex/nebius.ts` off the retired AI Studio host to Token Factory
  (`api.tokenfactory.nebius.com/v1`) and onto a current model
  (`meta-llama/Llama-3.3-70B-Instruct`); key set via `convex env set`, never
  in the repo.
- New `POST /ai/letter` HTTP route (`convex/http.ts`) runs
  `nebius.enhanceLetterNebius` — the Roaster's Letter now gets an
  in-character LLM rewrite with token/latency metrics, cached 7d by input
  hash so replays cost zero.
- `web/js/main.js` `showLetter()` renders the templated letter instantly,
  then swaps in the enhanced prose when the live call returns, signing it
  `— Idris · Llama-3.3-70B · {latency}ms`. Fire-and-forget; offline-safe.
- Verified live: `fallback:false`, 207 tokens, ~12.7s cold (cached after).
  Gate 14/14, site re-uploaded.

### 2026-09-13 - district leaderboard surfaces in the UI
Made the Convex multiplayer visible to anyone playing (Multiplayer · Convex
challenge):
- New `GET /sync/stands?campaignId=` route (`convex/http.ts`) serves
  `stands.topStands` (limit 8) over the same plain-fetch bridge — no client
  lib needed on the static floor.
- `web/js/convexSync.js` gains `stands()`; `web/js/main.js` `refreshStands()`
  runs after each dawn mirror, at day close, and at the week finale.
- HUD gains a `district` line — `1st <owner> £till · you Nth of M` — and the
  Z-read receipt gains a "district standings · live on convex" block with
  the player's row marked "— you". Owner names render via DOM text (no
  innerHTML) since `?stand=` is user input.
- Verified live: two owners mirrored into one campaign return sorted by
  till over `/sync/stands`. Gate 14/14, site re-uploaded.

### 2026-09-13 - Linkup research drives the market deck
Wired Deep Research end-to-end so findings do work, not just sit in a
module (Deep Research · Linkup challenge):
- `GET /ai/research` (`convex/http.ts`) serves `linkup.searchCommodityIntelligence`
  over the plain-fetch bridge; nightly `linkup-intel-refresh` cron keeps the
  6h cache warm alongside the Firecrawl tick.
- Server-side: `exchange.openDay` reads the cached `marketShift` payload and
  multiplies event weights (clamped 0.2–3×) inside the seeded pity-timer
  roll — a frost report genuinely makes frost more likely.
- Client-side: `convexSync.intel()` fetches once per session;
  `web/js/exchange.js` `roll(bias)` applies the same clamped multiplier to
  the floor's own deck, so the played game reacts to live news too.
- The roaster's letter cites the wire — `intelLine` prints
  "Off the wire — <headline> (<domain>)" when sources arrive; a day-1 toast
  names the top market shift.
- New `web/test/intel.mjs`: biased-deck frequency, pity timer under bias,
  citation presence/absence, and route/cron/consumer wiring. Gate 15/15.
- Live with `LINKUP_API_KEY` set via `convex env set`: first real pull
  processed 20 sources, detected `drought_ea` ×1.5 (Brazil drought coverage),
  cited Business Insider/WisdomTree in the letter. Caught and fixed a real
  bug on first pull — corroborating sources produced duplicate shifts that
  would have stacked 1.5^n into the deck; now one multiplier per eventId at
  both producer (`linkup.ts`) and consumer (`exchange.ts`). Gate 15/15.

### 2026-09-13 - District Insider Pass: subscriptions gate the wire
Built the freemium layer (Subscriptions · RevenueCat challenge): the week
stays free; the *edge* is paid.
- **The Wire (research desk)**: `web/js/desk.js` renders the full Linkup
  briefing — every cited source, each deck tilt (`event ×weight`), and the
  reasoning behind tomorrow's roll — gated on the `commodity_insider`
  entitlement. Free players keep the toast + one letter citation;
  subscribers get the desk.
- **Paywall**: `⚡ the wire ↗` HUD button appears once intel lands; a letter
  link ("insiders read the full wire before they choose") sits under the
  reply actions — the upsell surfaces exactly where the hedging decision
  happens. District Insider Pass modal: 3 perks, £4.99/mo, restore +
  dismiss, mode badge.
- **`web/js/billing.js` rewritten**: live path loads
  `@revenuecat/purchases-js` (CDN, pinned 1.47.3) only when a Web Billing
  public key is configured (`?rc=` / localStorage / `RC_API_KEY` const) —
  `configure` → `getOfferings` → `purchase({rcPackage})` → entitlement
  check; stand owner doubles as appUserId. Falls back to the Web Test
  Store so the full flow demos before production keys land. No key in repo.
- Analytics hooks: `paywall_shown`, `desk_opened`, `purchase_success`.
- New `web/test/desk.mjs`: entitlement lifecycle (test store), SDK surface,
  gating, markup, wiring. Gate 16/16, site re-uploaded. Awaiting the
  RevenueCat Web Billing public key to flip live checkout.

### 2026-09-13 - RevenueCat Test Store live end-to-end
Real SDK verified on the deployed site: `Purchases.configure` with the Test
Store public key, `getCustomerInfo` + `getOfferings` live (`$rc_monthly`,
`monthly` product), and a full Test Store purchase round-trip — the SDK's
own checkout modal → `commodity_insider` entitlement active → desk unlocks.
- `RC_API_KEY` set in `billing.js` (public SDK key — safe to ship by design;
  `test_` prefix = real SDK, simulated checkout).
- Mode badge now honest about all three states: "via RevenueCat Web
  Billing" / "RevenueCat SDK · Test Store checkout" / local fallback.
- Subscribe button renders the live offering price
  (`currentPrice.formattedPrice`) instead of a hardcoded £4.99 — currently
  shows $9.99/mo, matching the dashboard product.
- Verified via headless Chrome on the live site: configure → offerings →
  test purchase → entitlement → restore. Note: `convex.site` serves JS with
  `cache-control: max-age=14400` — repeat visitors may see stale modules
  for up to 4h after an upload; fresh visitors unaffected.
- **API spend guard:** `apiCache.claimDaily` adds a UTC-day counter row
  (26h TTL, same table — no schema change). `cachedNebiusChat` claims a
  slot before every *uncached* call; over `NEBIUS_DAILY_BUDGET` (2000/day,
  env-overridable) it serves the templated fallback instead — public
  `/ai/letter` spam can never burn past the cap, and the game never breaks.
  Counter verified live (claims increment 1, 2…); uncached calls still
  infer normally under budget.

### 2026-09-13 - Integration surface pass: the sponsors become the game
Three product-design fixes so judges *see* the integrations, not just the
plumbing:
- **Decision-time wire hint (Linkup × RevenueCat):** the letter's upsell
  line now leaks direction for free players — `wireHint()` maps the top
  deck tilt to a scent ("the wire smells like frost / drought / a glut /
  a craze · reads quiet") shown next to the contract/hold/settle choice.
  Free = scent, insiders = sources + multipliers.
- **The district talks (Nebius):** `regularGossipNebius` is live — new
  `POST /ai/gossip` route; `openDay` asks one rostered regular (rotating
  daily) for a one-line take on the day's event + top shift. Delivered
  mid-day as a friend-graph `gossipBubbles` hop once that regular is on
  the floor. Cached by (name|cohort|context) — every stand on the seed
  shares the pull; covered by the 2k/day budget guard. Verified live:
  "Coffee prices will skyrocket now obviously." — Mara, 112 tokens.
- **Desk shows the cards:** each deck tilt row in The Wire now names the
  actual event card it biases (`card in the deck · EAST AFRICA SHORT
  RAINS`) — the ×1.5 stops being abstract.
- Gate 16/16 (desk test updated for the new upsell copy), functions
  pushed, site re-uploaded.

### 2026-09-14 - AAA street craft: the district becomes a place
The last fidelity pass — the street already read clearly and felt alive; this pass makes it *photographable*. Every texture re-authored at 1024, every light re-hung, every facade corniced, every shaft dusty. Pure world-tooling, no new levers or currencies.
- **Textures re-authored (procedural, no fetch, all `anisotropy 8`):** `woodFloor` 512→1024 — honey-oak planks with vertical gradient + bevel + 8 grain ribbons + knots + end-grain + varnish sheen (`repeat 2.2×1.6`); `pavement` — slab grid + grout chamfer + aggregate + cracks + coffee ring + AO dots + leaf decal (`8×1.6`); `road` — dual-layer aggregate + oil stain + patch + manhole + worn dashed centre + tyre tracks (`6×1`); `awning` 16 stripes with weave + stitch + scalloped brass eyelets + AO. `menuBoard`/`shopSign`/`rentSign`/`tarp` all re-drawn at 1024 with grain, brass, stitch, grommets, emboss.
- **Light & ground kit:** exposure `1.12→1.18`, `fog 34/95→32/92`, bias tuned; new **bounce hemi** `0.22` lifts the bar underside, `hemi 0.30→0.42` + sun `0xfff6e8 1.25`; floor gains a scuff decal at the barista stand, pavement/road now carry their textures, zebra widened, awning gains 4 brass tie-downs, lamp cords + `bulb emi 1.55`.
- **Facades & skyline:** `facade()` now lays **two-tone bricks + mortar + highlight/shadow + micro-grain**, every window cut with **white frame + recess shadow + specular streak + sill shadow** (emissive map unchanged), cornice shadow; each block gains a **cornice cap + ground-floor shopfront band + brass rule**; far skyline 7→9 blocks with alternating material + tiny signed windows. *Caught a real crash:* `y` was block-scoped outside its row loop → `buildWorld` threw for every player — fixed by hoisting `y` to the row loop.
- **Ticker & street kit:** ticker `384×256→512×320`, linen grain, double rule, row rules, letter-spaced header, brass collar + 4 screws, `aniso 8`; **7 bollards + brass caps** along the pavement, **THE DISTRICT street decal** at the zebra, curb.
- **Weather as mood, now four-way:** `mist 0.4→0.42` + **warm dust motes (additive 180, `0.065`, amber)** drifting in shafts via `world.setMotes(shaft)` — frost `0.22` grey-blue cold, harvest `0.14` warm. Motes drift + cycle in `world._updateDelight(now, dt)` (lerped opacity + vertical sine recycle).
- **Onboarding trim in the same pass:** controls line `8→3` (`1 batch · 2 price · space pause`), **reactive `#goal`** (`queue≥6` → *build—batch now* / `≥3` → *watch the queue* / calm → *hold under 5 · 14:00 rush → GLASSHOUSE*), **3 just-in-time nudges** (queue≥4-unbatched → batch, first balk → *the queue’s the enemy · 1/2*, 13:20–14:00 unrepriced → price) — each once/campaign, condition-bound not timed. Also refreshed two stale test stubs (`rentSign 1024×768`, `tarp 1024²`, `setLineDash`). Gate **16/16**, `tsc` clean, `dist` 43.

### 2026-09-13 - Onboarding fix: teach at the moment of need
Playtesters reported not knowing what to do mid-game and finding the
controls line intimidating. Applied progressive disclosure + contextual
nudges instead of upfront instruction:
- **Controls line trimmed** 8 items → 3: `1 batch · 2 price · space
  pause`. Camera/photo/letter keys are discoverable or contextual.
- **Reactive goal strip:** `#goal` now answers "what should I do now"
  from live state — `queue's building — 1 to batch` at ≥6 queued,
  `watch the queue · 1 batches before the rush` at ≥3, `keep the queue
  under 5` when calm; always names the next beat (14:00 rush) and the
  stakes (walk-outs feed GLASSHOUSE).
- **Three just-in-time nudges** (once per campaign, condition-bound, not
  timed): queue ≥4 unbatched → batch hint + lever pulse; first balk →
  "they walked — the queue's the enemy · 1 batches, 2 cuts the price"
  (feedback names the remedy); 13:20–14:00 unrepriced → price hint +
  lever pulse.
- **Caught a real crash in the same pass:** `world.js facade()` used
  block-scoped `y` outside its loop → `buildWorld` would throw for every
  player. Fixed hoisting `y` to the row loop. Also refreshed two stale
  test stubs (rentSign/tarp canvases were upgraded to 1024² in the
  delight pass; `setLineDash` added to the ctx stub). Gate 16/16.

### 2026-09-12 - viral hooks, share cards, and campaign badges
Added subtle, meaningful social and engagement dynamics:
- **Z-Read Social Share Cards (`web/js/share.js`)**: Formats clean, aesthetic text/link
  summaries with 1-click share to X, featuring the day's till, reputation, roaster's verdict,
  and replayable seed URL (`?seed=N`).
- **Campaign Mastery Badges**: Performance-based awards (*Master Roaster*, *Matcha Strategist*,
  *Debt Free*, *Community Anchor*, *District Survivor*) based on net worth, debt clearance,
  and balk ratios.
- **Headless Test Suite (`web/test/share.mjs`)**: Verified badge evaluations, text formatters,
  and URL intent encodings. All 14 tests pass green.

### 2026-09-12 - behavioral economics & specialty craft slice
Built and verified the full end-to-end slice for behavioral economics & craft layers:
- **Chalkboard Decoy Pricing & Anchoring (`web/js/behavioral.js`)**: Introduced the
  Gesha Reserve Lot #4 (£7.80) to anchor price perceptions, reducing perceived
  price resistance for Creatives (-35%) and Students (-25%) on standard Matcha drinks.
- **Bean-to-Bar Chocolate & Pastry Basket Attachment**: Time-of-day weighted cross-selling
  (All-Butter Croissant £2.80 in the morning, Miso Banana Loaf £3.20, and 72% Single-Origin
  Cacao Slabs £3.60 in the afternoon) tailored to cohort affinities (Creatives & Tourists).
- **Tip Jar Social Proof**: Visibility feedback loop where accumulated tip levels
  reinforce tipping probability from patrons.
- **Headless Test Suite**: Added `web/test/behavioral.mjs` verifying anchoring curves,
  basket attachment distributions, and tipping mechanics. All 13 tests green.

### 2026-09-12 - sponsor challenge integrations
Added high-impact sponsor integrations focused on elevating game design:
- **Linkup (Deep Research)**: `convex/linkup.ts` queries live global coffee commodity
  market news, shipping disruptions, and harvest updates via Linkup's search API.
  Findings dynamically bias the morning event deck and are cited in the Roaster's Letter
  with live URLs (cached 6h in `apiCache`).
- **Nebius (Applied AI)**: `convex/nebius.ts` connects to Nebius Token Factory inference
  (Llama 3.1 70B / Qwen 2.5) to power in-character prose generation for Idris's Roaster's
  Letter and dynamic patron reaction lines, tracking token usage and inference latency.
- **RevenueCat (Subscriptions)**: `web/js/billing.js` provides Web Test Store integration
  for the "Commodity Trader / District Insider Pass" entitlement.

### 2026-09-12 - working tree
Scaffolded the Convex backend from the local sim: `convex/schema.ts`
(campaigns, marketEvents, regulars, friendships, letters, stands with
indexes), `convex/gameConfig.ts` (drift, event deck, roster, seeded RNG
ported from `web/js/config.js`), `convex/exchange.ts` (createCampaign,
openDay drift-then-pity-roll, contractBeans, consumeContract, settleDebt),
`convex/regulars.ts` (list, markSeen/unsee, resolveDay with expectation
pressure + 5% contagion), `convex/letters.ts` (templated Letter preview +
archive), `convex/crons.ts` (dawn-tick placeholder). Then added the sponsor
stack (key-gated, offline-safe) and the floor's live mirror:
`convex/openai.ts` (enhanceLetter, personaLine via gpt-4o-mini, templated
fallback without a key), `convex/firecrawl.ts` (fetchCommodityNews →
deck-weight suggestions, seeded deck without a key),
`convex/agentmail.ts` + `convex/http.ts` (signed /agentmail/webhook →
reply-to-command mutation with letters audit trail; /sync/state +
/sync/snapshot bridge). `web/js/convexSync.js` mirrors each dawn over plain
fetch when `?convex=URL` is set (HUD badge flips LIVE, game never blocks);
`web/js/main.js` + `web/index.html` wired minimally. `.env.example` gains
OPENAI_MODEL, FIRECRAWL_API_KEY, AGENTMAIL_WEBHOOK_SECRET. Code only — no
deployment yet (`npx convex dev` still needed for `_generated` + codegen).
All 11 headless web tests still pass; `tsc` shows only the missing-
`_generated` class. Convex features: schema, tables, indexes, queries,
mutations, actions, HTTP actions (`convex/`).

Live-verified on a local Convex deployment (`npx convex dev --once`,
127.0.0.1:3210, codegen clean, `tsc` fully green after fixing an
`args.coh`/`args.cohort` naming bug and adding `@types/node`): full loop
ran server-side — createCampaign → openDay day 1 (drift 1.00→1.025 then
rumour_frost → 1.075, matcha £4.80) → markSeen commuters (Dev) →
resolveDay (reputation 62→68) → openDay day 2 (1.02, £4.95) →
contractBeans (debt £22) → AgentMail inbound parsing "contract" (no
double-charge) → OpenAI/Firecrawl key-gated fallbacks. Letter preview
matches the local templated format. Note: CLI has no linked Convex
account yet — this is a local deployment only, so the log header stays
`not deployed` until `npx convex login` + cloud deploy. Added
`node_modules/` to `.gitignore`.

Cloud-linked the same session: device authorized via `npx convex login`,
created project `grunds` in team `papa-jams` (existing `juakali` project
left untouched), provisioned dev deployment
`striped-anaconda-746` and pushed all functions + indexes. Re-ran the loop
against cloud — identical deterministic results (day-1 rumour_frost,
1.075, rep 68). Deployment usage reads zero across every metric, so
headroom is a non-issue. Header `Convex deployment` now points at the
cloud deployment; the floor mirrors to it with
`?convex=https://striped-anaconda-746.convex.site`.

Frontend is live on Convex: installed `@convex-dev/static-hosting`
(registered in `convex/convex.config.ts`, catch-all in `convex/http.ts`
with app routes kept at root), built `dist/` from `web/` via
`tools/build-dist.sh` (38 files, schedule snapshot at
`dist/api/schedule.json`), unified the client fetch to
`./api/schedule.json` (`web/js/main.js`, `grunds/spatial.py` serves both
paths so local dev is unchanged), and made `convexSync.js` auto-mirror
when hosted on `*.convex.site`. Verified live:
`/` + `/api/schedule.json` + `/js/*` + a GLB all 200, SPA fallback serves
index, `/sync/state` + `/agentmail/webhook` exact routes intact (400/503
as designed). All 11 headless tests still pass.

Firecrawl is live: key set server-side via `convex env set` (never in the
repo). First real pull returned Brazil drought coverage mapped to
`drought_ea` ×1.4 deck suggestions. Cost control in place: new `apiCache`
table (TTL + inline GC) caches Firecrawl 6h per query (~1 search per
5-day campaign) and OpenAI prose 7d by input hash (deterministic sim
replays identical bodies, so repeats cost zero tokens); both actions take
`force:` to bypass, prompts stay tight (220/40 tokens, gpt-4o-mini).
Verified cached:true on repeat call. OpenAI + AgentMail keys still unset
— clean templated fallbacks hold until they land.

Craft + determinism pass (Sept 12, all verified in a real browser):
screenshot QA caught bubbles hanging off-canvas, "up -6%" copy, and no
way to pause. Fixed: bubbles capped at 10 (oldest pops) and clamped to
the viewport (`web/js/fx.js`); sign-aware numbers in the Letter and HUD
(`down 6%`, `-6%`); `space` pauses the sim clock with a ❚❚ HUD marker;
the open Letter answers to `1`/`2`/`3`. The `campaign` gate flaked ~1 in
5 on unseeded `Math.random` — loop tests (`smoke`, `campaign`,
`campaign-tight`) now seed it, gate green 3× straight (12 tests).
New `web/test/game-feel.mjs`. Docs (README/ARCHITECTURE/EVAL) brought
current with the live Convex state.

Second craft pass (browser-verified): day-1 13:00 coach toast nudges the
levers one hour before the student wave — once per campaign, only if the
player hasn't acted; beat-camera push-ins now fire at 1×/5× only (cards
still show at 20×, camera stays home); clickable pause/resume button in
the sys row with label following state. Verified: toast shown, labels
flip, zero page errors; gate 12/12; site re-uploaded.

Backend depth pass: nightly `commodity-news-refresh` cron runs a new
`firecrawl.refreshCommodityNews` internal action (verified live:
refreshed:true, 2 suggestions); `/sync/snapshot` now genuinely writes —
new `exchange.mirrorState` patches day/index/price/till/rep/debt and new
`stands.recordStand`/`topStands` keep a per-owner leaderboard (verified:
mirror → state → patch → leaderboard all 200/OK). The floor sends
campaign-cumulative till + matchaPrice + debt under a stable
`grunds.owner` id (`?stand=` override) and polls `/sync/state` for the
badge. Prod deploy deferred to submission week on purpose — one stable
cut then, dev URL qualifies until then.

Third craft pass — the rival lives: `world.setRivalHeat(n)` makes the
GLASSHOUSE sign burn brighter as their queue grows (capped glow, driven
inside the time-of-day pass); first defection queues a camera visit to
the rival via a new `rig.queueFocus` (news waits for beats, never stomps
them, expires if the player drives); rival sales ring a small coin burst
at their counter. Caught live: heat 22 → glow 1.45, beat active
mid-swing toward the rival, zero page errors. (Also noticed an
unreferenced `web/js/billing.js` RevenueCat stub — no secrets, left
alone.) Gate 12/12, site re-uploaded (39 files).

Fourth craft pass — the week lands: a CLOSING TIME card at 20:40 pulls
wide before the Z-read; the day-5 finale stages SOLD (camera visits the
sold storefronts road-side via a theta swivel in `rig.focus`/`queueFocus`,
card names the new tenant, verdict receipt lands 5s later); GLASSHOUSE
gets warm windows with a barista + guest silhouette drifting behind the
glass (`world.updateRival`, driven every frame). Verified full week in
browser: 4 letters → Z-read → SOLD → "A good week on the floor" verdict,
zero errors; rival front-on framing confirmed (sign, TEAL awning, TO LET
next door, defectors queued). Note: a parallel worker added
`convex/linkup.ts`, `convex/nebius.ts`, `web/js/behavioral.js`,
`web/js/share.js` — unreferenced by my code, no secrets, left untouched;
their backend modules push clean alongside. Gate 12/12, site re-uploaded
(41 files, incl. the inert modules).

Fifth craft pass — light, return, and smoothness: GLASSHOUSE glass now
runs a day/night curve (pale reflective `aeb6b5` at 10:00, lamplit amber
`ffb45e` at 20:40, verified live); restarting from the verdict cranes
home with a "new week" toast instead of snapping (verified: day 1,
crane mode, receipt hidden); HUD text + ticker redraw at ~5Hz in the
browser (headless bypasses, so sim assertions stay per-tick). That last
one fixed a real find: 20× play was choking on 66 DOM writes/s (wave
window crawled at +6/5s, now steady +100/5s). Gate 14/14 (incl. the
collaborator's behavioral + share suites), site re-uploaded.

Sixth craft pass — share, mix, mobile: the verdict receipt grew a
"challenge a friend" button wired to the collaborator's share module
(badge from campaign totals + `?seed=` X intent); mix bus gained a
DynamicsCompressor (guarded for older WebAudio — the unguarded first
cut broke all three loop tests, since the stubs lack it); phones get a
≤640px layout (HUD, lever bar, notebook, letter), `touch-action: none`
drags, and width-aware bubble clamping (verified 10/10 on-screen at
390px). Gate 14/14, site re-uploaded (41 files).

### 2026-09-09 - 8e1dd63 (state at end of session)

The session is paused for the day. Eleven headless tests pass on the
merged main. The day-5 construction story is closed end-to-end across
five PRs (#5–#9). Quick index of what shipped since the connected-campaign
PR #1 merged:

- **PR #2 — Phase 0 CC0 props (Kenney)**: vendored Kenney GLBs now
  populate the District floor; `web/js/loader.js` (cache + FIFO + fallback);
  `web/test/glb-substitution.mjs` (15 assertions).
- **PR #3 — Regulars friendship graph**: 11 undirected edges, gossip
  routes through named friends, 3D conversation lines; `web/test/regulars-graph.mjs`
  (8 assertions).
- **PR #4 — Gentrification drift**: per-day cost creep (+0.025), matcha
  price curve (4.80→5.40), cohort expectation pressure, HUD #pressure
  line, Roaster's Letter `driftLine`; `web/test/gentrification.mjs`
  (6 assertions).
- **PRs #5–#9 — Day-5 visual + audible construction**:
  - `web/test/rent-sign.mjs` (4) — 'let' → 'lease' → 'sold'
  - `web/test/construction.mjs` (4) — right facade block scaffold
  - `web/test/construction-left.mjs` (4) — left facade block scaffold
  - `web/test/construction-active.mjs` (5) — drifting dust + low saw loop
  - `web/test/construction-final.mjs` (6) — day-4 `neighborhoodLine`,
    back-row scaffold, jittered wooden tock + metal click
- **Docs**: README "Recent progress" section + ARCHITECTURE phase column
  updated to reflect what's now local (gentrification, friendship graph,
  day-5 visuals).

**Test gate**: 11 headless tests pass on every merge. To run them
all: `for t in regulars-graph gentrification rent-sign construction
construction-left construction-active construction-final smoke campaign
campaign-tight glb-substitution; do node web/test/$t.mjs; done`.

**Where to pick up next session**: the README's "Convex phase" section
still lists items that haven't shipped (scheduled functions, live
queries, AgentMail, OpenAI prose). The highest-leverage next step is
the Convex phase itself: scaffold the Convex deployment, port the
local-phase systems (`exchange`, `regulars`, the construction story) to
TypeScript, and start wiring the multiplayer / persistence layer. Local
features that are still on the wishlist and easy to ship: a "new
tenant opens" final cutscene for day-5 evening, a day-4 dust preview
before the day-5 full reveal, a fourth scaffold on the back-left
facade. None are mechanically necessary; all are pure polish.

### 2026-09-09 - 1655cf6
Squash-merged PR #9 ("Close the day-4/day-5 construction story:
letter line + third scaffold + hammer") into main. Diff: +194 / −1
across 6 files. The day-4/5 narrative is now complete on three
fronts: (1) `letter.js` adds `neighborhoodLine(s)` for days >= 4 —
day 4 reads "Two of the storefronts across the road have a For
Lease sign up. The street's moving."; day 5+ reads "Both storefronts
are scaffolded now. The street is being remade — for or against you,
that's the question." (2) `world.js` adds a third scaffold on the
back-right facade block (x=17, z=18.0) with a 4.4m × 1.4m tarp. (3)
`audio.js` adds `constructionHammer(on)` with a jittered 0.6-0.9s
rhythm — each tap is a wooden tock + a metal click. The day-5
construction is now: visible (3 scaffolds + 3 tarps), audible (saw
+ hammer), animated (drifting dust), narrativized (letter), and
numeric (HUD #pressure). All 11 headless tests pass on the merged
main.

### 2026-09-09 - feat/construction-final
Closed the day-4 / day-5 construction story on three fronts:
(1) `web/js/letter.js` adds `neighborhoodLine(s)` for days ≥ 4 —
day 4 reads "Two of the storefronts across the road have a For Lease
sign up. The street's moving."; day 5+ reads "Both storefronts are
scaffolded now. The street is being remade — for or against you,
that's the question." Inserted after `reputationLine` so the player
reads market mood, then their performance, then the district's.
(2) `web/js/world.js` adds a third scaffold on the back-right facade
block (x: 17, z: 20.5) at (x=17, z=18.0). Smaller to fit a smaller
facade: 4 posts, 3 cross-beam levels, X-brace diagonals, 4.4m × 1.4m
tarp. New `W.setConstructionRight(d)` and `W.cTarpMatR` parallel to
the existing left/center setters. The gentrification now reads from
any camera angle on the wide shot.
(3) `web/js/audio.js` adds `constructionHammer(on)` with a jittered
0.6-0.9s rhythm. Each tap is a wooden tock (low bandpassed noise,
80-120 Hz, ~80ms) + a metal click (high bandpassed noise, 1.8-2.2
kHz, ~30ms). The saw provides the drone, the hammer provides the
rhythm. `update()` drives the scheduler. New test
`web/test/construction-final.mjs` (6 assertions) covers the letter
function, the third scaffold, the audio method, the wiring, the
noise buffer use, and the public API. All 11 headless tests pass.
+~180 / −3 across 5 files.

### 2026-09-09 - 952bd1b
Squash-merged PR #8 ("Make day-5 construction feel active: drifting
dust + a low saw loop") into main. Diff: +158 / −1 across 5 files.
The day-5 construction now feels alive. Drifting dust between the
two scaffolds — new dustSite Pool in web/js/fx.js, 80 particles,
additive cream/warm-grey tint, spawning 1-2 per ~0.12s when
constructionActive is true. Plus a low procedural saw loop in
web/js/audio.js — 78 Hz sawtooth with -8 cents detune through a
220 Hz / Q=1.4 bandpass, ramped to gain 0.04 over ~1.5s. main.js
wires both, gated on d >= 5, at every dawn. The gentrification is
now visible (two scaffolds, two tarps, a rent sign), audible (the
saw fades in on day 5), and animated (dust drifts between the
scaffolds). All 10 headless tests pass on the merged main.

### 2026-09-09 - feat/construction-active
Made the day-5 construction feel alive. The two scaffolds (PRs #6 and
#7) were static props; the gentrification read as "the building is
being remade" but didn't *feel* active. Two layers: (1) a slow
drifting dust between the two scaffolds — new `dustSite` Pool in
`web/js/fx.js` (80 particles, additive cream/warm-grey tint, spawning
1-2 per ~0.12s in the box x ∈ [-12, 12], y ∈ [0.5, 3.5], z ∈ [15.5, 17]
when `constructionActive` is true). Particles in flight finish their
natural life when the flag flips off, so the dust fades over ~2s
rather than vanishing instantly. (2) a low procedural saw loop in
`web/js/audio.js` — a 78 Hz sawtooth with -8 cents detune through a
220 Hz / Q=1.4 bandpass, ramped to gain 0.04 over ~1.5s. The result
is a distant "nrrrr" rather than a literal saw. The oscillator +
filter are created on first call to on=true and re-used; on=false
ramps the gain to zero. `main.js` wires both: at every dawn in
`openDay`, sets `fx.constructionActive = (d >= 5)` and calls
`audio.constructionSaw(d >= 5)`. New test
`web/test/construction-active.mjs` (5 assertions): fx constructionDust
+ constructionActive + dustSite pool, audio constructionSaw with
sawtooth + bandpass, main.js wiring, and public API smoke. All 10
headless tests pass. +~120 / −2 across 4 files.

### 2026-09-09 - 333ef78
Squash-merged PR #7 ("Add day-5 left-side construction prop") into
main. Diff: +89 / −1 across 4 files. The day-5 gentrification now
reads district-wide: a scaffold + tarp on the right-side facade
block (PR #6, x=11, z=16.4) AND a matching, smaller scaffold on the
left-side facade block (x=-10, z=15.9). Both invisible on days 1-4;
both materialize on day 5 via parallel `W.setConstruction` /
`W.setConstructionLeft` setters. The two-storefront-flip-in-one-week
narrative is now visible from any camera angle. All 9 headless tests
pass on the merged main.

### 2026-09-09 - feat/construction-left
Mirrored the day-5 construction prop on the left side of the street.
PR #6 added a scaffold + tarp on the right-side facade block at
(x=11, z=16.4). The gentrification read on the right but the left
side was untouched, so the district felt like *one* building was
being remade rather than the whole street turning over. This commit
adds a second, smaller scaffold in front of the closer left-side
facade block (x: -10, z: 19) at (x=-10, z=15.9). Same tarp factory,
same `dayHasConstruction(day)` gate, smaller dimensions to fit a
smaller facade: 4 posts, 3 cross-beam levels, X-brace diagonals,
5.2m × 1.6m tarp. `web/js/world.js` exposes `W.setConstructionLeft(d)`
parallel to `W.setConstruction(d)`. `main.js` calls both at every
dawn. New test `web/test/construction-left.mjs` (4 assertions)
verifies the source-level wiring: `W.setConstructionLeft` defined,
scaffold at x=-10, visibility/opacity toggled, and the call from
`openDay`. All 9 headless tests pass. +~120 / −2 across 3 files.

### 2026-09-09 - 6d4c73d
Squash-merged PR #6 ("Add day-5 construction prop: scaffold + tarp on
the sold storefront") into main as a single commit. Diff: +173 / −2
across 5 files. The day-5 "SOLD" sign now has a physical complement:
a two-level scaffold (4 vertical posts, 3 horizontal cross-beam levels,
X-brace diagonals) in front of the big right-side facade block at
x=11, z=16.4, ~5m to the right of the rent sign. A 6m × 2m red-and-
white striped construction tarp covers the lower-middle of the block,
reading "UNDER CONSTRUCTION · SEPT 15". The whole prop group is
invisible on days 1-4; W.setConstruction(d) toggles visibility on
day 5. The gentrification is now visceral — the player sees the
*building* being remade, not just a sign. All 8 headless tests pass
on the merged main: regulars-graph, gentrification, rent-sign,
construction, smoke, campaign, campaign-tight, glb-substitution.

### 2026-09-09 - feat/construction-prop
Made the day-5 "SOLD" sign physical. The sign was good but the
building looked the same — the gentrification was in the sign, not
the structure. New `tarp()` factory in `web/js/textures.js` bakes
a red-and-white striped construction tarp with "UNDER CONSTRUCTION ·
SEPT 15" text onto a 512×512 canvas. `web/js/world.js` adds a
two-level scaffold in front of the big right-side facade block
(x=11, z=16.4, ~5m to the right of the rent sign at x=6):
4 vertical posts (6.5m walnut-dark), horizontal cross-beams at 3
levels, X-brace diagonals, and a 6m × 2m tarp panel covering the
lower-middle of the block. The whole group is invisible on days
1-4; `W.setConstruction(d)` makes it visible on day 5 (group
.visible = true, tarp material opacity → 1.0). `main.js` calls
it once per dawn in `openDay` (right after `setRentPressure`).
New test `web/test/construction.mjs` (4 assertions) covers the
tarp factory, the day-gated visibility ladder, and the integration
chain. All 8 headless tests pass. +~160 / −3 across 4 files.

### 2026-09-09 - e4b252d
Squash-merged PR #5 ("Add a visible rent-pressure sign on the district
floor") into main as a single commit. Diff: +209 / −2 across 5 files.
The gentrification drift now has a visual: a two-post signboard on the
right side of the street (x=6, z=16.5, between the rival and the
big right-side facade block) re-bakes one of three states per day —
'let' (cream "TO LET · enquiries next door") for day 1-2, 'lease' (red
"FOR LEASE" banner, "RENTS UP 12% · district turnover") for day 3-4,
'sold' (diagonal red SOLD stamp) for day 5. The sign is the
gentrification made physical — the player sees the district being
claimed, not just the cost creep. All 7 headless tests pass on the
merged main: regulars-graph, gentrification, rent-sign, smoke,
campaign, campaign-tight, glb-substitution.

### 2026-09-09 - feat/rent-sign
Made the gentrification drift visible on the floor. The numbers
(`#pressure` HUD, the matcha price curve, the driftLine in the Roaster's
Letter) were good but abstract — the player couldn't *see* the
district being claimed. New `rentSign()` factory in `web/js/textures.js`
(~70 lines) bakes one of three states onto a 512×384 canvas: 'let'
(cream, "TO LET · enquiries next door" with brass corner detail) for
day 1-2, 'lease' (white with a thick red "FOR LEASE" banner and
"RENTS UP 12% · district turnover") for day 3-4, and 'sold' (white with
a diagonal red SOLD stamp) for day 5. The texture re-bakes onto the
shared canvas; the world only pays for one material. `stateForDay(d)`
is the pure day→state mapping. `web/js/world.js` adds a two-post
signboard on the right side of the street (x=6, z=16.5, between the
rival and the big right-side facade block), facing the café across the
road, and exposes `W.setRentPressure(d)` that re-bakes the texture and
sets `needsUpdate = true`. `main.js` calls it once per dawn in
`openDay` (right after `world.setMist`). The sign rotates through the
three states as the campaign progresses — the player sees the
district being claimed, not just the cost creep. New test
`web/test/rent-sign.mjs` (4 assertions) covers the factory, the three
drawable states, the day→state ladder, and the integration chain. All
7 headless tests pass. +~210 / −5 across 4 files.

### 2026-09-09 - 60685bb
Squash-merged PR #4 ("Wire gentrification drift: per-day cost creep,
reputation pressure, and the matcha price curve") into main as a single
commit. Diff: +262 / −5 across 8 files. The README's "Inflation enters
as a pressure clock" and ARCHITECTURE's "gentrification drift" line are
now real: every dawn the bean index creeps +0.025 (capped at 1.80),
the matcha till price walks 4.80→5.40 over 5 days, and cohort
expectation pressure (elders -0.02, creatives -0.01, students +0.01,
tourists +0.01) pulls seen regulars' op by `day * delta` before the
friendship contagion. The HUD has a #pressure line that reads
"costs +X% · matcha £Y · day Z/5". The Roaster's Letter gets a
driftLine paragraph for days ≥ 2. All 6 headless tests pass on the
merged main: regulars-graph, gentrification, smoke, campaign,
campaign-tight, glb-substitution.

### 2026-09-09 - feat/gentrification-drift
Wired the gentrification drift promised by README.md ("Inflation enters as
a *pressure clock*, not a stat screen: the district gentrifies — rents and
bean costs creep, willingness-to-pay rises but expectations rise faster")
and ARCHITECTURE.md ("exchange ... gentrification drift"). New module
`web/js/gentrification.js` (~75 lines) exports three pure, deterministic
functions: `applyDrift(exchange, day)` raises `beanIndex` by `+0.025/day`
(capped at 1.80) and sets the day's matcha till price from a 4.80→5.40
curve; `applyExpectation(regulars, day)` shifts each *seen* regular's `op`
by `day * CAMPAIGN.expectation[coh]` (elders -0.02, creatives -0.01,
commuters 0, students +0.01, tourists +0.01); `priceForDay(day)` is the
pure price-curve lookup. `exchange.openDay()` now calls `applyDrift` *before*
the event roll, so the drift is the baseline and the event is the
deviation (a frost on a drifting index is a bigger shock). `main.js`
calls `applyExpectation(regulars, day)` before `regulars.resolveDay` so
the friendship contagion sees the gentrification pressure and can spread
it. The HUD has a new `#pressure` line: "costs +X% · matcha £Y · day Z/5".
The Roaster's Letter gets a `driftLine(s)` paragraph for days ≥ 2 so the
pressure shows up in prose ("Costs are creeping. 5% up on day one. The
elders are watching the chalkboard."). New test
`web/test/gentrification.mjs` (6 assertions): per-day drift math, price
curve monotonicity, cohort expectation deltas, maxIndex cap,
determinism across two seeded exchanges, and a wire check that
`openDay()` actually applies the drift on top of the event delta. All 6
headless tests pass. +~280 / −~15 across 6 files.

### 2026-09-09 - 65f3898
Squash-merged PR #3 ("Wire the Regulars friendship graph, routed gossip,
and 3D conversation lines") into main as a single commit. Diff: +392 / −27
across 6 files. The Regulars now have a real friendship graph: 11
undirected edges across 8 named regulars, diameter 2. Gossip routes
through named friends when one is on the floor, and 3D conversation
lines are visible between gossiping regulars. All 5 headless tests pass
on the merged main: regulars-graph, smoke, campaign, campaign-tight,
glb-substitution.

### 2026-09-09 - feat/regulars-graph
Wired the Regulars friendship graph promised by `README.md` ("word of mouth
propagates through a friendship graph (visible as 3D conversations)") and
`ARCHITECTURE.md` ("precedent (memory) → opinions, friendships"). Each entry
in `REGULAR_ROSTER` now has a `friends` array; the graph has 11 undirected
edges across 8 regulars with diameter 2 (everyone is within 2 hops of
everyone). `Regulars` now exposes `friendships` (Map<idx, Set<idx>>),
`friendOf`, `pickFriendFor`, `reachableIn`, and a 5%-per-day `opContagion`
step that runs at the end of `resolveDay` — a single bad day for Mara sours
her friends, and within a day or two the whole network feels it. Gossip is
now routed through named friends: when a named regular balks, the bubble
goes to one of their friends who is on the floor (a real "word of mouth"
hop), and a dashed 3D line is drawn between the two patrons' heads for
the lifetime of the bubble. Falls back to the nearest patron when no
friend is on the floor. `patrons.js` carries the `regularFriends` set on
each named-regular patron and tracks `regularsByIdx` so the gossip router
can find friends on the floor. `fx.js` got a 32-slot `THREE.LineSegments`
pool for the conversation lines (animated vertex-coloured, faded by the
bubble's lifetime). New test `web/test/regulars-graph.mjs` (8 assertions)
covers: edge count, friend pick, reachability from Mara, single-step
contagion pull, 10-round spread, reputation bookkeeping, and a public-API
smoke check. All 5 headless tests pass. +368 / −26 across 5 files.

### 2026-09-09 - ac25ff2
Squash-merged PR #2 ("Wire Phase 0 CC0 Kenney props into the District
floor") into main as a single commit. Diff: +388 / −47 across 24 files
(16 of which are the binary assets). The District café interior now uses
the Kenney props the README's "Phase 0 CC0 props (Kenney; see SOURCES.md)"
line promised. All 4 headless tests on the merged main pass: smoke,
campaign, campaign-tight, glb-substitution.

### 2026-09-09 - feat/phase-0-glb
Wired the vendored Kenney CC0 GLBs into the District floor. Until now the 14
GLBs in `web/assets/` were sitting untracked and the `web/vendor/README.md`
admitted "nothing in web/index.html or web/js/*.js currently imports
GLTFLoader" — the README's "Phase 0 CC0 props (Kenney; see SOURCES.md)" claim
was a placeholder, not a delivery. This commit chain makes it real.

New `web/js/loader.js` (~80 lines): a small async helper that wraps the
vendored GLTFLoader, with a per-URL parse cache (FIFO at 32 entries), a
graceful placeholder fallback for failed parses, and a `dispose()` path for
the cache. Cloning a parsed Group is cheap; per-instance position/scale/
rotation don't bleed between uses.

New `web/test/glb-substitution.mjs` (~95 lines, 15 assertions): pins the
loader's contract — parse returns a Group, the cache stores 1 entry after 10
calls, position/rotationY/scale apply correctly, unknown URLs return a
placeholder without throwing, dispose clears the cache, and `web/js/world.js`
still imports and runs (regression guard).

`web/js/world.js` substitutions (procedural mesh -> Kenney GLB):
  - bar shell, espresso machine, till -> kitchenBar / kitchenCoffeeMachine /
    kitchenBarEnd
  - 3 tables + 9 chairs -> tableRound + chairModernCushion (3 chairs per
    table, oriented toward the table)
  - 3 pendant lamps -> lampRoundTable (emissive bulb kept procedural so
    W.bulbMats still drives the time-of-day glow)
  - 2 door planters -> pottedPlant
  - retail shelf backing -> bookcaseClosedDoors (3 shelf layers + 18 product
    items stay procedural; the kit has no display case)
  - 3 pastry items -> croissant, 3 -> cake (case frame stays procedural)
  - 3 new bar stools at the counter (stoolBar), 1 new side stand (sideTable)

Untouched (no matching Kenney GLB, or text content that needs the procedural
path): facades, far skyline, street trees, benches, street lamps, rival
café, menu board, sign, awning, all the procedural shapes used by the time-
of-day director (bulbs, pendants, lamp glows, mist, stars, moon).

`web/js/world.js` `buildWorld` is still synchronous. It returns the world
shell immediately with whatever has been placed, and exposes `W.ready` — a
Promise that resolves once every queued GLB placement is in the scene. The
title-screen flow in `main.js` now waits on `W.ready` before enabling the
"Open the District" button, so the user never sees a half-loaded floor.

The vendored GLTFLoader and BufferGeometryUtils had bare `import ... from
'three'` / `'../utils/...'` import paths (Three's example build assumes an
npm install). These were retargeted to the local `three.module.js` so
Node-based headless tests can import the loader without npm.

All 4 headless tests pass on the wired tree: `smoke.mjs`, `campaign.mjs`,
`campaign-tight.mjs`, `glb-substitution.mjs`. No Convex code yet.

### 2026-09-09 - b9f3b8d
Squash-merged PR #1 ("The connected district: a 5-day campaign where the
Gamble meets the floor") into main as a single commit. Diff: +3046 / −211
across 20 files. The PR combined the original feat/connected-district branch
with the review-driven fix from this session. Headless tests on the merged
main: `web/test/smoke.mjs`, `web/test/campaign.mjs`, and `web/test/
campaign-tight.mjs` all pass. The District is now live on main.

### 2026-09-09 - working tree
Review-driven fix on the campaign branch. The PR review found two real bugs:
(1) `regulars.markSeen` was defined but never called, so named Regulars (Mara,
Tomas, Pip, …) had no per-individual effect on opinion — every regular's `op`
was updated every day from the floor's aggregate, and the README's "named
patrons carry opinion across resets" claim was a lie; (2) `exchange.contract
.units` was decremented 36 per dawn, so a single 40-unit contract expired
unilaterally on day 2 regardless of how many cups were actually sold — the
40-unit number was decorative. Fixed both: `markSeen` is now invoked from
`patrons.spawn(cohort, …)` and returns `{idx, name, coh}` so a named regular
gets a brass-cohort-band hat on the floor plus a one-line greeting bubble
when they join the queue; defectors to the rival are `unsee()`'d so they
don't earn opinion they never received. `exchange.consume(n)` now decrements
`contract.units` per actual cup served (and clears the contract at zero), and
`CAMPAIGN.contractUnits` is bumped from 40 to 2400 (one day's counter volume
in the deterministic data) so the hedge is real. New `web/test/campaign-tight
.mjs` pins all four behaviours with deterministic assertions: per-individual
opinion, cup-bounded contract expiry, settle-survives-dawn (interest guard
works on zero), and the campaign lands in a verdict band. `campaign.mjs` and
`smoke.mjs` are still green. No Convex code yet.

### 2026-09-08 - working tree
Connected the floor into a 5-day campaign so the three nested clocks meet the
3D street (was: an isolated single day). New web/js modules, all core-Three
r160, no CDN/build: `exchange.js` (the Gamble — a seeded pity-timer event deck:
frost on Minas Gerais, East Africa drought, clean harvest, matcha hype; never
two catastrophes back-to-back), a bean benchmark whose day-over-day drift feeds
cost-of-goods (anchored to benchmark_corpus.json ~30% COGS), and forward
contracts + a supplier-debt clock with daily interest (`web/js/exchange.js`);
`regulars.js` (persistent patron opinion → reputation → footfall/tips, the
Regulars, `web/js/regulars.js`); `letter.js` (the Roaster's Letter, templated
prose, reply-to-command — contract/hold/settle, `web/js/letter.js`). The
between-days flow runs in `web/js/main.js`: each close shows a Z-read receipt,
then the mailbox raises its flag and the letter arrives; the reply mutates the
exchange and opens the next dawn through to a campaign verdict. The diorama
also gained a custom shader sky dome (`web/js/sky.js`), procedural district
facades whose windows light at dusk, a far skyline, an in-world commodity
ticker board, a mailbox, weather mist after a frost, and a core-Three render-
target bloom/vignette/grain post pipeline (`web/js/postfx.js`). Added `grunds/
__main__.py` so `python3 -m grunds` works. New `web/test/campaign.mjs` runs
the campaign headless (stubbed DOM/GL/audio) and asserts the payoff: a frost
on the spot yields net ~£7,600 contracted vs ~£4,600 held; debt accrues
interest across the run; settle clears it. No Convex code yet.

### 2026-09-08 - working tree
Rebuilt the floor as a living diorama (`web/js/` modules under the vendored
Three.js r160, still no CDN/build step): dollhouse café with bar, espresso
machine, pastry case and retail shelf; a street out front with the rival chain
stand; a time-of-day lighting director keyed to the sim clock (dawn to blue
hour, pendants/lampposts/signs take over at night). Patrons are instanced
characters (8 draw calls for the whole crowd) with a real queue that snakes out
the door; balked patrons visibly cross the road to the rival. Story layer:
title screen with camera crane-in, chapter cards keyed to the real wave shapes,
the 12:00 read as a roaster's-notebook card, and a closing-time receipt with a
verdict. Procedural WebAudio (murmur scales with the crowd, espresso hiss, till
chime, lo-fi pad), gesture-gated by the title screen. Economy is now
prep-weighted so the levers are legible: made-to-order matcha costs 4
prep-points vs 1 pre-batched, pre-batch is re-purchasable, and reprice rewrites
the in-world chalkboard while pulling matcha demand. `web/test/smoke.mjs` runs
two full days headless (stubbed DOM/GL/audio) and asserts the payoff: wave
balks 165 to 52, till up ~11%. Added `grunds/__main__.py` so
`python3 -m grunds spatial` works as documented. No Convex code yet.

### 2026-09-05 - working tree
Built the first playable vertical slice of the floor. `grunds/ingest.py` parses
the 26.5k-row café export into a 5-minute wave schedule (173 ticks, 3,775 spawn
buckets) tagged by zone and cohort, and extracts the planted signals (matcha
139→683/wk, loaf 148→40 peak-to-end, 8.6% cake attach) — verified against the
data. `grunds/spatial.py` serves the Three.js floor at localhost:8787 with a
schedule API. `web/index.html` renders four zones with cohort-colored patrons,
counter queue heat, the pre-batch and reprice levers, a till/balk scoreboard,
a read hint at 12:00, gossip bubbles that drift to the nearest served patron,
and a day reset. Three.js is vendored locally so the demo needs no internet.
No Convex code yet.

### 2026-09-05 - 889f770
Added the pre-commit tooling gate: gitleaks secrets scan with a custom ruleset
(`.gitleaks.toml`, default rules plus OpenAI-style and Convex-key patterns), ruff
lint on staged Python files, and a dependency-free fallback scanner
(`tools/secret_scan.py`) for machines without gitleaks. Verified the hook blocks a
planted fake key and passes a clean commit. Started the hackathon build log
(`hackathon.md`) and committed the project-local hackathon skill. No Convex code yet.

### 2026-09-05 - 595be8b
Scaffolded the Grunds Python package with module stubs for ingest, spatial, agent,
precedent, and eval, plus CLI entry points and a deterministic café sales
transformer (`transform.py`) that generates a 13-week UK café dataset
(`out/square_item_sales.csv`, ~26.5k rows) with planted demand signals. Docs
established the dual plan: a 3D spatial demo now, a persistent multiplayer Convex
app by Sept 22. No Convex code yet.

### 2026-09-05 - c82fdd0
Aligned all docs (README, ARCHITECTURE, EVAL) to The District game design: four
systems (Exchange, Regulars, Roaster's Letter, Floor), five cohorts as demand
curves, Drug Wars-inspired event deck with pity timers, and the Convex phase
deployment shape (tables, scheduled functions, live queries, AgentMail inbox).
Module docstrings updated to match. No Convex code yet.
