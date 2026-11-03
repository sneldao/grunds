# Vision — Coffee as physics (adopted Nov 2, 2026)

Status: **direction, not yet implemented.** This doc records the design vision
agreed after the "feels generic" playtest feedback. Nothing here is shipped;
roadmaps below are proposals. ARCHITECTURE.md remains the source of truth for
what *is* built.

## The diagnosis

Playtest feedback: the game feels generic. Grounded cause: the theme is
decoration, not mechanics. The commodity engine, cohorts, and gossip would
survive a swap to ramen or record shops. Coffee is the wallpaper; it should be
the physics.

## The vision

**A street of coffee, landing in a different coffee capital each day of the
week.** Every person on the street is in the coffee trade or in coffee culture:
consumers, suppliers, farmers, roasters, chocolatiers. All of them react to
real-world conditions, and those conditions shape what each day *is*.

The differentiation claim: the city is not a coat of paint. A capital is a
**parameterization of the shared simulation core** — cohort mix, ritual, local
price pressures layered on the global ticker, and the wire's voice. Same
engine, different grammar. A Melbourne day plays differently from a Milan day
because the demand model itself is different, not because the awnings changed
colour.

### The causal spine (the demo)

The novel claim only holds if a player can trace the chain end to end:

> real-world event → the wire reports it in character → the day's capital
> reacts (farmers, suppliers, patrons) → prices shift → regulars gossip about
> it on the floor → your till.

Frost in Minas Gerais on the Brazil day: the grower who writes to you is
Brazilian, the street's regulars have opinions about it before you do, and the
rival stand's posture changes. If the capitals are themed sets over the same
ticker, the game is reskinned and critics will be right. The existing
Firecrawl → event deck pipeline is the seed of this; the work is making each
capital's local conditions flow through the *same* pipeline with local voice.

### What carries over, what changes

| System | Fate |
|---|---|
| Exchange (events, drift, contracts, debt) | **Carries over** — becomes the global layer each capital's local pressures sit on |
| Regulars / cohorts / gossip | **Carries over** — cohort mix and rituals become per-capital parameters; passion for coffee is the *pressure* on cohorts, not a replacement for them (the speed-obsessed commuter is more interesting in a coffee-obsessed city, not deleted by it) |
| Roaster's Letter | **Carries over and grows** — becomes the farmer/supplier relationship layer: a Yirgacheffe grower whose harvest the news hurt, negotiating by email while the street runs. The most distinctive system; lean here hardest |
| The Floor | **Parameterizes** — one street, re-dressed per capital; do not rebuild the floor five times |
| Brief → rush → verdict loop | **Unchanged** (ARCHITECTURE.md forbids reshaping it) |

### Scope guard

One capital per day is the right scope; five fully distinct cities is not.
Five days × five cities × five cohorts × real-world data is a content
explosion the 488-test determinism suite cannot protect. Capitals are
parameter tables over one engine, not codebases.

## The street of shops — every stand is a coffee stand

The rival-stand model becomes a **street of distinct coffee businesses**, each
with its own identity, competing for the same cohorts:

### Differentiation axes

Every shop is defined along coffee-native axes, not generic "quality/price":

- **Origin identity** — a house built on a single origin (Ethiopian
  Yirgacheffe, Colombian Huila, Brazilian Cerrado). Origin ties the shop
  directly into the Exchange: a frost event is *that shop's* crisis, visibly.
- **Speciality / method** — espresso bar, filter/brew bar, siphon theatre,
  matcha-and-chocolate house, roaster-café (roasts on site).
- **Ritual fit** — each shop is tuned to a subset of the cohort table:
  a standing espresso bar owns commuters; a laptop-tolerant brew bar owns
  creatives. No shop can own all five cohorts; the street is a niche map.
- **Hybrids** — shops can combine axes (origin + method, e.g. "single-origin
  siphon house"; or chocolate + coffee). Hybrids are the strategic frontier:
  they cover niche intersections rivals leave open, but each hybrid dilutes
  specialism (see below). The player picks a position at campaign start and
  may pivot between days at a cost.

### Specialisms and distinctive insights

Each shop holds **one specialism**: a piece of information or capability no
other shop has. This converts the game's existing "foresight is a skill"
pillar into a street-level economy of knowledge:

- **Insight examples**: the roaster-café sees green-bean price movements a day
  early; the chocolate house hears tourist-wave rumours first; the origin house
  has first call on its origin's scarce harvest when an event hits.
- **Asymmetry, not secrecy**: rivals' specialisms are *visible in play* (the
  roaster-café visibly restocks before the frost headline breaks) so the
  player can read and counter them — the floorplan is still the chart.
- **The player's shop picks one specialism at campaign start**; it shapes
  which Morning Brief information is legible and which levers are cheap.
  Switching specialism mid-week costs reputation with the regulars who came
  for the old one.
- **Hybrids trade depth for breadth**: a hybrid shop's insight is weaker
  (fires later, or with noise) than a pure specialist's. Pure specialists get
  the sharpest reads but are exposed when their niche's conditions turn.

### Why this fixes "generic"

Under the current model the rival is a stat block (GLASSHOUSE price/speed).
Under this model the rival is a *character with a coffee philosophy* whose
behaviour you can read off the street and whose fortunes are tied to the same
real-world events as yours. Competition becomes legible, thematic, and
dramatic — and every mechanic is one a generic café sim cannot copy without
becoming a coffee game itself.

## The cosy street — footfall is recruited, not spawned (Nov 2 feedback)

**Feedback:** "the number of customers is overwhelming — they stream into our
shop regardless of what we do, rather than a cosy world where people wander the
street, go into other cafés, browse ours and leave."

**Diagnosis (code-confirmed):** two disconnected traffic systems. The street's
ambient layer is a garnish (`STREET_SEED` = 7 souls full / 3 lite); the
economic layer is the real population, and **100% of wave spawns target our
counter** (`wave_schedule.json` zones are all `counter`). The only non-us
destinations are failure exits — balking mid-queue, defecting while waiting.
Rivals receive traffic only as our loss, never as their own life. Player
levers change flow *rate* (awareness × spawnMin..Max), never flow *direction*
— that is exactly "regardless of what we do". Same root as the HUD feedback:
everything moves *at* the player; the fix is indirection.

**Principle:** the street belongs to itself. Most people have no business with
us; customers should look *recruited* — a door is a place people decide about.
Cosy is density of behaviour, not density of people.

**Phases (order matters):**
1. **Choreography before counts — shipped.** Arrivals pause 1–2 sim-minutes
   at the door when a line has formed (`consider` state, dwell off the
   cosmetic phase, zero new sim draws; an empty bar joins at once) and then
   make the same join/divert decision as before. Rival doors get their own
   ambient traffic (`rivalvisit`, capped at two — stop at the neighbour's
   door, leave with a cup). Balkers and turnaways already strolled out via
   the far shelf or across to the rival visibly. Harness check: net-worth
   deltas vs the pre-change tree are symmetric noise (mean ≈ +£66 on a £7k
   baseline) — economically neutral, as promised.
2. **Flip the ratio.** The measured skew (balance harness, passive policy):
   ~3,000 served + ~800 balked + ~150 defected a day ≈ 4,000 door arrivals
   (~3 per sim-minute) against `STREET_CAP` 26 ambient souls. The core lever
   is the **stroll share**: a slice of wave spawns are people passing the
   street, not the door — they glance at the board from the pavement and walk
   on (counted as `passedBy`, receipt line "passed the door"). The share
   scales DOWN with awareness (a known stand gets purposeful visits; an
   unknown one gets passers-by), which turns chalk/sampling/sponsor from a
   rate knob into a street-composition knob — "what we do" changes who walks
   in, visibly. Ambient density rises in step (`STREET_SEED` 7→10, cap
   26→30). Shipped with `STROLL_BASE` 0.32 / floor 0.08. Harness (5 seeds ×
   passive/informed, vs the phase-1 tree): the funnel was slightly over-fed —
   net worth rose on 7 of 10 runs (aggregate +12%), two informed seeds lost
   ~£350–1800, no campaign flipped to lost. Fewer arrivals means fewer
   balks, less bean bought at bad prices, less waste; skilled play buys the
   traffic back through awareness as the share falls toward its floor.
3. **The street-of-shops answer** — real rival shops with catchments, street
   events visibly redirecting footfall between doors (the long version of this
   feedback; it argues for accelerating the shop geometry below).

## The attention street — arrive as nobody (Nov 3 vision)

**Thesis (north star):** the street is a real place with its own life and a
zero-sum economy of attention — and you arrive as nobody in it. Everything
below is an implementation of that sentence.

The config already admits the gap: `demand.start: 0.28 // opening-day
awareness — nobody knows the stand yet` — the comment says nobody, the number
served ~3,000 cups on day 1 in the harness. Cold start is not a new mechanic;
it is correcting the floor to match the fiction the code already claims.

### Pillar 1 — Cold start is the default (shipped)

Day 1 opens quiet: `start` 0.28→**0.10** (≈0.28× spawn mul — less than half
the old 0.47× hose), with ~30% of those arrivals strolling past (phase 2's
`strollShare` at low awareness). The hidden guaranteed funnel is gone: wave
entries used to be `Math.max(1, round(expected))` — one customer per entry
no matter how unknown the stand; they now thin stochastically via
`waveHash01` (a pure hash of seed/day/entry/slot — no rng stream, so a
mid-day resume replays identical waves). **Passing trade stays viable**:
`spawnMin` holds at 0.18 — unknown ≠ dead. (The first cut to 0.06 made
do-nothing weeks insolvent by day 3: punishment, not fiction.)

The "do interesting things" loop already existed (chalk / samples / sponsor
buy awareness) — cold start makes it the ladder. Gains raised: chalk
0.03→**0.045** (nearly offsets the 0.055 decay — the free daily ritual
holds the street; idle drift is −0.01/day), sample 0.12→**0.18** (+0.17
day-over-day), sponsor 0.20→**0.30**. Marketing stops being a rate knob and
becomes the core loop: the harness ramp climbs 1488→2950 served across the
week under engaged play.

The frontage-conversion loop (hesitators who read the front, awareness ×
reputation, max 3/day) is the visible earn: recruited converts never stroll
(`patrons.recruited` guard), and the first one lands a **FIRST OFF THE
STREET** card. Day-1 Brief copy names the fiction: "the street doesn't know
you yet — today's crowd is earned, not given." The chapter cards reframe
with it (`CHAPTERS[].d1` alt-sublines on day 1: FIRST LIGHT — "nobody
knows your name yet", THE COMMUTE — "give them a reason to stop", THE
MATCHA WAVE — "most won't look twice", LAST ORDERS — "every cup today
was chosen, not given").

**The rebalance, measured** (harness, 5 seeds × policies): verdict gates
retuned with the economy — held £4,500→**£1,000**, good £5,500→**£2,500**,
star £8,000→**£4,500** (rep bars unchanged). Do-nothing play averages +£469
with 3/5 seeds lost; exchange-smart play +£1,802; street-working play
+£3,849–4,267 and reliably held. The old gates assumed the hose and are
unreachable without it. Integration playthroughs (campaign-tight,
stock-loan) now stage marketing as part of a "competent week".

### Pillar 2 — The attention economy (phase 3's better name)

Footfall is a shared, scarce stock that all six shops compete for; nobody is
born entitled to it. Mechanically: attention as a **per-shop stock** that
decays and that events/moments/levers move — the extension of the existing
awareness decay (0.055/close) to the whole street. Catchments (phase 3) are
the allocation of that stock across doors. Zero-sum means our revenue falls
with the floor: the economy's fixed costs and verdicts re-tune together.

**Thin slice shipped (step 1 of 3).** The street is now one thing, not two
lists: the four neighbour buildings ARE the roster — THE QUILL (brew bar +
reading room, washed-lot shelf, `rain_taster`), HEARTH & RYE (the roaster in
the old bread hearth, Brazilian origin house, `frost_watcher`), BELL & BRASS
(the established house, reads the board a day early, `harvest_ear`), MARROW
LANE (the chocolate hybrid) — door ids and roster ids are identical, so a
door, an agent route and a shop row can no longer disagree. The old names
(HUILA HOUSE etc.) were data-only; the buildings led and the identities moved
in. And each shop now **wears its market posture on the pavement**: an A-frame
board by each door, repainted at dawn from the same `streetForDay` shape the
morning Brief renders (`boardLine` — pure, tone-mapped: dark when the event
hits their origin, bracing when the specialist acts on an early read, bright
on windfalls, standing copy on quiet days). Walking the street now reads the
market.

**Slice 2 shipped — the boards have lines.** Each apron carries the day's
queue, sized by the same board tone (`neighborQueues` — pure hash of
seed/day/shop over the tone band: a shop the market hit stands nearly empty,
a shop on a windfall has a line of 3–4). Queues are walk-in / dwell /
peel-out members on held slots (`nqueue` kind, cosmetic stream, non-
economic), reconciled at the top of `tick()` — posture first, so a freed
slot goes to the line, not a passer-by. Glasshouse keeps its own stand-in
queue; lite streets carry none. The street now *shows* the zero-sum before
the sim ever allocates it: frost day, Hearth & Rye's apron is bare while the
rest of the block trades on.

Next slice: the multi-way zero-sum allocation itself (per-shop attention
stocks, defection weights, the full rebalance).

### Pillar 3 — Street theatre: authored moments that feel emergent (first wave shipped)

The substrate exists (dogs chase pigeons, busker-and-crowd, chatting pairs,
bench sitters). **Honest constraint upheld: true GTA emergence is impossible
in a seeded, bit-identical sim.** What we build is a library of authored,
seeded moments that *read* as emergent, one live group at a time so the
street stays legible.

Shipped (first wave, `streetLife.js` + `street-theatre.mjs`): the **coffee
argument** (a squared-up pair, one lifts the cup in question, a third slows
to watch), the **bench cat** (a fixture that breathes, flicks its tail —
faster when a walker passes — and grooms on a timer, never touching the
seeded stream) with **cat-watchers** who gather road-side of the bench on
their own `vg:cat` gate, and the **skater** (a fast crossing on its own rare
roll, board under foot, one at a time, scatters the pigeons by proximity).
All ride the street's cosmetic stream and stay off the café till.

Next: hook moments into the attention economy — a busker outside our stand
gathers a crowd that converts to awareness; an argument next door spills
footfall our way. "Do interesting things" becomes "interesting things happen
around you."

### Pillar 4 — Anchored to the real world (snapshot, never live)

The differentiator: the week you play is anchored to the market that actually
existed that day. **Hard constraint:** live-drifting prices break bit-identical
replays and the balance harness, so the contract is a *snapshot*: fetch real
arabica/cocoa levels once at campaign start, fold them into the seed; the
week's Exchange is deterministically derived from a real market. Network stays
optional with a seeded synthetic fallback (the Grove-mirror philosophy — never
a runtime dependency). Free sources: FRED coffee/cocoa series (free key),
World Bank Pink Sheet, IMF. Real weather → the climate envelope is the same
trick and nearly free (fair/heat/rain/crisp already exists). Resolves open
question 5.

### Sequencing

1. **Cold-start day 1 (first)** — the foundation the rest stand on, and the
   one that can quietly become boring if wrong: near-zero floor, an earned
   first-customer ignition beat, day-1-aware chapter copy, balance re-sweep.
2. **Street theatre pass** — authored moments, cheap to layer once attention
   is scarce enough that a moment *means* something.
3. **Real-world snapshot** — campaign-start fetch → seed fold → Exchange
   anchoring; orthogonal infra, shippable independently.
4. **Attention economy / catchments** — per-shop attention stocks and the
   zero-sum allocation (phase 3 below, restated); the full rebalance, done
   last when the street's population story is final.

## Open questions (to resolve before build)

1. Which 2–3 capitals first? Candidates should differ in ritual grammar, not
   just set dressing (e.g. Milan standing-espresso vs. Melbourne flat-white
   origin culture vs. Osaka kissaten/siphon).
2. ~~Does the player's shop also get an origin identity?~~ **Resolved — yes
   (shipped).** The Brief has a "your house" pick (shown once the street tool
   is introduced, not on the licence — the first-time licence is already
   crowded): Huila, a washed-lot bar,
   Cerrado, or no origin (the open table, bit-identical to before). A house
   whose origin the day's event names feels it harder — the swing on your
   bean index is amplified by half the street exposure (frost on your plateau
   ×1.4, a clean harvest on your valley ×1.2) — and the street comes to ask
   (+4% footfall). The Brief says so in its first "The street" line. The pick is shown once, in the Brief the morning after the street is
   first on the cards (day 5 of a standard week — the climax morning,
   carried into week 2), and saved with the week. "No house origin" is a
   real, saved answer (`'none'` sentinel) — the Exchange still sees no origin,
   so the open table stays bit-identical (proven by the balance harness). The house also holds
   **one insight** (shipped): when the coming draw names its origin, the Brief
   says so at the open, before the wire does (`Exchange.peek` — a clone of the
   rng stream, so the seeded sequence is untouched). Huila and East Africa
   have one event each, so those reads are exact; Cerrado cannot tell a
   frost from its rumour. Asymmetric, never a perfect hedge — and the price
   of the warning is the amplified swing. **Rivals now act on their own
   insight** (shipped): a specialist whose origin the coming draw names shows a
   *tell* in the Brief (Cerrado Stand buying forward hard, Huila House riding
   spot, Yirg Corner pulling a lot). A tell shows ~60% of the time it could,
   decided by a pure hash of (seed, day, shop) — no rng stream touched — so
   presence is real and absence proves nothing. **Balance (20 seeds,
   `tools/house-sweep.mjs`):** no house is dominant. Net-worth deltas vs the open
   table are small against the ~£7k forecaster baseline and noisy (Δsd £400–1000);
   Huila is a free small upside (its only event is a harvest), Cerrado and the
   washed-lot bar are net-negative bets unless the read is used well (Cerrado
   informed +£352 over uninformed, ~1.5 SE). A `scout` policy (house read + rival tells,
   signals add) did **not** beat `informed` (Brazil +£89 vs +£232, East Africa
   −£209 vs −£225; all inside the noise), so under a crude cover-or-not policy
   the tells add no measurable value yet. Raising the footfall pull 1.04→1.10
   made both risky houses *worse* (Brazil forecaster −£240, East Africa −£159):
   extra customers on a frost/drought day buy at the inflated bean cost. Pull
   is not the lever; reverted. If the risky houses need a reason to exist, give
   them a payoff on bad days that is not more volume (e.g. a contract-fee
   discount on their own origin). Brief only for now; the floor
   (chalkboard, queue) doesn't show it yet.
3. How do farmer/supplier letters map onto the capital-of-the-day? (Lean: the
   Roaster's Letter sender is local to the day's capital; the relationship
   persists across the week as the tour moves on.)
4. Multiplayer stands: do human players pick conflicting specialisms, and how
   does the street rebalance?
5. ~~Real-world data cadence: the Firecrawl pipeline updates on news cycles,
   not game days — what is the deterministic snapshot contract for a campaign
   week?~~ **Resolved (Nov 3):** the snapshot contract — fetch once at campaign
   start, fold into the seed, derive the week deterministically; offline falls
   back to the seeded synthetic baseline. See Pillar 4 above.
