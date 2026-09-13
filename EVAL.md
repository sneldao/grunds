# Evaluation

How we score the demo loop — deterministic, reproducible, run-to-run.

## Demo metrics

| Metric | Definition | Target |
|---|---|---|
| Loop completeness | spawn → choose → buy → lever → visible payoff, no dead ends | all stages present |
| Read legibility | player can state *why* the lever worked before seeing the result | demoable |
| Wave fidelity | cohort wave shapes match `transform.py` hour-of-day profile | ±10% |
| Calm open | day-1 opens at 1× with tutorial + throttled demand; first 12 sim-min demand ×0.5, 07–10 ×0.52, gossip 10% | 1× + tutorial + throttling |
| Goal legibility | goal strip + queue bar + batch countdown visible before 14:00; levers pulse until first use | brass goal + health bar |
| Lever prediction | pressing 1 shows predicted `12 → ~6 by 14:00` and chalkboard flash | toast + glow |
| Wave payoff | 14:00 debrief at 17:00 shows `balk/served` vs `saved ~£` vs GLASSHOUSE; Day-2 forecast on receipt + toast | debrief + forecast |
| Signal payoff | matcha riser visible in zone heat + till delta after pre-batch lever | positive delta |
| Gossip visibility | one bad review visibly propagates through ≥2 friendship hops | demoable |
| Playtest instrumentation | `analytics.js` records tutorial/lever/balk/debrief/forecast; `__grunds.analytics.summary()` | localStorage + console |
| Share framing | finale X intent leads with `Held the line — 320 served, 12 walked` not just `£42` | outcome line |
| A11y | `prefers-reduced-motion` kills breath/grain/pulse; touch-safe canvas | reduced-motion + touch |
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
| Gate size | 15 headless tests; `tsc` clean; `dist` builds | `game-feel` + `intel` included |

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
for f in web/test/*.mjs; do node "$f"; done   # 15 headless tests
npm run typecheck && npm run build:dist         # tsc + dist
```

Output: `out/eval_results.json` with per-run scores; console `__grunds.analytics.summary()` after Day 1.
