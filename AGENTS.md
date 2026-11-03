# Working notes

## Verify
- `npm test` — full suite (`node --experimental-vm-modules --test --test-concurrency=1 web/test/*.mjs`)
- `npm run typecheck` — `tsc --noEmit`
- Licence/identity surface: `node web/test/identity.mjs web/test/orientation.mjs`
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

## Street / camera roadmap (post-feedback, agreed order)
1. Street vignettes — busker+crowd & chatting pairs in streetLife.js
   (waypoint dwell+face groups; one live group, members share the cap).
   Shipped: pigeons (instanced, peck/hop, proximity scatter — no per-frame
   rng), phone/sip occupation actions on dwellers, guaranteed park+bench
   sitters at beginDay, cohort dress codes (DRESS: hat/held/gait per
   cohort), and cloned Polyfork humanoids on standing-kind agents via
   street.loadChars() + CHAR_BY_COHORT (blobs hidden beneath; sitters and
   walkers stay instanced). Next: dog walker needs its own rig;
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
   displays candidates (showFrontage/finishFrontage).
4. Seasons — current climate envelope is cosmetic: seeded
   fair/heat/rain/crisp changes street density/cadence, sky tint/sun/stars,
   and rain. The fixed Brief header explains it before opening. Climate
   refreshes from the active seed on prepare/reset; heat has room for 33
   full-mode walkers and rain vignettes respect the reduced cap. Demand
   reweighting and umbrellas/caps remain future work.

## Generated assets (Grove mirror)
- Convex data-egress is the constraint: generated GLBs + previews are mirrored
  to Grove (immutable, `chain_id` 232) and the client rewrites
  `*.convex.cloud/api/storage/<uuid>` via `web/js/groveAssets.js` (generated —
  do not hand-edit the map). Un-mirrored storage URLs resolve to `null` and
  fall back to the classic procedural path **without a network request**.
- After new generations land (Tripo `persist`, franchise stands, new district
  kits), refresh the mirror: `node tools/mirror-assets.mjs` then redeploy.

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

## Conventions
- Choice surfaces: options + consequence visible, no folds for choices —
  see ARCHITECTURE.md "Choice surfaces".
- Sim RNG must never call bare `Math.random` — streams are `seeded(seed + n)`
  (`patronsRng` +17 decisions, `patronsCosRng` +29 spawn paint, `floorRng`
  +19, `fxRng` +23, `patronsConvRng` +43 frontage — saved/restored/reset as
  `streams.conv`); `web/test/seeded-floor.mjs` and `replay-campaign.mjs`
  guard it.
