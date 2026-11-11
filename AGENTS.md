# Working notes

## Verify
- **Default while iterating: `npm run test:fast`** — everything except the
  day/week playthroughs (~2 min vs ~20). CI (`test.yml`) still runs the full
  gate on push/PR; run the full thing locally before a deploy.
- `npm test` — full suite (~540 tests, `--test-concurrency=1`)
- `npm run test:slow` — only the playthrough files
- Slow membership lives in `tools/slow-tests.txt` (basenames, grepped -vxF).
  If a fast file grows past ~60 s, move it there. balance-policies.mjs
  spawns `--single` child campaigns via execFileSync — don't kill stray
  `balance-policies` processes without checking they're not the suite's.
- Balance sweeps are HEAVY: never background more than one; a machine at
  load 60+ starves the suite and flakes timing-sensitive tests.
- `npm run typecheck` — `tsc --noEmit`
- Licence/identity surface: `node web/test/identity.mjs web/test/orientation.mjs`
- UI density audit: `UI_OUT=/tmp/ui-audit node tools/ui-audit.mjs` plays day 1
  headlessly (desktop first-timer + vet, and 390×844 phone) on its own preview
  server (port 8791), screenshots every modal + the HUD into UI_OUT, and prints
  per-shot JSON — modal header/footer boxes, scrollH/clientH, section offsets,
  font sizes, HUD `chromeShare`. ~8–10 min on swiftshader; never run it
  alongside the test suites or another audit (load flakes both).
- Narrow: `node --test web/test/frontage.mjs web/test/polyfork-lighting.mjs web/test/camera-grammar.mjs web/test/climates.mjs`

## Deploy (`npm run deploy:site`)
- `tools/build-dist.sh` → `stage-site.mjs` bundles the **working tree**, not HEAD.
  With uncommitted work in the tree, deploy from a clean `git worktree` at the
  commit instead — and put it outside `/tmp`: `/tmp` is a `/private/tmp`
  symlink on macOS, and invoking `stage-site.mjs` by an absolute `/tmp/...`
  path desyncs its `argv[1] === import.meta.url` main-check so it silently
  exits 0. `~/grunds-deploy` works; symlink in `node_modules`, `out/`, `.env`,
  `.env.local` first.

## Polyfork assets
- `tools/vendor-polyfork.mjs` vendors free Polyfork GLBs into
  `web/assets/polyfork/` + regenerates `web/js/polyforkManifest.js`
  (zones / night-glow zones / pivots). Pass ids to add more; the manifest
  merges, so id-scoped runs don't clobber. List every id in
  `web/assets/SOURCES.md` (Polyfork licence: commercial use, no attribution,
  no redistribution as assets — not CC0).
- `web/js/polyfork.js` `loadPF(glb, id, opts)` loads through the shared
  GLBLoader, tints COLOR_0 zones via `PF_TINT`, extracts `night` zones into
  emissive overlays driven by updateTimeOfDay's street/pend factors
  (`opts.night: 'street'|'pend'`), and exposes rigged pivots on
  `userData.pfParts`. Night zones keep their opaque base triangles; a
  polygon-offset glow overlay adds the light. Route every successful
  world/district/franchise placement, including hydration, through
  world.registerPF; registerPFNight deduplicates entries.
- District: seeded-vendored Polyfork is the default. `?district=polyfork` /
  `?pfDistrict` are explicit aliases; `?district=tripo` /
  `?district=convex` / `?convexDistrict` select the provider path; the
  classic opt-out stays. Candidates still must not collide with ids pinned
  at fixed spots in `world.js`.
- Screenshot harness: `tools/pf-shots.mjs` (PF_SEED / PF_EXTRA env) →
  `/tmp/pf-shots/`; drives `__grunds.rig` + a `director` dusk layer.
- Video harness: `tools/demo-video.mjs` → `out/demo/demo.mp4`. Two
  Playwright takes + marker-cut ffmpeg concat. Hard-won rules:
  `sky.update(dayMin)` rewrites the backdrop every frame, so director
  time-pins can't fake dusk — film real dusk by holding evening trade
  open (`#evening-hold`); `modals.top()` calls `rig.release()`, so dismiss
  `#moment` cards before aiming the rig; mark timestamps drift ~±10 s vs
  video time on slow boots — verify cut windows against raw frames.

## Street / camera roadmap (post-feedback, agreed order)
1. Street vignettes — busker+crowd & chatting pairs in streetLife.js
   (waypoint dwell+face groups; one live group, members share the cap).
   Shipped: pigeons (instanced, peck/hop, proximity scatter — no per-frame
   rng), phone/sip occupation actions on dwellers, guaranteed park+bench
   sitters at beginDay, cohort dress codes (DRESS: hat/held/gait per
   cohort), and cloned Polyfork humanoids on standing-kind agents via
   street.loadChars() + CHAR_BY_COHORT (blobs hidden beneath; sitters and
   walkers stay instanced). Humanoids now *walk*: 5/10 Polyfork figures
   ship a rigged Walk clip; assignDonorWalk lends it to the other 5 (all
   share one 22-bone rig — clips bind by name). _driveChar eases timeScale
   in/out, pins hip root drift, offsets phase by idx (no rng), respects
   reduced-motion; the busker keeps his authored pose. Tier-2 bodies
   shipped too: patrons + bar staff + street crowd swapped box limbs for
   capsules, heads went oval-taller, and two new instanced bands landed —
   hips (trouser colour, torso reads as a shirt) and a hair cap (palette
   hash of p.idx — `hairFor`/`baldAt` in patrons.js, pure, no streams;
   staff hair comes from the portrait seed). patrons.js is 10 draw calls.
   Verb FX rolls fall back to a patron+time hash when fx is absent — never
   `Math.random`, never the decision/cosmetic streams. Street theatre
   shipped too (attention-street
   pillar): coffee argument, bench cat + cat-watchers, skater, the
   dog-walker (leash dog + line trail, heel/sniff-circle/hard-leash clamp
   in `_dogWalk`, timers only), and the **delivery** (hand-truck frames +
   wheels + crate + sack; `_cartFollow` heels half-step ahead, tilts back on
   the move, eases upright at the unload dwell, driven by timers only). Both
   get the walker's animated humanoid char. See `street-theatre.mjs`. Next:
   delivery/hand-truck vignette; rooftop dressing (tank/antennas/laundry).
2. Camera grammar — espressoIns/caseIns use authored view positions and
   alone bypass the r>=18 scripted clamp; lowStreet reaches phi=1.5.
   Insert exits blend back over 0.8 s. matchcut holds through
   review/planning; OPEN calls crane(), clearing held/queued beats.
   Pastry shots queue on actual sales, and the rush insert queues once
   per trading day.
3. Conversion mechanic — shipped both halves: ~30% of pavement walkers
   pause and face the door (buildRoute); the sim side is deterministic
   opportunities every 90 sim-minutes (first at start+45) that dwell 8
   sim-minutes then roll awareness(0..1) × reputation/100 ×3 capped at 1,
   max 3 successful spawns/day — FrontageConversions in frontage.js ticks
   inside tick() on its own saved/reset stream (seed+43). StreetLife only
   displays candidates (showFrontage/finishFrontage). Pillar 3 attention
   tide shipped on top: `planTheatre(seed, day)` (street.js, pure, tellHash
   idiom) deals 3 windows/day across sim-minutes 400..1120; while a window
   is live tick() lifts the awareness fed to frontageChance by the window's
   kind boost (busker .18 / argue .14 / catwatch .12 / chat .10 / skater .08)
   and toasts the window line once. THE RULE: the sim economy may only read
   the sim-minute clock — never the wall-clock vignette agents (they expire
   in update(dt), so reading them would break the replay fixed-step
   invariance test). Observability: `__grunds.theatre()`.
4. Seasons — current climate envelope is cosmetic: seeded
   fair/heat/rain/crisp changes street density/cadence, sky tint/sun/stars,
   and rain. The fixed Brief header explains it before opening. Climate
   refreshes from the active seed on prepare/reset; heat has room for 33
   full-mode walkers and rain vignettes respect the reduced cap. `?city=`
   campaigns now anchor the envelope to the real forecast (Open-Meteo
   snapshot — see "Real-world market snapshot" below); seed-only campaigns
   stay on the seeded path. Demand reweighting and umbrellas/caps remain
   future work.

## Generated assets (Grove mirror)
- Convex data-egress is the constraint: generated GLBs + previews are mirrored
  to Grove (immutable, `chain_id` 232) and the client rewrites
  `*.convex.cloud/api/storage/<uuid>` via `web/js/groveAssets.js` (generated —
  do not hand-edit the map). Un-mirrored storage URLs resolve to `null` and
  fall back to the classic procedural path **without a network request**.
- After new generations land (Tripo `persist`, franchise stands, new district
  kits), refresh the mirror: `node tools/mirror-assets.mjs` then redeploy.
- Meshy (offline asset source, never runtime): `tools/vendor-meshy.mjs`
  generates via the Meshy API into `web/assets/meshy/` + manifest.json.
  Key: `MESHY_API_KEY` in `.env.local`. Defaults follow Meshy's game-asset
  guidance — `meshy-t2`/`meshy-t2.5` Smart Topology + `meshy-n1` textures;
  `--rig` auto-rigs humanoids (GLB + baked walk). meshy-n1 refine of a
  non-7.1 text preview needs `--texture-image`. MCP server
  `@meshy-ai/meshy-mcp-server` is wired in `~/.config/devin/mcp_config.json`
  for agent-driven generation. `--preview-task <id>` resumes an orphaned
  preview task (e.g. after a 429 on refine) instead of paying for a new one.
  Downloads are auto-optimized (`gltf-transform`: WebP textures @1k,
  geometry compression OFF — the vendored GLTFLoader has no meshopt/draco
  decoder); `--optimize-existing` re-runs it over the whole dir, `--no-optimize`
  skips. 16 GLBs total ≈8.5 MB.
  Style matching (prefer over bare `--prompt`): render an in-game GLB with
  `tools/render-asset.mjs <assets/x.glb> <out.png> iso` and pass it as
  `--image`; when no in-game model exists, `--ref-prompt "<stylized
  low-poly … plain cream background>"` makes a text-to-image reference
  (~3 cr) and feeds it to image-to-3D. `--ref-task <id>` reuses a paid
  reference. Text-to-image lives at `/openapi/v1/text-to-image` (the spec's
  bare `/v1/...` 404s) and returns `image_urls[]`.
  Headless probes under machine load: wait for `#open` enabled via
  `waitForFunction` with interval polling — `waitForSelector(...visible)`
  timed out under load even though the button was ready.
  Meshy GLBs arrive as ~1 m centred boxes (min.y ≈ −0.5): `place()` does NOT
  normalize — each placement's scale/y must ground the bbox bottom itself
  (probe with `tools/meshy-probe.mjs`, which reports world bboxes of every
  `meshy/*` instance; `tools/meshy-shots.mjs` is the screenshot harness).
  Skinned chars go through `loadChars()` — the walk GLB carries mesh + clip.
  Vendored so far: bar-top cake-stand/cup-stack, pavement a-board/crate-stack/
  vintage-bike/plant-cluster/guitar-case/street-piano, cat.glb (replaces the
  procedural cat when it lands), skateboard.glb (streetLife deck swap),
  street-musician.walk.glb (second busker), roof-{tank,dish,antenna}.glb
  (spares, not yet placed).

## Real-world market snapshot (pillar 4 — snapshot, never live)
- `web/js/marketSnapshot.js` is the only place that touches the wire. A
  campaign resolves its anchor SYNCHRONOUSLY from a cached live snapshot or a
  seeded synthetic (`resolveSnapshot`) — play never blocks on the network and
  never drifts mid-week. A live value is fetched once in the background
  (`refreshSnapshotCache`, fired at campaign start/reset) and cached under
  `grunds.snapshot` for the NEXT campaign only.
- FRED official JSON API is used when a free key is cached (`?fredKey=` →
  `grunds.fredKey`); otherwise keyless `fredgraph.csv` (often bot-walled).
  Fetch is all-or-nothing: a partial read returns `null` → synthetic.
- The anchor folds into the Exchange as a bounded opening `beanIndex`
  (`startIndex` clamped 0.85–1.15) via `exchange.setAnchor` (once, only at
  day 0). The synthetic path keeps `startIndex === 1.0` bit-identical, so the
  balance harness, offline play, and every replay are untouched. The anchor
  rides the week save (`save.anchor`) and is restored verbatim on resume;
  pre-anchor saves re-anchor synthetic, never retroactively live.
- Synthetic wobble draws from a dedicated stream offset (`seeded(seed+47)`),
  never the sim streams (+17/+19/+23/+29/+43). Tests: market-snapshot.mjs.
- Weather seam: `web/js/weatherSnapshot.js` — city campaigns (`?city=`)
  geocode + fetch a 5-day Open-Meteo forecast (keyless, CORS-open), cached
  under `grunds.weather` (12 h TTL). Each dawn `climateNow()` maps the live
  forecast to the envelope (rain: total ≥8mm or 2 wet days; heat: peak ≥28°;
  crisp: mean tmax ≤10°; else fair) or falls back to seeded `pickClimate`
  (bit-identical for seed-only/offline/pre-anchor saves). Anchor rides
  `save.weather`; envelope is street-scene-only (no sim draws). Tests:
  weather-snapshot.mjs.

## Mid-day beats (asks / incidents / truce)
- No `#offer` modal any more. `presentBeat(o, incident, key)` enqueues a
  `moment` of type `ask` (highest priority) — the floor keeps running, the
  card is non-blocking, y/n keys answer it. Expiry (`ttl` 60 offers / 45
  incidents, counted from when the card is *shown*) resolves as a decline
  and toasts `walkLine`. Pending asks never expire unseen.
- Timetable is `web/js/beats.js` (`planAsk` / `planIncidents`), pure in
  (seed, day): day 1 always asks, one quiet day in 2–5, incidents 0/1/1/2
  across days 2–5, no index repeats within a week. Soft day keeps Pip at 11:00.
- Copy contract (linted in `web/test/agency.mjs`): every entry has
  `line / effect / yes / no / acceptLine / declineLine / walkLine`; cast
  offers add `cast / bubble / snubLine`. `effect` is one plain sentence —
  no `→`, `~`, `%`, or ` · ` chains. Toasts never echo the button label.
- Declined cast asks are remembered: `snubs` (saved with the week) → −0.03 op
  and the `snubLine` replaces that regular's next-day greeting once.
- Lever windows: `leverState` gets `queue`; while `queue >= 5` or
  (in-wave and batch ≤ 8) the levers are free of the £4.20 plan-change fine
  (`.window` class, halo on the chalkboard, one toast per opening).
- Motion polish is render-only: `patrons.render()` eases `vis` (k = dt·6) and
  drives `visPhase` from visual speed; `step()` is sim and must stay
  bit-identical (utilities/replay/seeded-floor tests guard it). `idlePose`
  in poses.js gives standing patrons three per-idx offset micro-clips.
- HUD: `#vitals` is off by default (`V` / `#standbtn`, `localStorage
  grunds.vitals`); camera HOME is `r 20 / phi 0.74`.

## Street of shops / house origin (VISION.md)
- `web/js/street.js` is the pure module: roster (`STREET`), `ORIGINS`,
  `originExposure` / `originAmp` / `originPull`, `houseRead`, `rivalTells`,
  `streetForDay`. No DOM, no rng, no clock — tells use a hash of
  (seed, day, shop id), never a stream.
- The player's house origin (`houseOrigin` in main.js, `exchange.origin`) is
  picked in the Brief, not the licence: the "Your house" pill row appears
  inside the street block once the `street` tool is introduced (day 4), and
  hides again once chosen. Saved with the week; `reset()` re-applies it to
  `exchange.origin` so it survives the next campaign. `grunds.identity`
  records it too.
  A matching event amplifies the bean-index swing by half the street exposure
  and adds `ORIGIN_PULL` footfall. No origin is bit-identical to before.
- `Exchange.peek(bias)` previews the coming draw from a *clone* of the rng
  (`_pool` is shared with `roll`, so they cannot disagree). The Brief runs
  before the draw: `exchange.event` there is yesterday's close, so rival
  lines are past tense and house reads / tells come from `peek`.
- Brief "The street" block = `renderStreetBrief()` (kept out of
  `showMorningBrief` — `visible-rivalry.mjs` scans a 30k-char window).
  Gated on the live tool visibility (`toolsToday.visible.has('street')`):
  day 4 for first-timers, day 1 for returning/tutorial-skipped players.
  Do NOT gate on `introducedSet()` — unlockAll players get `newToday=null`,
  so the commit loop never marks the tool introduced and the block would
  stay hidden all week.
- The house pick arrives the morning AFTER the street is first on the
  cards (`grunds.streetDay`, recorded at render time). Standard week:
  street taught day 4, pick on day 5 — chosen at the climax morning and
  carried into week 2.
- Balance: `node tools/house-sweep.mjs [seeds] [policies] [houses]` drives
  `balance-policies.mjs --single` with `GRUNDS_HOUSE`; policies `informed`
  and `scout` read `__grunds.houseReadNow/tellsNow`. Findings are in
  VISION.md — more footfall made the risky houses worse; don't tune pull.
- Not shipped: tells on the floor (chalkboard/queue), rivals changing sim
  behaviour, supplier stand, capital parameter layer.

## Cosy street (footfall feedback, Nov 2)
- Direction in VISION.md "The cosy street". Diagnosis: 100% of wave spawns
  target our counter; rivals only receive traffic as our failure exits;
  levers change flow rate, never direction.
- Phase 1 (shipped) = choreography, no count changes: door consideration
  beat in patrons.js — arrivals pause 1–2 sim-min at the door when a line
  already exists (state `consider`, dwell off the cosmetic phase, ZERO new
  sim draws, empty bar joins at once so the idle path is bit-identical);
  the join/divert decision after the beat is the unchanged door decision.
  Rival-door ambient traffic in streetLife.js (`rivalvisit` kind, cap 2,
  stop at a neighbour door with a cup, own mulberry32 stream — cosmetic).
  Balked/turnaway strolls already existed (`_leave` far-shelf route, 70%
  visible defection). Balance harness: ±noise vs pre-change tree (mean
  Δ ≈ +£66 on a £7k baseline — economically neutral).
- Phase 2 (shipped): `strollShare(awareness)` in demand.js (base 0.32, floor
  0.08, ×(1−0.75a)), set on `patrons.strollShare` each dawn. The decision
  reuses the spawn's `choiceRoll` — no new sim draws. The rival band is
  decided FIRST, exactly as pre-cosy-street (lost regulars ride on
  rival-choice spawns — Mara's glimpse — that stream must not move); the
  stroll then takes its share of what remains, remapped onto the unit
  interval. Pending regulars never stroll. Strollers glance at the board from the pavement
  (`strolling`/`strollLook`/`strollingOut`, jitter on the cosmetic stream),
  count as `passedBy`, never queue; receipt line when ≥50 & awareness <0.5.
  Quick spawns count without walking. Ambient density: STREET_SEED
  7→10/3→5, STREET_CAP 26→30/10→12, STREET_EVERY 9→8/20→16. Harness vs
  a8a2671: aggregate +12% net worth over 10 runs, no campaign flipped to
  lost. Tests: street-stroll.mjs.
- Guard rails: seeded-floor / replay-campaign / replay-resume stay green
  (determinism), balance-policies reconciliation stays green (ledger).

## The attention street (Nov 3 vision — VISION.md "Arrive as nobody")
Thesis: the street is a real place with its own life and a zero-sum economy
of attention — you arrive as nobody in it. Four pillars, in shipping order:
1. **Cold start (shipped)** — `demand.start` 0.28→0.10 (day 1 ≈0.28× spawn
   mul, <half the old hose); `spawnMin` HOLDS at 0.18 (a first cut to 0.06
   made do-nothing weeks insolvent by day 3 — punishment, not fiction;
   unknown ≠ dead). The hidden funnel `Math.max(1, round(expected))` per
   wave entry is gone — thinning is `waveHash01(seed, day, entry, slot)`,
   a pure hash (no rng stream → mid-day resume replays identical waves).
   Gains raised so working the street is a ladder: chalk 0.03→0.045
   (nearly offsets 0.055 decay — idle drift −0.01/day), sample 0.12→0.18,
   sponsor 0.20→0.30. Frontage converts never stroll (`patrons.recruited`
   guard around the spawn callback in main.js tick); the first convert
   lands a FIRST OFF THE STREET card (`firstRecruitShown`, cleared in
   campaign reset). Verdict gates retuned with the economy: held
   4500→1000, good 5500→2500, star 8000→4500 (rep bars unchanged;
   standing.mjs pins the numbers + copy). Harness matrix (5 seeds):
   passive mean +£469 (3/5 lost), informed +£1802, engaged +£3849 (5/5
   held), growth +£4267. campaign-tight/stock-loan playthroughs stage
   growth-style marketing as part of a "competent week". Tests:
   cold-start.mjs.
2. **Street theatre (first wave shipped)** — authored, seeded moments, one
   live group at a time, all on the street's cosmetic stream (`streetLife.js`,
   tests `street-theatre.mjs`). Shipped: coffee argument (squared pair, one
   lifts the cup, a watcher), bench cat (timer-driven fixture — breathes,
   grooms, tail flicks faster near walkers — never draws the rng) +
   cat-watchers on their own `vg:cat` gate, and the skater (fast crossing, own
   rare roll, board mesh rides under foot, one at a time, scatters pigeons by
   proximity). `_spawnVignette` now branches busker / chat / argue / catwatch
   by one roll; catwatch needs no `VIGNETTE_SPOT`. Killer version still ahead:
   hook moments into attention (busker at our door → awareness). TRUE GTA
   emergence is impossible in a seeded bit-identical sim — authored moments
   that FEEL emergent, never systemic chaos.
3. **Real-world snapshot (infra shipped)** — arabica/cocoa levels + the
   week's weather are fetched ONCE and cached; the week derives
   deterministically from the snapshot. Never live drift (breaks
   replays/harness). Network optional with seeded synthetic fallback
   (Grove-mirror philosophy) — the synthetic path is bit-identical to the
   classic behaviour, so the harness needs no re-sweep. Details + contract
   in "Real-world market snapshot" below.
4. **Attention economy / catchments (thin slice shipped)** — the four
   neighbour buildings ARE the roster now: door ids == shop ids
   (quill = THE QUILL brew bar / rain_taster, hearth = HEARTH & RYE roaster
   house / frost_watcher, bell = BELL & BRASS / harvest_ear, marrow = MARROW
   LANE hybrid). The old data-only names (HUILA HOUSE etc.) are gone —
   street.mjs + house-origin.mjs pins repinned. Each shop wears its posture
   on an A-frame board by its door: `boardLine(row, event)` in street.js
   (pure; tone dark/bracing/bright/flat), painted at dawn in main.js from
   the same `streetForDay` shape the Brief renders, build-time standing
   paint in world.js (`W.setNeighborBoards`). Tests: neighbor-boards.mjs.
   Slice 2 also shipped — the boards have lines: `neighborQueues(boards,
   seed, day)` in street.js maps each tone to a band (dark 0-1, bracing
   1-2, bright 3-4, flat 1-2) via tellHash, so a shop the market hit stands
   nearly empty while a windfall draws a line. streetLife reconciles each
   apron to its target via `NQUEUE_SLOTS` (held `nq:<id>:<i>`) and walk-in/
   dwell/peel-out `nqueue` members; the reconcile runs at the top of tick()
   (posture before ambient filler). Glasshouse keeps its own stand-in
   queue; lite streets carry none. Tests: neighbor-queues.mjs.
   Next: multi-way zero-sum allocation + full rebalance.
- Config contradiction that motivates pillar 1: `start: 0.28 // opening-day
  awareness — nobody knows the stand yet` — the comment says nobody, the
  harness served ~3,000 cups on day 1.

## Frame budget (performance pass)
The "patchy / juddery / stop-start" report traced to per-TICK work storms,
not GPU throughput — rush/evening bursts run up to ~19 sim ticks in one
frame, and each tick used to drag the whole HUD with it:
- Roaster's ticker (world.js): `draw` allocated a NEW `CanvasTexture` every
  call (GPU leak + rebind) and repainted 900 grain rects. Now: one texture
  for the life of the page, grain pre-rendered once and blitted, and
  identical states skip the repaint entirely.
- `updateHUD()` ran at the end of every `tick()`. Now tick() only sets
  `_hudPending`; the loop flushes once per frame, before render. The 200 ms
  text throttle inside updateHUD is unchanged.
- Shadow budget flicked `shadowMap.enabled` every frame at queue 40. Now a
  32/40 hysteresis band, written only on a real crossing.
- The old dynamic-lite ratchet counted slow frames but never reset — one
  transient hitch (dawn build, burst catch-up) could permanently downgrade
  the session. (Superseded by the pass-2 ladder below: slow frames decay,
  and resolution steps down long before anything is switched off.)
- patrons.render: no per-frame `[...this.patrons]` copy; `_prevVis`
  allocated once per patron and mutated in place.
- Pass 2 (steady GPU cost): an adaptive render-scale ladder — sustained
  slow frames (>34ms ×4) step the pixel ratio down one rung
  (`_prLevels`: top=min(DPR,2) → 1.5 → 1.25 → 1) and only when the ladder
  is exhausted does the session hit the lite cliff; ~4s of fast frames
  (<22ms) climbs a rung back, mixed frames decay both counters
  (`applyRenderScale` re-sizes the postfx RTs). Sun shadow map 2048²→1024²
  (PCFSoft; halves the per-frame shadow fill on integrated GPUs). Fixed a
  latent postfx bug: the resize handler passed CSS px, so any window
  resize on a retina display left the bloom pipeline rendering at a
  fraction of the buffer — it now passes `getDrawingBufferSize`.
  Observability: `__grunds.renderScale()` + one `console.info` per rung
  change.
- `web/test/perf-hygiene.mjs` pins all of the above as source contracts.
Sim determinism is untouched — every fix is render/HUD-side only
(balance-policies + replay gates re-ran green).

## Prompt → stand / described street
Natural language is a first-class input to the simulation, not a demo add-on.
Every path below is live for all users.

- **Describe routing:** live sessions POST `/franchise/describe` by default —
  LLM spec + real generation (Rodin first via `convex/rodin.ts`, Tripo
  fallback; photo prompts stay Tripo; `?builder=tripo` opts out end to
  end). The vendored keyword path (`pfDescribe`,
  seeded spec fallback) runs only for explicit `?district=polyfork` /
  `?pfDistrict` opt-ins (`districtPolyforkExplicit`), sessions with no
  Convex bridge, and as the failure fallback so a described lot never
  stays empty. Fallback stands are session-only (pfHydrate stays gated
  on the polyfork flag). `?hackathon=1` remains an internal flag that
  also auto-fills the default pitch prompt.
- **Prompt-derived seed:** with no explicit `?seed=`, a `?prompt=` session
  seeds from `worldSpecHash(prompt)` so described stands land on an
  unclaimed world — a live lot on a shared seed returns `claimed:false`
  and ignores the new prompt. Same words → same seed → the GLB is
  content-cached and instant for the next session.

- `web/js/standSpec.js` + `convex/standSpec.ts`: player words → validated
  stand card (name/cuisine/archetype/cohort/daypart/pull/priceTier/
  signature). LLM via `api.standSpec.expand` when keyed; seeded classifier
  is the always-available fallback and MUST stay bit-identical client and
  server (tests pin it). Card persists on `franchises.spec`; `specForLot`
  prefers the stored card, falls back to prompt classification for legacy
  rows. `specPull(cohort, daypart)` feeds `standWaveMul` in the wave loop —
  placed/successful stands only, per-stand ≤0.3, aggregate ≤0.6.
  `spec.source` (`'llm' | 'seeded'`) is returned on every card and used
  client-side to decide whether to show LLM attribution in the Brief.
- `web/js/worldSpec.js` + `convex/worldSpec.ts`: licence "your street"
  field / `?world=` / `?prompt=` → validated world card (climate, event
  bias vs real EVENTS ids, demand lean, rivalName, origin hint), cached by
  prompt hash, saved on the week save. Climate precedence: live weather →
  world spec → seeded `pickClimate`. Auto-prompt fires once per session on
  the sandbox lot when `?prompt=` is set or the internal hackathonMode flag
  is true.
- **New-visitor onboarding overlay** (`#prompt-intro`): shown on first load
  when there is no saved week and no `?prompt=` already in the URL. Explains
  "type a stand — it becomes a world" with a pre-filled example, a text
  input, a **Go** link (→ `?prompt=[value]`) and a **Lite mode** link
  (→ `?prompt=[value]&lite=1`). Dismissed by signing the licence normally.
  This is the game's natural entry point for new visitors, not a judge mode.
- **LLM attribution** in the Morning Brief: when `spec.source === 'llm'`
  the stand's `specLine` appends `· via {spec.model}` (`· shaped by AI` on
  cards that predate model provenance). The world spec brief line appends
  `· shaped by {spec.model}` when `worldSpec.source === 'live'` — the
  Open-Meteo credit stays in its own live-weather clause. The model name
  is stamped server-side: `convex/{standSpec,worldSpec}.expand` write the
  provider's real model onto the card before caching, and the client
  validators carry it through (`spec.model`, clamped 40 chars). Always on;
  no URL flag required.
- **LLM attribution** in the Wire desk: a `.d-foot` footer on the research
  report built from `intel.feed` (the pipes research.ts actually merged):
  `linkup + firecrawl crawled this · an LLM read the tape · Convex served
  it`. The middle clause only appears when a shift carries an OpenAI `why`.
  Shown whenever the desk opens with intel — no flag.
- **`?lite=1`**: disables GLB humanoid loading (`street.loadChars` guard in
  main.js), `shadowMap.enabled = false` (world.js), street vignettes +
  neighbour queues stay off (every streetLife spawner is `!this.lite`-
  gated), street cap drops to `STREET_CAP.lite`, postfx off, pixel ratio
  clamps to 1.0. Offered as a footer link in the licence modal
  ("on a slow device? try lite mode") for all users — hidden when lite is
  already on, and a typed street rides forward as `?world=` on the reload.
- Franchise lots: `pitch` (day 1, rent 0, `sandbox: true`, no purpose
  picker — spec drives its pull) + row lots 14/11/18. Both client
  `FRANCHISE.lots` and `convex/franchise.ts` MUST stay in parity
  (franchise.mjs pins it). Image-URL prompts skip stand-spec expansion.
- `tools/prebuild-row.mjs` prebuilds showcase stands on a seed.
- Tests: `stand-spec.mjs`, `world-spec.mjs`, `franchise.mjs`.

## Surface / lighting pass (post-c6dd48b)
- `web/js/postfx.js`: scene renders into `rtScene` with `samples: 4` —
  canvas `antialias` does nothing on the composite path. Composite shader
  also does unsharp mask (always, ~0.16) and a 4-tap tilt-shift DOF
  (`uDof`, cine-gated only). `uTexel` tracks drawing-buffer size on resize.
- `web/js/env.js`: dusk HDRI (`assets/hdri/evening_road_01_puresky_1k.hdr`,
  Poly Haven CC0) → PMREM → `scene.environment`, intensity 0.42. GLB
  materials get `envMapIntensity` via `applyEnvIntensity` in loader.js;
  procedural mats via the post-load scene traverse. Headless/no-GL → no-op.
- `web/js/contactShadow.js`: `addContactShadow(parent,x,z,w,d,opacity)` —
  blob under stands/tables/props; headless-safe no-op (no DOM canvas).
- `mat(color, {tex})` in world.js applies surface bakes (`plaster`,
  `roof`, `metal`, `fabric` in textures.js) — near-white grayscale maps
  that multiply the material colour.
- `tools/showcase-shots.mjs` tolerates the licence `?world=` reload
  (execution-context loss mid-evaluate = keep looping). Timeouts are
  env-tunable (`SHOT_GOTO_TIMEOUT`/`SHOT_OPEN_TIMEOUT`/`SHOT_PHASE_TIMEOUT`);
  note `waitForFunction` takes `(fn, arg, options)` — options is the THIRD arg.

## Diorama / painterly grade pass (post-ee4835c)
- The world edge is authored, not hidden: block base uses `plinthEdge()`
  wood grain; a 240×190 matte apron plane at y=-1.03 is "the table" the
  diorama sits on, thinning into fog; five `backdropFlat()` painted
  cyclorama planes (skyline silhouette + haze gradient baked into one
  canvas texture) ring the block as `MeshBasicMaterial` (`W.flatMats`,
  dimmed in `updateTimeOfDay` via `color.setScalar(1 - night*0.68)`).
- Haze ramp coefficient is 0.85 (district-art.mjs pins the literal —
  update the test if it changes again).
- postfx composite adds light NPR: `uPaint` 4-tap edge-preserving smooth
  (~0.18, 0.30 cine) and `uPaper` static fibre grain from `paperGrain()`
  (~0.10, 0.15 cine) sampled at /384 px. Both are grades, not filters —
  keep them low enough that chalkboards/sign text stays readable. No
  Kuwahara: it smears in-world text and fights the render-scale governor.
- `tools/showcase-shots.mjs` writes to argv[3] or `/tmp/showcase-shots`
  (the `GRUNDS_SHOTS` env var does nothing).

## Craft: the drum (Nov 9 playtest pivot)
- The cup is a verb now. `roast: null` means **unprogrammed** and pours a flat
  Q 0.90 — sacks are no longer created at their ideal. Never reintroduce a
  `?? 3` fallback on a roast read; `roastQuality(lot, null)` returns 0.9 by
  contract, and every consumer (serve loop, receipt, letter, convex mirror)
  passes the nullable value through.
- The sweet spot moves: `roastIdeal(lotId, crowdMix, climateLean)` = lot base
  (`ROAST_IDEAL`) + `crowdRoastPull(mix)` (`ROAST_LEAN` per cohort) +
  `ROAST_CLIMATE_LEAN` (heat −1, crisp +1). `lotRoastTarget(id)` in main.js is
  the single place that assembles it — the stepper label, the Q preview and the
  serve loop all read it, so they cannot disagree.
- **The schedule is cohort-flat.** `out/wave_schedule.json` has one cohort
  distribution and `wavesForDay` shifts only commuter *timing*, so any per-day
  mechanic derived from the crowd mix reads a constant (the first cut of this
  feature was inert for exactly this reason). Print a signal across days 1–5
  for two seeds before building on it. Climate is what actually varies.
- Scorch is bought, not gifted: `SCORCH_RISK` (0.08 at level 4, 0.20 at 5)
  rolls on `roastRng` = `seeded(seed + 53)` inside `applyLots`, saved/restored
  as `streams.roast`. **Offsets are a shared namespace** — +47 was already the
  market-snapshot wobble, and `roast.mjs` now fails if any non-main module
  draws +53. Pick a free offset by grepping, not by assuming. The frost-ask
  scorch still exists as the incident variant.
- Day 1 is the coffee: `SCHEDULE = { coffee: 1, menu: 2, street: 4,
  insurance: 5 }`, `planTools` hard-codes the day-1 branch, and
  `renderFranchiseRow` defers the vacant-lot prompt to day 2 (the auto-prompt
  still runs). `#brief.first-morning` uses flex `order` to put the lede then
  the tools block above the afternoon plan — markup order is unchanged and
  `franchise.mjs` still pins `#brief-row` above `#brief-prep`.
- `stageCellar({ lot, roast, topup })` gained `roast` (1–5, `'auto'` →
  this week's read, `'clear'`/null → unprogrammed) so headless policies can
  play the drum. `balance-policies.mjs` stages `roast: 'auto'` for every
  competent policy and leaves passive/reckless unprogrammed, so the verb has a
  measurable price against the floor.
- `web/test/orientation.mjs` is **not valid UTF-8** (23 stray cp1252
  0x92/0x94 bytes). Edit/Write refuse it; patch it with
  `decode('utf-8','surrogateescape')` / `encode(...,'surrogateescape')` to keep
  the bytes, and convert the encoding only as its own deliberate change.

## Floor tactics: stance, bussing, spillover, visual polish, and authentic café scale (Nov 9)
- **Ruth's stance** (`ruthStance`, `S` key / `#stance` button, trading phase
  only): `steady` (default) / `rush` / `craft`, cycled by `toggleRuthStance`.
  It is a *sim* lever, not a cosmetic: `stancePaceMul` (1.35 / 0.72 / 1.0)
  multiplies `staffed` bar-points in the serve loop, and commuter balk chance
  gets `stanceBalkMul` (rush ×0.70 holds the line; craft ×1.45 only when
  `counterQ.length > 3` so short queues don't penalize artisan pace).
  Served events carry `stance`; main.js applies regular-op deltas (craft +0.03
  creatives/elders, rush −0.02 creatives) and `rivalReact('rush')` triggers a
  real sim-side boost for Sam (`rivalCredit = Math.min(1, rivalCredit + 1.0)`)
  as well as toast feedback. Stance persists across dawns in `prepareDay`
  and is saved in `capturePreDawn`/`applySavedWeek` (`staff.ruthStance`),
  reverting to steady only on a fresh campaign `reset()`.
- **Table bussing**: sitters mark their table dirty on `_despawn`
  (`world.markTableDirty` → `t.dirty` + `t.dirtyGroup` mug, saucer, and crumb plate).
  `B` key / `#busbtn` → `busTables()` clears all, clink + toast. `world.dirtyCount()`
  feeds `_campDivert`: all three dirty repels high-dwell cohorts toward
  Glasshouse (+room pressure) even when the room isn't full. In craft stance
  Ruth auto-busses every 20 sim-min while `counterQ` is empty; rush ignores
  tables.
- **Bidirectional spillover**: in the rival-queue walk-back pass, when
  `rivalQ >= 6 && counterQ <= 2 && p.waitMin >= 2` and tables are in the room,
  a 0.20 draw on `patronsRng` (sim stream, saved/restored — replay-safe) moves
  the patron to `counterQ` with `rivalOrigin: 'spillover'`; main.js toasts +
  clinks on `rivalSpillover`. Not gated by `truceCeasefire`.
- **Gossip**: a named regular served with `op > 0.65` and `floorRng() < 0.30`
  triggers `fx.gossipBubbles(p, line, 'good')` — cosmetic only, routed
  through the friendship graph (`chainDepth`). Line picks "Best pour…" when
  craft stance or `roastMul >= 0.95`.
- **Visual coffee polish**:
  - `fx.steamFrom(dt)` now rises from the active espresso pickup spot on
    the counter (`LAYOUT.counter`) and from mugs on seated tables (`LAYOUT.tables`).
  - Cup surfaces are tinted by drink in `patrons.js` (matcha `0x86a860`,
    espresso crema `0x4a2c1a`, flat white / latte `0xd8b27a`, filter `0x2e1a10`).
  - Table clutter includes a ceramic saucer and golden pastry crumb plate.
- **Economic rescaling to café scale**:
  - `spawnScale`: 0.028 (~180–320 cups/day).
  - Fixed costs: `staffDayRate: 140`, `pitchMin: 110` (reval delta +15),
    `sundries: 15`, `powerStanding: 10`, `wifi: 5`. The daily nut displays
    `staff £140 · rent £110 · supplies £0 · bills £35` (£285/day total).
  - `contractUnits: 240` (covers 1 full day of coffee), `creditLimit: 1200`
    (covers ~2 days of bean inventory).
- **Hedge rebalance (+EV) — measured, not just asserted**:
  `contractUnitFee` 0.09→0.045 and `contractFeeSlope` 0.025→0.015, mirrored
  in `convex/gameConfig.ts`. Empirical run on Seed 7 (frost week): `conservative`
  (hedging) earned £1,610.97 net worth with `+£56.93` net hedge benefit after
  fees, beating unhedged `forecaster` (£1,020.72) by +£590.25 (+58%).
- Tests: `web/test/barista-stance.mjs` (17 checks — stance muls/balks, dirty
  props + bussing, spillover thresholds, gossip trigger, steam, cup tinting).

## UI density, HUD streamlining, and Brief folding pass (Nov 10)
- **Brief progressive disclosure & folding**:
  - Day 1 scroll content reduced from 1,379px to 815px (desktop) / 1,165px (phone).
  - Days 2–5 scroll content reduced from ~2,400px to ~1,085–1,313px. Optional tools
    and secondary panels (`#brief-street`, `#brief-row`, `#brief-staff`, `#brief-actions`,
    `#brief-lots`, `#brief-menu`, `#brief-demand`, `#brief-rival`, `#brief-nut`,
    `#brief-context`) render as single-line summary rows (`.brief-fold > summary` with
    `· change ›`, ~32–46px) that open on tap.
  - Morning prep / required decision stays on top. State persists across section-local
    re-renders during planning.
  - Pastry case options lay out in a compact 3-column grid (`#brief-pastry`).
- **HUD & Levers**:
  - HUD screen share reduced from 35% to 26% (desktop rush) / 68% to 57% (phone rush).
  - Goal line no longer duplicates prices; prices live on the lever buttons only.
  - Late-switch disclosure is stated once without redundant price repetition.
  - System controls streamlined: speed (1×/5×/20×), pause, and `more` toggle. Secondary
    controls (stand, camera, photo, see inside, sound, notebook, restart week) fold
    behind `more` with outside-click and Escape dismissal.
  - Notebook no longer auto-opens across gameplay; toggled via the notebook button.
- **Phone responsive layout**:
  - Fixed desktop `max-width` constraining lever and system rows on mobile. Levers span
    full width in a 2×2 grid with ≥44px touch targets.
- **Type scale & Modals**:
  - Standardized Brief, HUD, and modal typography onto a 4-step token scale
    (`--fs-1: 11px`, `--fs-2: 12.5px`, `--fs-3: 14px`, `--fs-4: 16px`).
  - Licence modal folds optional city/world fields behind `<details id="lic-more">`
    (auto-expanded if pre-filled), keeping background perks visible.
  - Receipt modal keeps the ledger drawer folded by default so the summary fits
    without scrolling.
- **UI Density Audit**:
  - `tools/ui-audit.mjs` plays day 1 headlessly across desktop (first-timer & vet)
    and mobile (390×844) viewports, screenshotting modals and HUD with automated
    box, scroll, and chrome share metrics.

## Conventions
- Import specifiers must match the tracked filename **byte for case**. CI runs
  on a case-sensitive FS; macOS does not, so `./barStaff.js` passes every
  local run and dies with `ERR_MODULE_NOT_FOUND` on the runner. That kept main
  red on every push from 3 Nov until `e106087`. Suspect it first when CI is
  red and `npm test` is green locally.
- Choice surfaces: options + consequence visible, no folds for choices —
  see ARCHITECTURE.md "Choice surfaces".
- Sim RNG must never call bare `Math.random` — streams are `seeded(seed + n)`
  (`patronsRng` +17 decisions, `patronsCosRng` +29 spawn paint, `floorRng`
  +19, `fxRng` +23, `patronsConvRng` +43 frontage, `roastRng` +53 drum scorch
  — saved/restored/reset as `streams.conv` / `streams.roast`);
  `web/test/seeded-floor.mjs` and `replay-campaign.mjs`
  guard it.
