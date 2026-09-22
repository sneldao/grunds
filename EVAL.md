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
| Gate scope | Node behavioral and structural suites plus TypeScript; the gate ran before the dev-deployment push and does not exercise deployed behavior. | Per-suite exit status is the evidence; source-string checks are not layout or gameplay proof. |

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

`balance-policies.mjs` is a measurement harness, not a balance gate. The
2026-09-22 tuning run played eight policies across ten seeds (7, 42, 101,
202, 555, 13, 77, 150, 314, 431 — 80 campaigns); a fresh-process replay of
seed 7 / passive matched exactly. Every run used a fixed frame clock, no
identity perk, and resolved offers/incidents through the normal modal action
handler (engaged accepts, the rest decline). Active policies batch and
reprice by the documented queue rules and hire apprentice cover when
eligible; a contract rejected by the supplier tab limit falls back to
riding the spot.

The same-day tuning changed the cost shape (committed staff roster and a
binding pitch floor rather than mostly per-cup costs), priced hedges per
covered cup, added the £1,500 supplier tab limit with 2.5%/day interest,
made `rumour_frost` a real (×3 weight) next-day spike signal, steepened the
reputation→footfall loop, lowered the zero-awareness spawn floor to 0.18×,
repriced marketing, and recalibrated `campaignVerdict` to the measured
economy (`lost` ≤ £0, `scarped` ≤ £4,500, `held` ≤ £5,500, `good` needs
rep ≥ 60, `star` needs rep ≥ 70 and £8,000). Insolvency at any review now
ends the campaign `lost` early.

| Policy | Mean net worth | Min | Mean rep | Verdicts (10 seeds) | Hedge EV after fees | Mean worst day |
|---|---:|---:|---:|---|---:|---:|
| Reckless (heavy hedge, push Ruth, no queue work) | £4,007.72 | £2,799.38 | 43.1 | 7 scarped · 3 held | −£647.38 | −£273.78 |
| Passive | £4,974.06 | £2,570.72 | 46.5 | 5 scarped · 5 held | — | −£248.26 |
| Aggressive hedge | £4,740.97 | £3,143.23 | 63.0 | 6 scarped · 1 held · 3 good | −£695.12 | −£353.51 |
| Growth-focused | £5,248.99 | £2,590.05 | 63.2 | 5 scarped · 2 held · 3 good | — | −£308.83 |
| Conservative hedge | £5,261.23 | £3,539.55 | 63.0 | 5 scarped · 2 held · 3 good | −£174.86 | −£262.38 |
| Queue-focused | £5,436.09 | £3,532.46 | 63.0 | 5 scarped · 2 held · 3 good | — | −£252.66 |
| Forecaster (hedge on the rumour signal) | £5,616.94 | £3,951.38 | 63.0 | 2 scarped · 5 held · 3 good | +£180.85 | −£30.57 |
| Engaged (levers + offers + forecast hedge + marketing) | £6,071.39 | £3,300.49 | 70.0 | 2 scarped · 2 held · 4 good · 2 star | +£188.75 | +£147.44 |

Capture: `out/review-balance-2026-09-22.json`, source fingerprint
`3e2a3765237f2576191ce7d549f8d1028ec310eeb7abc83b5f432e9ea4717f4f`.
Daily P&Ls reconciled to campaign net worth in every run.

Reading: the earlier forgiving economy is gone — every policy posts negative
days (4–8 per 50-day sample, mean worst day −£31 to −£354) and passive play
now lands scarped/held rather than always finishing ahead. Policy quality
orders correctly: reckless < passive < blind hedges < informed play, and
engaged play is the only policy to reach `star`. Hedging now behaves like
insurance — blind heavy cover loses ~£650–700 on average while the
rumour-informed policy earns ~£180 and holds the best worst-day protection.

Caveats: ten seeds is a diagnostic sample, not a difficulty guarantee. No
policy reached `lost` — the scripted floor is `scarped` (worst mid-campaign
net worth +£1,109), so `lost` requires play worse than the harness's
reckless policy (e.g. compounding the tab into a spike week) and is enforced
by the insolvency rule rather than observed in the sample. Human playtest of
the difficulty curve remains unperformed; these are scripted-policy results
under fixed conditions.

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
