# -*- coding: utf-8 -*-
# car_hero_*.png 를 수치로 검증한다(이미지를 못 보는 환경에서의 확인 수단).
# 실행: powershell -NoProfile -File tools/car_model/run_blender.ps1 tools/car_model/car_check.py car_check
import os

import bpy
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
REFS = os.path.join(ROOT, 'docs', 'refs')
FILES = ['car_hero_000.jpg', 'car_hero_020.jpg', 'car_hero_045.jpg', 'car_hero_090.jpg']


def stats(path):
    im = bpy.data.images.load(path)
    w, h = im.size[0], im.size[1]
    buf = np.empty(w * h * 4, dtype=np.float32)   # Blender 픽셀 버퍼는 항상 RGBA
    im.pixels.foreach_get(buf)
    bpy.data.images.remove(im)
    px = buf.reshape((h, w, 4))[:, :, :3]
    lum = px.mean(axis=2)
    r, g, b = px[:, :, 0], px[:, :, 1], px[:, :, 2]
    red = (r > 0.55) & (r - g > 0.30) & (r - b > 0.30)
    white = (r > 0.75) & (g > 0.75) & (b > 0.80)
    dark = lum < 0.05
    ys, xs = np.where(lum > (np.median(lum) + 0.06))
    return {
        'size': '%dx%d' % (w, h),
        'lum_mean': round(float(lum.mean()), 4),
        'lum_max': round(float(lum.max()), 4),
        'bg_lum': round(float(np.median(lum)), 4),
        'red_px': int(red.sum()),
        'white_px': int(white.sum()),
        'ink_frac': round(float(dark.mean() + 0), 4),
        'ink_bbox': '%d..%d x %d..%d' % (xs.min(), xs.max(), ys.min(), ys.max()) if len(xs) else 'none',
        'ink_w_m': round((xs.max() - xs.min()) / 160.0, 3) if len(xs) else 0,
        'ink_h_m': round((ys.max() - ys.min()) / 160.0, 3) if len(ys) else 0,
    }


def main():
    for f in FILES:
        p = os.path.join(REFS, f)
        if not os.path.exists(p):
            print('CHECK_MISSING ' + f)
            continue
        d = stats(p)
        print('CHECK %s ' % f + ' '.join('%s=%s' % kv for kv in d.items()))
    return 0


main()
