# Evaluation

## Metrics

| Metric | Definition | Target |
|---|---|---|
| Auto-match rate | % of transactions cleared without human input | >90% clean, >60% messy |
| Precision | Correct matches / all auto-matches | >95% |
| Recall | Correct matches / all true matches | >90% |
| Precedent lift | Auto-match rate run N vs run 1 | +10pp after 3 runs |

## Datasets

- `out/square_item_sales.csv` — 13-week deterministic café export (26.5k rows) from `transform.py`
- Planted signals: matcha riser, banana loaf faller, 8.2% cake attach rate

## Reproduce

```bash
python3 transform.py
python3 -m grunds eval
```

Output: `out/eval_results.json` with per-run scores.
