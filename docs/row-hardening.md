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
- [ ] Prompt/byline blocklist in `sanitizeFranchisePrompt`/`sanitizeByline`;
      image URLs: `https:` only, no userinfo
- Deferred: `franchiseReports` table (no auto-hide — griefing surface)

### 3. Immutability — no renovation path

Failed generations already re-describe; *successful* stands are locked
("first-come authorship" — deliberate). No auth → builder identity can't
be verified; gates are economic, not identity.

**Plan — `franchise.remodel`:**
- [ ] `describe` accepts `remodel: true` — allowed on `success` lots only;
      same pipeline, new key, patches the franchises row, **original
      byline preserved** ("built by X, renovated day N")
- [ ] Old tripoAssets row becomes unreferenced → `storage-audit --delete`
      reclaims (plumbing already exists)
- [ ] In-game cost (till money, client-enforced) + `remodelCount` cap
- **DECISION:** does first-come permanence stay absolute, or does paid
  renovation dilute it?

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
- **Phase 2** (next): prompt/URL hygiene; remodel verb + cost semantics
- **Phase 3** (only if measured): offline texture bake; deferred
  stand-load queue; byte-budget policy

## Open decisions

- Grade aggressiveness: warm multiply only vs shader desaturation
  (start with both at low strength, eyeball via stand-shots)
- Remodel allowed at all? (permanence vs iteration)
- `ROW_MOD_TOKEN` shared-secret mutation acceptable as admin surface?
