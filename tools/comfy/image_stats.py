"""Numeric image sanity check (this model cannot view images).

Run with the portable interpreter (it has Pillow + numpy):
  python_embeded\\python.exe -s tools\\comfy\\image_stats.py <file|dir> [...]
Prints size, brightness stats and the fraction of near-black / near-white pixels,
which is how we detect the "black image" failure mode of fast attention backends.
"""
import os
import sys

import numpy as np
from PIL import Image


def paths_of(arg):
    if os.path.isdir(arg):
        out = []
        for root, _, files in os.walk(arg):
            for f in sorted(files):
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    out.append(os.path.join(root, f))
        return out
    return [arg]


def stats(p):
    im = Image.open(p).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    lum = a.mean(axis=2)
    total = lum.size
    near_black = float((lum < 8).sum()) / total
    near_white = float((lum > 247).sum()) / total
    rgb = a.reshape(-1, 3)
    chroma = (rgb.max(axis=1) - rgb.min(axis=1)).mean()
    print("%-46s %5dx%-5d mean %6.1f std %5.1f min %3.0f max %3.0f "
          "black%% %5.1f white%% %5.1f chroma %5.1f unique %5d"
          % (os.path.basename(p), im.width, im.height, lum.mean(), lum.std(),
             lum.min(), lum.max(), near_black * 100, near_white * 100, chroma,
             min(len(np.unique(rgb[::37], axis=0)), 99999)))
    return lum.mean(), lum.std()


args = sys.argv[1:] or ['.']
mean_sum = 0.0
n = 0
for arg in args:
    for p in paths_of(arg):
        try:
            m, s = stats(p)
            mean_sum += m
            n += 1
        except Exception as e:
            print("%-46s FAIL %s: %s" % (os.path.basename(p), type(e).__name__, e))
print("---")
if n:
    print("files %d, overall mean brightness %.1f" % (n, mean_sum / n))
    print("VERDICT", "OK (has real image content)" if mean_sum / n > 20 else "SUSPECT BLACK / EMPTY")
