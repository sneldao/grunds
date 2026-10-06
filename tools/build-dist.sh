#!/bin/sh
# Build dist/ for @convex-dev/static-hosting upload.
# The staged tree is what gets uploaded: every ES module URL carries ?v=
# so a returning browser cannot mix this release with a cached older one.
# Usage: sh tools/build-dist.sh   (from the repo root)
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ ! -f "$ROOT/out/wave_schedule.json" ]; then
  python3 -m grunds.ingest
fi
STAGE=$(mktemp -d)
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT
# stage-site copies index.html, streets.html, js, vendor, and assets,
# then stamps ?v= on every module URL.
node "$ROOT/tools/stage-site.mjs" --out "$STAGE"
test -f "$STAGE/streets.html"
rm -rf "$ROOT/dist"
mkdir -p "$ROOT/dist"
cp -a "$STAGE/." "$ROOT/dist/"
# Tripothon asset board (slot · provider · prompt · preview · in-game shot).
# Non-fatal: the game ships even if the board can't be built offline.
node "$ROOT/tools/build-asset-board.mjs" --out "$ROOT/dist/asset-board.html" || echo "asset board skipped"
echo "dist ready: $(find "$ROOT/dist" -type f | wc -l | tr -d ' ') files"
