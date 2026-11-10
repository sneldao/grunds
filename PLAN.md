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
| C | Showcase seed + ui-audit run | tools/ui-audit.mjs | not started |
| D | Demo video | — | not started |
| E | Submission pack | — | not started |

## Open items / collisions

- **Shared-file contention:** `main.js` and `index.html` are being edited
  by multiple tracks — pull/re-read before editing, keep diffs tight.
- **Submission URL** (once A lands + deploys):
  `https://grunds.trustfall.xyz/?prompt=a+tiny+late-night+ramen+counter`
