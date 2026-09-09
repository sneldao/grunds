# Hackathon log

- **Project:** Grunds
- **Event:** Convex All Gas Hackathon
- **What it does:** A live 3D coffee-district economy game where players run café stands and AI patrons with persistent memory buy based on cohorts, commodity events, and gossip.
- **Live app:** not deployed
- **Repo:** https://github.com/sneldao/grunds
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** none
- **Convex features:** none yet
- **Auth:** none
- **AI models:** none
- **Started:** 2026-09-05T20:48:27Z
- **Last updated:** 2026-09-09T17:45:00Z

## Log

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
