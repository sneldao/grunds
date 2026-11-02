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

## Open questions (to resolve before build)

1. Which 2–3 capitals first? Candidates should differ in ritual grammar, not
   just set dressing (e.g. Milan standing-espresso vs. Melbourne flat-white
   origin culture vs. Osaka kissaten/siphon).
2. ~~Does the player's shop also get an origin identity?~~ **Resolved — yes
   (shipped).** The licence has a "your house" pick: Huila, a washed-lot bar,
   Cerrado, or no origin (the open table, bit-identical to before). A house
   whose origin the day's event names feels it harder — the swing on your
   bean index is amplified by half the street exposure (frost on your plateau
   ×1.4, a clean harvest on your valley ×1.2) — and the street comes to ask
   (+4% footfall). The Brief says so in its first "The street" line. The pick
   is saved with the week. The house also holds
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
5. Real-world data cadence: the Firecrawl pipeline updates on news cycles, not
   game days — what is the deterministic snapshot contract for a campaign week?
