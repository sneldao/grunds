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
  - kitchenBar.glb, kitchenBarEnd.glb, kitchenCoffeeMachine.glb
  - tableRound.glb, chairModernCushion.glb, stoolBar.glb
  - bookcaseClosedDoors.glb, sideTable.glb, lampRoundTable.glb, pottedPlant.glb
- Kenney Food Kit (200 files) — https://kenney.nl/assets/food-kit
  - cup-coffee.glb, croissant.glb, cake.glb, mug.glb, carton.glb, bag.glb
  - Textures/colormap.png (required external texture for the food GLBs)

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
