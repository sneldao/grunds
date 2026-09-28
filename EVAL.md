# Evaluation

How we score the demo loop — deterministic, reproducible, run-to-run.

## Demo metrics

| Metric | Definition | Target |
|---|---|---|
| Loop completeness | spawn → choose → buy → lever → visible payoff, no dead ends | all stages present |
| Read legibility | player can state *why* the lever worked before seeing the result | demoable |
| Wave fidelity | cohort wave shapes match `transform.py` hour-of-day profile | ±10% |
| Calm open | day-1 opens at 1× with 3-step tutorial + reactive `#goal` + 3 just-in-time nudges (queue≥4 / first balk / 13:20 price, each once/campaign); first 12 sim-min ×0.5, 07–10 ×0.52, gossip 10%; controls line 8→3; auto-`lite` on ≤4 cores/GB, dynamic `lite` after 3×>32ms, shadow budget `queue>40`; then **06:00 [PAUSED] Morning Brief** holds the floor until `OPEN` | 1× + tutorial + Brief + perf |
| Goal legibility | **reactive goal strip** answers “what now” live (`queue≥6` → *build—batch now* / `≥3` → *watch* / calm → *hold under 5 · 14:00 rush*) + queue bar + batch countdown visible before 14:00; levers pulse until first use; **3 nudges** teach at the moment of need | brass goal + nudges + health bar |
| Lever prediction | pressing 1 shows predicted `12 → ~6 by 14:00` + chalkboard flash (desaturate + wobble); 2 puffs chalk dust + `screech` | toast + glow + dust |
| Wave payoff | 14:00 debrief at 17:00: `balk/served` vs `saved ~£` vs GLASSHOUSE; `saved≥6` → fanfare + coin rain + crane + haptics, flop → rain; receipt prints line-by-line + typewrites verdict; Day-2 forecast on receipt + toast | debrief (juice) + forecast |
| Signal payoff | matcha riser in zone heat + till (now `tabular-nums`); pre-batch lever pays in balk delta + coin burst | positive delta |
| Gossip visibility | one bad review via ≥2 friendship hops (3D lines); warm gossip + hover story card (op ♥, friends) + click-to-wave | demoable |
| Playtest instrumentation | `analytics.js` records tutorial/lever/balk/debrief/forecast + `desk_opened`/`desk_opened_free`/`paywall_shown`/`purchase_success`; The Wire desk open to all, deck tilt gated on `commodity_insider` | localStorage + `__grunds.analytics.summary()` |
| Delight / craft | **1024 textures** (wood/pavement/road/awning 1024 + grain/knots/bevel), **brick facades + cornice + shopfront + bollards/decal**, **ticker 512×320 + brass collar**, till drawer + shadow, arcing coins + spin, sitters sip, cat Miso, plant health, **god rays + warm motes (180, amber, drift + cycle)**, rival lean/jeer, haptics, 90Hz tick at 1×, purr at ≤5, photo + `GRUNDS` | aggregate feel |
| The Wire (inverted) | `⚡ the wire ↗` HUD when intel lands + bean tape click-through + Letter desklink; desk shows headlines + sources free, deck tilt × multipliers + per-card reasoning on `commodity_insider`; `#desk-edge` invite → modal 3 perks, live `formattedPrice`; restore + localStorage gate | gated tilt + headless `desk.mjs` |
| Market legibility | HUD bean tape (index + Δ vs yesterday's close + event name); in-world ticker sparkline (index history) + bias glow when the wire tilts the deck; letter names the day's spot move + implication; **Brief 76px sparkline + wire headlines/host/why** | tape + ticker + Brief + `tapeLine` |
| Drug Wars turn (06:00) | Planning pauses at 06:00; a reversible draft commits once before the next market roll. Five full trading days precede the finale. | `lifecycle-accounting.mjs`, `modals.mjs` |
| Sizing | Price coverage of 1200/2400/4800 prepared cups; fees and realized hedge benefit are reported separately. Exhaustion returns to spot, never shortage or spoilage. | `lifecycle-accounting.mjs`, `deepening-mechanics.mjs` |
| Dialogue | 11:00 named-regular offer (y/n, same modal pause contract as Brief; 5 with real payoffs: Pip +22% wave, Esther free-forever, Olu payout, Gwen prebatch stock, Mara queue-gated steal) | `agency.mjs` |
| Identity | pitch licence before tutorial — name + stand + role + 1-perk background (pace/trim/warmth/circuit-whisper); signing is explicit activation only (the Sign button; Escape never signs); threads letter, receipts, tutorial, Convex owner (live `ownerName()`); `localStorage` + `?skipLicence` | `identity.mjs` |
| Staff | Ruth — hidden `baristaCondition` (−0.14/shift, worse on brutal floors; +0.45 rested); Brief row at <0.55 → home (0.7× bar, wage saved) / apprentice (£65 + £12 training, 1.05× bar) / push; <0.35 dawn drag; <0.2 crisis (asleep 0.5× / snaps −rep); sick-call incident reads her state | `agency.mjs` (RUTH) |
| Costs | nightly incident `14:55–16:55` (days 2+, 6-way, red tint) + **cost-sheet P&L** at closeDay (staff+milk+rent+card+sundries + contract fees + interest + realized hedge benefit) — outcomes measured by the reproducible policy comparison, not a promised profit target | `agency.mjs` + receipt |
| Agency | **the** agency fix — a sized position, not a binary toggle; every other midday choice reuses the same pause contract so turns compose | `agency.mjs` |
| Share framing | finale X intent leads with `Held the line — 320 served, 12 walked` not just `£42` | outcome line |
| A11y | `prefers-reduced-motion` kills breath/grain/pulse/`heartbeat`/`purr` + vignette; pad pre-warm so Day 1 isn't silent; haptics on balk/wave | reduced-motion + touch + haptics |
| Performance | auto-`lite` (≤4c/4GB) + dynamic `lite` (3×>32ms) + shadow budget (>40) + GLB cross-fade + RAF slot discipline (`loop` re-arms first, receipt + loader headless-safe) | 60fps intent |
| Photo + secret | `P`/`📷` golden-hour photo (720×405 + shutter + vignette); `GRUNDS` → Gwen gesha £7.80 persists as toast | delight affordances |
| Reset time | full reset to t=0 | <2s |
| Fallback | recorded run of the exact demo path | exists |

## Determinism checks

| Check | Requirement |
|---|---|
| Same seed → same run | identical patron sequence, prices, outcomes (bias paths included, clamped 0.2–3×) |
| Event fairness | no two catastrophic events in consecutive draws (pity timer), including under bias | intact under bias |
| Economy baseline | 13-week revenue ≈ GBP 157k; attach rate 8.2% preserved from source data |
| Deterministic gate | loop tests (`smoke`, `campaign`, `campaign-tight`) seed `Math.random`, so rail-adjacent assertions don't flake; `intel.mjs` pins bias + pity-under-bias |
| Linkup citation | `intelLine` prints `Off the wire — <headline> (<domain>)` when sources arrive; absent offline | headless gate |
| Gate scope | Node behavioral and structural suites plus TypeScript; the gate ran before the dev-deployment push and does not exercise deployed behavior. **No suite runs in a browser** — every one stubs DOM/GL/audio, so rendering, real input, and visual quality are unmeasured here. | Per-suite exit status is the evidence; source-string checks are not layout or gameplay proof. Closing the browser gap is the V0–V5 plan in `ARCHITECTURE.md` ("Verification roadmap"). |

## Datasets

- `out/square_item_sales.csv` — 13-week deterministic café export (26.5k rows) from `transform.py`
- Planted signals: matcha riser, banana loaf faller, 8.2% cake attach rate

## Playtest script (5 questions, ask after Day 1 close, before Day 2)

```
1. In your own words, what are you trying to win? (profit / rep / beat GLASSHOUSE)
2. At 06:00 what did you choose (light/standard/heavy/hold/settle) and why? Did the sparkline + wire help?
3. At 11:00 who asked you for what — did you say y or n, and what happened?
4. What happened at 14:00? Did the debrief make sense vs the Brief hedge?
5. Was anything too fast / too noisy at the start? (1=calm … 5=chaos)
— then run: __grunds.analytics.summary()  // check brief_choice, offer_*, debriefs
```

Targets: `skipRate` < 40%, Brief chosen before `OPEN` (`brief_choice` >80%), `% with a midday y/n answer` >60%, `first_lever_at_min` < 90s wall-clock, `% who press 1|2 before 14:00` > 60%, forecast/`tapeLine` recall > 50%.

## Reproduce

```bash
python3 transform.py
python3 -m grunds eval
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

Diagnostic policy comparison (not a pass/fail balance target):

```bash
node web/test/balance-policies.mjs
```

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

Tests use pure fixtures, mocked DOM/GL/audio, and mocked database/HTTP handlers
as appropriate. Layout geometry and deployed Convex behavior are not verified.
Headless import may attempt the existing RevenueCat remote module and report a
non-fatal unsupported-URL warning; do not describe the gate as universally
no-network. `npm run build:dist` is intentionally not part of it (it deletes
`dist/`). After the gate, `npm run deploy:site` pushed functions and the
static site to the dev deployment (`striped-anaconda-746`); codegen output
matched the committed `convex/_generated/api.d.ts`. Deployed behavior itself
is still outside the test evidence.

Gameplay verification: commit a hedge before a known test market move and reconcile the per-cup savings and fee; exhaust its quota and verify spot fallback. Exercise all five days, both modal keyboard paths, a tired apprentice shift, and the day-two/day-three/day-four modifiers. Human playtesting of pacing, audio, and visual fit remains a separate, unperformed check.

Output: `out/eval_results.json` with per-run scores; console `__grunds.analytics.summary()` after Day 1.
