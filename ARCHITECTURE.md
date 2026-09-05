# Architecture

## Pipeline

```
transform.py ──→ square_item_sales.csv ──→ ingest ──→ spatial ──→ agent ──→ precedent
                                        (CSV)      (zone map) (Three.js) (rules)   (JSONL)
```

## Modules

| Module | Responsibility |
|---|---|
| `ingest` | Parse Square CSV, tolerant column mapping, emit structured transaction records with zone assignment |
| `spatial` | Three.js scene: floorplan, 4 zones (counter, table, register, retail), entity spawner keyed on transaction time |
| `agent` | Barista agent: observes zone density + item trends, emits prep/schedule decisions |
| `precedent` | JSONL log of human-validated decisions; applied as rules in subsequent runs to raise auto-decision rate |
| `eval` | Scoring: precision/recall on planted signals, auto-decision rate across runs, heatmap correlation |

## Data flow

1. `transform.py` produces a deterministic 13-week Item Sales export (~26.5k rows)
2. `ingest` maps each row to a zone by item category:
   - Matcha/Coffee → counter
   - Bakery → retail shelf
   - Retail → shelf
   - All → register at checkout time
3. `spatial` spawns entities at zone coordinates per transaction time
4. `agent` polls the spatial state every N minutes and fires decisions
5. `precedent` stores (pattern → decision) pairs; next run applies them before fallback to agent

## Audit trail

Every action logs to `out/audit.jsonl`:
```json
{"ts": "...", "type": "match", "confidence": 0.92, "source": "deterministic"}
{"ts": "...", "type": "precedent_applied", "pattern": "matcha_rising_afternoon", "action": "auto_clear"}
{"ts": "...", "type": "human_override", "transaction_id": "...", "decision": "approve"}
```
