#!/usr/bin/env python3
"""Chroma-key a figure rendered on a solid green screen into a transparent PNG.

The figures are grey-white muscle + red-orange highlight + black shorts, so pure
green (#00FF00) is the one colour that never appears on the body. Alpha is
derived from "how green is this pixel"; edge pixels get green spill removed.
Crops to the figure's bbox and caps height.

usage: key-figure.py in.jpg out.png [--max-height 1024]
"""
import sys
import numpy as np
from PIL import Image


def main():
    src, dst = sys.argv[1], sys.argv[2]
    max_h = 1024
    if '--max-height' in sys.argv:
        max_h = int(sys.argv[sys.argv.index('--max-height') + 1])

    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # greenness: how far G exceeds the other channels
    green = g - np.maximum(r, b)
    # green ≥ 0.35 → background, ≤ 0.05 → figure
    alpha = np.clip(1.0 - (green - 0.05) / 0.30, 0.0, 1.0)
    alpha[alpha < 0.05] = 0.0
    # spill suppression on the kept pixels: clamp G to the max of R,B
    g2 = np.minimum(g, np.maximum(r, b) + 0.02)
    rgb = np.dstack([r, g2, b])
    out = np.dstack([rgb, alpha])
    img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), 'RGBA')

    bbox = img.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    if bbox:
        pad = 8
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(img.width, bbox[2] + pad), min(img.height, bbox[3] + pad))
        img = img.crop(bbox)
    if img.height > max_h:
        img = img.resize((round(img.width * max_h / img.height), max_h), Image.LANCZOS)
    img.save(dst, optimize=True)
    print(dst, img.size)


if __name__ == '__main__':
    main()
