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
- **Last updated:** 2026-09-09T13:00:00Z

## Log

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
