# Sprint status — prompt-first entry + honest provenance

Working doc for the current push. **AGENTS.md stays the architecture doc —
it only describes what is merged and verified, never planned work.** This
file is the single place to check what is in flight. Delete it (or fold
into AGENTS.md) once the deadline passes.

**Goal:** natural language is the game's front door, and AI provenance is
visible in-product — for every player, not a judge mode. `?hackathon=1`
remains an internal provider-path flag only.

**Verify:** `npm run test:fast` before claiming done; `npm run typecheck`
for convex/ changes. Deploy per AGENTS.md (worktree, not /tmp).

## Tracks

| # | Deliverable | Files | Status |
|---|-------------|-------|--------|
| A | First-visit `#prompt-intro` overlay on the title screen (input + "build it →" + "lite mode" links → `?prompt=`/`&lite=1`). Fresh browsers only: no saved week, no `?prompt=`, not headless/demo. | index.html, main.js | **done — prompt-entry.mjs green** |
| A | `?lite=1` productized: `street.loadChars` skipped on lite, `lic-lite` link in the licence footer for all users (carries `?world=` forward on reload). | main.js, index.html | **done** |
| B | LLM attribution: `spec.model` stamped server-side in `standSpec.expand`/`worldSpec.expand`; `specLine` appends `· via {model}` (`· shaped by AI` on pre-provenance cards); Brief "Your street" appends `· shaped by {model}` on `source==='live'`; desk `.d-foot` provenance footer from `intel.feed` (`· an LLM read the tape` only when a shift carries `why`). | standSpec.js/.ts, worldSpec.js/.ts, main.js, desk.js, index.html | **done — test:fast green, typecheck green** |
| C | Showcase seed + ui-audit run | tools/ui-audit.mjs | **prebuild done; audit blocked on machine load** |
| D | Demo video — `tools/demo-video.mjs`: two Playwright takes (prompt-intro + one continuous session) + marker-cut ffmpeg assembly → `out/demo/demo.mp4` (~70 s, 8 segments). Committed: tool + final mp4 + cut markers; raw `.webm` takes gitignored (re-render to re-cut). | tools/demo-video.mjs, out/demo/ | **done — usable cut; polish notes below** |
| E | Submission pack | — | not started |

## Open items / collisions

- **Video gaps (dev D notes):** the wire-desk segment is absent — `#wirebtn`
  stayed hidden because `marketIntel` didn't land that session (intel fetch
  404'd once); a dusk segment was dropped because the aim at `[0.5,2.2,15]
  r22` puts the camera inside a Row building — re-aim from street side
  (`[-1,1.6,7]` worked for night) if re-shooting. Two harness lessons baked
  into the script: `sky.update(dayMin)` owns the backdrop every frame so
  director time-pins can't fake dusk — film REAL dusk by holding evening
  trade open; and `modals.top()` calls `rig.release()` so `#moment` cards
  must be dismissed before aiming. Mark offsets drift ~±10 s vs video time
  on slow boots — final cut windows were hand-verified against raw frames.

- **Shared-file contention:** `main.js` and `index.html` are being edited
  by multiple tracks — pull/re-read before editing, keep diffs tight.
- **Dev C prebuild (done):** `?seed=99` showcase street — all 4 lots
  `success` on prod (pitch "a tiny late-night ramen counter" built this
  session; 14/11/18 pre-existing). Grove mirror refreshed: 12 new objects,
  218 total, committed `a70a01a`. **Deploy needed before the seeded
  stands + A/B features are visible on the live site.**
- **ui-audit (blocked):** two attempts flaked on timeouts while dev D's
  video render held the machine at load 16–18 — AGENTS.md warned this.
  Re-run `UI_OUT=/tmp/ui-audit node tools/ui-audit.mjs` once the render
  finishes (~8–10 min, nothing else heavy running).
- **Title overlay verified live:** headless shot confirmed `#prompt-intro`
  renders on the title screen (input pre-filled, links wired, zero
  pageerrors) — `/tmp/title-prompt-intro.png`.
- **Submission URL** (once A lands + deploys):
  `https://grunds.trustfall.xyz/?prompt=a+tiny+late-night+ramen+counter`
