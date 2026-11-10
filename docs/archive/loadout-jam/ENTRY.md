# Entry — Loadout AI Game Competition

**Deadline:** 2026-11-07 ~15:00 UTC · **Prize pool:** $5,000 (1st $2,500 / 2nd $1,500 / 3rd $1,000)
**Rules:** AI must have contributed to development. Post a public X clip with
15+ s of actual game footage tagging `@loadoutprotocol`, then submit the post
link + details at https://app.loadout.xyz/jam. One entry per person.

## Deliverables

- **Clip:** `dist/grunds-loadout.mp4` — 40.2 s · 1920×1080 · h264 + aac · 31 MB
  (X limit: 140 s / 512 MB). All real gameplay captured 2026-11-06 against the
  live deployed build `be38f53`, minus the two rendered cards (title is the
  game's own title screen; closing CTA is a PIL card in the game's type).
- **Live game:** https://grunds.trustfall.xyz (deployed `be38f53` — street
  theatre, walking Polyfork humanoids, rooftop dressing, perf passes all live)

## X post — paste ready

> A street that lives whether you watch or not.
>
> Grunds — a 3D coffee-district economy sim. AI patrons remember you, word of
> mouth is the economy, and typing any city rebuilds the street around it.
>
> Playable free, no install → grunds.trustfall.xyz
>
> Built with AI. @loadoutprotocol

(Attach `dist/grunds-loadout.mp4`. First line is the hook — don't bury it.)

## Form answers (adapt to the actual fields)

- **Game:** Grunds — The District
- **Play link:** https://grunds.trustfall.xyz (also try `?city=tokyo`,
  `?city=lisbon` — LLM-minted streets)
- **X post link:** (fill after posting)
- **One-liner:** A live 3D coffee-district economy game where AI patrons with
  persistent memory decide where to buy and word-of-mouth is the economy.
- **Description:** You run a café stand on a seeded street that lives without
  you — commuters, regulars, a rival across the road. A deterministic
  commodity market anchored on real-world data drives bean prices; persistent
  AI patrons carry opinion across days into reputation, footfall and tips.
  Type any city and an LLM mints the locality pack — currency, real cafés,
  local cast, palette — while the street rebuilds deterministically around it.
  Five-day campaign, playable free in the browser.
- **How AI was used:** Both to build it and to run it. The entire codebase,
  530-test suite, art pipeline and the submitted clip were produced with AI
  coding agents (the sim core is deliberately LLM-free so every seed replays
  bit-identically). At runtime: MiniMax M3.1 mints city locality packs,
  Llama-3.3-70B writes the Roaster's Letter, an OpenAI model writes the wire's
  analysis lines, and Mint/Tripo generate the district's 3D kits. Evidence:
  hackathon.md build log in the repo.

## Clip cut list (for a v2, if wanted)

| # | Shot | Source take | Window |
|---|------|-------------|--------|
| 1 | Title screen (real) | t4-brief | 19.5–22.5 |
| 2 | Dawn pavement crowd (busker window) | t2-theatre | 16–22.5 |
| 3 | 06:33 commute + ask card | t1-street | 19–25 |
| 4 | Morning Brief modal | t4-brief | 26–31 |
| 5 | 12:38 interior pre-rush | t3-rush | 57–63 |
| 6 | Tokyo street (¥ pack landed) | t5-city | 25.5–30.8 |
| 7 | Evening ledger modal | t6-dusk | 50–53.5 |
| 8 | CTA card | card-cta.png | 5 s |

Pipeline: `capture/record.mjs` (Playwright, drives `__grunds` rig/theatre/
skipToRush against the live site) → `assemble.sh` (trim, caption PNG overlays
from `../city-remix/render_text.py`, concat, bed mix from
`../city-remix/capture/audio/bed.wav`).
