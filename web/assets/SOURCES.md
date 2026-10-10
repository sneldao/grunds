# web/assets sources (Phase 0 — free, CC0)

All files CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/).
No attribution required. Do not commit other packs' files here without listing them.

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
  - cup-coffee.glb, croissant.glb, cake.glb, mug.glb
  - Textures/colormap.png (required external texture for the food GLBs)

Full zips (not committed): kept outside the repo during setup; re-download from
the URLs above. Considered but deferred: Quaternius Sushi Restaurant Kit,
Ultimate House Interior, Ultimate Food (https://quaternius.com, CC0).

## audio/ — recorded café one-shots (Freesound, CC0 1.0)

Derived from each sound's public lq preview MP3 (no login); raw downloads kept
outside the repo. Edits in ffmpeg: crop/trim, fades, mono, 44.1 kHz, 96 kbps
MP3, peak normalized to ≈ −3 dB.

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
