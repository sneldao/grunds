# ART.md — Grunds art direction lock

*Adopted Sept 28 (Phase 0, depth rebuild). Every visual addition conforms to
this page or is rejected. If the game ever looks inconsistent, this page is
wrong — fix the page, then fix the game.*

## Target look

**Storybook low-poly miniature.** A brass-and-cream model village that
happens to sell coffee. Warm, tactile, slightly toy-like — never gritty,
never neon, never photoreal. When in doubt, ask: "would this fit in a shop
window diorama?" If no, cut it.

## Palette (exact tokens — no improvising)

From `:root` in `web/index.html`, the single source of truth:

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#171310` | Text, outlines, night, camera bodies |
| `--paper` | `#efe6d3` | Modal paper, mugs, daylight surfaces |
| `--cream` | `#f6efe0` | Card stock, highlights, elder clothing |
| `--brass` | `#c9a227` | Rules, corners, stamps-accents, attention |
| `--matcha` | `#86a860` | Selection, growth, student clothing, life |
| `--neg` | `#d0603b` | Warnings, waste, loss, the red stamp |
| `--teal` | `#7fb3b0` | Tourists, water, cool contrast |

3D extensions (same family, no new hues): honey-oak floor, walnut `#4a3423`
props, dark-grey `#2a2c34` hardware. New colors need an amendment here, not
a hex in a commit.

## Typography

- **Serif** (Iowan Old Style / Palatino / Georgia): names, letters, headlines,
  anything a person *says*. People speak in serif.
- **Mono** (SF Mono / Menlo): numbers, prices, receipts, the till. Money
  speaks in mono. tabular-nums on the till, always.
- Never more than these two voices on screen at once.

## UI idiom — paper, brass, stamp

Modals are paper objects on a dark street: cream stock, double brass rule on
top (the `tcard` pattern), generous padding. Achievements and ownership are
*stamped*, not badged: rotated rubber stamps (the share-card `GRUNDS · SEED N`
in `--neg`), SOLD signs, lease notices. A stamp means "history happened
here." Keep inventing stamps, never badges.

## Character language

- **Silhouette first.** Cohorts read at distance by outline + prop + gait
  before any detail: commuter's briefcase stride, elder's cane shuffle,
  tourist's raised camera. If two cohorts share a silhouette, the design
  failed before shading started.
- **Faces are flat and few.** Portraits (`portrait.js`) are flat vector-ish
  Gracie-style avatars: skin, hair, one accessory, cohort clothing. No
  gradients on faces, no realism creep. Mood reads through mouth + eyes
  only (warm / flat / sour) — the floor shows opinion, not psychology.
- **Cohort palettes** (clothing + secondary props stay inside these):
  commuters walnut + grey · creatives ink + teal · students matcha + brass ·
  elders cream + walnut · tourists teal + brass · Sam chalk-white on ink
  (he is the photographic negative of the street).

## Light

Warm pendants and window-glow against blue-hour streets; the vitality spine
dims and brightens but never re-hues. God rays + dust motes for air, bloom +
vignette in post (never in materials). Night is ink, not black — `#171310`
holds the street so brass can glow against it.

## Motion feel (locked now, built in Phase 5)

Soft ease everywhere, sine over linear, squash over snap. Nothing moves at
constant velocity except the till drawer (machines are allowed one linear
privilege). Signature verbs beat new geometry: a camera flash says more than
a better camera model. See "Character language" — motion carries identity.

## Conformance

- New UI screenshots against the palette table before merge. A hex not on
  this page is a bug.
- Portraits are deterministic (same seed → same face, test-enforced). A
  face is forever; never re-roll a living patron.
- Amendments go through this file with a dated note, never silently.
