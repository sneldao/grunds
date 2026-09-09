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
- **Last updated:** 2026-09-09T12:00:00Z

## Log

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
