# Grunds — The District

A live 3D coffee district where **players run competing café stands** and **AI patrons
decide where to buy** — real commodity prices, behavioural cohorts, and word-of-mouth
gossip, all visible on the floor. Built at the **Spatial Intelligence + Generative 3D
Hackathon** (Founders Inc., Sept 5) and rebuilt as a **persistent multiplayer product
on Convex**.

## ▶ Play it

**https://grunds.trustfall.xyz** — no install, plays in the browser (desktop + phone).
Served by Convex static hosting ([direct link](https://striped-anaconda-746.convex.site));
connected mode runs the multiplayer backend with live commodity news in the wire.

Demo video: `videos/grunds-demo` (recorded gameplay + HyperFrames title treatment).

| Current state | |
|---|---|
| Source update | 2026-10-30 — deterministic frontage conversions, Polyfork lighting, camera lifecycle, and climate cues |
| Tests | Full Node suite: 488 passed; final UI/test polish: 11 targeted checks passed; `npm run typecheck` clean |
| Verified | Local staged build on desktop (1400×900) and mobile (390×844): opening, trading, pause/resume, lighting, and review → next-morning camera transition |
| Not yet verified | These changes are not deployed; production browser verification, pixel-diff baselines, performance budgets, and fresh human playtests remain open |
| Build history | [hackathon.md](hackathon.md) — dated log from day one |

An intermittent coach-test failure appeared during validation and passed on reruns; its cause is not confirmed.

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
in the day and a different lever that works on them. Inflation enters as a *pressure
clock*, not a stat screen: the district gentrifies — rents and bean costs creep,
standing still loses.

## How a week plays

The floor is a **connected 5-day campaign**, not a closed loop. At 06:00 the
**Morning Brief** pauses the street for the day's plan (sized bean hedge against the
ticker + wire); you trade the day's waves — commuters, the 14:00 matcha rush; at
11:00 a regular asks; incidents bite in the afternoon; at close a **receipt** prints
the real ledger (staff, milk, rent, tab interest, hedge benefit) and the **Roaster's
Letter** arrives for review — on connected runs you can post your plan to Idris's
real inbox and answer by email (contract / hold / settle). The event deck rolls a
pity-timed market at each dawn (frost, drought, clean harvest, matcha hype) that
moves the bean benchmark; **persistent Regulars** carry opinion across days into
reputation that modulates footfall and tips. New players get a **soft opening**
practice day first; the week ends in a sold-sign verdict and a seed-shareable
receipt. Full mechanics in [ARCHITECTURE.md](ARCHITECTURE.md).

The street now uses seeded, vendored Polyfork props by default. Small groups and passers-by dress the pavement; a separate simulation clock gives frontage visitors a chance to enter, based on awareness and reputation, with at most three successful spawns per day. Pausing, graphics mode, and saved-week resumes do not change those conversion draws.

A seeded fair, hot, wet, or crisp week changes the street's appearance and ambient crowd. The Morning Brief explains this before opening. Week climate adds no demand modifier; the existing daily event deck still controls its own demand effects. Closing camera frames hold through review and lead into the next morning's crane.

## Data layer

- **Source**: Maven Analytics "Coffee Shop Sales" — 149k transactions, 3 NYC locations
- **Transform**: `transform.py` (deterministic, seeded RNG) — 13 weeks, matcha-café
  menu overlay, GBP/VAT
- **Planted signals** (the narrative arc): **RISER** — iced matcha 260→671 units/wk;
  **FALLER** — miso loaf −45%; **ATTACH** — cake on only 8.2% of matcha orders.
  Spot them on the floor, act on them before rivals do.

## Two-minute demo script

1. Show the floor. Patrons arrive — commuters first, fast and impatient *(the scramble)*
2. The Roaster's Letter: frost event. Bean costs spike on the Exchange *(the gamble)*
3. Pull ONE lever mid-demo: pre-batch matcha / reprice before the student wave *(the read)*
4. Watch the payoff: queue shifts, till ticks, the rival stand visibly starves
5. One gossip moment: a bad review spreads across the floor as patrons chat

## Getting started

```bash
npm run preview:local    # serve the latest web source at http://127.0.0.1:8766
npm test                 # full headless suite (node --test web/test/*.mjs)
npm run typecheck        # tsc --noEmit

# Optional: regenerate demand data from raw sales (not needed to play)
python3 transform.py
python3 -m grunds run
```

URL params: `?seed=N`, `?speed=60|300|1200`, `?lite`, `?skipTutorial`,
`?skipLicence`, `?demo=1` (self-running showfloor demo), `?district=polyfork`
(seeded vendored props — the default), `?district=tripo` (provider path),
`?classicDistrict`.

## Design principles

- **Deterministic first**: all numbers computed by code; LLM optional for prose/persona
- **The floorplan is the chart**: the 3D view *is* the interface — no dashboard required
- **Foresight is a skill**: the economy isn't rigged; reads must be legible in hindsight
- **Fairest losses win**: never two catastrophes in a row — pity-timed events
- **Honest numbers on screen**: cards and receipts quote real counters, never invented
  saves or projected fun
- **Demo-reliable**: frozen dataset, one clean path, fallback recording ready

## Docs

| Doc | What it is |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Systems, contracts, roadmaps (timeless) |
| [hackathon.md](hackathon.md) | The dated build log — every pass, deploy, and verification state |
| [EVAL.md](EVAL.md) | Playtest protocol, balance evidence, readiness criteria |
| [ART.md](ART.md) | Art direction and asset rules |
| [AGENTS.md](AGENTS.md) | Working notes for coding agents |
| [TRIPOTHON.md](TRIPOTHON.md) | 3D asset generation saga (Tripo/Mint/Grove) |

Built at Founders Inc., San Francisco. Sept 5, 2026.
