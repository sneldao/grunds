---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Real-world information leaks into a simulated coffee district — every sponsor does real work."
destination: youtube
aspect: 1920x1080
language: en
audience: "Convex All Gas hackathon judges (Convex, OpenAI, Firecrawl, AgentMail staff)"
length: 150s
angle: show-it — captured gameplay drives; designed cards frame each beat
---

## Intent

The <3-minute submission video for Grunds — The District, a playable 3D
coffee-district economy game. Judges' own guidance: "talk less, click
through the real product." So real gameplay capture is the footage; designed
title cards and captions frame each beat. Show + light story.

## Spine (confirmed)

Full sponsor loop — every sponsor visibly doing work:

1. Pitch licence — name/stand/role/background signing (player agency)
2. Dawn Morning Brief — merged wire (Linkup + Firecrawl sources, origin tags), OpenAI "why this matters" line, sparkline
3. Sized hedge decision — light/standard/heavy contract
4. The day plays — patrons, incidents, Ruth the barista
5. The letter by post — AgentMail: letter mailed to a real inbox, reply "contract" mutates the campaign, Idris acks back
6. District board + cost-sheet receipt — the consequences

## Assets

- https://striped-anaconda-746.convex.site — the live game; capture brand + title shot
- Gameplay screen recordings — produced by scripted Playwright runs against the live site (see Notes)

## Customizations

- Captions carry the narration for v1; the user will provide an ElevenLabs key later for a TTS pass — keep caption timings narration-ready.
- Music bed underneath (mood: warm café-jazz / lo-fi).

## Notes

- The game is deterministic-seeded and has skip params (?skipTutorial, ?skipLicence, ?skipBrief) — scripted runs can land on exact beats.
- Live backend: merged /ai/research wire, /agentmail/letter send path, Svix webhook — captures should show REAL data, not mockups.
- Convex is the backend; the four sponsor beats (Firecrawl crawl → OpenAI explain → Convex serve → AgentMail post) must each be visible.
