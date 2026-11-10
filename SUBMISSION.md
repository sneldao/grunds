# Submission pack — Victoria VR AI Builder Hackathon 2026

**Deadline:** Nov 11, 16:30 CEST · **Requires:** repo + hosted demo + <3 min video + description

## Links

| Field | Value |
|---|---|
| Hosted demo | https://grunds.trustfall.xyz/ |
| Demo (prompt-first entry) | https://grunds.trustfall.xyz/?prompt=a+tiny+late-night+ramen+counter&world=a+rainy+night+market+against+MOON+NOODLE |
| Repo | https://github.com/sneldao/grunds |
| Video | `out/demo/demo.mp4` (70 s — upload or host wherever the form takes it) |

Use the deep link for the "try it" URL: it lands on the first-visit prompt
field, so a judge's first action produces the AI-shaped world.

## Description

### Tagline (~1 line)

Type a stand — it becomes a world. A 3D coffee-district economy where your
words become working places, not just scenery.

### Long form (paste-ready)

Grunds is a live 3D coffee-district sim played in the browser. The first
thing on the title screen is a text field: describe a street stand — "a
tiny late-night ramen counter", "a vinyl listening bar" — and the district
builds it.

Plain language becomes working logic, not just looks:

- **Your words become a working business.** The prompt is expanded into a
  validated character card — name, cuisine, crowd, hours, price tier —
  that the deterministic economy actually consumes: a late-night ramen
  counter literally pulls students after 18:00. The card rides the save
  and the morning brief reports what it pulls.
- **Your words shape the street.** Describe the district itself and a
  second spec sets the week's climate, event-deck leanings, footfall, the
  rival chain's name, and a hinted house origin — saved with the campaign.
- **Generated 3D, vendored honestly.** Franchise stands and street props
  are AI-generated GLBs (Meshy/Tripo pipelines, optimized offline),
  resolved through a Grove mirror with procedural fallback — play never
  blocks on a generator.
- **Provenance on screen.** AI-shaped cards credit the model that wrote
  them in the morning brief, and the research desk's footer names the
  pipes that fed it: Linkup + Firecrawl crawled the commodity news, an
  LLM read the tape, Convex served it.
- **A real economy underneath.** Deterministic seeded sim — five-day
  campaigns, commodity events driven by live crawled news, cohort patrons,
  a rival across the road, and a saved async rival pacing you from another
  player's week.

Everything degrades gracefully: every AI path falls back to a seeded
classifier, so offline play and every replay stay bit-identical.

### Built with

Convex (schema, actions, HTTP routes, crons, apiCache, static hosting) ·
OpenAI-compatible chat for spec expansion (gpt-4o-mini + fallback
provider) · Nebius Llama-3.3-70B (letters) · SandBase minimax (city
packs) · Linkup + Firecrawl (wire research) · Mint + Meshy + Polyfork
(generated GLBs) · Grove (asset mirror) · Three.js (custom toon diorama,
no engine) · Playwright + ffmpeg (demo capture)

## Pre-submit checklist

- [ ] **Deploy first** — `npm run deploy:site` from a clean `~/grunds-deploy`
      worktree (not /tmp — AGENTS.md). The prompt-intro, lite link,
      attribution, and seed-99 showcase stands are not live until this runs.
- [ ] Smoke the demo URL post-deploy — prompt-intro shows on first visit,
      sign, brief opens, floor runs (one pass on a real browser, not just
      headless).
- [ ] Video: `out/demo/demo.mp4` — 70 s, 1280×720. Under the 3 min cap.
      Known gap: no wire-desk segment (intel 404'd in that take).
- [ ] `npm run test:fast` green on the deployed commit.
- [ ] Repo public + README points at the live demo.

## For the record

- Subtitle/controls: no install, desktop + phone, keyboard or touch.
- `?lite=1` exists for slow devices (licence footer link offers it).
- Determinism guarantee for judges who replay: same seed + same choices →
  same week; AI paths only write character, never sim draws.
