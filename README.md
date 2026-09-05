# Grunds — The District

A live 3D coffee district where **players run competing café stands** and **AI patrons
decide where to buy** — real commodity prices, behavioural cohorts, and word-of-mouth
gossip, all visible on the floor. Built at the **Spatial Intelligence + Generative 3D
Hackathon** (Founders Inc., Sept 5) and being rebuilt as a **persistent multiplayer
product on Convex** for the **Convex All Gas Hackathon** (deadline Sept 22).

> *"The Sims gave us households, Football Manager gave us squads — Grunds gives you a
> live micro-economy where real commodity shocks meet behavioural agents, and you can
> watch cause and effect move through a 3D street."*

## Design pillar

**"You can't control demand. You can only be ready for it — faster than the café
across the street."**

The fun is **read → scramble → payoff**, running on three nested clocks:

| Beat | Clock | What it feels like |
|---|---|---|
| **The Read** | hours | Spotting a signal before rivals — the floorplan *is* your chart |
| **The Scramble** | seconds | Overcooked-style triage during a rush: shots, restock, or rescue a regular |
| **The Gamble** | days | Frost hits Minas Gerais — contract beans today or risk tomorrow's spike |

Inspired by **Drug Wars**: a price table players can read, an event deck they can't
predict, and a clock they can't ignore. Depth is emergent from price variance — not
from buttons.

## The four systems

- **The Exchange** — real-world anchoring. Arabica futures drift, frost/drought events
  in growing regions (seeded by Firecrawl news crawls), harvest calendars, forward
  contracts. World events pass through commodity economics into patrons' pockets into
  your till — every link visible in 3D.
- **The Regulars** — the social layer. Patrons are persistent characters with memory;
  word-of-mouth propagates through a friendship graph (visible as 3D conversations).
  Bad reviews spread; regulars hold court and boost reputation.
- **The Roaster's Letter** — the inbox. The supplier writes in character (AgentMail);
  you reply by email to contract beans, restock, or settle debt. Lore-native UI.
- **The Floor** — the 3D scene. Zones (counter, tables, register, retail shelf),
  entity spawning per transaction, gossip bubbles, queue heat. One complete
  interaction loop, demoable in two minutes.

## Cohorts — culture as mechanics, not skin

Diversity lives in the demand curves and gossip networks, not in costumes:

| Cohort | Ritual | Elasticity | Gossip trigger |
|---|---|---|---|
| Commuters (7–9am) | Same order; speed is everything | Low; zero queue patience | "Line took 6 minutes" |
| Creatives (10am–2pm) | Laptop campers, single-origin talk | Price-insensitive, reputation-sensitive | "They switched roasters" |
| Students (2–6pm) | Matcha spike, price-sensitive | High — follow discounts | "Next door is £1 cheaper" |
| Elders (off-peak) | Cappuccino, loyalty, recognition | Want recognition, not novelty | Memory of every mistake |
| Tourists (weekends) | Whatever's on the "best of" list | Follow hype, tip well | Post the latte art |

A price cut wins students but insults the creatives. Each cohort is a different clock
in the day and a different lever that works on them.

**Inflation** enters as a *pressure clock*, not a stat screen: the district
gentrifies — rents and bean costs creep, willingness-to-pay rises but expectations
rise faster. Standing still loses. (Supplier credit is the Drug Wars debt clock,
delivered by the Roaster's Letter.)

## Track alignment

### Spatial Intelligence Hackathon — Gaming & Interactive Worlds (today)

| What judges look for | What Grunds delivers |
|---|---|
| Playable world, one complete interaction loop | Read → scramble → payoff, demoed in 2 minutes |
| Embodied agents in a physical environment | AI patrons with memory, visible on the floor |
| Clearly visible state changes | Transactions spawn entities; frost events visibly shift the drink mix |
| Spatial reasoning | The floorplan is the chart: queues, gossip, zone heat |

Single-player, deterministic, seeded — `transform.py` generates the demand curves.
Planted signals are the narrative arc: the matcha riser, the loaf faller, the 8.2%
cake attach.

### Convex All Gas Hackathon (by Sept 22)

Same world, multiplayer and persistent:

- **Convex**: tables for stands, patrons, opinions, contracts; scheduled functions
  spawn waves and roll events; live queries move the whole district in real time
- **Firecrawl**: nightly crawls of commodity news + real café menus/prices seed the
  Exchange and market realism
- **AgentMail**: the Roaster's Letter — in-character briefings with reply-to-command
- **OpenAI**: patron personas that explain their choices in speech bubbles
- Deployed on `convex.site`, public repo, `hackathon.md` build log from day one

Prior work disclosed honestly in the build log: "a deterministic café dataset engine
and briefing design (prototype); this build: a live, real-time product on Convex."

## Data layer (exists today)

- **Source**: Maven Analytics "Coffee Shop Sales" — 149k transactions, 3 NYC
  locations, Jan–Jun 2023
- **Transform**: `transform.py` (deterministic, seeded RNG) — one location, 13 weeks
  shifted to end on the most recent Saturday, matcha-café menu overlay, GBP/VAT
- **Output**: `out/square_item_sales.csv` — ~26.5k rows, 286 txns/day, morning peak
  7–11am

### Planted signals (the narrative arc)

| Signal | Pattern | Why it matters in the game |
|---|---|---|
| **RISER** | Iced Matcha Latte 260→671 units/wk (2.6×) | The read: spot it, pre-batch, win the afternoon wave |
| **FALLER** | Miso Banana Loaf 141→59 (−45%) | Dead stock decision: discount, donate, or drop |
| **ATTACH** | Cake attached to only 8.2% of matcha orders | The nudge: bundle mechanics, measurable lift |

## Two-minute demo script

1. Show the floor. Patrons arrive — commuters first, fast and impatient *(the scramble)*
2. The Roaster's Letter: frost event. Bean costs spike on the Exchange *(the gamble)*
3. Pull ONE lever mid-demo: pre-batch matcha / reprice before the student wave *(the read)*
4. Watch the payoff: queue shifts, till ticks, the rival stand visibly starves
5. One gossip moment: a bad review spreads across the floor as patrons chat

Keep one reliable path, visible reset controls, and a fallback recording.

## Hackathon build plan

**Today (spatial, 10:00–18:00)**
1. Zone mapper: each transaction → (zone, time, item, cohort) — `grunds/ingest.py`
2. Patron wave spawner from `transform.py` output — cohorts 1–3 (commuters,
   creatives, students)
3. Three.js floor: 4 zones, entity spawning, queue heat
4. ONE player lever wired in: pre-batch/reprice before the afternoon matcha wave
5. Gossip stub: one visible bad-review propagation
6. Demo polish: reset button, fallback recording, 2-min script locked

**Convex phase (by Sept 22)**
1. Fresh repo, `npm create convex`, port signals/zone logic to TypeScript
2. The Exchange: scheduled functions + Firecrawl news→event deck (with pity timers)
3. The Regulars: persistent patron memory + gossip propagation graph
4. The Roaster's Letter: AgentMail inbox, reply-to-command mutations
5. All 5 cohorts, supplier credit clock, gentrification drift, cupping events
6. Deploy convex.site, public repo, `hackathon.md`, video, X post

## Architecture

```
transform.py          ← deterministic data engine (existing)
        ↓
  square_item_sales.csv
        ↓
  ingest/             ← CSV parser + zone/cohort mapper
        ↓
  spatial/            ← Three.js floor: zones, entity spawner, gossip bubbles
        ↓
  agent/              ← patron decisions + barista agent (read/scramble levers)
        ↓
  precedent/          ← patron memory: opinions persist across runs
        ↓
  exchange/           ← (Convex phase) event deck, price drift, contracts
```

## Design principles

- **Deterministic first**: all numbers computed by code; LLM optional for prose/persona
- **The floorplan is the chart**: the 3D view *is* the interface — no dashboard required
- **Foresight is a skill**: the economy isn't rigged; reads must be legible in hindsight
- **Fairest losses win**: never two catastrophes in a row — pity-timed events
- **Depth in the doc, delight in the demo**: elasticity never appears on screen
- **Demo-reliable**: frozen dataset, one clean path, fallback recording ready

## Getting started

```bash
python3 transform.py          # regenerate deterministic demand data
python3 -m grunds ingest      # zone/cohort map + wave schedule (WIP)
python3 -m grunds spatial     # launch the Three.js floor (WIP)
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
│   ├── ingest.py                # CSV parser + zone/cohort mapper + wave schedule
│   ├── spatial.py               # Three.js floor server (localhost:8787)
│   ├── agent.py                 # patron choice loop + barista levers
│   ├── precedent.py             # patron memory, opinions, friendship graph
│   └── eval.py                  # demo-loop scoring
├── web/
│   ├── index.html               # the floor: zones, waves, levers, gossip
│   └── vendor/three.module.js   # vendored Three.js (demo-reliable, no CDN)
├── benchmark_corpus.json        # UK café COGS benchmarks
├── locality_packs.json          # district locality data
├── cli.py
└── tests/
```

---

Built at Founders Inc., San Francisco. Sept 5, 2026.
