# Tripothon S1 — build log

- **Project:** Grunds — The District (the Generative District)
- **Event:** Tripothon S1 · Build a world as a Gift (developers.tripo3d.ai)
- **Tracks:** Game (direction) + Tripo (tool)
- **Live app:** https://striped-anaconda-746.convex.site
- **Repo:** https://github.com/sneldao/grunds
- **War plan:** `TRIPOTHON.md`
- **Started:** 2026-09-15

> Public version of this file is cross-posted to X with #Tripothon and a tag
> for @TripoAI. One post per week minimum; the loud ones get amplified (per the
> event rules), and the social pool needs ≥1,000 likes on a post by Oct 20.

## Log

### 2026-10-05 — Tripo goes live: credits landed, provider routing shipped, first Tripo-grown districts
- **The blocker cleared:** a funded `TRIPO_API_KEY` (25,000 credits) replaced the empty key on the deployment. `tripo:balance` verifies live — `fallback: false`, 25k in.
- **Provider routing shipped (PR #25):** `district.ensure` now tries `tripo.generate` first for un-grown slots and falls back to `mint.generate` on refusal, missing key, budget stop, or throw. `kit` + `ensure` read BOTH provider keys per slot (`mintKey` vs `tripo.assetKey`), so Mint-cached seeds keep resolving untouched and a Tripo-failed slot lets Mint retry first — an outage can't pin a slot to `failed`. Tripo slots run `tripo-p1` with per-slot face limits (8–12k), the house negative prompt, and `model_seed`/`texture_seed` derived deterministically from (district seed, slot).
- **Signed-URL fix:** Tripo's model/preview URLs expire, so a success triggers `tripo.persist` — the GLB + preview are copied into Convex file storage and the row repoints. Every future visitor loads a permanent URL.
- **First Tripo districts grown: seeds 13 + 19, 5/5 each, ~48 credits/asset** (480 total of 25k). Seeds 11 + 23 turned out already Mint-grown since the Sep-19 refusal — the first player who visited them paid the generation; the memoization design did its job. In-game board shots captured for both Tripo seeds.
- **Asset board live:** `tools/build-asset-board.mjs` → `dist/asset-board.html` (built by `build:dist`, served at `/asset-board.html`). Slot · provider · status · exact prompt · provider preview → GLB link · in-game screenshot; self-refreshes from `/district/kit` so it fills in as more seeds grow.
- **`web/test/district-routing.mjs`** (19 assertions): provider order, fallback decisions, dual-key reads, idempotency, board wiring. Suite 321/321, `tsc` clean, deployed.
- **Tool-track claim is now honest:** real Tripo generations are load-bearing in the shipped game — two whole districts exist because Tripo built them.

### 2026-09-19 — The unblockable demo: `?classicDistrict`, on-demand pre-warm, seed in every artifact
- **`tools/mint-pipeline.mjs` (new):** grows or checks district kits through the *same* live `district:ensure` / `district:kit` path the first player's boot fires — one prompt source of truth (`convex/district.ts`), offline and runtime can't drift. Each poll tick kicks `mint:reaper` directly instead of waiting for the hourly cron, so a fresh kit finalizes inside one run; writes `out/district-manifest.json`. **Hero seed 7: 5/5 grown + cached** — the seed judges land on never waits on a provider.
- **`?classicDistrict` built** (aliases `?noDistrict` / `?nogen`) — the completeness guarantee the plan named but nobody had wired: `districtOptOut()` is pure + test-pinned; a classic boot makes **zero network calls**. New `web/test/district.mjs` (20 assertions): opt-out regex (incl. substring false-positives), classic/headless/no-GL/no-base no-ops, slot placement contract, main.js wiring. Gate **20/20**, `tsc` clean, site uploaded.
- **Seed visibility:** the photo-mode caption now signs every shot `· seed N` (the district board and share card already carried it) — everything a player emits names the world to gift.
- **Provider flake found the honest way:** seeds 11 + 23 (fresh shareable streets) are refused **at creation** by Mint's safety check ("couldn't complete the safety check. Try again.") — every slot, 4 retry rounds, ~45 min. Seed 7's byte-identical lantern prompt proves it isn't our prompt library. The floor degrades exactly as designed: `missing` → classic stand-in, never an error. Retry via `node tools/mint-pipeline.mjs 11 23` (free until it grows).
- **Budget-guard fix this surfaced:** `apiCache.claimDaily` slots were consumed by *unbilled* creation failures — a provider outage could starve a whole day of budget. New `apiCache.refundDaily` hands the slot back whenever upstream fails without billing (mint.generate + tripo.generate catch paths); verified live — counter stayed at 0 across five fresh flakes. `MINT_DAILY_BUDGET` 25 → 40.

### 2026-09-17 — Demand: awareness + loyalty (direction-track difficulty)
- **The game got harder on purpose** (player feedback: customers came too
  easily). New pure `web/js/demand.js`: awareness 0..1 multiplies wave spawns
  0.4×–1.3×, decays 0.04/close (+0.04 catastrophes); loyalty is reputation as
  a return rate (12% at rep 62, cap 35%) — yesterday's served reappear across
  today's waves. Coasting 3 closes runs 0.55 → 0.43 awareness.
- **Brief gains a `work the street` row:** chalk (free), sample hour (£8 cups),
  sponsor the stall (£30 ops line, day 3+). Costs commit with the hedge;
  verdicts talk back under 0.35 awareness; tape + receipt print pips.
- **Proof:** new `web/test/demand.mjs` (9 pins), agency BRIEF extended, full
  suite 19/19 green, EVAL gate bumped, live on the deployment.

### 2026-09-17 — Generative District goes live: seed-7 kit grown, brief de-cluttered
- **`convex/district.ts` + `web/js/districtGen.js` shipped and deployed:**
  seed → deterministic 5-slot kit spec (mulberry32, silhouette-first word
  banks, house style, no-text guard) → content-keyed get-or-create via Mint
  (`/district/kit`, `/district/ensure` — routed, live-verified). Client
  cross-fades successes over the procedural base, normalizes arbitrary
  generator scale per slot, self-grows missing seeds on first visit.
  `MINT_DAILY_BUDGET=25` on the deployment.
- **Seed 7 pre-warmed: 5/5 success**, all GLBs URL-verified (3.5–6.2 MB),
  all previews eyeballed — honey-oak + brass coherent, no gibberish text,
  no re-rolls needed. Fresh seeds correctly read `missing` (first player grows).
- **Morning Brief progressive disclosure** (direction-track completeness):
  news-only letter (sizing paragraph + wire citation de-duplicated into
  buttons/wire), wire folded into `<details>` (kicker click opens it),
  `decide — size the position` label over the commit row, desk entry moved
  inside the open wire. Plus an honesty fix: day-1 no longer prints a phantom
  "Spot closed up N%" (tape needs a yesterday). Agency + smoke PASS, live.

### 2026-09-17 — First generated asset: the franchise kiosk (Mint, 198 credits)
The no-credits path is no longer a contingency — it's the plan.

- **Found 33,042 credits** on the repo's existing `MINT_API_KEY` (mint.gg,
  server-side, already gitignored + deployment env). No purchase needed.
- **`convex/mint.ts` shipped** — the Mint provider on the same
  provider-agnostic spine as `tripo.ts`: content-keyed get-or-create in
  `tripoAssets` (new `provider` field), daily budget guard, reaper-poll
  completion (Mint has no webhooks), `pollNow` for dev. `tripoAssets` is now
  genuinely provider-agnostic; `tripo.ts` waits for credits.
- **Cost calibration (live):** `pricing:estimate` → model fast ≈248,
  standard ≈798; 5-item asset pack fast ≈1240. The first real task
  **finalized at 198 credits in ~90 s** — estimates are conservative, and
  the whole event (district kits + franchise + re-skins) fits ~130× over.
- **Taste calibration passed on prompt #1.** "A small coffee kiosk
  storefront, warm honey-oak wood and brass fittings, folded canvas awning,
  …" → clean stylized stall, scalloped awning, copper pot + bean sacks, Y-up
  +Z-forward GLB (4.7 MB), webp preview. The §7 house style block transfers
  to Mint verbatim — no re-tuning.
- **One bug found & fixed the honest way:** the first poll marked the row
  `success` with a null URL (assets live on the operation, not the model
  stage we fetched) — fixed `pollMint` to read `op.assets` first, backfilled
  the row, and the GLB verified on disk (`glTF` magic, loads clean).
- **Design consequence:** Mint exposes no seed parameters, so District Seed
  determinism is *key memoization* — generate once per seed, cache forever.
  Same seed → same street, same player experience as the Tripo design, one
  mechanism simpler.
- Next: district kit generator (5-item asset pack per seed, `tools/mint-pipeline.mjs`
  pre-warm), `districtGen.js` boot wire-up with the classic-district
  fallback, seed code on the district board + share card.

### 2026-09-15 — The district can now grow itself: Tripo v3 wired end-to-end
The Generative District's spine is live: a full Tripo v3 integration behind the
same key-gated degradation discipline the game already runs (Firecrawl,
AgentMail, Nebius).

- **`convex/tripo.ts` (new):** `generate` (get-or-create, content-addressed —
  identical prompt+model+seeds share one row and generate exactly once),
  `byKey` (floor read at boot), `balance`, and a `reaper` backstop that
  re-queries tasks stuck in `processing`. Determinism is the point:
  `model_seed`/`image_seed`/`texture_seed` make a District Seed reproducible —
  the same seed grows the same street for every player, which is what makes a
  seed *shareable*.
- **`tripoAssets` table:** spec + task + status + URLs, indexed by key and
  task. Failed rows are re-rollable in place (Tripo refunds failed-task
  credits, so the re-roll loop is free until something succeeds).
- **`convex/http.ts`:** `POST /tripo/webhook` — Tripo's `task.completed` /
  `task.failed` events, verified with the same HMAC-SHA256 discipline as the
  AgentMail Svix check (5-minute replay window, idempotent apply — Tripo
  retries non-2xx, so we always answer 2xx once verified).
- **Cron:** `tripo-task-reaper` hourly — webhooks primary, polling backstop.
- **Spend guard:** `claimDaily` (same pattern as the Nebius budget) caps
  text-to-model tasks per UTC day (`TRIPO_DAILY_BUDGET=50`).
- **Verified live:** `tripo:balance` → `{fallback:true}` (no key yet),
  `tripo:generate` → content key + clean fallback, classic district path
  untouched. `tsc` clean.

Next: console account + API key, one `tripo-p1` taste-calibration generation,
then the district kit prompt library (the real moat — see `TRIPOTHON.md` §7).

**Same-day follow-ups (key wired, live-verified):**
- `TRIPO_API_KEY` set on the deployment (`convex env set`) + gitignored
  `.env`. Nothing secret touched the repo; `tripo:balance` authenticates and
  returns live figures.
- **The live API rejects the docs' short model names** — it wants dated
  versions. Added a `MODEL_IDS` pin map in `convex/tripo.ts`
  (`tripo-p1 → P1-20260311`, `tripo-v3.1 → v3.1-20260211`, …) so specs stay
  readable and pinned; also discovered the newer **`P2-20260801`** P-series
  model — worth an A/B against P1 during taste calibration.
- Error chain verified end-to-end: no key → clean fallback; bad model →
  normalized error; **insufficient credit → clean fallback, no row, game
  plays on.** Balance is currently **0** — the first real generation is
  blocked until credits land (top-up in the console, or a Tripothon
  registration perk if one ships).

**Same-day decision — no-credits contingency activated.** No top-up is
planned, so the plan now runs on a decision gate (full logic in
`TRIPOTHON.md` §3):
- The **Direction Track is sponsor-agnostic** — Global Top 1/2/3
  ($5k/$4k/$3k) + Best Game ($800) are fully in play with $0 of sponsor
  spend; Grunds stands on its own as the Games entry.
- The **Tripo tool track** needs actual API use, so it hinges on *free*
  credits arriving. Acquisition order: registration confirmation (the
  co-host is Tripo itself; participant grants are standard) → event Discord
  dev channel → console Billing page → support email. The ask is tiny: the
  district kits pre-warm offline once and the runtime Franchise is 1 task
  per campaign — ~10–20 successful P-series tasks total, and failed tasks
  refund credits.
- **Sep 18 gate:** credits in hand → Tripo plan as written. Nothing in hand
  → same generative-district *mechanics* (District Seeds, the Franchise,
  re-skins) run through the already-live `MINT_API_KEY` (provider adapter
  in `tripo.ts`; same `tripoAssets` table, same content keys), direction-
  track only. If Tripo credits land later in the window, flip the adapter
  and claim the track.
- Open question that changes the math: do we own a **PICO headset**? If
  yes, a `?vr` WebXR viewer mode becomes a real second tool track.

## Oct 5 — The Franchise: player words → geometry (Tier B, merged)

**The money shot is live.** Tier B from the plan shipped as PR #26: from
day 3 the morning brief offers the vacant storefront at 14 The Row — the
letter's "For Lease" beat made playable. The player types a description
(three words or more), it becomes a real Tripo `text_to_model` task, and
the stand cross-fades into the street when it lands — mid-day if the
builders are fast, else at the next dawn. Once standing it pays a `+£15`
rent line on each dawn's receipt. The player's words are now load-bearing
game state.

- **Backend** — `convex/franchise.ts` sanitizes the prompt (printable
  ASCII, bounded words, franchise-fitted suffix), derives a deterministic
  spec (`model_seed`/`texture_seed` hashed from seed+prompt — same words
  on the same seed grow the same stand), and keys the asset
  content-addressed via `assetKey()`. Retries reuse the row; a failed
  attempt frees the seed for a new description; one franchise per seed —
  the street remembers who built it. Routes: `GET /franchise/status`,
  `POST /franchise/describe`, same no-auth posture as `/district/*`.
- **Frontend** — `web/js/franchise.js` polls status, fits + grounds the
  GLB at the far-row slot (`FRANCHISE` in `config.js`), fires the arrival
  toast. Same never-block posture as `districtGen`: classic district,
  headless, no-GL, no bridge, dropped connections — the procedural street
  is always the floor.
- **Live-verified end-to-end on seed 99**: describe ("a tiny ramen
  counter with red lanterns") → real Tripo task `524526a0…` (40 credits,
  P1-20260311, finished in under a minute) → reaper resolved at the
  10-min mark → GLB + preview persisted into Convex storage →
  `/franchise/status` serves permanent URLs. Invalid prompts return
  `{status:"invalid"}` and free the line for another try.
- Suite 322/322; `web/test/franchise.mjs` pins sanitize/spec determinism,
  poll→place→rent timing, and every main.js wiring anchor.

**Credit ledger**: 10 kit tasks (seeds 13/19, ~480) + 1 franchise probe
(40) ≈ **520 of 25,000 used**. Remaining Tier-C/D runway is enormous.

**Honest note for the judges**: the reaper resolves tasks at the 10-min
mark (webhook optional), so a stand described during the day most often
arrives at the next dawn — which happens to be the better fiction anyway
("the builders work overnight"). Described-early generations can still
land mid-day.

## Oct 5 (late) — The fountain hero, thirteen grown streets

**Six slots now.** `DISTRICT_SLOTS` gained a hero — a **fountain** on the
far row beside the franchise storefront, run through the newer **P2**
pipeline at a stand-scale 15k face budget (the taste-calibration A/B the
plan called for). Slot order is append-only so every existing seed kept
its prompts; grown seeds picked the fountain up on their next ensure with
zero re-growth.

**13 streets fully grown** (78 slots): 7 · 11 · 13 · 19 · 23 · 3 · 5 ·
17 · 21 · 27 · 31 · 42 · 99 — plus two live franchises (seed 42's "a
bakery with blue shutters", seed 99's "a tiny ramen counter with red
lanterns"), both Tripo-built and persisted to Convex storage.

**Two honest limits hit, both handled by design:**
- Tripo's **concurrency cap** ("exceeded the limit of generation") tripped
  mid-burst — the affected slots fell through to Mint per-slot, so the
  streets are a visible provider mix (a live demo of the fallback chain,
  not a bug). Stragglers self-healed on re-ensure once the queue drained.
- The 50/day `TRIPO_DAILY_BUDGET` guard tripped once — raised to 500 for
  the sprint; still bounded, still logged.

The asset board now shows a **★ franchise row** per seed — a player's own
words next to the kit prompts — with live refresh on both routes.
Balance: ~22,830 of 25,000 credits remaining after ~60 generations.

## Oct 5 (later still) — The whole Row is buildable: three lots, photo-to-model, inherited stands (PR #28)

**The franchise went from a storefront to a street.** Three vacant
storefronts now unlock across the campaign — 14 The Row on day 3, 11 on
day 4, 18 on day 5 — and each one takes its own description. By the
finale the player has authored a third of the street themselves; the
Tripo generation isn't decoration, it's the campaign's creative verb.
"Their world grew three buildings while they slept" is now playable.

- **Photo-to-world shipped.** The same describe line accepts a pasted
  image link → Tripo `image_to_model` turns a photograph of a real café
  into the stand. `GenerateSpec.imageUrl` flows through the same
  content-keyed, budget-guarded, reaper-resolved, storage-persisted
  pipeline as text. Live-verified: seed 42 lot 11 resolved a photo
  source to a real GLB in Convex storage.
- **The gift made legible.** One franchise per `(seed, lot)` means
  first-come authorship is the mechanic the event is named for — every
  later player on a seed inherits the stands, and once the Row is
  spoken for the brief says exactly that ("built by a previous owner
  and still pays you rent").
- **Determinism deepened**: the lot salts `model_seed`/`texture_seed`
  hashing, so identical words on different addresses grow different
  geometry. Pre-multi-lot franchise rows back-fill to lot 14 — no
  regeneration, no drift.
- **Live-verified all six stands**: seed 99 carries the full terrace
  (ramen counter · jazz record shop · flower kiosk), seed 42 carries
  bakery · photo-built stand · bookshop — all `success`, all persisted.
  `locked`/`invalid` gates verified live (day-3 describe on the day-5
  lot correctly refuses).
- Suite 322/322 after the franchise test's rewrite (75 checks — lot
  parity across client/server tables, unlock gating, per-lot placement
  and summed rent timing, image-mode anchors on route + spec).

**Credit ledger**: 2,920 of 25,000 used (~22,080 remain). The gift
credits remain largely unspent — the ambition that fit the deadline was
depth of mechanic, not volume.

**Caught and fixed in the same sprint**: adding `imageUrl` to the asset
fingerprint initially shifted every content key, orphaning all
pre-existing TriPo rows (seed 13 read all-missing). The fix only
appends `imageUrl` to the fingerprint when a spec actually carries one —
text-mode keys are byte-identical to before, every orphaned row
re-resolved instantly, and the ~15 slots that re-grew under the shifted
keys became harmless duplicate rows. The test now pins the conditional
fingerprint so a future spec field can't repeat it.

## Consistency pass — the Row meets the game (2026-10-05, late)

A harmonization sweep across every system the Row touches, after the
purpose/worksite sprint left seams:

- **Live arrival is real now**: `/franchise/status` runs `statusLive`,
  which re-queries Tripo for any task past 90s (`tripo.pollTask`,
  factored out of the hourly reaper). Verified end-to-end on seed 5 —
  three stands described, resolved to `success` inside ~2 minutes
  through the status read itself, no cron wait.
- **World + letter agree with the Row**: claimed lots suppress the
  baked day-5 scaffold props that physically overlapped them; the
  Roaster's Letter reads `s.row` = { built, claimed, unsigned } instead
  of asserting the pre-Row "For Lease / scaffolded" story. `rowSummary`
  returns null until a live status read lands so dead mode keeps legacy
  lines and a boot-time letter can't assert unknown state.
- **Purposes scaled to the economy** (+0.04 awareness / +8 returnees /
  +£40 tenant lease — the £5 uplift was ~7x weaker than the hub's gross
  against a ~£2.9k/day operating nut) and centralized in
  `FRANCHISE.purposes`; UI labels, effects, and receipt rows all derive
  from the one table.
- **Honest toasts**: `state.onArrived` was never assigned — arrival
  toasts were unreachable. Now wired, and the first status read
  hydrates silently (`announce=false`) so an inherited street doesn't
  announce itself as newly arrived.
- **Receipt speaks the player's words**: the chosen purpose is named
  ("a draw" / "a hub") and the tenant uplift is split out of the stand-
  rent line ("a tenant's lease"). Asset board: `player-authored`, and
  purpose shown beside the prompt.
- Suite: focused franchise file green (151+ checks incl. new anchors
  for the nudge, suppression, hydration silence); typecheck + syntax
  clean. No browser used anywhere — hardware constraint respected.

**Demo seed for the video**: `?seed=5` — fully-grown district plus all
three purposes standing: a neon-lit vinyl listening bar (draw), a
corner bookshop (community), an artisan bakery (rent).

**Credit ledger**: ~3,070 of 25,000 used (~21,930 remain) — three more
generations for the purpose-demo Row.
