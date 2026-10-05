#!/bin/sh
# Build dist/ for @convex-dev/static-hosting upload. No bundler: web/ is
# already plain HTML+JS, so "build" = copy + inject the schedule snapshot.
# Usage: sh tools/build-dist.sh   (from the repo root)
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
rm -rf "$ROOT/dist"
mkdir -p "$ROOT/dist/api"
cp "$ROOT/web/index.html" "$ROOT/web/streets.html" "$ROOT/dist/"
cp -R "$ROOT/web/js" "$ROOT/web/vendor" "$ROOT/web/assets" "$ROOT/dist/"
if [ ! -f "$ROOT/out/wave_schedule.json" ]; then
  python3 -m grunds.ingest
fi
cp "$ROOT/out/wave_schedule.json" "$ROOT/dist/api/schedule.json"
# Tripothon asset board (slot · provider · prompt · preview · in-game shot).
# Non-fatal: the game ships even if the board can't be built offline.
node "$ROOT/tools/build-asset-board.mjs" --out "$ROOT/dist/asset-board.html" || echo "asset board skipped"
echo "dist ready: $(find "$ROOT/dist" -type f | wc -l | tr -d ' ') files"
