"""Draw the pokerlingo icons into public/.

Run with:  /home/hermes/venvs/docs/bin/python scripts/make_icons.py

A white spade on the felt green. The spade glyph comes from DejaVu Sans.
The maskable icon keeps the spade inside the central safe circle, so Android can
crop it to any shape.
"""

from __future__ import annotations

import glob
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FELT = (31, 107, 74)
FELT_DARK = (23, 79, 55)
PAPER = (245, 242, 234)
GOLD = (154, 107, 0)
SPADE = "♠"

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public"


def find_font() -> str:
    for pattern in ("/usr/share/fonts/**/DejaVuSans-Bold.ttf", "/usr/share/fonts/**/DejaVuSans.ttf"):
        matches = sorted(glob.glob(pattern, recursive=True))
        if matches:
            return matches[0]
    sys.exit("DejaVu Sans was not found under /usr/share/fonts")


def background(size: int) -> Image.Image:
    """Felt green with a soft darker edge, like a table."""
    img = Image.new("RGB", (size, size), FELT_DARK)
    glow = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(glow)
    pad = int(size * 0.08)
    draw.ellipse((pad, pad, size - pad, size - pad), fill=255)
    from PIL import ImageFilter

    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.18))
    return Image.composite(Image.new("RGB", (size, size), FELT), img, glow)


def draw_spade(img: Image.Image, fraction: float, font_path: str) -> None:
    """Centre a spade whose glyph box fills `fraction` of the icon."""
    size = img.size[0]
    target = size * fraction
    font_size = int(target)
    font = ImageFont.truetype(font_path, font_size)
    # Fit by measuring the real ink box, then scale the font to match the target.
    left, top, right, bottom = font.getbbox(SPADE)
    ink = max(right - left, bottom - top)
    font = ImageFont.truetype(font_path, max(int(font_size * target / ink), 8))
    left, top, right, bottom = font.getbbox(SPADE)
    x = (size - (right - left)) / 2 - left
    y = (size - (bottom - top)) / 2 - top
    draw = ImageDraw.Draw(img)
    draw.text((x, y), SPADE, font=font, fill=PAPER)


def make(size: int, fraction: float, font_path: str, ring: bool = True) -> Image.Image:
    img = background(size)
    if ring:
        draw = ImageDraw.Draw(img)
        inset = int(size * 0.06)
        width = max(size // 64, 2)
        draw.ellipse((inset, inset, size - inset, size - inset), outline=GOLD, width=width)
    draw_spade(img, fraction, font_path)
    return img


def main() -> None:
    OUT.mkdir(exist_ok=True)
    font_path = find_font()

    # The glyph's ink is about 80 percent of the box measured here, so 0.68 gives a spade
    # roughly 55 percent of the icon tall.
    for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180), ("favicon.png", 64)):
        make(size, 0.68, font_path, ring=size >= 180).save(OUT / name)

    # Maskable: no ring (it would be cropped), spade about 47 percent tall, well inside the
    # 60 percent safe circle.
    make(512, 0.58, font_path, ring=False).save(OUT / "icon-512-maskable.png")
    print(f"Icons written to {OUT}")


if __name__ == "__main__":
    main()
