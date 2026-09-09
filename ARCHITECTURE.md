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
| `spatial` | Three.js floor: zones (counter, tables, register, retail), entity spawner keyed on time, queue heat, gossip bubbles, Kenney CC0 props, day-5 construction props, drifting dust, conversation lines | today |
| `agent` | Patron decision loop (choose stand by price/queue/reputation) + barista levers (pre-batch, reprice) + named-Regular hat/bubble + friend-graph gossip routing | today |
| `precedent` | Patron memory: opinions persist across runs; gossip propagates through a named-friend graph; 5%/day opinion contagion along the friendship edges | today |
| `exchange` | Event deck (frost, harvest, hype) with pity timers; gentrification drift (per-day cost creep + matcha price curve); forward contracts; supplier debt clock | today |

## Game loop mapping

```
 THE GAMBLE (days)          THE READ (hours)           THE SCRAMBLE (seconds)
 ─────────────────          ────────────────           ──────────────
 exchange events     ──→    wave schedule       ──→    patron spawn ticks
 gentrification drift       cohort signals             barista levers
 contracts / debt           friend-graph gossip        (queue vs restock vs regular)
 (Roaster's Letter)         (3D conversation lines)    named-Regular hat + bubble
        ↓                          ↓                          ↓
        └────────── outcomes feed precedent memory (patron opinions) ──────────┘
                                          ↓
                          contagion step pulls each regular 5% toward
                          the mean of their friends' opinions
```

Three nested clocks keep the game never-idle but never exhausting. All outcomes write
back to patron memory — reputation, gossip, regulars, and the friendship graph all
persist across days. The gentrification drift is the *baseline* cost creep; the event
deck is the *deviation* on top. Day 5 the visible scaffolding reads the drift as
physical: three procedural scaffolds + striped tarps, drifting dust, and a low saw +
hammer soundscape.

## Cohorts (behavioural layer)

Culture is mechanics: each cohort has its own arrival wave, elasticity, and gossip
trigger (see README table). `ingest` tags every transaction with a cohort by
hour-of-day and item; `agent` uses cohort rules for patron choice; `precedent`
stores per-patron opinion state.

## Data flow

1. `transform.py` produces a deterministic 13-week Item Sales export (~26.5k rows)
2. `ingest` maps each row to a zone by item category and tags the cohort:
   - Matcha/Coffee → counter · Bakery → retail shelf · Retail → shelf · all → register
   - Cohort by hour: 7–9 commuters · 10–14 creatives · 14–18 students (5 cohorts
     in the local phase, the Convex phase adds 5th + 6th cohorts on the agent)
3. `spatial` spawns entities at zone coordinates per transaction time; gossip
   bubbles + 3D conversation lines render the friendship graph; Kenney CC0
   props place the café interior; day-5 scaffolds + tarps + dust render the
   gentrification visually
4. `agent` patrons pick stands (price, queue length, reputation); named
   Regulars get a brass-band hat + a one-line greeting; the player pulls
   levers (pre-batch, reprice) against the wave schedule
5. `precedent` stores (pattern → opinion) pairs; regulars, grudges, and the
   friendship graph persist; a 5%/day `opContagion` step pulls each regular
   toward the mean of their friends' opinions
6. `exchange` rolls events with pity timers at each dawn, applies
   gentrification drift (per-day cost creep + matcha price curve + cohort
   expectation pressure) *before* the event roll, and settles contracts and
   supplier debt from the Roaster's Letter

## Convex phase deployment shape

The local phase has shipped: the friendship graph (`precedent`), the
gentrification drift (`exchange`), the day-5 visual + audible construction
story, and the Kenney CC0 props. What's still on the Convex side:

- Tables: `stands`, `patrons`, `opinions`, `friendships`, `contracts`,
  `events`, `prices`, `construction_props`
- Scheduled functions: wave spawning, nightly Exchange rolls (with
  Firecrawl news seed), per-day gentrification drift tick
- Live queries: the whole district syncs to every client in real time
- AgentMail: Roaster's Letter inbox; reply-to-command mutates
  `contracts`/`stands` (the local phase already handles this client-side
  via the in-world mailbox)
- OpenAI: patron persona prose (speech bubbles), generated server-side in
  actions (the local phase uses templated prose)
- Frontend on `convex.site`; `hackathon.md` build log in the public repo

## Audit trail

Every decision logs to `out/audit.jsonl`:
```json
{"ts": "...", "type": "spawn", "cohort": "commuter", "zone": "counter", "ts_of_day": "07:42"}
{"ts": "...", "type": "lever", "action": "prebatch_matcha", "cost": 4.2, "expected_units": 40}
{"ts": "...", "type": "gossip", "from": "patron_17", "to": "patron_23", "opinion": "-0.6"}
{"ts": "...", "type": "exchange_event", "event": "frost_minas", "bean_price_delta": "+18%"}
```
