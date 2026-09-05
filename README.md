# Grunds — spatial intelligence for the café floor

Grunds is a deterministic synthetic-data engine plus a 3D spatial simulation
that turns transaction patterns into a living café floorplan. Built for the
**Spatial Intelligence + Generative 3D Hackathon** (Founders Inc., Sept 5).

## The concept

Real cafés have rhythms: the morning pour-over rush, the afternoon matcha spike,
the pastry that fades by week 8. Most tools see these as rows in a spreadsheet.
Grunds makes them **visible** — transactions map onto physical space, an agent
observes the flow, and precedents accumulate across simulated days.

It's a digital twin for the counter.

## Track: Physical AI & Simulation

| What judges look for | What Grunds delivers |
|---|---|
| Embodied agents in a physical environment | A barista agent that reads spatial flow and makes prep/scheduling decisions |
| Clearly visible state changes | Transactions spawn entities at zones; the floor animates through the day |
| Spatial reasoning | Each sale maps to a location (counter, table, register, retail shelf); patterns emerge across zones |
| Deterministic + learnable | Same seeded data → reproducible runs; precedent memory improves auto-decisions across days |

## Data layer (exists today)

The deterministic engine produces a Square-format Item Sales export from a
real-shaped POS dataset:

- **Source**: Maven Analytics "Coffee Shop Sales" — 149k transactions, 3 NYC
  locations, Jan–Jun 2023
- **Transform**: `transform.py` (deterministic, seeded RNG) — one location,
  13 weeks shifted to end on the most recent Saturday, matcha-café menu overlay,
  GBP/VAT-inclusive pricing
- **Output**: `out/square_item_sales.csv` — ~26.5k rows, 286 txns/day, morning
  peak 7–11am

### Planted signals (the narrative arc)

| Signal | Pattern | Why it matters in 3D |
|---|---|---|
| **RISER** | Iced Matcha Latte 260→671 units/wk (2.6×) | Barista agent ramps shot prep; zone visual shows increasing counter density |
| **FALLER** | Miso Banana Loaf 141→59 (−45%) | Bakery display empties faster than restock; agent notes the decay |
| **ATTACH** | Cake attached to only 8.2% of matcha orders | Missed bundle opportunity surfaced in the spatial view |

## Architecture

```
transform.py          ← deterministic data engine (existing)
        ↓
  square_item_sales.csv
        ↓
  ingest/             ← CSV parser + zone mapper (transaction → floor coordinates)
        ↓
  spatial/            ← Three.js scene: floorplan, zones, entity spawner
        ↓
  agent/              ← barista agent: observes flow, makes prep/schedule decisions
        ↓
  precedent/          ← pattern memory: encodes human-validated decisions, applies next run
        ↓
  ui/                 ← timeline scrub, zone heatmap, agent decision log
```

## Hackathon build plan

**Morning (10:00–13:00)**
1. Scaffold repo, wire `transform.py` into the new structure
2. Build the zone mapper: each transaction → (zone, time, item type)
3. Rough Three.js scene: floorplan, 4 zones, basic entity spawning
4. Timeline scrub: play back a single day's transactions in 3D

**Afternoon (13:45–18:00)**
5. Barista agent: simple rule-based logic (rise → prep more, fall → reduce stock)
6. Precedent memory: store a resolved pattern as JSON, re-apply on next run
7. Zone heatmap overlay: color zones by transaction density
8. Demo polish: recorded fallback, 2-min script locked down

**What "good" looks like on stage**
- Scrub through a simulated day; watch entities flow through zones
- Point to a rising pattern (matcha) and the agent's response (prep adjustment)
- Run the same day twice: second run has fewer manual overrides (precedent applied)
- Show the heatmap before vs. after agent intervention

## Design principles

- **Deterministic first**: all numbers computed by code; LLM optional for prose
- **Spatial as story**: the 3D view *is* the interface — no dashboard required
- **Precedent over perfection**: the agent gets better across runs, not in one shot
- **Demo-reliable**: frozen dataset, one clean path, fallback recording ready

## Getting started

```bash
python3 transform.py          # regenerate synthetic data
python3 -m grunds ingest      # parse + zone-map (WIP)
python3 -m grunds spatial     # launch Three.js scene (WIP)
```

Repo structure:

```
grunds/
├── README.md
├── ARCHITECTURE.md
├── EVAL.md
├── pyproject.toml
├── data/
│   └── coffee_shop_sales.xlsx   # source (deterministic via transform.py)
├── out/
│   └── square_item_sales.csv    # generated export
├── grunds/
│   ├── __init__.py
│   ├── ingest.py                # CSV parser + zone mapper
│   ├── spatial.py               # Three.js scene + entity spawner
│   ├── agent.py                 # barista agent logic
│   ├── precedent.py             # pattern memory + apply
│   └── eval.py                  # auto-match rate across runs
├── cli.py
└── tests/
```

---

Built at Founders Inc., San Francisco. Sept 5, 2026.
