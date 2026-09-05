# Evaluation

## Metrics

| Metric | Definition | Target |
|---|---|---|
| Auto-match rate | % of transactions cleared without human input | >90% clean, >60% messy |
| Precision | Correct matches / all auto-matches | >95% |
| Recall | Correct matches / all true matches | >90% |
| Precedent lift | Auto-match rate run N vs run 1 | +10pp after 3 runs |

## Datasets

- `data/bank_clean.csv` + `data/gl_clean.csv` — no mismatches, dates aligned
- `data/bank_messy.csv` + `data/gl_messy.csv` — planted offsets, partials, splits

## Reproduce

```bash
python3 -m grunds eval --dataset clean
python3 -m grunds eval --dataset messy
python3 -m grunds eval --dataset messy --precedent --runs 3
```

Output: `out/eval_results.json` with per-run scores.
