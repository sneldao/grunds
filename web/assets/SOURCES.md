# web/assets sources (free assets, mixed licences)

GLBs under `assets/` (root + `Textures/`) and `audio/` are CC0 1.0 Universal
(https://creativecommons.org/publicdomain/zero/1.0/) — no attribution required.
`icons/` is CC BY 3.0 — attribution required, and it ships in the Brief's art
credits. `polyfork/` is the Polyfork free catalogue licence (commercial use,
modification, no attribution; do not redistribute the files themselves as
assets — in-game use is fine). Do not commit other packs' files here without
listing them.

**As of 2026-09-09 every asset in this directory was loaded by `web/js/world.js`
via the vendored GLTFLoader (see `web/js/loader.js`).** That was true when only
GLBs lived here; `audio/` (added later) is fetched lazily by `web/js/audio.js`,
not world.js. The food kit GLBs
(`croissant.glb`, `cake.glb`, `mug.glb`, `cup-coffee.glb`) reference
`Textures/colormap.png` via a relative path; the loader registers `assets/` as
the root so the texture resolves.

- Kenney Furniture Kit (140 files) — https://kenney.nl/assets/furniture-kit
  - placed: kitchenBar.glb, kitchenBarEnd.glb (the bar shell and the till)
  - vendored, not placed in the room: kitchenCoffeeMachine.glb,
    tableRound.glb, chairModernCushion.glb, stoolBar.glb,
    bookcaseClosedDoors.glb, sideTable.glb, lampRoundTable.glb, pottedPlant.glb
    (stools, tables, chairs, pendants, the shelf back, and the door pots
    are procedural walnut and brass in world.js)
- Kenney Food Kit (200 files) — https://kenney.nl/assets/food-kit
  - cup-coffee.glb, croissant.glb, cake.glb, mug.glb, carton.glb, bag.glb
  - Textures/colormap.png (required external texture for the food GLBs)

## polyhaven/ — Poly Haven models (CC0 1.0, https://polyhaven.com/license)

- CoffeeCart_01 (by Joe Seabuhr) — industrial coffee cart; .gltf + .bin +
  1k JPG textures kept under `polyhaven/CoffeeCart_01/` so the loader's
  relative sidecar resolution works. Placed in world.js as pitch-side
  dressing. API: https://api.polyhaven.com
- metal_trash_can, wooden_crate_01, Barrel_01, planter_box_01 — pitch-side
  clutter and pavement greenery, same .gltf + sidecar layout, placed in
  world.js beside the coffee cart. All CC0 1.0 via https://api.polyhaven.com

## hdri/ — Poly Haven HDRIs (CC0 1.0, https://polyhaven.com/license)

- evening_road_01_puresky_1k.hdr — dusk sky-only HDRI; PMREM-filtered into
  `scene.environment` by web/js/env.js for image-based lighting on every
  MeshStandardMaterial. Sky-only variant keeps the horizon clean for the
  shader sky dome. API: https://api.polyhaven.com

## polyfork/idles.json — Rokoko everyday idles, retargeted

Three 5-second loops (IdleChat, IdleWatch, IdleLook) baked by
`tools/retarget-rokoko-idles.mjs` from Rokoko's free everyday-idle pack
(FBX, Mixamo skeleton, 30 fps, commercial use — the source zip is not
committed): https://www.rokoko.com/resources/rokoko-mocap-10-free-everyday-idle-animations

Retargeted onto the shared Polyfork body bones (fingers and face dropped).
Street dwellers play one, chosen by `idx`, up to eight at a time. The
busker is left on his authored pose.

## polyfork/ — Polyfork free catalogue (vendored by tools/vendor-polyfork.mjs)

Per-asset pages and licence: https://polyfork.dev (free low-poly tier:
commercial use, no attribution; not CC0 — see header note). manifest.json +
web/js/polyforkManifest.js are generated; re-run the vendor script to update.

- espresso-machine-a2db84, coffee-grinder-6f962a, batch-brew-urn-f54a3b,
  pos-terminal-f1273c, takeaway-coffee-cup-1fd6dd, pastry-display-case-8bcce5,
  shop-coffee-roaster-c6a2b5, chalkboard-menu-board-a24d9d,
  bistro-table-877a6d, bistro-chair-7c354d, planter-trough-divider-1b0ead,
  potted-olive-tree-7eee05 — Modern Restaurant Cafe kit
- market-stall-94937d — Medieval Village kit
- newsstand-6dfd65, projecting-shop-sign-aa1867, globe-lamp-346cb6,
  brownstone-row-house-e58392, street-lamp-136745, hot-dog-cart-115192,
  street-sign-pole-1e9551 — New York City kit
- lantern-post-f47665 — Nature & Forest kit
- paper-lantern-3387e9, ramen-yatai-stall-53974b — Little Tokyo kit
- mercado-stall-6e6ba3, elote-cart-a8fb49, plaza-fountain-5a5f6e — Día de Muertos kit
- flower-planter-550bfb — Little Tokyo kit
- sandwich-board-sign-cb5e7c — Little Tokyo kit
- hanging-shop-sign-18d2b0 — Frontier Town kit
- yard-sign-f1882f — Neighborhood Pathways kit
- ice-cream-kiosk-on-40a568 — Coast and Boardwalk kit
- sopaipilla-cart-712632 — Chile: Fiestas Patrias kit
- campus-plaza-fountain-a0cab1, campus-coffee-kiosk-ec2395 — University kit
- coffee-kiosk-406d3e — Modern Restaurant Cafe kit
- refreshment-kiosk-406f65 — Stadium kit
- container-snack-kiosk-7036e5 — Skatepark kit
- delivery-moped-1aa2ce — Little Tokyo kit

Full zips (not committed): kept outside the repo during setup; re-download from
the URLs above. Considered but deferred: Quaternius Sushi Restaurant Kit,
Ultimate House Interior, Ultimate Food (https://quaternius.com, CC0).

## audio/ — recorded café one-shots (Freesound + OpenGameArt, CC0 1.0)

The Freesound three derive from each sound's public lq preview MP3 (no
login); `street.mp3` is an OpenGameArt OGG download. Raw sources kept outside
the repo. Per-file edits below (ffmpeg crop/trim, fades, mono MP3, peak
normalize).

- `audio/espresso.mp3` — espresso machine rush, loop under `AudioEngine.rush`
  - https://freesound.org/people/KaleidacousticsAudio/sounds/627650/ — KaleidacousticsAudio, CC0
  - preview: https://cdn.freesound.org/previews/627/627650_13875907-lq.mp3
  - edit: 8–14 s crop (6 s), 0.15 s fade in/out
- `audio/grinder.mp3` — bean grinder burst for the pre-batch lever
  - https://freesound.org/people/tbsounddesigns/sounds/530197/ — tbsounddesigns, CC0
  - preview: https://cdn.freesound.org/previews/530/530197_5387364-lq.mp3
  - edit: 2–4 s crop (2 s), 0.03 s fade in / 0.15 s fade out
- `audio/cup.mp3` — ceramic cup set down; `AudioEngine.clink()`
  - https://freesound.org/people/TheHiraHira/sounds/460241/ — TheHiraHira, CC0
  - preview: https://cdn.freesound.org/previews/460/460241_9117851-lq.mp3
  - edit: leading/trailing silence trimmed at −50 dB (0.11 s remains),
    0.01 s fade in / 0.1 s fade out
- `audio/street.mp3` — distant traffic bed under `AudioEngine.streetActive`
  - https://opengameart.org/content/high-traffic-road-sounds — IgnasD, CC0
  - download: https://opengameart.org/sites/default/files/gatve%20Varniu_2.ogg
  - edit: first 12 s of 59.6 s source, highpass 90 Hz / lowpass 900 Hz,
    0.5 s fade in/out, mono, 32 kHz, 64 kbps MP3, peak ≈ −9 dB

## meshy/ — Meshy-generated assets (vendored by tools/vendor-meshy.mjs)

AI-generated via the Meshy API (https://www.meshy.ai); generated offline,
committed as GLBs. Meshy output licence: check meshy.ai terms for commercial
use of generated assets. manifest.json records task ids, models, credits.

Placed in world.js / streetLife.js: crate-stack, vintage-bike,
plant-cluster, guitar-case, street-piano (pavement), cat (bench cat GLB
swap), skateboard (skater deck swap), street-musician.walk (rigged busker,
own 24-joint rig + Walk clip). Vendored but not on the counter: cake-stand,
cup-stack (the bar is the Polyfork café kit). Not yet placed: a-board,
roof-tank, roof-dish, roof-antenna.

Style-matched via image-to-3D: cup-stack, cake-stand, a-board,
plant-cluster, vintage-bike and crate-stack from renders of our own GLBs
(cup-coffee, cake, chalkboard-menu-board, potted-olive-tree,
delivery-moped, carton); cat, skateboard, guitar-case and street-piano
from Meshy text-to-image references. Task ids are in manifest.json.

## hyper3d/ — Hyper3D Rodin-generated assets (vendored by tools/vendor-hyper3d.mjs)

AI-generated via the Rodin API (https://hyper3d.ai); generated offline,
committed as GLBs — and since 2026-11-11 also the live describe-path
builder (`convex/rodin.ts`: player words → Rodin first, Tripo fallback).
First A/B spike landed 2026-11-11 (all Gen-2.5-Low,
Basic-access account — Medium rejected with API_NO_ACTIVE_SUBSCRIPTION):
espresso-rodin-low (style-matched re-gen of our machine, 9.9k tris),
stand-rodin-low (text-to-3D market coffee stall, 11.5k tris),
barista-rodin-low (text-to-3D T-pose-aspirant barista, 9.3k tris),
espresso-rodin-low-v2 (same ref + explicit two-group prompt — exactly two
groups, faithful; use v2, not v1, for any placement),
barista-rodin-low-rigged (--rig model-upload path: human template, core
skinning, skinned JOINTS/WEIGHTS, no clips),
barista-rodin-walk (same rig + human_sp/walking preset: 1 clip, 104
channels, 2 s — the donor-walk-killer test, awaiting in-engine playback).
In-engine proof (ego-browser live session, day-2 paused street, insert-view
close-ups via rig.focus view+hold): proof-stand-present.png (stall renders
on the pavement by the piano — wood, striped awning, bean bags, legible
chalkboard) + proof-stand-absent-control.png (same framing with H3_*
hidden — stall gone, so the pixels are ours, not dressing) +
proof-barista-fullbody.png (walk GLB full figure, blue cap/apron, skinned
mesh + clip bound, mixer.setTime drives the pose). Verdict: Rodin earns
the describe-path stand slot; espresso v2 + walk-clip viable, final call
needs a side-by-side against incumbents.
Rigging note: asset_id submits on raw Rodin geometry fail in-job with
"Invalid input" (no confirmed model/texture); the tool auto-retries as a
model upload, which works and preserves PBR materials — the A/B spike (espresso machine
re-gen, 1 franchise stand, 1 rigged humanoid) lands here first. Paid plans
include unlimited export / any use; free-tier output is limited — see
https://hyper3d.ai/pricing. Tool defaults: Gen-2.5-Low (Basic-access safe),
Raw + quality_override 10000 (house 8–12k face discipline, Fast-mode
eligible), tier-default 2K textures crushed to WebP 1k post-download.

## pbrgen/ — PBRgen-generated texture maps (app.pbrgen.com, Pro plan)

AI-generated via PBRgen (https://app.pbrgen.com); generated offline,
committed as WebP. Pro plan permits commercial use of generated maps.
Derived from our own `pavement()` canvas bake (web/js/textures.js)
uploaded as the start image — same slab grid, pixel-aligned, tiles
seamlessly. Create at 1K with "Inpaint seams" off; only NRM + ROUGH
kept (COL/DISP/SPEC discarded). Applied to the pavement material by
world.js only while it rains (lazy-loaded on first rain; dry days never
fetch them).

- `pbrgen/pavement-nrm.webp` — 1024² normal map, OpenGL convention
  (three.js-ready, no Y flip), q92 WebP
- `pbrgen/pavement-rough.webp` — 512² greyscale roughness (values
  0.55–0.75, grout rougher than slabs), q85 WebP

## icons/ — Morning Brief + vitals ink glyphs (Game-icons.net, CC BY 3.0)

Four by Delapouite and one by rihlsul, all CC BY 3.0
(http://creativecommons.org/licenses/by/3.0/) — attribution required; the
credit lives in the Brief's "art credits" fold. Artwork unchanged; tinted via
CSS masks (`background-color: currentColor` + `mask: url(...)`).

- `icons/coffee-beans.svg` — cellar/pouring summary glyph
  - https://game-icons.net/1x1/delapouite/coffee-beans.html
  - download: https://game-icons.net/icons/000000/transparent/1x1/delapouite/coffee-beans.svg
- `icons/croissant.svg` — pastry-case section label glyph
  - https://game-icons.net/1x1/delapouite/croissant.html
  - download: https://game-icons.net/icons/000000/transparent/1x1/delapouite/croissant.svg
- `icons/coins.svg` — closing-bills summary glyph
  - https://game-icons.net/1x1/delapouite/coins.html
  - download: https://game-icons.net/icons/000000/transparent/1x1/delapouite/coins.svg
- `icons/coffee-cup.svg` — vitals staff/batch glyph — Delapouite
  - https://game-icons.net/1x1/delapouite/coffee-cup.html
  - download: https://game-icons.net/icons/000000/transparent/1x1/delapouite/coffee-cup.svg
- `icons/milk-carton.svg` — vitals milk glyph — rihlsul
  - https://game-icons.net/1x1/rihlsul/milk-carton.html
  - download: https://game-icons.net/icons/000000/transparent/1x1/rihlsul/milk-carton.svg
passenger-ac425a, graduate-student-945ef0, grandmother-in-a-rebozo-4d5190, professor-14dc4d, trainspotter-ffd141, organillero-67b687 (characters — cohort humanoids)
village-child-bef09e, flight-attendant-befaf4, huaso-c4847f, parrilla-cook-255918 (characters — cohort variety)
