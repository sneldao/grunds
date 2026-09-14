# Hackathon log

- **Project:** Grunds
- **Event:** Convex All Gas Hackathon
- **What it does:** A live 3D coffee-district economy game where players run café stands and AI patrons with persistent memory buy based on cohorts, commodity events, and gossip.
- **Live app:** https://striped-anaconda-746.convex.site
- **Repo:** https://github.com/sneldao/grunds
- **Frontend:** Convex static hosting
- **Convex deployment:** https://striped-anaconda-746.convex.cloud
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions (live: /ai/letter, /ai/research, /ai/gossip, /sync/*, /agentmail/webhook), crons, static hosting
- **Auth:** none
- **AI models:** meta-llama/Llama-3.3-70B-Instruct via Nebius Token Factory (live), gpt-4o-mini (key-gated action stub, falls back offline)
- **Started:** 2026-09-05T20:48:27Z
- **Last updated:** 2026-09-14T00:00:00Z

## Log

### 2026-09-14 - Inverted wire + ticker board
The paywall was hiding the USP — free players could never *see* the news move prices. Inverted:
- **Desk opens for everyone** (`desk.js renderDesk(intel, subscribed)`): summary + clickable source headlines (real links, `rel=noopener`, host caption) + a free "why this matters" line from the lead shift. Only the quantitative **deck tilt** (× multipliers + per-card reasoning + card names) gates on `commodity_insider` — free readers see a placeholder row naming the boundary.
- **Invite, don't block:** new `#desk-edge` footer in the desk offers `peek the edge →` to non-subscribers (opens the paywall, tracks `paywall_shown`); opens tracked separately as `desk_opened` vs `desk_opened_free`.
- **Ticker board upgrade (`world.js`):** the in-world brass board now draws a **sparkline of the bean-index history** (line + dots + lo/hi labels, today's index included) and a **bias glow** — the board tints warm when the wire amplifies a bad card, green when it loads a good one (`bias` passed price-directional from `updateTicker`, EVENTS tier-aware). `· WIRE` badge + "tap the wire for sources" caption when a tilt is active.
- Paywall perks reworded to sell the gated edge, not the now-free sources. `desk.mjs` updated to assert the inversion. Gate 17/17, `tsc` clean, site re-uploaded.

### 2026-09-14 - Agency pass: the tape, sized contracts, letter stakes, the regular's ask
Playtesters' second pass: "no real dialogue or interactivity mid-day, no sense the market is a thing I can read or act on." The Drug Wars loop — information → plan → execute — existed but was illegible. Five fixes, one coherent change: **make the market a visible object, then make decisions about it sized and personal.**
- **The Tape (`#tape`):** a new HUD line shows `beans 1.15 ↑ +15% · EAST AFRICA SHORT RAINS · wire ↗` — current index, day-over-day delta vs `tapePrev` (stashed at dawn), direction arrow, event name. Clickable → opens the Wire desk when `marketIntel` exists. The market is now a number you *watch*, not a hidden die roll.
- **Letter stakes (`letter.js tapeLine`):** the nightly letter now names the day's spot move (`Spot closed up 15% — ...`) and says what it implies (rising board → lock tonight buys tomorrow at today's price; falling → ride spot). The information→plan→execute turn is now explicit in the fiction.
- **Free market visibility:** the tape + event + wire *scent* hint are free — news visibly moves prices for every player. The paid desk keeps cited sources, exact multipliers, and card names. Information asymmetry stays buyable; basic comprehension doesn't.
- **Sized contracts:** letter now offers four replies — `contract` (light: ½ units, ½ fee — covers the wave), `contract_deep` (2× units, 2× fee — rides into tomorrow), `hold`, `settle`. `exchange.contractBeans(units, fee)` parameterized; the position still burns cup-by-cup and clears at quota. Keys 1–4.
- **The regular's ask (`#offer` modal):** once per day at 11:00 a named regular pauses the floor and makes an offer — Y accepts, N/Esc declines, each with a real simulated consequence: Pip's study group (+22% demand at 14:00), Esther's stamp card (£15 now, her cups free forever), Olu's bridge club (£9 at 12:30 + 4 patrons), Gwen's gesha (20 units for £6.40 into prebatch), Mara's office run (£28 at 15:00 *if* queue < 6 — else they go to GLASSHOUSE). Rotates `(day-1) % 5`; headless-gated so tests don't stall on the pause.
- **Tests/build:** new `web/test/agency.mjs` proves tape wiring, sized contract math, 4-reply letter with delta line, and all five offers' deferred consequences. Gate **17/17**, `tsc` clean, site re-uploaded. (No Convex changes — the `/ai/gossip` route from the prior pass now serves the ask's voice.)

### 2026-09-13 - Delight craft pass: performance + every 10ms detail
The game already read clearly — now it *feels* made. A 4-bucket craft pass: lock 60fps, add weight, add time, add life. No new currencies, no new levers — just the payoff moment you just made legible, made intentional. Two real regressions caught and fixed in the same pass:
- **P0 performance lock (no new systems, pure feel):** `?lite` now auto-enables on `hardwareConcurrency≤4` or `deviceMemory≤4` (no shadows/post-FX without asking); **dynamic lite** trips after 3 frames >32ms mid-wave → kills `shadowMap` + `postfx`; **shadow budget** at `queue>40` disables shadows to save fill-rate at 14:00; `loader.js` GLBs **cross-fade `opacity 0→1` over 400ms** on `place()` resolve (headless-aware `setTimeout` so the main loop's single RAF slot is never stolen); `audio.js` pad **pre-warms `0→0.02 in 600ms →0.055`** so Day 1 isn't silent.
- **Weight (things have mass):** tiny **till drawer** (0.62×0.06 box under register) slides +0.38m for 420ms on every `sale()` plus a **stretching shadow plane** (`scale 1→1.35`, opacity 0→0.18) driven by `world._updateDelight(now)` lerp 0.22; **coins arc** with `vy 0.9–1.4 → gravity` + a `spinZ` 2–3.2 rad encoded as horizontal drift; chalk `screech 1200→900Hz` + 10 chalk huffs now paired with **menu desaturate + 1.02 board wobble** on `flashChalk`.
- **Time (the clock is felt):** `#till` now `font-variant-numeric: tabular-nums` so digits don't jitter; `fx.receipt` **staggers line-by-line at 30ms** (till *prints*) and **typewrites the verdict at 18ms/char** with a `prefers-reduced-motion` bypass; at `1×` a soft **90Hz clock tick** throttles to 0.9s (`audio.tick()`), felt not heard.
- **Life (the shop breathes):** sitters now **sip at `dwell==4`** — arm lifts 0.6rad, head dips -0.04m, lean -0.14, steam puff from `fx.steam`; **street cat Miso** (`world.cat` capsule+head+tail) walks `spawnL→door→tables` at 1.1m/s once/day ~09:30 (`world.spawnCat`/`updateCat`), sits 8s if `queue<4`, scatters if >10 while sitting, meows once per sit via `audio.meow()`; **living plant** (3 spheres over the right planter at -2.2,6.6) tints HSL `0.28→0.10` lush→brown, wilts scale/wilt + emissive when `queue≤5`, driven every HUD tick via `world.setPlantHealth(queue)` + `audio.purr()` 38Hz sine; **rival leans** -0.08rad when `rivalHeat>6` + **jeers** on 5 defections via `world.jeerRival()` (2.2s emissive pulse); **Idris quips** at 10:00 rep≥80 praise / 12:00 rep<62 warn from `COPY.idrisQuips`; **weather as mood** ties `mistMat` + `godRay` quad (18×14 translucent) to `event.tier` (frost 0.22 grey-blue, harvest 0.14 warm shafts).
- **Payoff juice (14:00 now explodes):** at the 17:00 debrief, `saved≥6` → `audio.waveFanfare(saved)` rising major triad (pitch tracks saved) + `rig.focus(counter)` 3.5s crane + `fx.coinRain` 10–22 coins + `fx.victoryBurst` card pop + haptics `[20,30,50]` + `setPlantHealth`; flop → `audio.waveRain` + 35ms buzz. `doReprice()` puffs `fx.chalkDust` + `audio.chalkScreech()`.
- **Coherence & respect:** hover a patron → **story card** (`nearestPatronAt` projects every `inQueue`/`sit` patron, 36px radius, shows `Mara — flat white · op ♥0.42 · friends: Dev, Olu`; click to wave → `+0.06` op + bubble + 20ms haptic); `P` / 📷 **photo mode** freezes at golden hour (`dayMin=1080`, `world.updateTimeOfDay`), renders to 720×405 canvas with vignette + caption, downloads `grunds-day1.png`, `audio.shutter()` click+thump; `GRUNDS` secret → **Gwen gesha £7.80** flashes 4.2s then reverts, persists as a next-day toast (`exchange.geshaUnlocked`); queue bar now **heartbeats** at >10 and **purrs** at ≤5; `@media (prefers-reduced-motion: reduce)` now also kills `heartbeat`/`purr` + vignette.
- **Two regressions fixed (would have shipped broken):** (1) **`reputation NaN` → `campaign-tight` filtered `regulars[]` (`Tomas`/`Yuki` out), then `opContagion` indexed by sparse `r.i` into a dense array → `undefined op` → `NaN` contagion → `reputation NaN` → `footfallMul NaN` → dawn spawns killed the loop.** Fixed `regulars.js:opContagion` to use `Map<i→op>` + `find(rr.i===f)` + `Number.isFinite` guard.** (2) **RAF steal at campaign close → `fx.receipt` used `requestAnimationFrame` inside the row loop. Headless harness owns the single RAF slot (`rafCb = cb`) — one extra RAF overwrote `loop` → `runFrames` saw `null`. Fixed with `isHeadless` branch (sync + `setTimeout` stagger).** Verified headless before/after.
- **Tests/build:** gate **16/16**, `tsc` clean, `dist` 43 files (`web/js/desk.js` now shipped). `smoke`: cold 555→433 balks with levers holds.

### 2026-09-13 - Calm open, tutorial, payoff legibility, analytics & polish
P0 design fix for "looks crazy on launch / don't know what to do" — pacing, onboarding, and payoff all made legible, plus the measurement and replay hooks that prove it:
- **Calm open (pacing):** default speed **1× (60)** for new players (`?speed=300/1200` still honored, headless stays at 5×); day-1 first 12 sim-min demand ×0.5 + morning (<10:00) ×0.52 so the queue trickles while eyes settle; gossip throttled to 10% in the calm window (35%→14% at 20× otherwise); `WALK_MUL` eased to 1/3/6; camera breath muted 7s after `crane()` (`_calm` factor 0.25→1) — street reads as curated, not handheld.
- **3-step tutorial (paused start):** `OPEN` → 3-step card overlay (Read 14:00 / Lever 1+2 / Keep 5 vs GLASSHOUSE, `Enter`/`Space`/`Esc` + Skip) → 3.4s paused crane settle before first tick; bypassed via `?skipTutorial`/`?notutorial`/headless; bypassed sim still gates on `!tutorialActive`.
- **Goal-first HUD:** new brass `#goal` strip ("Keep the queue under 5 · 14:00… Hit 1 to batch"), `#queuebar` health bar (ok/warm/hot + "queue 7/12 — watch it"), `#batchcount` pulse on change; levers pulse `attention` until first use on day 1; chalkboard flashes brass/matcha via new `world.flashChalk(kind)` + `W.menuMat` emissive.
- **Lever prediction on press:** `doPrebatch()` shows `Chalkboard: 12 → ~6 by 14:00 with 40 warm cups` and flips the goal bar to live status; `doReprice()` toasts "New price holds the line" — `-£4.20` now reads as investment.
- **14:00 wave debrief (payoff):** new `fx.debriefCard()` at 17:00 (dayMin≥1020, once/day) — `14:00 — THE WAVE` with `balk / served` vs counterfactual `Without it: ~Z would have walked · saved ~£XX` and a verdict (`You held the line.` / `Try 1 before noon tomorrow`); also toasts saved cups.
- **Day-2 forecast (replay hook):** toast at 17:30 day 1 (`Forecast Day 2: … board 1.05 · matcha £4.95 — you'll choose at closing`) + brass `#r-forecast` stripe on the day-1 Z-read receipt — preview is truthful (`priceForDay(2)`, `drift.perDay`).
- **Notebook earlier + coach earlier:** notebook pinned at 06:01 day 1 (read arrives before the rush); day-1 coach moved to **12:00** (was 13:00), halfway between noon reading and 14:00 wave.
- **Analytics (playtest measurement):** new `web/js/analytics.js` — offline-first, localStorage, `__grunds.analytics.summary()`; events `tutorial_step/skip/complete`, `first_lever_at_min`, `lever_batch/reprice`, `day1_balk`/`balk` (throttled in console), `wave_debrief_shown`, `forecast_shown`; boot prints 5-question script (`time-to-first-lever <90s`, `% who press 1/2 before 14:00`, `can they say win condition`).
- **Share virality framing:** `share.js` now leads with outcomes the player caused (`Held the line — 320 served, 12 walked (4%)` / `Beat GLASSHOUSE`) not just `£42`; `campaignClose()` passes `served`,`balked`,`beatGlasshouse`.
- **Mobile + a11y:** `touch-action:none` already; `index.html` adds `@media (prefers-reduced-motion: reduce)` killing grain/pulse; `camera.js` breath scales to 0 under `prefers-reduced-motion`; distal HUD `#district` + receipt `#r-stands` leaderboard surface (`refreshStands()` after each dawn/close/finale); `__grunds.analytics` exposed for console QA.
- **Convex parity:** `convex/exchange.ts` `openDay(bias)` + `convex/linkup.ts` `LINKUP_RESEARCH_QUERY` export; server `openDay` reads cached Linkup `marketShift` (clamped 0.2–3×) inside the pity-timer roll; `convex/http.ts` adds `/sync/stands`, `/ai/letter`, `/ai/research`; `convex/crons.ts` adds `linkup-intel-refresh` 06:15 UTC; `convex/nebius.ts` host migrated to `api.tokenfactory.nebius.com` + model `Llama-3.3-70B`.
- **Tests/build:** `web/test/intel.mjs` (bias frequency + pity under bias + citation + route/cron/consumer wiring); `game-feel` coach gate widened to 720|780; loop gate now checks `tutorialActive`; gate **15/15**, `tsc` clean, `dist` 42 files.

### 2026-09-13 - Nebius Token Factory goes live
Wired the Applied AI integration end-to-end ahead of the Burning Token
submission (Applied AI · Nebius challenge):
- Migrated `convex/nebius.ts` off the retired AI Studio host to Token Factory
  (`api.tokenfactory.nebius.com/v1`) and onto a current model
  (`meta-llama/Llama-3.3-70B-Instruct`); key set via `convex env set`, never
  in the repo.
- New `POST /ai/letter` HTTP route (`convex/http.ts`) runs
  `nebius.enhanceLetterNebius` — the Roaster's Letter now gets an
  in-character LLM rewrite with token/latency metrics, cached 7d by input
  hash so replays cost zero.
- `web/js/main.js` `showLetter()` renders the templated letter instantly,
  then swaps in the enhanced prose when the live call returns, signing it
  `— Idris · Llama-3.3-70B · {latency}ms`. Fire-and-forget; offline-safe.
- Verified live: `fallback:false`, 207 tokens, ~12.7s cold (cached after).
  Gate 14/14, site re-uploaded.

### 2026-09-13 - district leaderboard surfaces in the UI
Made the Convex multiplayer visible to anyone playing (Multiplayer · Convex
challenge):
- New `GET /sync/stands?campaignId=` route (`convex/http.ts`) serves
  `stands.topStands` (limit 8) over the same plain-fetch bridge — no client
  lib needed on the static floor.
- `web/js/convexSync.js` gains `stands()`; `web/js/main.js` `refreshStands()`
  runs after each dawn mirror, at day close, and at the week finale.
- HUD gains a `district` line — `1st <owner> £till · you Nth of M` — and the
  Z-read receipt gains a "district standings · live on convex" block with
  the player's row marked "— you". Owner names render via DOM text (no
  innerHTML) since `?stand=` is user input.
- Verified live: two owners mirrored into one campaign return sorted by
  till over `/sync/stands`. Gate 14/14, site re-uploaded.

### 2026-09-13 - Linkup research drives the market deck
Wired Deep Research end-to-end so findings do work, not just sit in a
module (Deep Research · Linkup challenge):
- `GET /ai/research` (`convex/http.ts`) serves `linkup.searchCommodityIntelligence`
  over the plain-fetch bridge; nightly `linkup-intel-refresh` cron keeps the
  6h cache warm alongside the Firecrawl tick.
- Server-side: `exchange.openDay` reads the cached `marketShift` payload and
  multiplies event weights (clamped 0.2–3×) inside the seeded pity-timer
  roll — a frost report genuinely makes frost more likely.
- Client-side: `convexSync.intel()` fetches once per session;
  `web/js/exchange.js` `roll(bias)` applies the same clamped multiplier to
  the floor's own deck, so the played game reacts to live news too.
- The roaster's letter cites the wire — `intelLine` prints
  "Off the wire — <headline> (<domain>)" when sources arrive; a day-1 toast
  names the top market shift.
- New `web/test/intel.mjs`: biased-deck frequency, pity timer under bias,
  citation presence/absence, and route/cron/consumer wiring. Gate 15/15.
- Live with `LINKUP_API_KEY` set via `convex env set`: first real pull
  processed 20 sources, detected `drought_ea` ×1.5 (Brazil drought coverage),
  cited Business Insider/WisdomTree in the letter. Caught and fixed a real
  bug on first pull — corroborating sources produced duplicate shifts that
  would have stacked 1.5^n into the deck; now one multiplier per eventId at
  both producer (`linkup.ts`) and consumer (`exchange.ts`). Gate 15/15.

### 2026-09-13 - District Insider Pass: subscriptions gate the wire
Built the freemium layer (Subscriptions · RevenueCat challenge): the week
stays free; the *edge* is paid.
- **The Wire (research desk)**: `web/js/desk.js` renders the full Linkup
  briefing — every cited source, each deck tilt (`event ×weight`), and the
  reasoning behind tomorrow's roll — gated on the `commodity_insider`
  entitlement. Free players keep the toast + one letter citation;
  subscribers get the desk.
- **Paywall**: `⚡ the wire ↗` HUD button appears once intel lands; a letter
  link ("insiders read the full wire before they choose") sits under the
  reply actions — the upsell surfaces exactly where the hedging decision
  happens. District Insider Pass modal: 3 perks, £4.99/mo, restore +
  dismiss, mode badge.
- **`web/js/billing.js` rewritten**: live path loads
  `@revenuecat/purchases-js` (CDN, pinned 1.47.3) only when a Web Billing
  public key is configured (`?rc=` / localStorage / `RC_API_KEY` const) —
  `configure` → `getOfferings` → `purchase({rcPackage})` → entitlement
  check; stand owner doubles as appUserId. Falls back to the Web Test
  Store so the full flow demos before production keys land. No key in repo.
- Analytics hooks: `paywall_shown`, `desk_opened`, `purchase_success`.
- New `web/test/desk.mjs`: entitlement lifecycle (test store), SDK surface,
  gating, markup, wiring. Gate 16/16, site re-uploaded. Awaiting the
  RevenueCat Web Billing public key to flip live checkout.

### 2026-09-13 - RevenueCat Test Store live end-to-end
Real SDK verified on the deployed site: `Purchases.configure` with the Test
Store public key, `getCustomerInfo` + `getOfferings` live (`$rc_monthly`,
`monthly` product), and a full Test Store purchase round-trip — the SDK's
own checkout modal → `commodity_insider` entitlement active → desk unlocks.
- `RC_API_KEY` set in `billing.js` (public SDK key — safe to ship by design;
  `test_` prefix = real SDK, simulated checkout).
- Mode badge now honest about all three states: "via RevenueCat Web
  Billing" / "RevenueCat SDK · Test Store checkout" / local fallback.
- Subscribe button renders the live offering price
  (`currentPrice.formattedPrice`) instead of a hardcoded £4.99 — currently
  shows $9.99/mo, matching the dashboard product.
- Verified via headless Chrome on the live site: configure → offerings →
  test purchase → entitlement → restore. Note: `convex.site` serves JS with
  `cache-control: max-age=14400` — repeat visitors may see stale modules
  for up to 4h after an upload; fresh visitors unaffected.
- **API spend guard:** `apiCache.claimDaily` adds a UTC-day counter row
  (26h TTL, same table — no schema change). `cachedNebiusChat` claims a
  slot before every *uncached* call; over `NEBIUS_DAILY_BUDGET` (2000/day,
  env-overridable) it serves the templated fallback instead — public
  `/ai/letter` spam can never burn past the cap, and the game never breaks.
  Counter verified live (claims increment 1, 2…); uncached calls still
  infer normally under budget.

### 2026-09-13 - Integration surface pass: the sponsors become the game
Three product-design fixes so judges *see* the integrations, not just the
plumbing:
- **Decision-time wire hint (Linkup × RevenueCat):** the letter's upsell
  line now leaks direction for free players — `wireHint()` maps the top
  deck tilt to a scent ("the wire smells like frost / drought / a glut /
  a craze · reads quiet") shown next to the contract/hold/settle choice.
  Free = scent, insiders = sources + multipliers.
- **The district talks (Nebius):** `regularGossipNebius` is live — new
  `POST /ai/gossip` route; `openDay` asks one rostered regular (rotating
  daily) for a one-line take on the day's event + top shift. Delivered
  mid-day as a friend-graph `gossipBubbles` hop once that regular is on
  the floor. Cached by (name|cohort|context) — every stand on the seed
  shares the pull; covered by the 2k/day budget guard. Verified live:
  "Coffee prices will skyrocket now obviously." — Mara, 112 tokens.
- **Desk shows the cards:** each deck tilt row in The Wire now names the
  actual event card it biases (`card in the deck · EAST AFRICA SHORT
  RAINS`) — the ×1.5 stops being abstract.
- Gate 16/16 (desk test updated for the new upsell copy), functions
  pushed, site re-uploaded.

### 2026-09-14 - AAA street craft: the district becomes a place
The last fidelity pass — the street already read clearly and felt alive; this pass makes it *photographable*. Every texture re-authored at 1024, every light re-hung, every facade corniced, every shaft dusty. Pure world-tooling, no new levers or currencies.
- **Textures re-authored (procedural, no fetch, all `anisotropy 8`):** `woodFloor` 512→1024 — honey-oak planks with vertical gradient + bevel + 8 grain ribbons + knots + end-grain + varnish sheen (`repeat 2.2×1.6`); `pavement` — slab grid + grout chamfer + aggregate + cracks + coffee ring + AO dots + leaf decal (`8×1.6`); `road` — dual-layer aggregate + oil stain + patch + manhole + worn dashed centre + tyre tracks (`6×1`); `awning` 16 stripes with weave + stitch + scalloped brass eyelets + AO. `menuBoard`/`shopSign`/`rentSign`/`tarp` all re-drawn at 1024 with grain, brass, stitch, grommets, emboss.
- **Light & ground kit:** exposure `1.12→1.18`, `fog 34/95→32/92`, bias tuned; new **bounce hemi** `0.22` lifts the bar underside, `hemi 0.30→0.42` + sun `0xfff6e8 1.25`; floor gains a scuff decal at the barista stand, pavement/road now carry their textures, zebra widened, awning gains 4 brass tie-downs, lamp cords + `bulb emi 1.55`.
- **Facades & skyline:** `facade()` now lays **two-tone bricks + mortar + highlight/shadow + micro-grain**, every window cut with **white frame + recess shadow + specular streak + sill shadow** (emissive map unchanged), cornice shadow; each block gains a **cornice cap + ground-floor shopfront band + brass rule**; far skyline 7→9 blocks with alternating material + tiny signed windows. *Caught a real crash:* `y` was block-scoped outside its row loop → `buildWorld` threw for every player — fixed by hoisting `y` to the row loop.
- **Ticker & street kit:** ticker `384×256→512×320`, linen grain, double rule, row rules, letter-spaced header, brass collar + 4 screws, `aniso 8`; **7 bollards + brass caps** along the pavement, **THE DISTRICT street decal** at the zebra, curb.
- **Weather as mood, now four-way:** `mist 0.4→0.42` + **warm dust motes (additive 180, `0.065`, amber)** drifting in shafts via `world.setMotes(shaft)` — frost `0.22` grey-blue cold, harvest `0.14` warm. Motes drift + cycle in `world._updateDelight(now, dt)` (lerped opacity + vertical sine recycle).
- **Onboarding trim in the same pass:** controls line `8→3` (`1 batch · 2 price · space pause`), **reactive `#goal`** (`queue≥6` → *build—batch now* / `≥3` → *watch the queue* / calm → *hold under 5 · 14:00 rush → GLASSHOUSE*), **3 just-in-time nudges** (queue≥4-unbatched → batch, first balk → *the queue’s the enemy · 1/2*, 13:20–14:00 unrepriced → price) — each once/campaign, condition-bound not timed. Also refreshed two stale test stubs (`rentSign 1024×768`, `tarp 1024²`, `setLineDash`). Gate **16/16**, `tsc` clean, `dist` 43.

### 2026-09-13 - Onboarding fix: teach at the moment of need
Playtesters reported not knowing what to do mid-game and finding the
controls line intimidating. Applied progressive disclosure + contextual
nudges instead of upfront instruction:
- **Controls line trimmed** 8 items → 3: `1 batch · 2 price · space
  pause`. Camera/photo/letter keys are discoverable or contextual.
- **Reactive goal strip:** `#goal` now answers "what should I do now"
  from live state — `queue's building — 1 to batch` at ≥6 queued,
  `watch the queue · 1 batches before the rush` at ≥3, `keep the queue
  under 5` when calm; always names the next beat (14:00 rush) and the
  stakes (walk-outs feed GLASSHOUSE).
- **Three just-in-time nudges** (once per campaign, condition-bound, not
  timed): queue ≥4 unbatched → batch hint + lever pulse; first balk →
  "they walked — the queue's the enemy · 1 batches, 2 cuts the price"
  (feedback names the remedy); 13:20–14:00 unrepriced → price hint +
  lever pulse.
- **Caught a real crash in the same pass:** `world.js facade()` used
  block-scoped `y` outside its loop → `buildWorld` would throw for every
  player. Fixed hoisting `y` to the row loop. Also refreshed two stale
  test stubs (rentSign/tarp canvases were upgraded to 1024² in the
  delight pass; `setLineDash` added to the ctx stub). Gate 16/16.

### 2026-09-12 - viral hooks, share cards, and campaign badges
Added subtle, meaningful social and engagement dynamics:
- **Z-Read Social Share Cards (`web/js/share.js`)**: Formats clean, aesthetic text/link
  summaries with 1-click share to X, featuring the day's till, reputation, roaster's verdict,
  and replayable seed URL (`?seed=N`).
- **Campaign Mastery Badges**: Performance-based awards (*Master Roaster*, *Matcha Strategist*,
  *Debt Free*, *Community Anchor*, *District Survivor*) based on net worth, debt clearance,
  and balk ratios.
- **Headless Test Suite (`web/test/share.mjs`)**: Verified badge evaluations, text formatters,
  and URL intent encodings. All 14 tests pass green.

### 2026-09-12 - behavioral economics & specialty craft slice
Built and verified the full end-to-end slice for behavioral economics & craft layers:
- **Chalkboard Decoy Pricing & Anchoring (`web/js/behavioral.js`)**: Introduced the
  Gesha Reserve Lot #4 (£7.80) to anchor price perceptions, reducing perceived
  price resistance for Creatives (-35%) and Students (-25%) on standard Matcha drinks.
- **Bean-to-Bar Chocolate & Pastry Basket Attachment**: Time-of-day weighted cross-selling
  (All-Butter Croissant £2.80 in the morning, Miso Banana Loaf £3.20, and 72% Single-Origin
  Cacao Slabs £3.60 in the afternoon) tailored to cohort affinities (Creatives & Tourists).
- **Tip Jar Social Proof**: Visibility feedback loop where accumulated tip levels
  reinforce tipping probability from patrons.
- **Headless Test Suite**: Added `web/test/behavioral.mjs` verifying anchoring curves,
  basket attachment distributions, and tipping mechanics. All 13 tests green.

### 2026-09-12 - sponsor challenge integrations
Added high-impact sponsor integrations focused on elevating game design:
- **Linkup (Deep Research)**: `convex/linkup.ts` queries live global coffee commodity
  market news, shipping disruptions, and harvest updates via Linkup's search API.
  Findings dynamically bias the morning event deck and are cited in the Roaster's Letter
  with live URLs (cached 6h in `apiCache`).
- **Nebius (Applied AI)**: `convex/nebius.ts` connects to Nebius Token Factory inference
  (Llama 3.1 70B / Qwen 2.5) to power in-character prose generation for Idris's Roaster's
  Letter and dynamic patron reaction lines, tracking token usage and inference latency.
- **RevenueCat (Subscriptions)**: `web/js/billing.js` provides Web Test Store integration
  for the "Commodity Trader / District Insider Pass" entitlement.

### 2026-09-12 - working tree
Scaffolded the Convex backend from the local sim: `convex/schema.ts`
(campaigns, marketEvents, regulars, friendships, letters, stands with
indexes), `convex/gameConfig.ts` (drift, event deck, roster, seeded RNG
ported from `web/js/config.js`), `convex/exchange.ts` (createCampaign,
openDay drift-then-pity-roll, contractBeans, consumeContract, settleDebt),
`convex/regulars.ts` (list, markSeen/unsee, resolveDay with expectation
pressure + 5% contagion), `convex/letters.ts` (templated Letter preview +
archive), `convex/crons.ts` (dawn-tick placeholder). Then added the sponsor
stack (key-gated, offline-safe) and the floor's live mirror:
`convex/openai.ts` (enhanceLetter, personaLine via gpt-4o-mini, templated
fallback without a key), `convex/firecrawl.ts` (fetchCommodityNews →
deck-weight suggestions, seeded deck without a key),
`convex/agentmail.ts` + `convex/http.ts` (signed /agentmail/webhook →
reply-to-command mutation with letters audit trail; /sync/state +
/sync/snapshot bridge). `web/js/convexSync.js` mirrors each dawn over plain
fetch when `?convex=URL` is set (HUD badge flips LIVE, game never blocks);
`web/js/main.js` + `web/index.html` wired minimally. `.env.example` gains
OPENAI_MODEL, FIRECRAWL_API_KEY, AGENTMAIL_WEBHOOK_SECRET. Code only — no
deployment yet (`npx convex dev` still needed for `_generated` + codegen).
All 11 headless web tests still pass; `tsc` shows only the missing-
`_generated` class. Convex features: schema, tables, indexes, queries,
mutations, actions, HTTP actions (`convex/`).

Live-verified on a local Convex deployment (`npx convex dev --once`,
127.0.0.1:3210, codegen clean, `tsc` fully green after fixing an
`args.coh`/`args.cohort` naming bug and adding `@types/node`): full loop
ran server-side — createCampaign → openDay day 1 (drift 1.00→1.025 then
rumour_frost → 1.075, matcha £4.80) → markSeen commuters (Dev) →
resolveDay (reputation 62→68) → openDay day 2 (1.02, £4.95) →
contractBeans (debt £22) → AgentMail inbound parsing "contract" (no
double-charge) → OpenAI/Firecrawl key-gated fallbacks. Letter preview
matches the local templated format. Note: CLI has no linked Convex
account yet — this is a local deployment only, so the log header stays
`not deployed` until `npx convex login` + cloud deploy. Added
`node_modules/` to `.gitignore`.

Cloud-linked the same session: device authorized via `npx convex login`,
created project `grunds` in team `papa-jams` (existing `juakali` project
left untouched), provisioned dev deployment
`striped-anaconda-746` and pushed all functions + indexes. Re-ran the loop
against cloud — identical deterministic results (day-1 rumour_frost,
1.075, rep 68). Deployment usage reads zero across every metric, so
headroom is a non-issue. Header `Convex deployment` now points at the
cloud deployment; the floor mirrors to it with
`?convex=https://striped-anaconda-746.convex.site`.

Frontend is live on Convex: installed `@convex-dev/static-hosting`
(registered in `convex/convex.config.ts`, catch-all in `convex/http.ts`
with app routes kept at root), built `dist/` from `web/` via
`tools/build-dist.sh` (38 files, schedule snapshot at
`dist/api/schedule.json`), unified the client fetch to
`./api/schedule.json` (`web/js/main.js`, `grunds/spatial.py` serves both
paths so local dev is unchanged), and made `convexSync.js` auto-mirror
when hosted on `*.convex.site`. Verified live:
`/` + `/api/schedule.json` + `/js/*` + a GLB all 200, SPA fallback serves
index, `/sync/state` + `/agentmail/webhook` exact routes intact (400/503
as designed). All 11 headless tests still pass.

Firecrawl is live: key set server-side via `convex env set` (never in the
repo). First real pull returned Brazil drought coverage mapped to
`drought_ea` ×1.4 deck suggestions. Cost control in place: new `apiCache`
table (TTL + inline GC) caches Firecrawl 6h per query (~1 search per
5-day campaign) and OpenAI prose 7d by input hash (deterministic sim
replays identical bodies, so repeats cost zero tokens); both actions take
`force:` to bypass, prompts stay tight (220/40 tokens, gpt-4o-mini).
Verified cached:true on repeat call. OpenAI + AgentMail keys still unset
— clean templated fallbacks hold until they land.

Craft + determinism pass (Sept 12, all verified in a real browser):
screenshot QA caught bubbles hanging off-canvas, "up -6%" copy, and no
way to pause. Fixed: bubbles capped at 10 (oldest pops) and clamped to
the viewport (`web/js/fx.js`); sign-aware numbers in the Letter and HUD
(`down 6%`, `-6%`); `space` pauses the sim clock with a ❚❚ HUD marker;
the open Letter answers to `1`/`2`/`3`. The `campaign` gate flaked ~1 in
5 on unseeded `Math.random` — loop tests (`smoke`, `campaign`,
`campaign-tight`) now seed it, gate green 3× straight (12 tests).
New `web/test/game-feel.mjs`. Docs (README/ARCHITECTURE/EVAL) brought
current with the live Convex state.

Second craft pass (browser-verified): day-1 13:00 coach toast nudges the
levers one hour before the student wave — once per campaign, only if the
player hasn't acted; beat-camera push-ins now fire at 1×/5× only (cards
still show at 20×, camera stays home); clickable pause/resume button in
the sys row with label following state. Verified: toast shown, labels
flip, zero page errors; gate 12/12; site re-uploaded.

Backend depth pass: nightly `commodity-news-refresh` cron runs a new
`firecrawl.refreshCommodityNews` internal action (verified live:
refreshed:true, 2 suggestions); `/sync/snapshot` now genuinely writes —
new `exchange.mirrorState` patches day/index/price/till/rep/debt and new
`stands.recordStand`/`topStands` keep a per-owner leaderboard (verified:
mirror → state → patch → leaderboard all 200/OK). The floor sends
campaign-cumulative till + matchaPrice + debt under a stable
`grunds.owner` id (`?stand=` override) and polls `/sync/state` for the
badge. Prod deploy deferred to submission week on purpose — one stable
cut then, dev URL qualifies until then.

Third craft pass — the rival lives: `world.setRivalHeat(n)` makes the
GLASSHOUSE sign burn brighter as their queue grows (capped glow, driven
inside the time-of-day pass); first defection queues a camera visit to
the rival via a new `rig.queueFocus` (news waits for beats, never stomps
them, expires if the player drives); rival sales ring a small coin burst
at their counter. Caught live: heat 22 → glow 1.45, beat active
mid-swing toward the rival, zero page errors. (Also noticed an
unreferenced `web/js/billing.js` RevenueCat stub — no secrets, left
alone.) Gate 12/12, site re-uploaded (39 files).

Fourth craft pass — the week lands: a CLOSING TIME card at 20:40 pulls
wide before the Z-read; the day-5 finale stages SOLD (camera visits the
sold storefronts road-side via a theta swivel in `rig.focus`/`queueFocus`,
card names the new tenant, verdict receipt lands 5s later); GLASSHOUSE
gets warm windows with a barista + guest silhouette drifting behind the
glass (`world.updateRival`, driven every frame). Verified full week in
browser: 4 letters → Z-read → SOLD → "A good week on the floor" verdict,
zero errors; rival front-on framing confirmed (sign, TEAL awning, TO LET
next door, defectors queued). Note: a parallel worker added
`convex/linkup.ts`, `convex/nebius.ts`, `web/js/behavioral.js`,
`web/js/share.js` — unreferenced by my code, no secrets, left untouched;
their backend modules push clean alongside. Gate 12/12, site re-uploaded
(41 files, incl. the inert modules).

Fifth craft pass — light, return, and smoothness: GLASSHOUSE glass now
runs a day/night curve (pale reflective `aeb6b5` at 10:00, lamplit amber
`ffb45e` at 20:40, verified live); restarting from the verdict cranes
home with a "new week" toast instead of snapping (verified: day 1,
crane mode, receipt hidden); HUD text + ticker redraw at ~5Hz in the
browser (headless bypasses, so sim assertions stay per-tick). That last
one fixed a real find: 20× play was choking on 66 DOM writes/s (wave
window crawled at +6/5s, now steady +100/5s). Gate 14/14 (incl. the
collaborator's behavioral + share suites), site re-uploaded.

Sixth craft pass — share, mix, mobile: the verdict receipt grew a
"challenge a friend" button wired to the collaborator's share module
(badge from campaign totals + `?seed=` X intent); mix bus gained a
DynamicsCompressor (guarded for older WebAudio — the unguarded first
cut broke all three loop tests, since the stubs lack it); phones get a
≤640px layout (HUD, lever bar, notebook, letter), `touch-action: none`
drags, and width-aware bubble clamping (verified 10/10 on-screen at
390px). Gate 14/14, site re-uploaded (41 files).

### 2026-09-09 - 8e1dd63 (state at end of session)

The session is paused for the day. Eleven headless tests pass on the
merged main. The day-5 construction story is closed end-to-end across
five PRs (#5–#9). Quick index of what shipped since the connected-campaign
PR #1 merged:

- **PR #2 — Phase 0 CC0 props (Kenney)**: vendored Kenney GLBs now
  populate the District floor; `web/js/loader.js` (cache + FIFO + fallback);
  `web/test/glb-substitution.mjs` (15 assertions).
- **PR #3 — Regulars friendship graph**: 11 undirected edges, gossip
  routes through named friends, 3D conversation lines; `web/test/regulars-graph.mjs`
  (8 assertions).
- **PR #4 — Gentrification drift**: per-day cost creep (+0.025), matcha
  price curve (4.80→5.40), cohort expectation pressure, HUD #pressure
  line, Roaster's Letter `driftLine`; `web/test/gentrification.mjs`
  (6 assertions).
- **PRs #5–#9 — Day-5 visual + audible construction**:
  - `web/test/rent-sign.mjs` (4) — 'let' → 'lease' → 'sold'
  - `web/test/construction.mjs` (4) — right facade block scaffold
  - `web/test/construction-left.mjs` (4) — left facade block scaffold
  - `web/test/construction-active.mjs` (5) — drifting dust + low saw loop
  - `web/test/construction-final.mjs` (6) — day-4 `neighborhoodLine`,
    back-row scaffold, jittered wooden tock + metal click
- **Docs**: README "Recent progress" section + ARCHITECTURE phase column
  updated to reflect what's now local (gentrification, friendship graph,
  day-5 visuals).

**Test gate**: 11 headless tests pass on every merge. To run them
all: `for t in regulars-graph gentrification rent-sign construction
construction-left construction-active construction-final smoke campaign
campaign-tight glb-substitution; do node web/test/$t.mjs; done`.

**Where to pick up next session**: the README's "Convex phase" section
still lists items that haven't shipped (scheduled functions, live
queries, AgentMail, OpenAI prose). The highest-leverage next step is
the Convex phase itself: scaffold the Convex deployment, port the
local-phase systems (`exchange`, `regulars`, the construction story) to
TypeScript, and start wiring the multiplayer / persistence layer. Local
features that are still on the wishlist and easy to ship: a "new
tenant opens" final cutscene for day-5 evening, a day-4 dust preview
before the day-5 full reveal, a fourth scaffold on the back-left
facade. None are mechanically necessary; all are pure polish.

### 2026-09-09 - 1655cf6
Squash-merged PR #9 ("Close the day-4/day-5 construction story:
letter line + third scaffold + hammer") into main. Diff: +194 / −1
across 6 files. The day-4/5 narrative is now complete on three
fronts: (1) `letter.js` adds `neighborhoodLine(s)` for days >= 4 —
day 4 reads "Two of the storefronts across the road have a For
Lease sign up. The street's moving."; day 5+ reads "Both storefronts
are scaffolded now. The street is being remade — for or against you,
that's the question." (2) `world.js` adds a third scaffold on the
back-right facade block (x=17, z=18.0) with a 4.4m × 1.4m tarp. (3)
`audio.js` adds `constructionHammer(on)` with a jittered 0.6-0.9s
rhythm — each tap is a wooden tock + a metal click. The day-5
construction is now: visible (3 scaffolds + 3 tarps), audible (saw
+ hammer), animated (drifting dust), narrativized (letter), and
numeric (HUD #pressure). All 11 headless tests pass on the merged
main.

### 2026-09-09 - feat/construction-final
Closed the day-4 / day-5 construction story on three fronts:
(1) `web/js/letter.js` adds `neighborhoodLine(s)` for days ≥ 4 —
day 4 reads "Two of the storefronts across the road have a For Lease
sign up. The street's moving."; day 5+ reads "Both storefronts are
scaffolded now. The street is being remade — for or against you,
that's the question." Inserted after `reputationLine` so the player
reads market mood, then their performance, then the district's.
(2) `web/js/world.js` adds a third scaffold on the back-right facade
block (x: 17, z: 20.5) at (x=17, z=18.0). Smaller to fit a smaller
facade: 4 posts, 3 cross-beam levels, X-brace diagonals, 4.4m × 1.4m
tarp. New `W.setConstructionRight(d)` and `W.cTarpMatR` parallel to
the existing left/center setters. The gentrification now reads from
any camera angle on the wide shot.
(3) `web/js/audio.js` adds `constructionHammer(on)` with a jittered
0.6-0.9s rhythm. Each tap is a wooden tock (low bandpassed noise,
80-120 Hz, ~80ms) + a metal click (high bandpassed noise, 1.8-2.2
kHz, ~30ms). The saw provides the drone, the hammer provides the
rhythm. `update()` drives the scheduler. New test
`web/test/construction-final.mjs` (6 assertions) covers the letter
function, the third scaffold, the audio method, the wiring, the
noise buffer use, and the public API. All 11 headless tests pass.
+~180 / −3 across 5 files.

### 2026-09-09 - 952bd1b
Squash-merged PR #8 ("Make day-5 construction feel active: drifting
dust + a low saw loop") into main. Diff: +158 / −1 across 5 files.
The day-5 construction now feels alive. Drifting dust between the
two scaffolds — new dustSite Pool in web/js/fx.js, 80 particles,
additive cream/warm-grey tint, spawning 1-2 per ~0.12s when
constructionActive is true. Plus a low procedural saw loop in
web/js/audio.js — 78 Hz sawtooth with -8 cents detune through a
220 Hz / Q=1.4 bandpass, ramped to gain 0.04 over ~1.5s. main.js
wires both, gated on d >= 5, at every dawn. The gentrification is
now visible (two scaffolds, two tarps, a rent sign), audible (the
saw fades in on day 5), and animated (dust drifts between the
scaffolds). All 10 headless tests pass on the merged main.

### 2026-09-09 - feat/construction-active
Made the day-5 construction feel alive. The two scaffolds (PRs #6 and
#7) were static props; the gentrification read as "the building is
being remade" but didn't *feel* active. Two layers: (1) a slow
drifting dust between the two scaffolds — new `dustSite` Pool in
`web/js/fx.js` (80 particles, additive cream/warm-grey tint, spawning
1-2 per ~0.12s in the box x ∈ [-12, 12], y ∈ [0.5, 3.5], z ∈ [15.5, 17]
when `constructionActive` is true). Particles in flight finish their
natural life when the flag flips off, so the dust fades over ~2s
rather than vanishing instantly. (2) a low procedural saw loop in
`web/js/audio.js` — a 78 Hz sawtooth with -8 cents detune through a
220 Hz / Q=1.4 bandpass, ramped to gain 0.04 over ~1.5s. The result
is a distant "nrrrr" rather than a literal saw. The oscillator +
filter are created on first call to on=true and re-used; on=false
ramps the gain to zero. `main.js` wires both: at every dawn in
`openDay`, sets `fx.constructionActive = (d >= 5)` and calls
`audio.constructionSaw(d >= 5)`. New test
`web/test/construction-active.mjs` (5 assertions): fx constructionDust
+ constructionActive + dustSite pool, audio constructionSaw with
sawtooth + bandpass, main.js wiring, and public API smoke. All 10
headless tests pass. +~120 / −2 across 4 files.

### 2026-09-09 - 333ef78
Squash-merged PR #7 ("Add day-5 left-side construction prop") into
main. Diff: +89 / −1 across 4 files. The day-5 gentrification now
reads district-wide: a scaffold + tarp on the right-side facade
block (PR #6, x=11, z=16.4) AND a matching, smaller scaffold on the
left-side facade block (x=-10, z=15.9). Both invisible on days 1-4;
both materialize on day 5 via parallel `W.setConstruction` /
`W.setConstructionLeft` setters. The two-storefront-flip-in-one-week
narrative is now visible from any camera angle. All 9 headless tests
pass on the merged main.

### 2026-09-09 - feat/construction-left
Mirrored the day-5 construction prop on the left side of the street.
PR #6 added a scaffold + tarp on the right-side facade block at
(x=11, z=16.4). The gentrification read on the right but the left
side was untouched, so the district felt like *one* building was
being remade rather than the whole street turning over. This commit
adds a second, smaller scaffold in front of the closer left-side
facade block (x: -10, z: 19) at (x=-10, z=15.9). Same tarp factory,
same `dayHasConstruction(day)` gate, smaller dimensions to fit a
smaller facade: 4 posts, 3 cross-beam levels, X-brace diagonals,
5.2m × 1.6m tarp. `web/js/world.js` exposes `W.setConstructionLeft(d)`
parallel to `W.setConstruction(d)`. `main.js` calls both at every
dawn. New test `web/test/construction-left.mjs` (4 assertions)
verifies the source-level wiring: `W.setConstructionLeft` defined,
scaffold at x=-10, visibility/opacity toggled, and the call from
`openDay`. All 9 headless tests pass. +~120 / −2 across 3 files.

### 2026-09-09 - 6d4c73d
Squash-merged PR #6 ("Add day-5 construction prop: scaffold + tarp on
the sold storefront") into main as a single commit. Diff: +173 / −2
across 5 files. The day-5 "SOLD" sign now has a physical complement:
a two-level scaffold (4 vertical posts, 3 horizontal cross-beam levels,
X-brace diagonals) in front of the big right-side facade block at
x=11, z=16.4, ~5m to the right of the rent sign. A 6m × 2m red-and-
white striped construction tarp covers the lower-middle of the block,
reading "UNDER CONSTRUCTION · SEPT 15". The whole prop group is
invisible on days 1-4; W.setConstruction(d) toggles visibility on
day 5. The gentrification is now visceral — the player sees the
*building* being remade, not just a sign. All 8 headless tests pass
on the merged main: regulars-graph, gentrification, rent-sign,
construction, smoke, campaign, campaign-tight, glb-substitution.

### 2026-09-09 - feat/construction-prop
Made the day-5 "SOLD" sign physical. The sign was good but the
building looked the same — the gentrification was in the sign, not
the structure. New `tarp()` factory in `web/js/textures.js` bakes
a red-and-white striped construction tarp with "UNDER CONSTRUCTION ·
SEPT 15" text onto a 512×512 canvas. `web/js/world.js` adds a
two-level scaffold in front of the big right-side facade block
(x=11, z=16.4, ~5m to the right of the rent sign at x=6):
4 vertical posts (6.5m walnut-dark), horizontal cross-beams at 3
levels, X-brace diagonals, and a 6m × 2m tarp panel covering the
lower-middle of the block. The whole group is invisible on days
1-4; `W.setConstruction(d)` makes it visible on day 5 (group
.visible = true, tarp material opacity → 1.0). `main.js` calls
it once per dawn in `openDay` (right after `setRentPressure`).
New test `web/test/construction.mjs` (4 assertions) covers the
tarp factory, the day-gated visibility ladder, and the integration
chain. All 8 headless tests pass. +~160 / −3 across 4 files.

### 2026-09-09 - e4b252d
Squash-merged PR #5 ("Add a visible rent-pressure sign on the district
floor") into main as a single commit. Diff: +209 / −2 across 5 files.
The gentrification drift now has a visual: a two-post signboard on the
right side of the street (x=6, z=16.5, between the rival and the
big right-side facade block) re-bakes one of three states per day —
'let' (cream "TO LET · enquiries next door") for day 1-2, 'lease' (red
"FOR LEASE" banner, "RENTS UP 12% · district turnover") for day 3-4,
'sold' (diagonal red SOLD stamp) for day 5. The sign is the
gentrification made physical — the player sees the district being
claimed, not just the cost creep. All 7 headless tests pass on the
merged main: regulars-graph, gentrification, rent-sign, smoke,
campaign, campaign-tight, glb-substitution.

### 2026-09-09 - feat/rent-sign
Made the gentrification drift visible on the floor. The numbers
(`#pressure` HUD, the matcha price curve, the driftLine in the Roaster's
Letter) were good but abstract — the player couldn't *see* the
district being claimed. New `rentSign()` factory in `web/js/textures.js`
(~70 lines) bakes one of three states onto a 512×384 canvas: 'let'
(cream, "TO LET · enquiries next door" with brass corner detail) for
day 1-2, 'lease' (white with a thick red "FOR LEASE" banner and
"RENTS UP 12% · district turnover") for day 3-4, and 'sold' (white with
a diagonal red SOLD stamp) for day 5. The texture re-bakes onto the
shared canvas; the world only pays for one material. `stateForDay(d)`
is the pure day→state mapping. `web/js/world.js` adds a two-post
signboard on the right side of the street (x=6, z=16.5, between the
rival and the big right-side facade block), facing the café across the
road, and exposes `W.setRentPressure(d)` that re-bakes the texture and
sets `needsUpdate = true`. `main.js` calls it once per dawn in
`openDay` (right after `world.setMist`). The sign rotates through the
three states as the campaign progresses — the player sees the
district being claimed, not just the cost creep. New test
`web/test/rent-sign.mjs` (4 assertions) covers the factory, the three
drawable states, the day→state ladder, and the integration chain. All
7 headless tests pass. +~210 / −5 across 4 files.

### 2026-09-09 - 60685bb
Squash-merged PR #4 ("Wire gentrification drift: per-day cost creep,
reputation pressure, and the matcha price curve") into main as a single
commit. Diff: +262 / −5 across 8 files. The README's "Inflation enters
as a pressure clock" and ARCHITECTURE's "gentrification drift" line are
now real: every dawn the bean index creeps +0.025 (capped at 1.80),
the matcha till price walks 4.80→5.40 over 5 days, and cohort
expectation pressure (elders -0.02, creatives -0.01, students +0.01,
tourists +0.01) pulls seen regulars' op by `day * delta` before the
friendship contagion. The HUD has a #pressure line that reads
"costs +X% · matcha £Y · day Z/5". The Roaster's Letter gets a
driftLine paragraph for days ≥ 2. All 6 headless tests pass on the
merged main: regulars-graph, gentrification, smoke, campaign,
campaign-tight, glb-substitution.

### 2026-09-09 - feat/gentrification-drift
Wired the gentrification drift promised by README.md ("Inflation enters as
a *pressure clock*, not a stat screen: the district gentrifies — rents and
bean costs creep, willingness-to-pay rises but expectations rise faster")
and ARCHITECTURE.md ("exchange ... gentrification drift"). New module
`web/js/gentrification.js` (~75 lines) exports three pure, deterministic
functions: `applyDrift(exchange, day)` raises `beanIndex` by `+0.025/day`
(capped at 1.80) and sets the day's matcha till price from a 4.80→5.40
curve; `applyExpectation(regulars, day)` shifts each *seen* regular's `op`
by `day * CAMPAIGN.expectation[coh]` (elders -0.02, creatives -0.01,
commuters 0, students +0.01, tourists +0.01); `priceForDay(day)` is the
pure price-curve lookup. `exchange.openDay()` now calls `applyDrift` *before*
the event roll, so the drift is the baseline and the event is the
deviation (a frost on a drifting index is a bigger shock). `main.js`
calls `applyExpectation(regulars, day)` before `regulars.resolveDay` so
the friendship contagion sees the gentrification pressure and can spread
it. The HUD has a new `#pressure` line: "costs +X% · matcha £Y · day Z/5".
The Roaster's Letter gets a `driftLine(s)` paragraph for days ≥ 2 so the
pressure shows up in prose ("Costs are creeping. 5% up on day one. The
elders are watching the chalkboard."). New test
`web/test/gentrification.mjs` (6 assertions): per-day drift math, price
curve monotonicity, cohort expectation deltas, maxIndex cap,
determinism across two seeded exchanges, and a wire check that
`openDay()` actually applies the drift on top of the event delta. All 6
headless tests pass. +~280 / −~15 across 6 files.

### 2026-09-09 - 65f3898
Squash-merged PR #3 ("Wire the Regulars friendship graph, routed gossip,
and 3D conversation lines") into main as a single commit. Diff: +392 / −27
across 6 files. The Regulars now have a real friendship graph: 11
undirected edges across 8 named regulars, diameter 2. Gossip routes
through named friends when one is on the floor, and 3D conversation
lines are visible between gossiping regulars. All 5 headless tests pass
on the merged main: regulars-graph, smoke, campaign, campaign-tight,
glb-substitution.

### 2026-09-09 - feat/regulars-graph
Wired the Regulars friendship graph promised by `README.md` ("word of mouth
propagates through a friendship graph (visible as 3D conversations)") and
`ARCHITECTURE.md` ("precedent (memory) → opinions, friendships"). Each entry
in `REGULAR_ROSTER` now has a `friends` array; the graph has 11 undirected
edges across 8 regulars with diameter 2 (everyone is within 2 hops of
everyone). `Regulars` now exposes `friendships` (Map<idx, Set<idx>>),
`friendOf`, `pickFriendFor`, `reachableIn`, and a 5%-per-day `opContagion`
step that runs at the end of `resolveDay` — a single bad day for Mara sours
her friends, and within a day or two the whole network feels it. Gossip is
now routed through named friends: when a named regular balks, the bubble
goes to one of their friends who is on the floor (a real "word of mouth"
hop), and a dashed 3D line is drawn between the two patrons' heads for
the lifetime of the bubble. Falls back to the nearest patron when no
friend is on the floor. `patrons.js` carries the `regularFriends` set on
each named-regular patron and tracks `regularsByIdx` so the gossip router
can find friends on the floor. `fx.js` got a 32-slot `THREE.LineSegments`
pool for the conversation lines (animated vertex-coloured, faded by the
bubble's lifetime). New test `web/test/regulars-graph.mjs` (8 assertions)
covers: edge count, friend pick, reachability from Mara, single-step
contagion pull, 10-round spread, reputation bookkeeping, and a public-API
smoke check. All 5 headless tests pass. +368 / −26 across 5 files.

### 2026-09-09 - ac25ff2
Squash-merged PR #2 ("Wire Phase 0 CC0 Kenney props into the District
floor") into main as a single commit. Diff: +388 / −47 across 24 files
(16 of which are the binary assets). The District café interior now uses
the Kenney props the README's "Phase 0 CC0 props (Kenney; see SOURCES.md)"
line promised. All 4 headless tests on the merged main pass: smoke,
campaign, campaign-tight, glb-substitution.

### 2026-09-09 - feat/phase-0-glb
Wired the vendored Kenney CC0 GLBs into the District floor. Until now the 14
GLBs in `web/assets/` were sitting untracked and the `web/vendor/README.md`
admitted "nothing in web/index.html or web/js/*.js currently imports
GLTFLoader" — the README's "Phase 0 CC0 props (Kenney; see SOURCES.md)" claim
was a placeholder, not a delivery. This commit chain makes it real.

New `web/js/loader.js` (~80 lines): a small async helper that wraps the
vendored GLTFLoader, with a per-URL parse cache (FIFO at 32 entries), a
graceful placeholder fallback for failed parses, and a `dispose()` path for
the cache. Cloning a parsed Group is cheap; per-instance position/scale/
rotation don't bleed between uses.

New `web/test/glb-substitution.mjs` (~95 lines, 15 assertions): pins the
loader's contract — parse returns a Group, the cache stores 1 entry after 10
calls, position/rotationY/scale apply correctly, unknown URLs return a
placeholder without throwing, dispose clears the cache, and `web/js/world.js`
still imports and runs (regression guard).

`web/js/world.js` substitutions (procedural mesh -> Kenney GLB):
  - bar shell, espresso machine, till -> kitchenBar / kitchenCoffeeMachine /
    kitchenBarEnd
  - 3 tables + 9 chairs -> tableRound + chairModernCushion (3 chairs per
    table, oriented toward the table)
  - 3 pendant lamps -> lampRoundTable (emissive bulb kept procedural so
    W.bulbMats still drives the time-of-day glow)
  - 2 door planters -> pottedPlant
  - retail shelf backing -> bookcaseClosedDoors (3 shelf layers + 18 product
    items stay procedural; the kit has no display case)
  - 3 pastry items -> croissant, 3 -> cake (case frame stays procedural)
  - 3 new bar stools at the counter (stoolBar), 1 new side stand (sideTable)

Untouched (no matching Kenney GLB, or text content that needs the procedural
path): facades, far skyline, street trees, benches, street lamps, rival
café, menu board, sign, awning, all the procedural shapes used by the time-
of-day director (bulbs, pendants, lamp glows, mist, stars, moon).

`web/js/world.js` `buildWorld` is still synchronous. It returns the world
shell immediately with whatever has been placed, and exposes `W.ready` — a
Promise that resolves once every queued GLB placement is in the scene. The
title-screen flow in `main.js` now waits on `W.ready` before enabling the
"Open the District" button, so the user never sees a half-loaded floor.

The vendored GLTFLoader and BufferGeometryUtils had bare `import ... from
'three'` / `'../utils/...'` import paths (Three's example build assumes an
npm install). These were retargeted to the local `three.module.js` so
Node-based headless tests can import the loader without npm.

All 4 headless tests pass on the wired tree: `smoke.mjs`, `campaign.mjs`,
`campaign-tight.mjs`, `glb-substitution.mjs`. No Convex code yet.

### 2026-09-09 - b9f3b8d
Squash-merged PR #1 ("The connected district: a 5-day campaign where the
Gamble meets the floor") into main as a single commit. Diff: +3046 / −211
across 20 files. The PR combined the original feat/connected-district branch
with the review-driven fix from this session. Headless tests on the merged
main: `web/test/smoke.mjs`, `web/test/campaign.mjs`, and `web/test/
campaign-tight.mjs` all pass. The District is now live on main.

### 2026-09-09 - working tree
Review-driven fix on the campaign branch. The PR review found two real bugs:
(1) `regulars.markSeen` was defined but never called, so named Regulars (Mara,
Tomas, Pip, …) had no per-individual effect on opinion — every regular's `op`
was updated every day from the floor's aggregate, and the README's "named
patrons carry opinion across resets" claim was a lie; (2) `exchange.contract
.units` was decremented 36 per dawn, so a single 40-unit contract expired
unilaterally on day 2 regardless of how many cups were actually sold — the
40-unit number was decorative. Fixed both: `markSeen` is now invoked from
`patrons.spawn(cohort, …)` and returns `{idx, name, coh}` so a named regular
gets a brass-cohort-band hat on the floor plus a one-line greeting bubble
when they join the queue; defectors to the rival are `unsee()`'d so they
don't earn opinion they never received. `exchange.consume(n)` now decrements
`contract.units` per actual cup served (and clears the contract at zero), and
`CAMPAIGN.contractUnits` is bumped from 40 to 2400 (one day's counter volume
in the deterministic data) so the hedge is real. New `web/test/campaign-tight
.mjs` pins all four behaviours with deterministic assertions: per-individual
opinion, cup-bounded contract expiry, settle-survives-dawn (interest guard
works on zero), and the campaign lands in a verdict band. `campaign.mjs` and
`smoke.mjs` are still green. No Convex code yet.

### 2026-09-08 - working tree
Connected the floor into a 5-day campaign so the three nested clocks meet the
3D street (was: an isolated single day). New web/js modules, all core-Three
r160, no CDN/build: `exchange.js` (the Gamble — a seeded pity-timer event deck:
frost on Minas Gerais, East Africa drought, clean harvest, matcha hype; never
two catastrophes back-to-back), a bean benchmark whose day-over-day drift feeds
cost-of-goods (anchored to benchmark_corpus.json ~30% COGS), and forward
contracts + a supplier-debt clock with daily interest (`web/js/exchange.js`);
`regulars.js` (persistent patron opinion → reputation → footfall/tips, the
Regulars, `web/js/regulars.js`); `letter.js` (the Roaster's Letter, templated
prose, reply-to-command — contract/hold/settle, `web/js/letter.js`). The
between-days flow runs in `web/js/main.js`: each close shows a Z-read receipt,
then the mailbox raises its flag and the letter arrives; the reply mutates the
exchange and opens the next dawn through to a campaign verdict. The diorama
also gained a custom shader sky dome (`web/js/sky.js`), procedural district
facades whose windows light at dusk, a far skyline, an in-world commodity
ticker board, a mailbox, weather mist after a frost, and a core-Three render-
target bloom/vignette/grain post pipeline (`web/js/postfx.js`). Added `grunds/
__main__.py` so `python3 -m grunds` works. New `web/test/campaign.mjs` runs
the campaign headless (stubbed DOM/GL/audio) and asserts the payoff: a frost
on the spot yields net ~£7,600 contracted vs ~£4,600 held; debt accrues
interest across the run; settle clears it. No Convex code yet.

### 2026-09-08 - working tree
Rebuilt the floor as a living diorama (`web/js/` modules under the vendored
Three.js r160, still no CDN/build step): dollhouse café with bar, espresso
machine, pastry case and retail shelf; a street out front with the rival chain
stand; a time-of-day lighting director keyed to the sim clock (dawn to blue
hour, pendants/lampposts/signs take over at night). Patrons are instanced
characters (8 draw calls for the whole crowd) with a real queue that snakes out
the door; balked patrons visibly cross the road to the rival. Story layer:
title screen with camera crane-in, chapter cards keyed to the real wave shapes,
the 12:00 read as a roaster's-notebook card, and a closing-time receipt with a
verdict. Procedural WebAudio (murmur scales with the crowd, espresso hiss, till
chime, lo-fi pad), gesture-gated by the title screen. Economy is now
prep-weighted so the levers are legible: made-to-order matcha costs 4
prep-points vs 1 pre-batched, pre-batch is re-purchasable, and reprice rewrites
the in-world chalkboard while pulling matcha demand. `web/test/smoke.mjs` runs
two full days headless (stubbed DOM/GL/audio) and asserts the payoff: wave
balks 165 to 52, till up ~11%. Added `grunds/__main__.py` so
`python3 -m grunds spatial` works as documented. No Convex code yet.

### 2026-09-05 - working tree
Built the first playable vertical slice of the floor. `grunds/ingest.py` parses
the 26.5k-row café export into a 5-minute wave schedule (173 ticks, 3,775 spawn
buckets) tagged by zone and cohort, and extracts the planted signals (matcha
139→683/wk, loaf 148→40 peak-to-end, 8.6% cake attach) — verified against the
data. `grunds/spatial.py` serves the Three.js floor at localhost:8787 with a
schedule API. `web/index.html` renders four zones with cohort-colored patrons,
counter queue heat, the pre-batch and reprice levers, a till/balk scoreboard,
a read hint at 12:00, gossip bubbles that drift to the nearest served patron,
and a day reset. Three.js is vendored locally so the demo needs no internet.
No Convex code yet.

### 2026-09-05 - 889f770
Added the pre-commit tooling gate: gitleaks secrets scan with a custom ruleset
(`.gitleaks.toml`, default rules plus OpenAI-style and Convex-key patterns), ruff
lint on staged Python files, and a dependency-free fallback scanner
(`tools/secret_scan.py`) for machines without gitleaks. Verified the hook blocks a
planted fake key and passes a clean commit. Started the hackathon build log
(`hackathon.md`) and committed the project-local hackathon skill. No Convex code yet.

### 2026-09-05 - 595be8b
Scaffolded the Grunds Python package with module stubs for ingest, spatial, agent,
precedent, and eval, plus CLI entry points and a deterministic café sales
transformer (`transform.py`) that generates a 13-week UK café dataset
(`out/square_item_sales.csv`, ~26.5k rows) with planted demand signals. Docs
established the dual plan: a 3D spatial demo now, a persistent multiplayer Convex
app by Sept 22. No Convex code yet.

### 2026-09-05 - c82fdd0
Aligned all docs (README, ARCHITECTURE, EVAL) to The District game design: four
systems (Exchange, Regulars, Roaster's Letter, Floor), five cohorts as demand
curves, Drug Wars-inspired event deck with pity timers, and the Convex phase
deployment shape (tables, scheduled functions, live queries, AgentMail inbox).
Module docstrings updated to match. No Convex code yet.
