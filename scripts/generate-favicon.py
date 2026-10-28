"""Makes the website icons from the University emblem (public/assets/logo-emblem.jpeg).

Run once after the emblem changes:  python scripts/generate-favicon.py
Writes app/favicon.ico, app/icon.png, app/apple-icon.png and public/icon-192.png, public/icon-512.png.
The emblem is cut out as a circle (no square white corners) and made square, so it is not stretched.
"""

import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
source = Image.open(os.path.join(ROOT, "public", "assets", "logo-emblem.jpeg")).convert("RGB")

# The circle of the emblem: the part that is not the near-white page.
pixels = np.array(source).astype(int)
ys, xs = np.where(np.abs(pixels - 255).sum(axis=2) > 60)
left, right, top, bottom = xs.min(), xs.max(), ys.min(), ys.max()
side = max(right - left, bottom - top) + 1
cx, cy = (left + right) / 2, (top + bottom) / 2
box = (round(cx - side / 2), round(cy - side / 2), round(cx + side / 2) + 1, round(cy + side / 2) + 1)
square = source.crop(box)


def circle(size: int, background=None) -> Image.Image:
    big = square.resize((size * 4, size * 4), Image.LANCZOS)
    mask = Image.new("L", big.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big.size[0] - 1, big.size[1] - 1), fill=255)
    out = Image.new("RGBA", big.size, background or (0, 0, 0, 0))
    out.paste(big, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


app = os.path.join(ROOT, "app")
public = os.path.join(ROOT, "public")
circle(512).save(os.path.join(app, "icon.png"))
circle(192).save(os.path.join(public, "icon-192.png"))
circle(512).save(os.path.join(public, "icon-512.png"))
# The phone home-screen icon is a filled square (the system rounds it): the emblem on white.
badge = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
inner = circle(156)
badge.paste(inner, (12, 12), inner)
badge.convert("RGB").save(os.path.join(app, "apple-icon.png"))
circle(256).save(
    os.path.join(app, "favicon.ico"),
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("icons written")
