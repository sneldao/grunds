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

## Conventions
- Choice surfaces: options + consequence visible, no folds for choices —
  see ARCHITECTURE.md "Choice surfaces".
- Sim RNG must never call bare `Math.random` — streams are `seeded(seed + n)`
  (`patronsRng` +17 decisions, `patronsCosRng` +29 spawn paint, `floorRng`
  +19, `fxRng` +23); `web/test/seeded-floor.mjs` and `replay-campaign.mjs`
  guard it.
