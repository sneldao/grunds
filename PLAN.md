# Sprint plan — Victoria VR submission, final day

**Deadline:** Nov 11, 16:30 CEST = **14:30 UTC** (~20h from Nov 10 18:00 CET).
T&C §6.4: no material changes after submission; repo + demo must stay live
through Nov 25 judging.

**Verify:** `npm run test:fast` before claiming done; `npm run typecheck` for
convex/ changes. Deploy per AGENTS.md (clean `~/grunds-deploy` worktree, not
/tmp). AGENTS.md stays the architecture doc — merged and verified only.

## The honest position — why this loses as submitted

1. **The demo link doesn't reach the real AI.** `?prompt=` alone resolves
   `polyfork` (districtPolyforkOpt default) → `pfDescribe` → regex over 12
   vendored GLBs (`PF_STANDS`, franchise.js ~L200). Only `?hackathon=1`
   reaches the provider path (main.js ~L248). T&C §9.4: judges test their
   own prompts — unmatched words get a seeded generic stall, visibly wrong.
2. **Prompt → scene is thin.** A prompt changes one lot's mesh + a spec card;
   the street is identical every time. `?world=` only nudges climate/bias.
3. **AI is decorative by design.** The sim stays bit-identical with AI
   absent (replay tests enforce it). The brief wants AI central to
   "how the experience is created, changed, or interacted with".
4. **Game, not builder.** Type once, then play a pre-authored game — no
   iterative shaping ("continue shaping the result" is the brief's ask).
5. **Judge-session timescale.** The depth unfolds over a 5-day campaign; a
   judge has minutes. The 70 s video lacks the wire-desk segment — the
   strongest visible AI evidence (LLM reading crawled news).
6. **Fallbacks hide AI in both directions.** Provider down → seeded
   classifier → zero AI, silently. Tripo is credit-idle; real generation
   rides on Mint alone for two more weeks of judging.
7. Prior-event mentions consolidated → `docs/archive/` (this pass).

## Decision: Path A vs Path B — make it tonight

T&C **§5.4: each team may submit up to THREE judged submissions.**

- **Path A (always do):** submit Grunds with the judge path fixed — the
  tracks below. Ceiling: top-5 in a thin field.
- **Path B (if it spikes):** second submission — a thin prompt→street
  generator on the existing pipeline. This is what the brief literally asks
  for ("can a person describe a world and begin exploring it seconds later?").
  Reuse: `convex/mint.ts`/`tripo.ts` adapters, `districtGen.js` kit system,
  `standSpec`/`worldSpec` expansion, Grove mirror, construction→reveal UX.
  Exclude: the game loop, sim, save system.
- **Gate:** the spike must show a typed prompt producing a generated stand
  on a lot in-session by ~midnight, else Path A only.

## Tracks — Path A (parallel-safe, assign per dev)

| # | Deliverable | Files | Done when |
|---|---|---|---|
| 1 | Judge path: submitted link reaches real generation. **done — `01c728e` + `bfb14e0`**: live sessions POST `/franchise/describe` by default (LLM spec + real gen); vendored archetype only on explicit `?district=polyfork`, no-bridge, or provider failure. `?prompt=` sessions seed from the prompt hash so every described stand gets an unclaimed world. Verified live: describe → GLB in ~90s. **Open:** `spec:null` on describes — `standSpec.expand` erroring server-side despite `OPENAI_API_KEY` set; check `npx convex logs`. Pre-warm the example prompt's derived seed so the link lands instantly. | main.js, franchise.js, districtGen.js | A judge-typed arbitrary prompt produces a coherent named stand; a prompt with no keyword match still produces a real spec card |
| 2 | `?world=` in the deep link + one *visible* consequence of the street spec (street name on the district board / rival sign / climate tint) | main.js, worldSpec.js, SUBMISSION.md | Deep link shows a street visibly different from default |
| 3 | Generation reliability: **fallback shipped** (`01c728e` — provider down/garbage → vendored stand with typed words lands). **Open:** verify Mint + Tripo credit balances (Tripo produced a GLB on the live path despite "idle" notes — confirm which provider actually answered) | convex/mint.ts, franchise.js | Provider disabled → lot still fills, spec still real |
| 4 | Video: add the wire-desk segment (marketIntel LLM "why this matters"), re-cut ≤3 min, recommit `out/demo/demo.mp4` | tools/demo-video.mjs, out/demo/ | New cut committed; wire desk on screen |
| 5 | Docs consolidation (this pass — done): README reframed, hackathon.md header focused, TRIPOTHON*.md → docs/archive/ | README, hackathon.md, PLAN.md | No prior-event mentions in top-level docs |
| 6 | Deploy + submit: clean-worktree deploy, post-deploy smoke on a real browser, `test:fast` on deployed commit, submit the form | SUBMISSION.md | Submitted before 14:30 UTC Nov 11 |

## Path B spike (optional second submission)

- One page: text field → `worldSpec.expand` → `districtGen` kit grows
  generated stands; construction→reveal UX covers generation latency.
- Iterative follow-ups ("make it night", "add a ramen bar on the corner") —
  the brief's "continue shaping the result".
- If it doesn't cohere by the gate, drop it — split teams ship two mediocre
  things.

## Landed (prior sprint — kept for context)

Tracks A–E from the prompt-first/provenance sprint all landed: `#prompt-intro`
overlay, `?lite=1` productized, LLM attribution (`spec.model` → `· via {model}`),
seed-99 showcase street + Grove mirror (218 objects), 70 s demo cut,
SUBMISSION.md pack. Deployed commit `cf75474` — prompt-intro verified live.

Open from that sprint: ui-audit still blocked on machine load (rerun when the
box is quiet); video gaps noted above are track 4 now.
