# Evaluation

How we check gameplay correctness and readiness. Automated regression checks, scripted economy probes, and fresh-player understanding are separate forms of evidence; none alone establishes that the game is engaging.

## Current verification — October 6, 2026: restock-and-settle harness on the current constants

Same 80-run grid as the October 1 diagnostic (`web/test/balance-policies.mjs`: seeds 7, 42, 101, 202, 555, 13, 77, 150, 314, 431 × eight policies). Competent policies restock the cellar each morning and settle an open tab before borrowing again. Passive and reckless stay naive. No identity perk, fixed 100ms frames, offers and incidents declined except `engaged`, which accepts them. A replay of seed 7 / passive matched. Source hash `0df597d0c2f9880b500eba03764dac023fee0e8e31525d749c132416c91d76e3`. The supplier tab in this run is the live cap, **£3,500** (`CAMPAIGN.creditLimit` in `web/js/config.js`). The £1,500 figure further down is the September 28 cap only.

| Policy | Mean net worth | Min | Max | Verdicts (10 seeds) | Hedge after fees |
|---|---:|---:|---:|---|---:|
| Passive (no restock, no queue work) | −£615 | −£3,024 | £1,946 | 8 lost · 2 scarped | — |
| Queue | £2,075 | £1,195 | £3,021 | 10 scarped | — |
| Growth | £1,695 | £730 | £2,780 | 10 scarped | — |
| Conservative | £2,757 | £904 | £3,946 | 10 scarped | −£83 |
| Aggressive | £1,665 | £695 | £2,020 | 10 scarped | −£229 |
| Forecaster | £2,582 | £2,059 | £4,285 | 10 scarped | +£92 |
| Engaged | £2,965 | £1,401 | £4,313 | 10 scarped | +£80 |
| Reckless (no restock) | −£1,167 | −£2,443 | £597 | 9 lost · 1 scarped | −£467 |

Every competent policy stayed in the black on every seed (lowest single run +£695, aggressive). None of the 80 runs reached **held** (net > £4,500 and reputation ≥ 50). The best run was engaged at £4,313. **Good** (> £5,500 and reputation ≥ 60) and **star** (> £8,000 and reputation ≥ 70) were not reached. Mean reputation for engaged was 55; the other competent policies sat just under 50.

`campaignVerdict` was not moved. The best scripted week sits just under the held line, so a small cut would stamp "held" on one outlier and leave every policy mean in scarped. Good and star are well above every run. The October 1 grid, on an earlier build, did reach held (conservative 5/10, forecaster 3/10, engaged 3/10 plus one good), so this ladder is not a proven mistake of the formula — outcomes on the current constants are simply lower, and this pass did not bisect why. The call is left to the owner.

Means are rounded to the pound. The unrounded summary is the harness stdout from this run.

## Current verification — October 1, 2026: economy incentives pass (`c94b822`; deployed to dev)

- Baseline on the then-current code (80 runs, 10 seeds × 8 scripted policies): every policy averaged a loss (−£1,188 to −£287), none reached "held", and about 28–30 of 50 player-days per policy were negative. Causes found by reading the per-day ledgers: (1) the supplier tab capped at £1,500 was smaller than one day of beans (~£3.3k at full service), so from day 3 the cellar ran dry and every cup billed the till at 1.5× spot (revenue per cup fell from £3.55 to £1.70); (2) the hedge and `settle` share one slot, so hedging meant not settling, which meant a capped tab; (3) the Brief's "restock" bought yesterday's pour +25% regardless of stock on hand, so a larger tab alone would have composted the surplus.
- Changes: `creditLimit` 1,500 → 3,500 (`web/js/config.js`, `convex/gameConfig.ts`); `restockQty(poured, onHand)` tops up to the same target net of stock on hand; the final receipt gains a "the turning point" row (`turningPoint` in `autopsy.js`) that names the costliest avoidable decision (dry cellar premium, interest, an uncovered frost/drought) from fields now on the per-day record. Prices, costs, demand and hedge fees are unchanged.
- Harness: competent policies now restock each morning and settle an open tab (`passive` and `reckless` stay naive as floors). Same 80-run grid afterward, mean net worth: passive −£793 (8 lost, 2 scarped); queue £3,697; growth £3,295; conservative £4,228 (5 held); aggressive £3,870; forecaster £4,249 (3 held); engaged £4,084 (3 held, 1 good); reckless −£1,187. Lowest single run for any competent policy rose from −£2,944 to +£1,584. Hedge benefit after fees: forecaster +£95 and engaged +£71 (both read the rumour), aggressive −£290 (blind heavy cover), so informed reading now beats blind hedging by about £385 a run.
- Not fixed, found while measuring: service capacity binds at roughly 2,500–2,850 cups a day, and the opening demand is already near it, so awareness above about 0.3 adds little (the `growth` policy trails `queue`; `engaged` at awareness 1.0 served only ~14% more). Marketing has almost no payoff until demand or capacity is retuned. A competent week still mostly lands at "scarped" (£0–4.5k); "held" is 10–50% of runs by policy and "good"/"star" are rare.
- Gate: all 72 non-balance suites pass (including new `restockQty` net-of-stock and `turningPoint` cases); the separate `stage-site.mjs` check passes from the project checkout; `tsc --noEmit` is clean. The two tests that hard-coded the £1,500 cap were updated (`orientation.mjs` now derives it from `CAMPAIGN.creditLimit`). Commit `c94b822` is pushed and deployed to the dev site; sampled live files match the staged artifact by SHA-256. No browser run and no human playtest.

## Current verification — October 1, 2026: staged soft morning

- On the soft day, the first-morning brief is replaced by a two-step card modal (`#softintro`): the stand name with "Step inside" (or "Skip the soft opening"), then Ruth's portrait with "Open the doors", which commits a hold/no-prep plan and starts the day. Progress dots and a fade-and-rise step transition, disabled under `prefers-reduced-motion`. The "Students arrive at 14:00" line no longer appears before Pip asks, fixing a cause-before-effect leak. Accepting Pip queues a `plan` moment — "24 students at 14:00. How will you get ready?" — whose Starter batch, Matcha deal, and Wait and see buttons call the real levers with live costs and expire at 14:00. The soft coach no longer says a plan is already set. All Day-1 choice cards are one line each, with a merged "what's the difference?" details.
- `soft-opening.mjs` (79 checks) covers the steps, dots, Escape inertness, skip parity, plan-card copy/costs/expiry/priority/lever wiring, and the previous slice checks. The full 72-suite non-balance gate passed on the working tree in `/tmp/grunds-test-mirror17`, with orientation, moments, coach, modals, curriculum, lifecycle/accounting, and time-locked-levers suites and TypeScript clean.
- Dead code noted: the soft-day overrides inside `showMorningBrief` and the `#brief-softskip` button are now unreachable (the brief never renders on a soft day). Harmless but worth removing later. The Ruth-step heading still shows the stand name rather than a new heading.
- No browser automation was run; the card layout, animation, and reduced-motion fallback are untested on screen.

## Previous verification — October 1, 2026: soft opening (slice: one soft day)

- New players now start with a soft day before the five-day week: the same first-morning brief and coach, a thinned crowd (each schedule entry spawns with expected `q × spawnScale × 0.005`, drawn from its own seeded RNG), only Mara, Pip, and Olu, Mara by about 08:10 and Olu by about 12:30, and at 11:00 Pip's study group of 24 students for 14:00. The day closes at 17:00 with a practice receipt (served, walked, takings, batch, Pip's group; no running costs, debt, or net worth) and no evening letter. "Open the week" or "Skip the soft opening" runs the existing campaign reset and then restores only the roster's opinion, visits, stage, usual, and history (relabelled "soft opening") and known walk-in faces. Veterans who have finished a week, skip-tutorial, demo, and headless runs go straight to the week as before.
- `soft-opening.mjs` (46 checks) covers the 17:00 close, the walk-in band, cast restriction and arrival times, 24 party students on accept and none on decline, the receipt contents, the hidden letter, the OPENING WEEK brief with ungated choices and no coach, skip parity, the veteran bypass, and that the week's ledger, market, cellar, awareness, and staff state equal a fresh reset with the same seed. The full 71-suite non-balance gate passed before a final one-line change (hiding the letter), after which soft-opening, orientation, lifecycle/accounting, moments, and coach suites passed again with TypeScript clean.
- Measured only on the test fixture (seed 7, Pip declined): 60 customers served, none walked, £226.80 practice takings. Crowd size across other seeds and with Pip accepted, and the soft day's real-time length, are not measured here; from the quiet-pace windows it should be roughly a minute and a half at 1×, an estimate rather than a measurement.
- Carried opinions can shift week reputation slightly through footfall; that effect is not measured. No browser automation was run. Whether the soft day feels cosy and teaches the controls is the purpose of the next fresh-player check.
- `cbdc424` passed the full non-balance gate on the committed tree and is published to the existing Convex dev site (`?v=cbdc424`); HTTP-only checks matched the artifact, and deployed gameplay remains unverified.

## Previous verification — October 1, 2026: pacing (roadmap step 3)

- Quiet time runs at 4× the chosen speed (capped at 20×) when nothing needs the player: trading, unpaused, no modal, no visible or pending moment card, Day 1's settling-in beats finished, and within 06:00–11:00, after the 11:00 ask until 13:30, or 16:00–17:00 once the day's incident has landed. Only the wall-clock rate changes; customer movement is sub-stepped per game minute so outcomes do not depend on pace. Four non-modal moment cards add small in-day decisions: a regular at the counter (say hello or open their profile), a returning regular's second chance (say hello), a long line before 14:00 (cut the matcha price at its real lever cost, or ride it out), and a regular crossing to Glasshouse. Each shows at most once per day and expires after 45 game minutes without pausing the clock.
- `pace.mjs` (22 checks) and `moments.mjs` pass, including exact copy, once-per-day triggers, priority, expiry, the existing +0.06 greeting, the lever cost on the price cut, and an identical fixed-seed day (served, walked, till, net) with pace on and off. Coach, orientation, and lifecycle/accounting suites pass with TypeScript clean.
- Lead pace probe (`/tmp/grunds-step3-pace2-*.json`; seeds 7, 42, 101; `queue` policy; moments enabled and never clicked): an earlier draft that required a line of three or fewer was quiet for only 40–130 of 900 minutes a day, because the line exceeds ten people about 70% of the time in these windows (`/tmp/grunds-step3-queue-*.json`); the rule now keys off pending decisions instead. Final: 380–426 quiet minutes a day (mean 415), and a modelled 1× day of about 174–185 seconds instead of 270. The model ignores existing rush and evening fast-forwards and time in modals.
- Quiet windows run customer movement about four times as often per frame; low-end device performance is unchecked. No browser automation was run, and whether the faster mornings feel calmer or rushed is a playtest question.
- `a18bb28` passed the full 70-suite non-balance gate on the committed tree and is published to the existing Convex dev site (`?v=a18bb28`); HTTP-only checks matched the artifact, and deployed gameplay remains unverified.

## Previous verification — October 1, 2026: regulars react to their own bad day (step 2b)

- Lead probe of dawn opinions on `fb787d3` (same ten runs as step 2; `/tmp/grunds-step2b-t-*.json`): every named regular stayed between −0.06 and +0.32 at every dawn, so an opinion threshold could not produce absences within a week. Replaying the recorded opinions, thresholds of −0.2, −0.15 and −0.1 produced no absences; only −0.05 or higher (a neutral regular) did, which would not read as a consequence.
- The trigger is now personal: a regular who walked out of the line or crossed to Glasshouse yesterday stays away today (the opinion < −0.2 path remains). They return the next day for one chance; walking out again that day, or being unhappy at the next dawn, loses them to Glasshouse. `consequences.mjs` (20 checks) and the lifecycle fixture (walkout → away → returning → repeat walkout → lost) pass, with cast, dossier, and patron-arc suites and TypeScript clean.
- Same ten-run probe after the change (`/tmp/grunds-step2b-before-after.json`): 7 of 10 runs had a regular stay away (8 away-days in total, for example Mara away on Day 3 after walking out on Day 2, back on Day 4); 7 second-chance returns; no regular was lost, because none walked out twice. Five-day net worth changed by +£73 on average with no verdict changes. These are scripted policies, not players; whether one absence a week is noticeable or too frequent is a playtest question.

## Previous verification — October 1, 2026: consequences through people (roadmap step 2)

- Named regulars now record walkouts and defections in their history and lose the same opinion walk-ins lose (−0.08 / −0.12, once per day). An unhappy regular (opinion below −0.2 at dawn) stays away for a day, returns once for a second chance, and starts going to Glasshouse for the rest of the campaign if still unhappy the next dawn; lost regulars are seen walking into Glasshouse with no further effect. The Morning Brief's "Who's coming in" section reports absences, second chances, losses, companions, and the reputation footfall effect when it is at least 3%. Receipts name walkouts, defections, and companions. Incidents now cost a share of the till when they open (2–6%, solicitor contest 14%) with the old fixed amounts as floors; decline effects are unchanged. Campaign reset now clears roster history and the walk-in pool.
- `consequences.mjs` (pure state machine, reasons, cost rounding) and an extended `lifecycle-accounting.mjs` (away → returning → lost, walkout recording, incident copy equals charge, reset clears history) pass. A 68-suite non-balance gate passed before the reset fix; affected suites passed again afterward with TypeScript clean.
- Before/after probe (lead-authored; seeds 7, 42, 101, 202, 555; Cerrado restock + tab settlement; `queue` declines offers and incidents, `engaged` accepts; same wrapper on `df82b4f` and on this change; `/tmp/grunds-step2-before-after.json`): incidents now cost £155–£300 instead of £18–£60. Accepting every incident lowered five-day net worth by £651 on average (range −£583 to −£701), and one engaged run moved from "held" to "scarped". Declining policies moved by −£0 to +£403 (mean +£148), within run-to-run variation from the changed spawn path. Named regulars recorded 11 walkouts across the ten runs, versus none before.
- No regular stayed away or was lost in these ten runs: the regulars who became unhappy (Olu and Esther under the declining policy, about −0.29) crossed the threshold only on the final day. The absence path is exercised by fixtures, not yet by these sampled policies; whether opinion moves fast enough for players to see it within a week is an open tuning question, not settled here.
- No browser automation was run. `fb787d3` passed the full 68-suite non-balance gate on the committed tree and is published to the existing Convex dev site (`?v=fb787d3`); HTTP-only checks matched the artifact, and deployed gameplay remains unverified.

## Previous verification — October 1, 2026: meet the cast (roadmap step 1)

- Any named patron, queuing or seated, and every regulars-board row opens a profile: bio, wants, usual (most frequent actual order, else their canon drink), feeling in words, the last thing that happened, friends, and recent history. The hover card no longer shows raw opinion numbers.
- The previous uncapped click-to-wave opinion gain is removed. "Say hello" applies the same +0.06 opinion once per person per day; identity-less patrons get a greeting bubble with no effect.
- `cast.mjs`, `dossier.mjs`, `patron-arcs.mjs`, and `orientation.mjs` (real `index.html` markup) passed, and the full 67-suite non-balance gate passed on committed `df82b4f` with TypeScript checking clean. No browser automation was run, and whether profiles make the cast memorable is a playtest question.
- `df82b4f` (with the curriculum commit `c2e4684`) is published to the existing Convex dev site as the first release-versioned artifact. HTTP-only checks confirmed the page requests `main.js?v=df82b4f` and that served files match the artifact; deployed gameplay remains unverified.

## Previous verification — October 1, 2026: progressive Brief curriculum

- Day 1 shows only the afternoon plan. Later tools arrive one at a time through a "New today" card: coffee (Day 2), menu (Day 3), street work (Day 4), bean insurance and the Wire (Day 5, or earlier after a market warning). Needs bypass the schedule: low coffee stock surfaces the coffee tool, and an outstanding supplier tab always shows the tab and its daily interest. Introduced tools stay visible as rows; finishing a week unlocks all of them for the next run. Headless, demo, and skip-tutorial modes show every tool, so existing financial fixtures are unchanged.
- `curriculum.mjs` covers the unlock schedule and need overrides. `orientation.mjs`, using the actual `index.html` markup, checks that Day 1 hides cellar, menu, insurance, Wire, and bill details; that a drained Day 1 still produces the Day-2 coffee card with only cellar-available coffees; that Day 3 introduces the menu; and that restock labels show what the supplier tab will actually fund. Receipt lessons report measured values only: Day-1 running costs and, on introduction days, cups poured or drinks served.
- A 65-suite non-balance Node gate passed before the final review fixes; the affected curriculum, orientation, cellar, Wire, lifecycle/accounting, prep, modal, and staging suites passed again afterward, with TypeScript checking clean. Economic constants and scoring are unchanged.
- `npm run stage:site` builds an upload directory whose JavaScript module URLs carry the release version, so a browser cannot combine a new page with modules cached from an earlier release. `stage-site.mjs` checks that every relative module import is versioned and resolves.
- No browser automation was run. Whether players notice, understand, and enjoy each introduction—and whether one per day is the right pace—remains a human-playtest question. Committed as `c2e4684` and published with `df82b4f`.

## Previous verification — October 1, 2026: first-morning orientation

- The first-morning pass introduces place, people, automatic service, and one afternoon preparation choice before the financial planning details. Guided first-day opening requires an explicit prep/deal/wait choice; the core commit API and economic constants are unchanged.
- An initial 65-suite non-balance Node gate passed in a temporary mirror using the existing schedule snapshot. After review fixes, the affected orientation, coaching, modal, lifecycle/accounting, prep, and guidance suites passed again; TypeScript checking passed during the pass. The last narrow cleanup was covered by orientation, coach, modals, and lifecycle/accounting reruns, without repeating the full gate.
- `orientation.mjs` parses the actual `web/index.html` markup into a simplified headless fixture and checks primary versus folded content, explicit choice gating, numeric shortcut routing, replacement-button focus, opening charges, and the transition to Day 2. Its captured text is not a browser screenshot, layout measurement, or proof of native focus behavior.
- Closing bills stay available in the full plan, not as a large number on the initial primary surface. Opening preparation cash, selected insurance fees, settlement, and estimated credit-funded stock remain disclosed before commit.
- No browser automation was run for this pass. Visual composition, physical-device behavior, emotional connection, and whether new players find the first day intuitive remain human-playtest questions. Commit `f3e0d18` is published to the existing Convex dev site for playtesting. HTTP-only checks matched the upload artifact; deployed gameplay remains unverified.

## Previous verification — September 30, 2026

- The 64-suite non-balance Node gate passed using a temporary source mirror and the existing `dist/api/schedule.json` snapshot, without restoring the deleted `out/` files. After the final layout edits, `coach`, `lever-state`, `next-action`, `game-feel`, and `lifecycle-accounting` passed again against refreshed source; `npm run typecheck` passed.
- Runtime regression cases cover reservation before 14:00, actual drink identifiers and milk use, routine top-ups without opinion penalties, late-switch charges, coaching pause ownership, and five-day lifecycle/accounting with explicit stock procurement and supplier settlement.
- Earlier exploratory desktop checks exercised onboarding, prep and discount routes, the evening debrief, receipt, pause/resume, and reset. Limited phone checks preceded the final layout edits. Browser automation was then stopped at the user's request. Final 320px and wave-coach layout checks, physical-device testing, and deployed gameplay testing are not claimed.
- Three scripted supply-managed queue probes (seeds 7, 42, 101; Cerrado restock plus settlement of an outstanding tab) remained viable, with recorded net worth £6,545.11, £6,202.96, and £7,024.77. Seed 7 queue control without procurement ended at −£697.08. These are a small diagnostic sample from a frozen source snapshot, not an updated 80-run benchmark, a general difficulty guarantee, or evidence of human engagement.
- Publishing a playable build for feedback does not clear the submission gate. Fresh-player sessions remain outstanding.

## Demo metrics

| Metric | Definition | Target |
|---|---|---|
| Loop completeness | spawn → choose → buy → lever → visible payoff, no dead ends | all stages present |
| Read legibility | player can state *why* the lever worked before seeing the result | demoable |
| Wave fidelity | cohort wave shapes match `transform.py` hour-of-day profile | ±10% |
| Calm open | The pitch licence leads to a paused first-morning introduction: café, Idris, Ruth's automatic service, and one afternoon plan. Guided first-day opening requires an explicit choice; optional craft guidance begins after opening without another forced pause. The existing 14:00 and low-stock coaching pauses retain user-pause ownership. | `orientation.mjs`, `coach.mjs` + fresh-player observation |
| Goal legibility | `leverState()` supplies availability and costs to buttons, handlers, and guidance. Reserved stock is distinct from live stock; the discount route never recommends locked prep; late switches disclose their cost and opinion effect. | `lever-state.mjs`, `next-action.mjs` |
| Lever feedback | Morning prep reserves 40 cups until 14:00. Routine replenishment costs £40 without an opinion penalty; the first unstaged post-noon batch costs £44.20. Feedback reports real stock rather than inventing a queue reduction. | Runtime stock, charge, and opinion assertions |
| Wave payoff | The 17:00 debrief reports served/walked counts, actual batch cups and stockout timing or the discount's abandonment-probability rule, then a route-specific tomorrow option. Receipts lead with net and counts above the detailed ledger. | Reconciled counts + player explanation |
| Signal payoff | The street and stock countdown show the chosen approach in action. Prep uses less bar time; discount lowers queue-abandonment risk rather than increasing service speed. | Player can distinguish the trade-off |
| Gossip visibility | One visible speech bubble at a time; friendship conversations continue independently of the display cap. Named walk-ins are dealt once per day and accrue one meaningful visit outcome per day. | `game-feel.mjs`, `patron-arcs.mjs` |
| Playtest instrumentation | Local events include coaching milestones, levers, balks, debriefs, and forecasts. Record observed actions and interview answers separately; the bounded event buffer can evict earlier events, so its summary is not a complete session measurement. | Manual observation + local event inspection |
| Delight / craft | **1024 textures** (wood/pavement/road/awning 1024 + grain/knots/bevel), **brick facades + cornice + shopfront + bollards/decal**, **ticker 512×320 + brass collar**, till drawer + shadow, arcing coins + spin, sitters sip, cat Miso, plant health, **god rays + warm motes (180, amber, drift + cycle)**, rival lean/jeer, haptics, 90Hz tick at 1×, purr at ≤5, photo + `GRUNDS` | aggregate feel |
| The Wire (inverted) | `⚡ the wire ↗` HUD when intel lands + bean tape click-through + Letter desklink; desk shows headlines + sources free, deck tilt × multipliers + per-card reasoning on `commodity_insider`; `#desk-edge` invite → modal 3 perks, live `formattedPrice`; restore + localStorage gate | gated tilt + headless `desk.mjs` |
| Market legibility | HUD bean tape (index + Δ vs yesterday's close + event name); in-world ticker sparkline (index history) + bias glow when the wire tilts the deck; letter names the day's spot move + implication; **Brief 76px sparkline + wire headlines/host/why** | tape + ticker + Brief + `tapeLine` |
| Drug Wars turn (06:00) | Planning pauses at 06:00; a reversible draft commits once before the next market roll. Five full trading days precede the finale. | `lifecycle-accounting.mjs`, `modals.mjs` |
| Sizing | Price coverage of 1200/2400/4800 prepared cups; fees and realized hedge benefit are reported separately. Exhaustion returns to spot, never shortage or spoilage. | `lifecycle-accounting.mjs`, `deepening-mechanics.mjs` |
| Dialogue | 11:00 named-regular offer (y/n, same modal pause contract as Brief; 5 with real payoffs: Pip +22% wave, Esther free-forever, Olu payout, Gwen prebatch stock, Mara queue-gated steal) | `agency.mjs` |
| Identity | Pitch licence before the Morning Brief — name, stand, role, and one-perk background. Signing requires explicit activation; Escape never signs. Identity threads letters, receipts, dossiers, and the Convex owner; `localStorage` and `?skipLicence` remain. | `identity.mjs`, `patron-arcs.mjs` |
| Staff | Ruth's condition affects throughput and the staffing choices in the Brief. Apprentice day rate is £2,040 plus £12 training; home staffing saves the rostered wage but reduces throughput. Rest, training, and crisis behavior use the existing `CAMPAIGN`/staffing rules. | `agency.mjs`, `lifecycle-accounting.mjs` |
| Costs | nightly incident `14:55–16:55` (days 2+, 6-way, red tint) + **cost-sheet P&L** at closeDay (staff+milk+rent+card+sundries + contract fees + interest + realized hedge benefit) — outcomes measured by the reproducible policy comparison, not a promised profit target | `agency.mjs` + receipt |
| Agency | **the** agency fix — a sized position, not a binary toggle; every other midday choice reuses the same pause contract so turns compose | `agency.mjs` |
| Share framing | finale X intent leads with `Held the line — 320 served, 12 walked` not just `£42` | outcome line |
| A11y | `prefers-reduced-motion` kills breath/grain/pulse/`heartbeat`/`purr` + vignette; pad pre-warm so Day 1 isn't silent; haptics on balk/wave | reduced-motion + touch + haptics |
| Performance | auto-`lite` (≤4c/4GB) + dynamic `lite` (3×>32ms) + shadow budget (>40) + GLB cross-fade + RAF slot discipline (`loop` re-arms first, receipt + loader headless-safe) | 60fps intent |
| Photo + secret | `P`/`📷` golden-hour photo (720×405 + shutter + vignette); `GRUNDS` → Gwen gesha £7.80 persists as toast | delight affordances |
| Reset time | full reset to t=0 | <2s |
| Fallback | recorded run of the exact demo path | exists |

## Determinism checks

| Check | Requirement / scope | Evidence / limitation |
|---|---|---|
| Same seed → same run | Seeded market behavior and reproducible scripted probes. | Harnesses seed `Math.random` and fix clocks; full cosmetic RNG determinism remains roadmap work. |
| Event fairness | The pity timer protects the first three days; days four and five retain the gamble. | `intel.mjs`, `clamp-asymmetry.mjs`; no blanket guarantee against consecutive catastrophes. |
| Economy baseline | Historical 13-week revenue ≈ GBP 157k and source-data cake attach rate 8.2%. | Dataset context, not a current gameplay or player-engagement measurement. |
| Deterministic gate | Loop tests (`smoke`, `campaign`, `campaign-tight`) seed `Math.random`; `intel.mjs` pins bias behavior. | Controlled headless fixtures, not unseeded browser replay proof. |
| Linkup citation | Research sources are cited when market intel is available; absent offline. | `intel.mjs`; no new live-provider call is implied by the test. |
| Gate scope | Node behavioral/structural coverage plus TypeScript, with DOM/GL/audio/database stubs where appropriate. | Earlier exploratory browser checks are separate evidence; source-string checks are not layout, engagement, or live-backend proof. |

## Datasets

- `out/square_item_sales.csv` — 13-week deterministic café export (26.5k rows) from `transform.py`
- Planted signals: matcha riser, banana loaf faller, 8.2% cake attach rate

## Fresh-player playtest gate — next step; not yet measured

**Build to test:** release `c94b822`, deployed to the Convex dev site at https://striped-anaconda-746.convex.site. Use a fresh browser profile/session for each participant so saved identity, curriculum and tutorial state do not carry over. The environment should be the deployed dev build; backend and static assets are live there. This is a five-person formative test, not a statistically powered balance study.

**Facilitator:** run from a fresh session. Do not explain the controls or recommend a strategy. Record any help the player requests. Do not intervene when they make a choice you consider suboptimal. Ask after the receipt, before Day 2:

```
1. In your own words, what are you trying to accomplish over the five days?
2. Which morning approach did you choose, and what did you expect it to change?
3. What happened at 14:00? What could you still do, and why do you think customers stayed or walked?
4. Which person do you remember, and what happened between you?
5. What would you do differently tomorrow? Would you choose to play another day? Why?
```

Record answers and observed actions separately. In an initial group of five fresh players, the proposed clarity gate is at least four who can explain the objective, make a meaningful choice without coaching from the observer, explain prep versus discount, understand why customers stayed or walked, and identify something to change tomorrow. In-game guidance is allowed; observer assistance must be recorded.

Engagement is a separate qualitative check: observe whether players voluntarily continue to Day 2 before asking about intent, remember a named character and an interaction, and express a specific reason to try again. No engagement result or submission approval is claimed. Automated checks do not establish understanding or engagement.

### Session record and review

For each participant, capture (with consent):

- Session/build identifier (`c94b822`), date, device/browser, fresh-profile confirmation, and any technical interruption.
- The participant's unprompted morning plan, whether they found the cellar/restock control, and whether they changed it; record the choice and rationale without grading it during the session.
- 14:00 observations: whether they notice the queue and levers, what they think prep versus discount changes, any customers walking, and what they believe caused that outcome.
- At the finale receipt: whether they notice and can explain the "turning point" row; whether the attributed cost matches what they noticed during play.
- Requested help and facilitator intervention (quote or summarize), plus verbatim answers to the five questions above.
- Voluntary continuation/restart before being asked, character recall, and a specific replay intention. Do not treat a stated "yes" alone as engagement evidence.

After five sessions, summarize the five participants individually before aggregating. Report the clarity gate as `x/5`, noting exactly which objective each participant could or could not explain and any facilitator help. Keep usability/clarity findings separate from enjoyment and continuation. Compare prep/deal/wait, restock, hedge, sampling/sponsorship choices with the observed reasons and outcomes; identify confusing feedback or unintended exploit/dominated choices. Do not retune from one participant's outcome. If the same misunderstanding or dead end appears repeatedly, propose a narrowly scoped fix and re-run the relevant automated suites plus the sessions affected by it.

### Follow-up order

1. **Run the five fresh-player sessions** on the deployed dev build and record results using the session record above. Test desktop first; note device constraints and any rendering/performance issues rather than assuming the 3D presentation is equivalent on every device.
2. **Triage findings by evidence:** first fix blockers (can't open, understand, or complete a day); then repeated comprehension failures; then economy/incentive tuning supported by repeated observed choices. Leave prices and costs unchanged until the results show what players misread versus what is actually under-rewarded.
3. **Re-run the balance grid after any economy change.** The current 80-run results use scripted policies that now restock and settle competently; passive/reckless are intentionally weak baselines. Marketing currently shows weak marginal return because service capacity binds near opening demand. Treat a demand/capacity retune as a separate, measured proposal, not as a playtest conclusion.
4. **Record the outcome here and in `hackathon.md`:** participant count and context, clarity `x/5`, repeated friction, voluntary continuation, technical issues, and the next agreed change. Do not claim engagement, balance, or release readiness from automated tests alone.

## Reproduce

```bash
python3 transform.py
python3 -m grunds run
failed=0; count=0
for f in web/test/*.mjs; do
  case "$f" in *balance-policies.mjs) continue ;; esac
  count=$((count+1))
  if [[ "$f" == *decisions.mjs ]]; then node --experimental-vm-modules "$f"; else node "$f"; fi
  [ $? -eq 0 ] || failed=$((failed+1))
done
echo "$count suites, $failed failed"; test "$failed" -eq 0
npm run typecheck
```

Diagnostic policy comparison (not a pass/fail balance target; requires regenerated `out/wave_schedule.json`):

```bash
node web/test/balance-policies.mjs
```

### Historical balance diagnostic — September 28, 2026

The following table and capture describe the September 28 model, not later gameplay. The supplier tab in that model was £1,500. The current tab is £3,500, and the October 6 section above is the rerun on today's constants.

`balance-policies.mjs` is a measurement harness, not a balance gate. It
played eight policies across ten seeds (7, 42, 101, 202, 555, 13, 77, 150,
314, 431 — 80 campaigns); a fresh-process replay of seed 7 / passive matched
exactly. Every run used a fixed frame clock, no identity perk, and resolved
offers/incidents through the normal modal action handler (engaged accepts,
the rest decline). Active policies batch and reprice by the documented queue
rules and hire apprentice cover when eligible; a contract rejected by the
supplier tab limit falls back to riding the spot.

The 2026-09-28 tab conversion changed what a bean week costs: dawn sacks now
ride the supplier tab (clamped to the £1,500 credit line — a capped tab buys
nothing), a bone-dry cellar bills **every** cup from the till at 1.5× spot
(previously the first emergency sack was free), and starter stock is prepaid
(value 0 at reset, so opening pours never bill twice). The 2026-09-28 pilot
below re-measured the same eight policies under that model. The earlier
cost-shape tuning stands (committed staff roster, binding pitch floor, per-cup
hedge fees £0.065/£0.09/£0.115, £1,500 tab with 2.5%/day interest,
`rumour_frost` ×3 next-day signal, 0.18× zero-awareness spawn floor,
`campaignVerdict` recalibrated: `lost` ≤ £0, `scarped` ≤ £4,500, `held`
≤ £5,500, `good` needs rep ≥ 60, `star` needs rep ≥ 70 and £8,000).
Insolvency at any review ends the campaign `lost` early.

| Policy | Mean net worth | Min | Mean rep | Verdicts (10 seeds) | Hedge EV after fees | Mean worst day |
|---|---:|---:|---:|---|---:|---:|
| Reckless (heavy hedge, push Ruth, no queue work) | £384.69 | −£2,667.95 | 53.2 | 4 lost · 6 scarped | −£224.89 | −£2,224.19 |
| Passive | £952.96 | −£2,605.03 | 51.2 | 4 lost · 6 scarped | — | −£2,320.65 |
| Aggressive hedge | £947.49 | −£2,491.14 | 62.0 | 4 lost · 6 scarped | −£408.45 | −£2,263.04 |
| Growth-focused | £834.55 | −£2,943.35 | 62.0 | 1 held · 3 lost · 6 scarped | — | −£2,472.06 |
| Conservative hedge | £1,384.12 | −£2,183.06 | 62.0 | 2 held · 3 lost · 5 scarped | +£28.18 | −£2,305.48 |
| Queue-focused | £1,355.94 | −£2,364.00 | 62.0 | 2 held · 3 lost · 5 scarped | — | −£2,359.98 |
| Forecaster (hedge on the rumour signal) | £1,221.76 | −£2,172.92 | 62.0 | 1 held · 3 lost · 6 scarped | −£134.18 | −£2,487.70 |
| Engaged (levers + offers + forecast hedge + marketing) | £1,694.98 | −£2,369.48 | 63.0 | 2 held · 2 lost · 6 scarped | −£123.44 | −£2,420.00 |

Capture: `out/review-balance-2026-09-28.json`, source fingerprint
`dadbeeb20604340eefa573fc9003b334464272685b611a734d461383b0564367`. Daily
P&Ls reconciled to campaign net worth in every run. (The pre-conversion
2026-09-22 tuning capture stays in `out/review-balance-2026-09-22.json` for
comparison.)

Reading: the floor now has real teeth — 20 of 80 runs reach `lost`, and every
policy posts catastrophic days when the tab caps (mean worst day −£2.2k to
−£2.5k, versus −£31 to −£354 pre-conversion). Engaged remains the best
policy (mean £1,695, the only 2-held performer) and reckless the worst; the
ordering engaged > conservative ≈ queue > passive ≈ aggressive ≈ reckless is
directionally intact, but the spread collapsed from ~£2k to ~£1.3k because
bean costs are no longer free. Hedging is now a losing line in isolation
(blind cover −£124 to −£408 after fees) — the tab's 2.5%/day interest eats
fees the spot never did, and a spike-week save needs a settle-then-relock
discipline the harness's single-lock policies don't play.

Caveats: ten seeds is a diagnostic sample, not a difficulty guarantee. The
harness never stages a cellar top-up, so every policy rides the starter stock
into the per-cup emergency spiral — measured here as the worst case, not as
policy skill. Competent play (restock + settle when in debt, as
`campaign-tight.mjs` now pins) clears the bleed-out floor; the
perfect-vs-delayed bookend in `ARCHITECTURE.md` V4 remains unperformed.
Human playtest of the difficulty curve remains unperformed; these are
scripted-policy results under fixed conditions.

The historical gate used pure fixtures, mocked DOM/GL/audio, and mocked database/HTTP handlers as appropriate. Its checks did not establish layout geometry or deployed Convex behavior. Headless import may attempt the existing RevenueCat remote module and report a non-fatal unsupported-URL warning; the gate is not universally no-network. The historical `npm run deploy:site` record refers to the September 28 dev deployment, not a new deployment claim.

For the current pass, use the verification scope at the top of this document. `npm run preview:local` serves the latest web source with a local schedule or the existing `dist/api/schedule.json` fallback. Headless integration suites still require `out/wave_schedule.json`; the optional regeneration commands above write data, whereas this session used a temporary mirror. `npm run build:dist` is excluded from the code gate because it removes and recreates `dist/`. A fresh temporary static upload directory can publish the current source without regenerating local data or deleting the existing build. No backend schema or function changes are required for the gameplay pass.

Gameplay verification: commit a hedge before a known test market move and reconcile the per-cup savings and fee; exhaust its quota and verify spot fallback. Exercise all five days, both modal keyboard paths, a tired apprentice shift, and the day-two/day-three/day-four modifiers. Human playtesting of pacing, audio, and visual fit remains a separate, unperformed check.

Outputs: per-suite console results and recorded scripted-probe data. `python3 -m grunds eval` is still a CLI stub and does not produce a verified `out/eval_results.json`. `__grunds.analytics.summary()` exposes the bounded local event buffer; use separately recorded observations and answers for the human gate.
