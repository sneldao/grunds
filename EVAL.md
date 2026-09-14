# Evaluation

How we score the demo loop — deterministic, reproducible, run-to-run.

## Demo metrics

| Metric | Definition | Target |
|---|---|---|
| Loop completeness | spawn → choose → buy → lever → visible payoff, no dead ends | all stages present |
| Read legibility | player can state *why* the lever worked before seeing the result | demoable |
| Wave fidelity | cohort wave shapes match `transform.py` hour-of-day profile | ±10% |
| Calm open | day-1 opens at 1× with 3-step tutorial + reactive `#goal` + 3 just-in-time nudges (queue≥4 / first balk / 13:20 price, each once/campaign); first 12 sim-min ×0.5, 07–10 ×0.52, gossip 10%; controls line 8→3; auto-`lite` on ≤4 cores/GB, dynamic `lite` after 3×>32ms, shadow budget `queue>40` | 1× + tutorial + nudges + perf |
| Goal legibility | **reactive goal strip** answers “what now” live (`queue≥6` → *build—batch now* / `≥3` → *watch* / calm → *hold under 5 · 14:00 rush*) + queue bar + batch countdown visible before 14:00; levers pulse until first use; **3 nudges** teach at the moment of need | brass goal + nudges + health bar |
| Lever prediction | pressing 1 shows predicted `12 → ~6 by 14:00` + chalkboard flash (desaturate + wobble); 2 puffs chalk dust + `screech` | toast + glow + dust |
| Wave payoff | 14:00 debrief at 17:00: `balk/served` vs `saved ~£` vs GLASSHOUSE; `saved≥6` → fanfare + coin rain + crane + haptics, flop → rain; receipt prints line-by-line + typewrites verdict; Day-2 forecast on receipt + toast | debrief (juice) + forecast |
| Signal payoff | matcha riser in zone heat + till (now `tabular-nums`); pre-batch lever pays in balk delta + coin burst | positive delta |
| Gossip visibility | one bad review via ≥2 friendship hops (3D lines); warm gossip + hover story card (op ♥, friends) + click-to-wave | demoable |
| Playtest instrumentation | `analytics.js` records tutorial/lever/balk/debrief/forecast + `desk_opened`/`desk_opened_free`/`paywall_shown`/`purchase_success`; The Wire desk open to all, deck tilt gated on `commodity_insider` | localStorage + `__grunds.analytics.summary()` |
| Delight / craft | **1024 textures** (wood/pavement/road/awning 1024 + grain/knots/bevel), **brick facades + cornice + shopfront + bollards/decal**, **ticker 512×320 + brass collar**, till drawer + shadow, arcing coins + spin, sitters sip, cat Miso, plant health, **god rays + warm motes (180, amber, drift + cycle)**, rival lean/jeer, haptics, 90Hz tick at 1×, purr at ≤5, photo + `GRUNDS` | aggregate feel |
| The Wire (inverted) | `⚡ the wire ↗` HUD when intel lands + bean tape click-through + Letter desklink; desk shows headlines + sources free, deck tilt × multipliers + per-card reasoning on `commodity_insider`; `#desk-edge` invite → modal 3 perks, live `formattedPrice`; restore + localStorage gate | gated tilt + headless `desk.mjs` |
| Market legibility | HUD bean tape (index + Δ vs yesterday's close + event name); in-world ticker sparkline (index history) + bias glow when the wire tilts the deck; letter names the day's spot move + implication | tape + ticker + `tapeLine` |
| Agency | sized contracts (light ½/½ units/fee, deep 2×/2×) burn cup-by-cup; the regular's ask at 11:00 pauses for a real y/n (Pip wave, Esther card, Olu payout, Gwen stock, Mara queue check) | `agency.mjs` |
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
| Gate size | 17 headless tests; `tsc` clean; `dist` 43 files | `game-feel` + `intel` + `desk` + `agency` included |

## Datasets

- `out/square_item_sales.csv` — 13-week deterministic café export (26.5k rows) from `transform.py`
- Planted signals: matcha riser, banana loaf faller, 8.2% cake attach rate

## Playtest script (5 questions, ask after Day 1 close, before Day 2)

```
1. In your own words, what are you trying to win? (profit / rep / beat GLASSHOUSE)
2. What did [1] and [2] do? What did the chalkboard change?
3. What happened at 14:00? Did the debrief make sense?
4. What do you think happens tomorrow? (forecast recall)
5. Was anything too fast / too noisy at the start? (1=calm … 5=chaos)
— then run: __grunds.analytics.summary()  // check skipRate, firstLever, debriefs
```

Targets: `skipRate` < 40%, `first_lever_at_min` < 90s wall-clock, `% who press 1|2 before 14:00` > 60%, forecast recall > 50%.

## Reproduce

```bash
python3 transform.py
python3 -m grunds eval
for f in web/test/*.mjs; do node "$f"; done   # 16 headless tests
npm run typecheck && npm run build:dist         # tsc + dist
```

Delight hill: try the wave at 1× with headphones — `saved≥6` should ring, rain, and crane; try `GRUNDS` and hover a sitter (watch the sip at `dwell==4`); try `P` for a golden-hour shot. Then read `__grunds.analytics.summary()` — `skipRate` <40% + `first_lever_at_min` <90s is the calm-open hill.

Output: `out/eval_results.json` with per-run scores; console `__grunds.analytics.summary()` after Day 1.
