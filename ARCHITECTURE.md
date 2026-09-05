# Architecture

Grunds — The District — is a micro-economy simulation rendered as a 3D coffee
district. One deterministic data engine feeds everything; the game layers sit on top.

## Pipeline

```
transform.py ──→ square_item_sales.csv ──→ ingest ──→ spatial ──→ agent ──→ precedent
                                         (CSV)      (zones)  (Three.js) (levers)  (memory)
                                                                      ↓
                                                          exchange (Convex phase: events,
                                                          price drift, contracts, debt)
```

## Systems

| System | Responsibility | Phase |
|---|---|---|
| `ingest` | Parse Square CSV, map each row to (zone, time, item, cohort); emit wave schedules | today |
| `spatial` | Three.js floor: zones (counter, tables, register, retail), entity spawner keyed on time, queue heat, gossip bubbles | today |
| `agent` | Patron decision loop (choose stand by price/queue/reputation) + barista levers (pre-batch, reprice) | today |
| `precedent` | Patron memory: opinions persist across runs; gossip propagates through friendship graph | today (stub) → Convex |
| `exchange` | Event deck (frost, harvest, hype) with pity timers; gentrification drift; forward contracts; supplier debt clock | Convex phase |

## Game loop mapping

```
 THE GAMBLE (days)          THE READ (hours)           THE SCRAMBLE (seconds)
 ─────────────────          ────────────────           ──────────────
 exchange events     ──→    wave schedule       ──→    patron spawn ticks
 contracts / debt           cohort signals             barista levers
 (Roaster's Letter)         (floorplan as chart)       (queue vs restock vs regular)
        ↓                          ↓                          ↓
        └────────── outcomes feed precedent memory (patron opinions) ──────────┘
```

Three nested clocks keep the game never-idle but never exhausting. All outcomes write
back to patron memory — reputation, gossip, and regulars persist.

## Cohorts (behavioural layer)

Culture is mechanics: each cohort has its own arrival wave, elasticity, and gossip
trigger (see README table). `ingest` tags every transaction with a cohort by
hour-of-day and item; `agent` uses cohort rules for patron choice; `precedent`
stores per-patron opinion state.

## Data flow

1. `transform.py` produces a deterministic 13-week Item Sales export (~26.5k rows)
2. `ingest` maps each row to a zone by item category and tags the cohort:
   - Matcha/Coffee → counter · Bakery → retail shelf · Retail → shelf · all → register
   - Cohort by hour: 7–9 commuters · 10–14 creatives · 14–18 students (5 cohorts in
     the Convex phase)
3. `spatial` spawns entities at zone coordinates per transaction time; gossip bubbles
   render the friendship graph
4. `agent` patrons pick stands (price, queue length, reputation); the player pulls
   levers (pre-batch, reprice) against the wave schedule
5. `precedent` stores (pattern → opinion) pairs; regulars and grudges persist
6. `exchange` (Convex phase) rolls events with pity timers, applies gentrification
   drift, settles contracts and supplier debt from the Roaster's Letter

## Convex phase deployment shape

- Tables: `stands`, `patrons`, `opinions`, `friendships`, `contracts`, `events`, `prices`
- Scheduled functions: wave spawning, nightly Exchange rolls, Firecrawl crawls
- Live queries: the whole district syncs to every client in real time
- AgentMail: Roaster's Letter inbox; reply-to-command mutates `contracts`/`stands`
- OpenAI: patron persona prose (speech bubbles), generated server-side in actions
- Frontend on `convex.site`; `hackathon.md` build log in the public repo

## Audit trail

Every decision logs to `out/audit.jsonl`:
```json
{"ts": "...", "type": "spawn", "cohort": "commuter", "zone": "counter", "ts_of_day": "07:42"}
{"ts": "...", "type": "lever", "action": "prebatch_matcha", "cost": 4.2, "expected_units": 40}
{"ts": "...", "type": "gossip", "from": "patron_17", "to": "patron_23", "opinion": "-0.6"}
{"ts": "...", "type": "exchange_event", "event": "frost_minas", "bean_price_delta": "+18%"}
```
