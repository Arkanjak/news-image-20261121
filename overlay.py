#!/usr/bin/env python3
"""Build entry.png (960x960) from base.png for news-image-20261121.

Centre-crops base to square, resizes to 960x960, then draws a dark-navy
top band (date / headline / subhead) and a dark-navy bottom band with
six verified 21 Nov 2026 news labels, each fitted to the band width.
"""
from PIL import Image, ImageDraw, ImageFont

SIZE = 960
NAVY = (8, 12, 24)
GOLD = (212, 175, 55)
WHITE = (255, 255, 255)
SOFT = (220, 224, 232)
TOP_H = 200
BOTTOM_H = 300
PAD_X = 36

BOLD_PATHS = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
REG_PATHS = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def load_font(paths, size):
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def fit_font(draw, text, paths, start, max_width, minimum=14):
    """Largest font size (<= start, >= minimum) that fits max_width."""
    size = start
    while size > minimum:
        font = load_font(paths, size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 1
    return load_font(paths, minimum)


def main():
    base = Image.open("base.png").convert("RGB")
    w, h = base.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = base.crop((left, top, left + side, top + side))
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    draw = ImageDraw.Draw(img)

    # --- top band ---
    draw.rectangle([0, 0, SIZE, TOP_H], fill=NAVY)
    draw.rectangle([0, TOP_H - 3, SIZE, TOP_H], fill=GOLD)

    date_font = fit_font(draw, "21 NOVEMBER 2026", BOLD_PATHS, 30, SIZE - 2 * PAD_X)
    draw.text((PAD_X, 22), "21 NOVEMBER 2026", font=date_font, fill=GOLD)

    headline = "RUSSIAN MISSILES LAND IN POLAND"
    head_font = fit_font(draw, headline, BOLD_PATHS, 48, SIZE - 2 * PAD_X)
    draw.text((PAD_X, 62), headline, font=head_font, fill=WHITE)

    subhead = "Tusk calls it a deliberate provocation — NATO chief heads to Warsaw"
    sub_font = fit_font(draw, subhead, REG_PATHS, 24, SIZE - 2 * PAD_X)
    draw.text((PAD_X, 128), subhead, font=sub_font, fill=SOFT)

    # --- bottom band ---
    by = SIZE - BOTTOM_H
    draw.rectangle([0, by, SIZE, SIZE], fill=NAVY)
    draw.rectangle([0, by, SIZE, by + 3], fill=GOLD)

    labels = [
        "SAUDI DEFENCES DOWN 3 HOUTHI MISSILES OVER RIYADH",
        "S&P 500 AND DOW INTO CORRECTION IN AI SELLOFF",
        "IRAN SAYS IT DOWNED US MQ-9 DRONE OVER HORMUZ",
        "TRUMP WEIGHS NEW STRIKES ON IRAN",
        "UK–EU SIGN BIGGEST POST-BREXIT DEALS",
        "COP31 TALKS RUN PAST DEADLINE OVER FOSSIL FUELS",
    ]
    row_h = (BOTTOM_H - 24) // len(labels)
    for i, label in enumerate(labels):
        font = fit_font(draw, label, BOLD_PATHS, 26, SIZE - 2 * PAD_X, minimum=18)
        y = by + 16 + i * row_h
        draw.text((PAD_X, y), label, font=font, fill=WHITE)
        # thin gold tick at the left edge of each row
        draw.rectangle([PAD_X - 16, y + 8, PAD_X - 10, y + 20], fill=GOLD)

    img.save("entry.png", format="PNG", optimize=True)
    print(f"wrote entry.png {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
