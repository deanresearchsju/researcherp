"""Placeholder brand marks for the Research ERP preview.

Replace public/assets/logo-full.jpeg and public/assets/logo-emblem.jpeg
with the official university artwork when it is available.
"""

from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "public", "assets")
APP = os.path.join(ROOT, "app")

PURPLE = (91, 42, 134)
PURPLE_DEEP = (61, 26, 92)
GOLD = (242, 194, 48)
MAROON = (139, 30, 63)
WHITE = (255, 255, 255)
INK = (28, 23, 48)

GEORGIA = r"C:\Windows\Fonts\georgia.ttf"
GEORGIA_BOLD = r"C:\Windows\Fonts\georgiab.ttf"
SEGOE = r"C:\Windows\Fonts\segoeui.ttf"
SEGOE_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def draw_emblem(size: int, background: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", (size, size), background)
    draw = ImageDraw.Draw(image)
    cx = cy = size // 2
    outer = int(size * 0.46)
    draw.ellipse((cx - outer, cy - outer, cx + outer, cy + outer), fill=GOLD)
    inner = int(size * 0.415)
    draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=PURPLE)
    ring = int(size * 0.34)
    width = max(3, size // 90)
    draw.ellipse(
        (cx - ring, cy - ring, cx + ring, cy + ring),
        outline=GOLD,
        width=width,
    )

    arm = max(4, size // 48)
    length = int(size * 0.055)
    cross_y = cy - int(size * 0.2)
    draw.rectangle(
        (cx - arm // 2, cross_y - length, cx + arm // 2, cross_y + length),
        fill=GOLD,
    )
    draw.rectangle(
        (cx - length, cross_y - arm // 2, cx + length, cross_y + arm // 2),
        fill=GOLD,
    )

    monogram = font(GEORGIA_BOLD, int(size * 0.2))
    draw.text((cx, cy + int(size * 0.01)), "SJU", font=monogram, fill=GOLD, anchor="mm")

    line_w = int(size * 0.16)
    line_y = cy + int(size * 0.12)
    draw.line((cx - line_w, line_y, cx + line_w, line_y), fill=GOLD, width=max(2, size // 160))

    label = font(SEGOE_BOLD, int(size * 0.045))
    draw.text(
        (cx, cy + int(size * 0.185)),
        "RESEARCH",
        font=label,
        fill=WHITE,
        anchor="mm",
    )
    return image


def draw_wordmark(width: int, height: int) -> Image.Image:
    image = Image.new("RGB", (width, height), WHITE)
    emblem = draw_emblem(height - 36, WHITE)
    image.paste(emblem, (18, 18))
    draw = ImageDraw.Draw(image)
    text_x = height + 24
    draw.line(
        (text_x - 28, 48, text_x - 28, height - 48),
        fill=GOLD,
        width=4,
    )
    draw.text(
        (text_x, 68),
        "ST. JOSEPH UNIVERSITY",
        font=font(SEGOE_BOLD, 22),
        fill=MAROON,
        anchor="lm",
    )
    draw.text(
        (text_x, 132),
        "Research",
        font=font(GEORGIA_BOLD, 64),
        fill=PURPLE,
        anchor="lm",
    )
    draw.text(
        (text_x, 198),
        "Fully Human & Fully Alive",
        font=font(GEORGIA, 22),
        fill=PURPLE_DEEP,
        anchor="lm",
    )
    return image


def draw_og() -> Image.Image:
    image = Image.new("RGB", (1200, 630), PURPLE_DEEP)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1200, 12), fill=GOLD)
    draw.rectangle((0, 618, 1200, 630), fill=GOLD)
    emblem = draw_emblem(280, PURPLE_DEEP)
    image.paste(emblem, (80, 175))
    draw.text(
        (420, 210),
        "ST. JOSEPH UNIVERSITY",
        font=font(SEGOE_BOLD, 28),
        fill=GOLD,
        anchor="lm",
    )
    draw.text(
        (420, 300),
        "Advancing Knowledge.",
        font=font(GEORGIA_BOLD, 54),
        fill=WHITE,
        anchor="lm",
    )
    draw.text(
        (420, 370),
        "Shaping Scholars.",
        font=font(GEORGIA_BOLD, 54),
        fill=WHITE,
        anchor="lm",
    )
    draw.text(
        (420, 460),
        "Office of Research  ·  Ph.D. Programmes",
        font=font(SEGOE, 24),
        fill=(236, 228, 245),
        anchor="lm",
    )
    return image


def main() -> None:
    os.makedirs(ASSETS, exist_ok=True)
    emblem = draw_emblem(640, WHITE)
    emblem.save(os.path.join(ASSETS, "logo-emblem.jpeg"), "JPEG", quality=92, optimize=True)
    wordmark = draw_wordmark(860, 280)
    wordmark.save(os.path.join(ASSETS, "logo-full.jpeg"), "JPEG", quality=92, optimize=True)
    og = draw_og()
    og.save(os.path.join(ASSETS, "og.jpeg"), "JPEG", quality=90, optimize=True)
    icon = emblem.resize((512, 512), Image.Resampling.LANCZOS)
    icon.save(os.path.join(APP, "icon.png"), "PNG")
    apple = emblem.resize((180, 180), Image.Resampling.LANCZOS)
    apple.save(os.path.join(APP, "apple-icon.png"), "PNG")
    print("Wrote brand assets")


if __name__ == "__main__":
    main()
