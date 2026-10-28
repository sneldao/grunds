# Entry — SandBase AI City Remix

**Title:** Dear Newcomer: A Letter from Lisbon
**Film:** `dist/final.mp4` — 90 s · 1920×1080 · English · subtitles only (no voiceover)
**The thing the film sells:** https://grunds.trustfall.xyz/?city=lisbon

## Description

Grunds is a 3D coffee-district economy game: you run a café stand, AI patrons
decide where to buy, and word-of-mouth carries your reputation down the street.
For the AI City Remix we gave the street a name — **any name**.

Type a city into the licence (or open `grunds.trustfall.xyz/?city=<yourcity>`)
and the game builds you that city's street: MiniMax M3.1 Flash, called through
the SandBase gateway, mints a **locality pack** — the district name, the local
currency, a local matcha price, five real independent cafés nearby, a landmark,
a palette, and a cast of local regulars — while the city's name seeds the
whole week deterministically. The road decal reads LISBON, the ticker names
Príncipe Real, the till counts in euros, the rival barista is João, and the
street furniture grows in the city's own style. Every city typed joins a
public **lit map** — the film's last shot is an invitation, and the link on
screen is live.

The film itself is a letter: Lisbon writes, warm and a little wry, to a
newcomer opening a stand — every shot a real capture of the real tool, and
the direction, the shot list, and the timing all authored by M3.1 through
SandBase (prompts and responses archived in `videos/city-remix/direction/`).

## Accuracy notes

- The on-screen price is quoted as **"about €4"** — the pack's minted figure,
  inside the real Lisbon band (≈ €3–5 for a matcha latte). No fixed price is
  claimed anywhere.
- Príncipe Real is a real Lisbon district; the film carries it only as the
  ticker's district label — never as a map claim.
- The five cafés named by the pack (Nicolau Lisboa, Hello, Kristof, Seagull
  Method, Dear Breakfast, Fábrica Coffee Roasters) are real independent
  Lisbon cafés; the licence may show the pack's list, the film's subtitles
  never narrate them, and no partnership or address is claimed.
- João and the patron names are characters the tool minted for this city —
  game facts, not real people.

## Workflow (AI)

- **Direction** — shot list, letter, subtitles, timing: MiniMax M3.1 Flash
  via the SandBase gateway; the edit was returned for editor notes
  (scorecard-driven) and re-cut by the model (see `direction/`).
- **Locality content** — the pack is a live M3.1 call served at
  `GET /city/pack?city=…` (cached server-side, budget-guarded).
- **Everything else is real gameplay** — the street, the patrons, the brief,
  the till, and the share card are captures of the deterministic `?city=`
  street anyone can open.
- **Music** — synthesized in-repo (`music/make-bed.mjs`, seeded, no samples):
  the bed has a generator, not a license.

## Sources

1. Portuguese pavement (calçada portuguesa) — https://en.wikipedia.org/wiki/Portuguese_pavement
2. Príncipe Real, Lisbon — neighbourhood of the city centre (Bairro Alto / São Bento area)
3. Hello, Kristof — https://hellokristof.com/
4. Dear Breakfast — https://dearbreakfast.com/
5. Seagull Method — https://www.instagram.com/seagullmethodcafe/
6. Nicolau Lisboa — https://www.tripadvisor.com/Restaurant_Review-g189158-d10920507-Reviews-Nicolau_Cafe-Lisbon_Lisbon_District_Central_Portugal.html
7. Lisbon matcha price band — https://www.yelp.com/search?find_desc=Matcha+Latte&find_loc=Lisbon
