# Evaluation

How we score the demo loop — deterministic, reproducible, run-to-run.

## Demo metrics

| Metric | Definition | Target |
|---|---|---|
| Loop completeness | spawn → choose → buy → lever → visible payoff, no dead ends | all stages present |
| Read legibility | player can state *why* the lever worked before seeing the result | demoable |
| Wave fidelity | cohort wave shapes match `transform.py` hour-of-day profile | ±10% |
| Signal payoff | matcha riser visible in zone heat + till delta after pre-batch lever | positive delta |
| Gossip visibility | one bad review visibly propagates through ≥2 friendship hops | demoable |
| Reset time | full reset to t=0 | <2s |
| Fallback | recorded run of the exact demo path | exists |

## Determinism checks

| Check | Requirement |
|---|---|
| Same seed → same run | identical patron sequence, prices, outcomes |
| Event fairness | no two catastrophic events in consecutive draws (pity timer) |
| Economy baseline | 13-week revenue ≈ GBP 157k; attach rate 8.2% preserved from source data |

## Datasets

- `out/square_item_sales.csv` — 13-week deterministic café export (26.5k rows) from `transform.py`
- Planted signals: matcha riser, banana loaf faller, 8.2% cake attach rate

## Reproduce

```bash
python3 transform.py
python3 -m grunds eval
```

Output: `out/eval_results.json` with per-run scores.
