#!/bin/sh
# deploy-vercel.sh — publish dist/ to Vercel (project grunds-proxy →
# grunds.trustfall.xyz). The staged site files sit next to vercel.json in
# deploy/vercel-proxy and are served by Vercel's CDN; only the API prefixes in
# vercel.json proxy to the Convex deployment, so the ~40MB asset payload no
# longer burns Convex data egress.
#
# One-time setup (either):
#   cd deploy/vercel-proxy && npx vercel link        # project: grunds-proxy
# or export VERCEL_ORG_ID + VERCEL_PROJECT_ID.
# Then: sh tools/deploy-vercel.sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SITE="$ROOT/deploy/vercel-proxy"
[ -f "$ROOT/dist/index.html" ] || { echo "no dist/ — run npm run build:dist first" >&2; exit 1; }
rsync -a --delete --exclude 'vercel.json' --exclude '.vercel' --exclude '.env*' "$ROOT/dist/" "$SITE/"
cd "$SITE"
if [ ! -f .vercel/project.json ]; then
  if [ -n "${VERCEL_ORG_ID:-}" ] && [ -n "${VERCEL_PROJECT_ID:-}" ]; then
    mkdir -p .vercel
    printf '{"orgId":"%s","projectId":"%s"}\n' "$VERCEL_ORG_ID" "$VERCEL_PROJECT_ID" > .vercel/project.json
  else
    echo "deploy/vercel-proxy is not linked — run 'npx vercel link' there once (project: grunds-proxy)" >&2
    exit 1
  fi
fi
npx vercel deploy --prod --yes
