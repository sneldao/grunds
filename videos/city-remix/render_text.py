#!/usr/bin/env python3
# render_text.py — the film's text renderer (cards + subtitle strips).
#
# The local ffmpeg build has no drawtext/libass, so the assembler hands this
# script a jobs file of PNGs to draw: full-frame cards on the warm-dark
# ground, and transparent full-frame subtitle strips composited by ffmpeg's
# overlay filter. Type is Iowan Old Style (the game's serif) from
# videos/grunds-demo/fonts/iowan.ttc; the link line is Menlo (money speaks
# in mono — ART.md).
#
#   python3 render_text.py jobs.json
#   jobs.json = [{out, lines: [{text, size, color, font, y}], rule: y|null}]
#   colors: "cream" → #F2E8D5, "brass" → #B08D57; ground #171310 (cards only,
#   when "ground": true), otherwise transparent (subtitles).
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
GROUND = (23, 19, 16)        # ART.md's locked night #171310
CREAM = (242, 232, 213)
BRASS = (176, 141, 87)
STROKE = (23, 19, 16)
HERE = __file__.rsplit("/", 1)[0]
SERIF = f"{HERE}/../grunds-demo/fonts/iowan.ttc"
# Money speaks in mono — Menlo on the Mac, DejaVu Sans Mono elsewhere.
_MONO_CANDIDATES = [
    "/System/Library/Fonts/Menlo.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/dejavu/DejaVuSansMono.ttf",
]
MONO = next((p for p in _MONO_CANDIDATES if Path(p).exists()), SERIF)

_fonts = {}

def font(kind, size):
    key = (kind, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(
            MONO if kind == "mono" else SERIF, size, index=0)
    return _fonts[key]

def main(jobs_path):
    jobs = json.load(open(jobs_path, encoding="utf-8"))
    for job in jobs:
        ground = bool(job.get("ground"))
        img = Image.new("RGB" if ground else "RGBA", (W, H),
                        GROUND if ground else (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for line in job["lines"]:
            f = font(line.get("font", "serif"), line["size"])
            color = CREAM if line["color"] == "cream" else BRASS
            text = line["text"]
            box = d.textbbox((0, 0), text, font=f)
            tw = box[2] - box[0]
            x = line.get("x")
            x = (W - tw) / 2 if x is None else x
            y = line["y"] - box[1]  # box[1] lifts baseline jitter off the y
            d.text((x, y), text, font=f, fill=color,
                   stroke_width=line.get("stroke", 0), stroke_fill=STROKE)
        rule = job.get("rule")
        if rule is not None:
            d.rectangle([(W - 560) / 2, rule, (W + 560) / 2, rule + 2],
                        fill=BRASS)
        img.save(job["out"])
        print(f"rendered {job['out']}")

if __name__ == "__main__":
    main(sys.argv[1])
