"""Draw the pokerlingo icons into public/.

Run with:  /home/hermes/venvs/docs/bin/python scripts/make_icons.py

The 9 by 9 pixel spade, white, on a dark green rounded square, with a hard shadow one
pixel below it. The spade is the same drawing as src/app/suits.ts, so change both together.
Each icon scales the spade by a whole number, so its pixels stay square and crisp.

The Home Screen icon (apple-touch-icon) and the maskable icon fill the whole square,
because iOS and Android round the corners themselves. The maskable icon keeps the spade
inside the central safe circle.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

GREEN = (27, 58, 51)
SHADOW = (13, 30, 26)
WHITE = (255, 255, 255)

SPADE = [
    "....#....",
    "...###...",
    "..#####..",
    ".#######.",
    "#########",
    "#########",
    ".##.#.##.",
    "....#....",
    "...###...",
]

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public"


def draw_spade(img: Image.Image, scale: int) -> None:
    """Centre the spade, with its shadow one drawing pixel lower."""
    size = img.size[0]
    left = (size - 9 * scale) // 2
    top = (size - 9 * scale) // 2 - scale // 2  # lifted by half a pixel to make room for the shadow
    draw = ImageDraw.Draw(img)
    for colour, dy in ((SHADOW, scale), (WHITE, 0)):
        for y, row in enumerate(SPADE):
            for x, ch in enumerate(row):
                if ch == "#":
                    x0 = left + x * scale
                    y0 = top + y * scale + dy
                    draw.rectangle((x0, y0, x0 + scale - 1, y0 + scale - 1), fill=colour)


def make(size: int, scale: int, rounded: bool) -> Image.Image:
    if rounded:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(img).rounded_rectangle((0, 0, size - 1, size - 1), radius=size * 22 // 100, fill=GREEN)
    else:
        img = Image.new("RGBA", (size, size), GREEN)
    draw_spade(img, scale)
    return img


def main() -> None:
    OUT.mkdir(exist_ok=True)
    make(192, 12, rounded=True).save(OUT / "icon-192.png")
    make(512, 32, rounded=True).save(OUT / "icon-512.png")
    make(180, 11, rounded=False).save(OUT / "apple-touch-icon.png")
    make(64, 4, rounded=True).save(OUT / "favicon.png")
    # Spade about 42 percent of the icon, well inside the 60 percent safe circle.
    make(512, 24, rounded=False).save(OUT / "icon-512-maskable.png")
    print(f"Icons written to {OUT}")


if __name__ == "__main__":
    main()
