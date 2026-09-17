# Tripothon S1 — Winning Plan

> **Goal:** Not just submit — put Grunds in an incredible position to win
> **Global Top 3** (Game direction track), **Best Use of Tripo** ($800 global),
> and stack regional + social-media prizes on top.
>
> Companion to `README.md` (product) and `hackathon.md` (Convex All Gas log).
> This file is the Tripothon war plan: facts, strategy, build plan, submission kit.

---

## 1. Event facts (verified from developers.tripo3d.ai, 2026-09-15)

**Tripothon S1 — "Build a world as a Gift · The 1st World-Building Hackathon"**
Host: VAST × Tripo. Free to enter. Teams of 1–3 (solo OK). Open worldwide.

| Phase | Dates |
|---|---|
| Build / Submission period | **Sep 15 – Oct 5, 2026** (hard deadline is **Oct 5**, not Oct 25) |
| Regional Demo Days | Oct 5–20 (7 cities; US pool is the biggest) |
| Jury review | Oct 5–25 (online + in-person simultaneously) |
| Winner announcement | **Oct 25** |

**Tracks.** One **Direction Track** (required, any stack) + **0–3 Tool Tracks**
(optional, must *actually use* the named tool or be disqualified from it):

- Direction: **Game** · Film/VFX · VR/XR/AR · App · Physical Design
- Tool: **Tripo** · PICO · Heygears · World Labs · Jupiter

**Required deliverables:**
1. A **complete playable demo** — judges must be able to play it themselves.
2. A **screen recording** — "a walkthrough of the world, not a trailer cut."
3. A **visual asset board** — key stills, turnarounds, environment frames.
4. *(Optional)* A **public build log** — "optional, but we amplify the loud ones."

**Judging rubric — this is what we design against:**

| Direction track (e.g. Game) | Weight | Tool track (e.g. Tripo) | Weight |
|---|---|---|---|
| Creativity | 30% | Inventive use of the tool | 35% |
| Completeness | 25% | Tool synergy | 25% |
| Theme fit ("a world as a gift") | 20% | Tool contribution | 20% |
| Viral potential | 15% | Theme fit | 20% |
| Commercial value | 10% | | |

**Prizes relevant to us (Global Online pool, $19,200 total — reachable without
travel):**
- Global Top 1 / 2 / 3 — $5,000 / $4,000 / $3,000
- Best Use of Tripo — **$800** · Best Game Project — **$800**
- US Offline pool (if we travel): Regional Top 1/2/3 $5,000/$3,5,000/$2,200
  + Best Use of Tripo again ($800) — offline attendees compete for **both** pools
- Social media pool (Mac mini ×3): Most Viewed / Most Liked / Most Quoted on X,
  across IG/FB/X/YT/TikTok as of **Oct 20**. Eligibility floor: **1,000 likes
  on the post**. Tag **@TripoAI** + hashtag **#Tripothon**.

### Tripo API cheat sheet (v3, `https://openapi.tripo3d.ai/v3`)

- **Models**: `tripo-p1` — low-poly 48–20,000 faces, "Game pipelines / UGC
  generative gameplay / Mobile 3D assets" ← our workhorse. `tripo-v3.1` —
  high-fidelity hero assets (up to 1.5M tris, `detailed`/`extreme` 8K textures).
  Image gen: `seedream_v4`/`v5`, `gemini-*` (text→image, image→image,
  image→multiview). *(Live caveat: the API requires the dated versions —
  `P1-20260311`, `P2-20260801`, `v3.1-20260211`, … — pinned via the `MODEL_IDS`
  map in `convex/tripo.ts`. A newer P-series `P2-20260801` exists; A/B it
  against P1 during taste calibration.)*
- **Generative determinism — the goldmine:** `model_seed` (identical mesh),
  `image_seed`, `texture_seed` (same geometry, new skin), `negative_prompt`,
  `face_limit`, `auto_size` (real-world meters), `pbr`, `texture_quality`.
- **Post-processing endpoints**: texture regen, format-convert (GLTF/FBX/USDZ/…),
  retopology, segmentation, mesh-complete.
- **Animation**: auto-rig → rig-check → **animation-retarget** (preset
  animations onto rigged models) ← Ruth and Miso.
- **Async tasks**: `POST /generation/*` → `task_id` → poll `GET /tasks/{id}`
  **or** signed **webhooks** (HMAC-SHA256 over `{timestamp}.{raw_body}`,
  `Tripo-Webhook-*` headers, delivery id for idempotency — same shape as the
  Svix pattern we already run for AgentMail).
- **Concurrency** (account-level): P-series 3D gen **5**, H-series 10,
  image gen 1, animation 10, model-processing 5, mesh ops 10.
- **Billing**: credits freeze on task start, **failures/cancels are refunded**.
  Check per-task credit cost in the console (`GET /account/balance`).

---

## 2. Why Grunds is a contender (not a participant)

The rubric is a personality test, and Grunds already passes most of it:

| Criterion | What we already have |
|---|---|
| Completeness 25% | A shipped, deterministic, multi-day game loop with a real economy, staff, weather-of-market events, tutorial, 18/18 test gate, live deploy |
| Theme fit 20% | **We are a world.** A persistent, living, multi-tenant district with residents (regulars), gossip, memory, and seasons (harvest calendars, gentrification). "A world as a gift" is not a stretch — it is the product |
| Creativity 30% | Real commodity futures × behavioural cohorts × word-of-mouth in 3D; Drug Wars-style dawn hedge; the Roaster writes you a real email |
| Viral potential 15% | Photo mode, the Letter (already AgentMail-shareable), `share.js`, a 2-minute demoable loop |
| Inventive tool use 35% | **This is the build below** — Tripo becomes a *game mechanic*, not a texture source |

The gap: today the 3D content is Kenney CC0 props + procedural facades. Judges
of "Best Use of Tripo" will look for Tripo doing *load-bearing work*. The plan
makes Tripo the difference between "a coffee-shop game" and **"a world that
builds itself"**.

---

## 3. The concept: **The Generative District**

> *In Grunds you can't control demand. So this season, the district itself is
> grown, not loaded — every street, stand, and cup is generated by Tripo from
> the world's own words. The economy writes the prompts; the prompt grows the
> street; the street changes the economy.*

Four tiers, each independently shippable, each compounding the last.
**Tripo is used in five different API families** (P-series gen, H-series gen,
image gen, texture/seed re-skin, rig+retarget) — breadth is a tool-track tell.

### Tier A — The Generative District (P0, the spine)
The district shell is Tripo-generated per **District Seed**:
- Campaign boot (before the tutorial) → a Convex action generates the district
  kit from the seed: `N` rival stand façades, 2–3 hero props (a planter, a
  market cart, a street lantern), a sign. P-series for props (5–15k faces),
  H-series for 1–2 hero pieces with PBR.
- Deterministic: same seed → same prompts + `model_seed` → same district.
- **District Seeds are shareable** — a seed code appears on the district board
  and in photo mode. Same seed = same street = community campaigns /
  leaderboards per seed. This is the "world as a gift" line: *gift a seed,
  gift a world.* (Roguelike-seed mechanics transplanted onto an AI-generated
  world — high novelty, low risk: generation happens at boot, cached forever.)
- Fallback: `?classicDistrict` (or empty API key / generation failure) loads
  the current Kenney/procedural district. The demo must never be blocked on a
  generation failure — a hard completeness requirement.

### Tier B — The Franchise (P1, the money shot for "inventive use")
A **runtime** generation mechanic, fused with the existing letter system:
- Day 3: the gentrification beat (scaffolds already exist!) reveals an empty
  storefront across the street. The Roaster's Letter that night: *"The lease on
  14 The Row is vacant. Describe the stand you want there, and I'll have the
  builders out by dawn."*
- The player replies **in character by email** (AgentMail already delivers
  this — the reply path already parses contract/hold/settle; we add a
  `franchise: "<one sentence>"` line, or the web form equivalent in the
  Letter modal).
- A Convex action prompts Tripo (`"a small coffee kiosk, …"` + fixed style
  suffix + seed) → webhook → store GLB URL in `tripoAssets` → **at dawn, the
  stand cross-fades onto the street** (we already have GLB cross-fade-in).
- The franchise stand runs a simplified autopilot (one item, price follows
  your hedge) and pays rent to you — a second income line that the cost sheet
  and finale receipt already know how to print.
- This is the single most judge-visible thing in the game: **the player's own
  words become geometry on the street within one in-game day.**

### Tier C — The Re-Skin Season (P2, the "texture_seed" trick)
Tripo's `texture_seed` gives **identical geometry, different skin**.
- Tie a skin to the market: harvest event → warm autumn palette on the
  storefronts; frost event → cold, frosted, muted. Same stand, `texture_seed`
  shifts with the event tier (2–3 pre-baked skins per hero asset, generated
  once, cached — zero runtime cost).
- Cost: a handful of texture tasks up-front. Impact: the world visibly
  *responds to the economy with new materials* — a one-paragraph,
  unforgettable build-log story.

### Tier D — Rigged Life (P2, cheap delight)
- **Miso the cat** and/or **Ruth**: auto-rig → animation-retarget (idle,
  walk, sit) → replace the hand-authored transforms. The cat sleeping on the
  counter is the photo-mode magnet for the social pool.

### Tier E — The Asset Board & Hero Frames (P1, submission-grade polish)
- 2–3 `tripo-v3.1` `extreme` (8K) hero assets used in the **photo mode**
  golden-hour shots (your cup, your sign, the planter) — same models, better
  maps at render time.
- The visual asset board deliverable = generated prompt → rendered reference
  (Tripo returns `rendered_image_url`; Mint returns `previewImageUrl` — free
  turnaround sheets either way) → in-game frame, side by side. The provider's
  own render previews *are* the asset board.

### What we deliberately do NOT do
- **PICO track** — would need a real VR runtime port of the diorama (WebXR on
  a PICO headset is possible but unproven with our camera/interaction code,
  and "actual use" of PICO tooling is the standard). Skip for S1 — **unless
  we own a PICO headset**; if we do, a WebXR viewer mode becomes a real
  second tool track (decide by the Sep 18 gate below).
- **Heygears** — AI-glasses hardware; no meaningful integration in 3 weeks.
- **World Labs / Jupiter** — separate world-model platforms; a "dream twin"
  would be a gimmick that dilutes the Tripo story. One tool, used deeply,
  beats four tools used thinly (tool synergy ≠ tool count). World Labs is
  the one reconsider if *they* grant participant credits and not Tripo.
- No multiplayer scope additions for Tripothon. The Convex All Gas rebuild
  (persistent stands, district board) is our "world persists" story — done.

### No-credits contingency (active as of 2026-09-15 — balance is 0)

Tool tracks require *actual use* of the named tool; zero API calls =
no claim. The Direction Track and its prizes (Global Top 1/2/3, Best Game
$800) are sponsor-agnostic and fully in play either way.

**Credit acquisition, in order (the ask is ~10–20 successful P-series tasks —
failed tasks refund, so it's a few dollars' worth):**
1. Tripothon registration confirmation — participant grants are standard;
   the co-host is Tripo itself.
2. Event Discord dev channel — sized ask: "runtime generation mechanic,
   ~10–20 P-series tasks, district kits pre-warmed offline."
3. Console Billing page — claimable free-tier grant.
4. Support email — direct, sized request for the hackathon.

**Decision gate — Sep 18:**
- Credits in hand → execute the Tripo plan as written.
- Nothing in hand → pivot: same generative-district *mechanics* (District
  Seeds, the Franchise, re-skins) run through a provider we **can** call —
  the repo already carries a live `MINT_API_KEY` (mint.gg AI 3D asset API,
  used for the asset pipeline). Make `tripo.ts` a swappable provider adapter
  (same `tripoAssets` table, same content keys, different wire protocol);
  keep the "world that builds itself" story as a direction-track feature,
  drop the tool-track claim from the submission. If Tripo credits land later
  in the window, flip the adapter and claim the track.
- We own a PICO headset → add WebXR viewer mode as second tool track (scope:
  `?vr` mode reusing the scene, one build day + polish).

**2026-09-17 update — the Mint path is live, not just a fallback.**
- `MINT_API_KEY` (already in the repo) holds **33,042 credits** — a working
  generative budget with no purchase. Live `pricing:estimate` costs: model
  fast ≈248 (first task finalized at **198**), standard ≈798; 5-item asset
  pack fast ≈1240. That's ~130 fast models or ~25 district kits — the whole
  event, several times over.
- `convex/mint.ts` shipped + verified end-to-end on the deployment: same
  `tripoAssets` spine (new `provider` field), content-keyed get-or-create,
  daily budget guard, reaper-poll completion (Mint has no webhooks),
  `pollNow` for dev. Output is Three.js-ready: **Y-up +Z-forward GLB**,
  optimized GLB, preview/thumbnail images, bounds.
- **First taste-calibration asset passed on prompt #1:** franchise kiosk
  (fast, 198 credits, ~90 s) — honey-oak + brass, scalloped awning, copper
  pot, bean sacks, clean game-ready silhouette. The §7 house style block
  transfers to Mint verbatim.
- Design note: Mint exposes no seed parameters, so District Seed determinism
  comes from **key memoization** (generate once per seed, cache forever in
  `tripoAssets`), not API-level reproducibility — same player experience:
  same seed → same street.
- The Sep 18 gate now only decides the **$800 tool track**, not the game:
  the generative district builds on Mint regardless. Tripo-credit efforts
  (registration → Discord → billing → support) continue in parallel; if
  they land, the adapter flips and we claim Best Use of Tripo.

---

## 4. Architecture — how it fits the code we have

New files (follow existing conventions):

| File | Role |
|---|---|
| `convex/tripo.ts` | All Tripo API logic: `generateDistrict(seed)` action, `generateFranchise(campaignId, prompt)` action, `tripoWebhook` handler (in `http.ts`), task→asset bookkeeping, balance guard |
| `convex/schema.ts` (+) | `tripoAssets` table: `{ key: hash(prompt+model+seeds), taskId, status, prompt, model, faceLimit, seeds{model,image,texture}, glbUrl, previewUrl, bytes, createdAt, usedBy[] }` + `by_key` index; `campaigns` gains `districtSeed`, `franchiseAssetId` |
| `web/js/districtGen.js` (new) | Boot flow: fetch district kit for seed from Convex (`syncSnapshot` extension: `assets` field) → loader cross-fades generated GLBs in over the procedural base; `?classicDistrict` + failure fallback to today's district |
| `web/js/letter.js` (+) | Franchise reply path in the Letter modal + `franchise:` parsing for inbound AgentMail replies (extends `handleInbound`) |
| `web/js/world.js` (+) | Franchise stand placement (cross-fade-in, shadow budget slot, one autopilot tick in `agent`), event-tier skin swapping on hero assets, rigged Miso/Ruth |
| `tools/tripo-pipeline.mjs` (new) | Offline batch generator (pre-warm district kits for seeds, pre-bake Tier C skins, hero 8K assets) with a manifest — the same prompt library the runtime uses, so offline and runtime stay consistent |
| `videos/tripothon-walkthrough` (new) | HyperFrames composition from Playwright-recorded gameplay (same harness as `videos/grunds-demo`) — see §6 |

**Patterns we reuse (this is why the build is fast):**
- **`apiCache`** (30-day TTL) for task lookups + prompt→asset memoization;
  `tripoAssets` is the durable layer, cache is the fast path.
- **Svix-style HMAC verification** (`verifySvix` in `agentmail.ts`) —
  `verifyTripo` is the same HMAC-SHA256 recipe over `t=<unix>,v1=<hex>`,
  with `Tripo-Webhook-Delivery` id for idempotency.
- **Cron pattern**: a `tripo-task-reaper` cron (like `wire-merge-refresh`)
  re-queries any `processing` task older than N minutes — webhooks primary,
  polling backstop.
- **Graceful degradation discipline** (like the research fan-out): no Tripo key
  → classic district; one failed asset → procedural stand-in for that slot;
  the game is always fully playable. Completeness > spectacle.
- **Concurrency reality**: P-series pool is 5 — the boot kit (≈5–8 assets)
  pre-generates offline and is cached; only the franchise (1 asset, once per
  campaign) generates at runtime. No queueing risk at demo time.

**Budget guard**: `tripo.ts` reads `GET /account/balance` before each
generation; per-campaign cap (e.g. 4 P + 1 H + 3 texture + 2 animation tasks);
failures are free (refunded credits) so retries are cheap.

**Cost note**: per-task credit prices are in the console, not the docs.
First task on the calendar: register, create key, generate one P-series test
asset, read the actual credit numbers, then size the district kit. Failed
tasks cost zero, so the art-directed re-roll loop (negative prompts, seeds)
is effectively free until a task succeeds.

---

## 5. Timeline — Sep 15 → Oct 5 (submissions close Oct 5!)

> The Convex All Gas deadline (Sep 22) overlaps weeks 1–2. Tripo work is
> additive and backend-first so it doesn't collide with All Gas polish.

### Wk 1 — Sep 15–19: Foundation (≈ all-gas week 2, low collision)
- [x] Tripo console account, API key wired (deployment + gitignored `.env`),
      live-verified (`tripo:balance` authenticates; **balance 0** →
      no-credits contingency active, §3). Dated model versions discovered
      live (`MODEL_IDS` map in `convex/tripo.ts`); `P2-20260801` noted for A/B.
- [ ] Register in Tripothon (form is live; tracks: **Game + Tool: Tripo**)
      — check the confirmation for a participant API-credit grant
- [ ] Discord / support credit ask (~10–20 P-series tasks, sized request);
      **Sep 18 gate**: credits → Tripo plan as written; none → Mint adapter
      pivot, direction-track only (§3)
- [ ] ~~`convex/tripo.ts` skeleton~~ **done** — task create, webhook
      (`verifyTripo`), reaper cron, `tripoAssets`, balance guard, daily
      budget; fallback chain verified live end-to-end
- [ ] **Prompt library v1** (the secret weapon — see below)
- [ ] ~~First end-to-end: seed → district kit generated → GLB loads in
      `districtGen.js` next to procedural assets~~ **spine done via Mint
      (09-17):** first calibration kiosk generated, polled, URL-verified
      (Y-up GLB, 4.7 MB). District kit + `districtGen.js` wire-up next.
- [ ] Public: build-log post #1 + X thread "we're growing a district with
      Tripo" (@TripoAI, #Tripothon)

### Wk 2 — Sep 20–26: P0 shipped (All Gas deploy Sep 22)
- [ ] District kit complete: rival façades + hero props + sign; seed → code on
      district board + photo mode
- [ ] `?classicDistrict` + failure fallback hardened (headless-safe)
- [ ] `tools/tripo-pipeline.mjs` pre-warms a **hero seed** (the demo seed) so
      judges' first load is always the best district
- [ ] All Gas final gate + deploy; Tripo work tagged in a separate branch
      cadence so the All Gas gate (18/18) stays green
- [ ] Build-log post #2 with before/after frames (Kenney vs generated stand)

### Wk 3 — Sep 27 – Oct 2: The Franchise (Tier B) + skins
- [ ] Letter prompt → inbound `franchise:` parse (web modal + AgentMail
      reply) → runtime generation → dawn placement → autopilot income →
      cost-sheet line
- [ ] Tier C: bake 2–3 event skins (`texture_seed` variants) for hero assets;
      frost/harvest swap wired to the existing event-tier tint
- [ ] Tier D (if time): rig + retarget Miso
- [ ] Build-log post #3: *"I emailed a description of a coffee kiosk; by dawn
      it was on the street"* — this post is the viral artifact; record a
      60-second vertical cut of exactly that for IG/TikTok
- [ ] Photo-mode hero frames with 8K textures (Tier E start)

### Wk 4 — Oct 3–5: Submission lock
- [ ] Oct 3: freeze features. Bug-bash the generated-district boot on a cold
      deploy (judge simulation: fresh browser, fresh profile, 5 min to play)
- [ ] Oct 3: record the **walkthrough** (not a trailer): 6–8 min, play a real
      day at readable speed; show licence → seed board → brief → day →
      franchise letter → dawn reveal → photo mode → share seed
- [ ] Oct 4: **visual asset board** — prompt → Tripo render preview → in-game
      frame, 8–12 rows; screenshot pass for every UI surface
- [ ] Oct 4: submission form: playable URL (convex.site, hero seed default),
      walkthrough link, asset board link, build-log links, tracks =
      Game + Tripo
- [ ] Oct 5 morning: submit. Screenshot confirmation. Post #4 ("submitted —
      here's the world") with the shareable seed code

**Demo Day decision (by Oct 1):** if we're US-based / can travel, register for
the US Demo Day (pool $10,700 + the $800 Best Use of Tripo *again* + the Xbox
unlock). Travel is optional for the global pool; decide on Wk 3 strength.

---

## 6. The submission kit (rubric-mapped)

1. **Playable demo** — the live convex.site URL. Hero seed default so the
   first impression is the best district; classic fallback guarantees play.
   Fresh-browser 5-minute-to-fun is the acceptance test.
2. **Walkthrough** — extend the `videos/grunds-demo` HyperFrames + Playwright
   harness. Tone: *walk the world*, not cut the trailer (the page literally
   says so). Must contain: (a) the seed board, (b) a real market event →
   price move → patron behavior chain, (c) the franchise letter → dawn
   reveal, (d) photo mode, (e) sharing the seed. End on the live URL.
3. **Visual asset board** — a static page (could be a `dist` subroute or the
   repo's `out/`): each row = prompt text, Tripo `rendered_image_url`, final
   in-game frame, polycount. Include the failed-retry story (one re-roll with
   `negative_prompt`) — honesty reads as craft.
4. **Public build log** — `hackathon.md` pattern continues as
   `TRIPOTHON-LOG.md` in-repo + cross-posts (X/YouTube/TikTok, #Tripothon,
   @TripoAI). "We amplify the loud ones" — the log IS the viral-potential
   line item (15% of direction score) AND the Mac-mini social pool.
   Rhythm: one post per week minimum, one short video per week.

---

## 7. The prompt library (the actual competitive moat)

"Best Use of Tripo" will be decided by how *designed* the outputs look, not by
how many calls we make. Prompts are product code — version them in
`tools/prompts/` with tests:

- **House style block** (appended to every prompt): *"small-scale diorama
  prop, warm honey-oak and brass palette, soft daylight, clean game-ready
  topology, no text, no humans"* + negative: *"blurry, broken mesh,
  duplicated parts, watermark, logo, text"*.
- **Seed-derivation**: district seed → deterministic picks (façade color
  words, prop set, sign word) so seeds produce *consistent*, legible streets —
  not a bag of random objects.
- **Quality bar**: each kit asset has a written accept/reject standard
  (silhouette readable at 3 m in-game, texture holds at photo-mode distance).
  Re-rolls are free (failed-task refunds + re-rolling a *succeeded* task only
  costs that task's credits) — spend the first day on a taste calibrating
  P-series with ~20 test generations, then lock prompts.
- **Scale discipline**: `face_limit` 8–15k for stands, 3–8k for props,
  `auto_size: true` so meters line up with the existing world scale.

---

## 8. Risks → mitigations

| Risk | Mitigation |
|---|---|
| Generation quality lottery (P-series can be ugly) | Taste-calibration day first; prompt library + negative prompts; `model_seed` re-rolls; H-series upgrade path for heroes; procedural fallback per-asset |
| Credit budget unknown/too small | Read real costs on day 1; offline pre-warm keeps runtime spend at 1 asset/campaign; balance guard + per-campaign cap; failures refund |
| Oct 5 deadline vs All Gas Sep 22 | Backend-first Tripo work in weeks 1–2 (no UI collisions); All Gas gate stays 18/18; Tripo UI lands weeks 3–4 |
| Judges hit a slow/failing boot | Hero seed pre-warmed & cached; classic fallback; reaper cron; boot never blocks input (playable behind generation, cross-fade in) |
| "Actual use" challenge on the tool track | Five API families used, documented in the build log + asset board; runtime (not just build-time) generation via the Franchise |
| Viral floor (1,000 likes) unreachable | The franchise-reveal vertical + seed-sharing mechanic are built to be shareable; daily cadence on X + short video; log posts tag @TripoAI (possible amplification) |
| Scope creep (multiplayer, VR…) | Explicit §3 "not doing" list; Wk-4 freeze Oct 3 |

---

## 9. Definition of "incredible position to win"

By Oct 5 we have, in order of strategic value:

1. **The Franchise** — the only entry the Tool-track judges see where the
   *gameplay* depends on the tool: an email reply becomes street geometry.
   (Inventive use 35% + synergy 25% + contribution 20% all answered at once.)
2. **District Seeds** — the cleanest possible expression of "a world as a
   gift" for a world-building hackathon, with a built-in community/viral loop.
   (Theme fit 20% on both rubrics, viral 15%.)
3. **A complete, unblockable demo** — generated or classic, the game always
   runs. (Completeness 25% — where most ambitious entries die.)
4. **A build log people actually read** — the letter-to-geometry story is the
   thread the whole community retells. (Viral 15% + social pool + judge
   goodwill; "we amplify the loud ones.")
5. **Tripo as an ambassador** — deep, honest, multi-API usage documented in
   the asset board, including failures. Sponsors notice.

**Win path:** Best Use of Tripo ($800) + Best Game ($800) are realistic with
items 1–3 alone. Global Top 3 ($3,000+) is the stretch — it needs items 4–5
plus a walkthrough that lets judges *feel* the dawn reveal. Demo Day travel is
the final multiplier, decided Oct 1.

---

## Appendix A — Immediate next actions (today)

1. Register at platform.tripo3d.ai, create API key, generate one `tripo-p1`
   test ("small coffee kiosk, warm wood and brass, game-ready, no text"),
   note credit cost + latency. *(user step — console account)*
2. Submit Tripothon registration: tracks **Game** + Tool **Tripo** (1–3
   people; invite a teammate for Demo Day if we travel). *(user step —
   form at developers.tripo3d.ai)*
3. ~~Spike `convex/tripo.ts`~~ **done 2026-09-15** — task create → webhook →
   reaper live on the deployment, key-gated fallback verified (`TRIPOTHON-LOG.md`).
   Activate with: `npx convex env set TRIPO_API_KEY <key>` +
   `npx convex env set TRIPO_WEBHOOK_SECRET <whsec>` + webhook URL
   `https://striped-anaconda-746.convex.site/tripo/webhook` in the console.
4. ~~Start `TRIPOTHON-LOG.md`~~ **done 2026-09-15** — post #1 ready to send
   (trim the log entry to a thread).
