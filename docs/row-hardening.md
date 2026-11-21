# Row hardening — generated-asset risks + plan

*Created 2026-11-21. Tracks the four risks from the design review of
generated assets (Grove-first persist era). Check items off as they ship.*

## Verdict recap

The describe→persist system is well-designed: permanent, shared, systemic
(words → GLB + deed + spec card that drives the stand's pull on the floor
for every later player). The exposure is editorial, not architectural.

## Risks

### 1. Aesthetic coherence — generated PBR on a flat-shaded street

Polyfork assets are flat-shaded vertex-colour (`PF_TINT` rewrites
`COLOR_0` zones). Generated stands are `pbr: true` textured models with no
vertex-colour zones — the tint machinery can't apply. `loader.js` only
runs `applyEnvIntensity`. `FRANCHISE_FRAME` already house-styles the
*prompt* ("warm honey-oak and brass fittings"); nothing grades the
*material*.

**Plan — client-side grade pass:** ✔ shipped
- [x] `gradeStreet(root)` in `loader.js` after `applyEnvIntensity`,
      opt-in via `glb.loadGLB(url, { grade: 'street' })`:
  - `metalness → 0`, `roughness ≥ 0.7` — kills the glossy tell
  - `envMapIntensity` already clamped by applyEnvIntensity
  - fragment-shader desaturation + warm multiply (onBeforeCompile) —
    pulls albedo toward the street palette
  - grade is part of the cache key (same URL can never load both ways)
- [x] Wire `grade: 'street'` into `franchise.js` + `districtGen.js` loads
- [x] `tools/stand-shots.mjs` — side-by-side render (generated stand vs
      Polyfork storefront) to eyeball the grade before shipping.
      Verified: graded model visibly warmed/desaturated toward the
      Polyfork palette. Harness quirk: `loadGLB` cross-fades instances
      over RAF — the capture must pump ~40 RAFs before `toDataURL`.
- Escalation if insufficient: offline texture bake (deferred — Grove URLs
  are content-addressed, rebake means repatching rows)

### 2. Curation — permanent unmoderated UGC

`/franchise/describe` is unauthenticated; output is permanent on a shared
street. Corrections from the review: the image URL is fetched by the
*provider* (Tripo), not our backend — lower SSRF exposure than first
assessed; and `FRANCHISE_LOTS` bounds each street to 4 stands. No admin
surface exists anywhere in convex/ yet.

**Plan:** ✔ shipped (as `franchise.setHidden`)
- [x] `franchises.hidden` + `hiddenReason` (schema, optional)
- [x] `franchise.setHidden` mutation: `{token, seed, lot, hidden, reason}`
      vs env `ROW_MOD_TOKEN`; filters in `status`/`statusLive`/`streets`
      (client derives vacancy from absent rows → hidden lots auto-vacant).
      Bonus: a re-described lot clears the flag (`hidden: undefined`) —
      curation hides the stand, not the lot.
- [x] Prompt/byline blocklist in `sanitizeFranchisePrompt`/`sanitizeByline`;
      image URLs: `https:` only, no userinfo, dotted hostname
- Deferred: `franchiseReports` table (no auto-hide — griefing surface)

### 3. Immutability — no renovation path

Failed generations already re-describe; *successful* stands are locked
("first-come authorship" — deliberate). No auth → builder identity can't
be verified; gates are economic, not identity.

**Plan — `franchise.remodel`:** ✔ shipped
- [x] `describe` accepts `remodel=1` — honoured on `success` lots only;
      same pipeline, new key, `record` patches the franchises row with
      `existing.byline ?? args.byline` + `existing.purpose` preserved
      ("built by X, renovated day N"; an unsigned deed may be signed by
      the renovator)
- [x] Hardening beyond the plan: a failed remodel generation never
      repoints the lot (the standing build stays up), and identical
      words don't burn a renovation (same key → no count bump)
- [x] `FRANCHISE_REMODEL_MAX = 2` server-side; `status` returns
      `remodelCount`; `settled` status at the cap
- [x] Client: `place()` swaps stand+sign+shadow when a new modelUrl
      lands; renovate links on built stands → remodel-mode describe
      card; `FRANCHISE.remodelCost` (£60) from the till, client-enforced
- [x] Old tripoAssets row becomes unreferenced → `storage-audit --delete`
      reclaims (plumbing already exists)
- **DECIDED:** paid renovation allowed — deed preserves first signature

### 4. Load weight — bounded, needs hygiene not surgery

Audit data: median 1.83MB, p90 3.36MB, max 5.2MB per object × 4
stands/seed ≈ 7MB typical, ~20MB worst on a 43MB street. Bounded by the
lot table, not unbounded.

**Plan:**
- [x] `tripoAssets.sizeBytes` at persist (`buf.byteLength`) — enables a
      per-street byte policy later
- [ ] Defer stand loads until after first interactive frame (queue
      `place()` behind world-ready)
- Deferred: offline gltf-transform pass; per-street byte budget

## Phase order

- **Phase 1** ✔ shipped (2026-11-21): grade pass + wiring + shot harness;
  hidden + `setHidden` + filters; sizeBytes. Typecheck clean, 566/566
  fast tests, convex dev pushed.
- **Phase 2** ✔ shipped (2026-11-21): prompt/URL hygiene (blocklist,
  https-only image input); remodel verb (`remodel=1`, £60 from the
  till, cap 2, deed preserved). Typecheck clean, 566/566 fast tests,
  convex dev pushed.
- **Phase 3** (only if measured): offline texture bake; deferred
  stand-load queue; byte-budget policy

## Live verification (2026-11-21, Vercel + convex dev)

- Deploy live at grunds.trustfall.xyz; `ROW_MOD_TOKEN` armed on dev.
- Fresh seed `777001` Pitch describe (`a small secondhand bookstall`,
  byline `devin-verify`, spec `Page & Perk`): provider URL flipped to a
  Grove `api.grove.storage` URL ~30 s after success — Grove-first persist
  verified in production path.
- Idempotent re-describe: `claimed:false`, original prompt/byline/model
  untouched. Blocked word prompts and `http://` image input → `invalid`.
- Remodel (`a tiny vinyl listening bar`, `remodel=1`): `remodeled:true`,
  `remodels:1`, byline preserved despite a conflicting signature attempt;
  new GLB landed on Grove; raw/graded/polyfork side-by-side confirms the
  street grade mutes provider output toward the house palette.
- Old tripoAssets row is unreferenced after remodel — future
  `storage-audit`/`deleteMirrored` territory, no action needed now.

## Open decisions

- Grade aggressiveness: warm multiply only vs shader desaturation
  (start with both at low strength, eyeball via stand-shots)
- ~~Remodel allowed at all?~~ DECIDED: paid renovation, deed preserved
- `ROW_MOD_TOKEN` shared-secret mutation acceptable as admin surface?
  (shipped — set the env var when the mutation should go live;
  set it on prod too if traffic ever migrates to descriptive-ram-190)
