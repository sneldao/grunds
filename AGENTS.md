# Working notes

## Verify
- `npm test` — full suite (`node --test web/test/*.mjs`, sequential)
- `npm run typecheck` — `tsc --noEmit`
- Licence/identity surface: `node web/test/identity.mjs web/test/orientation.mjs`

## Deploy (`npm run deploy:site`)
- `tools/build-dist.sh` → `stage-site.mjs` bundles the **working tree**, not HEAD.
  With uncommitted work in the tree, deploy from a clean `git worktree` at the
  commit instead — and put it outside `/tmp`: `/tmp` is a `/private/tmp`
  symlink on macOS, and invoking `stage-site.mjs` by an absolute `/tmp/...`
  path desyncs its `argv[1] === import.meta.url` main-check so it silently
  exits 0. `~/grunds-deploy` works; symlink in `node_modules`, `out/`, `.env`,
  `.env.local` first.

## Generated assets (Grove mirror)
- Convex data-egress is the constraint: generated GLBs + previews are mirrored
  to Grove (immutable, `chain_id` 232) and the client rewrites
  `*.convex.cloud/api/storage/<uuid>` via `web/js/groveAssets.js` (generated —
  do not hand-edit the map). Un-mirrored storage URLs resolve to `null` and
  fall back to the classic procedural path **without a network request**.
- After new generations land (Tripo `persist`, franchise stands, new district
  kits), refresh the mirror: `node tools/mirror-assets.mjs` then redeploy.

## Conventions
- Choice surfaces: options + consequence visible, no folds for choices —
  see ARCHITECTURE.md "Choice surfaces".
- Sim RNG must never call bare `Math.random` — streams are `seeded(seed + n)`
  (`patronsRng` +17 decisions, `patronsCosRng` +29 spawn paint, `floorRng`
  +19, `fxRng` +23); `web/test/seeded-floor.mjs` and `replay-campaign.mjs`
  guard it.
