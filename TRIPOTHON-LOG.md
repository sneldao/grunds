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
