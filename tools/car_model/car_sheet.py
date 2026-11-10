# -*- coding: utf-8 -*-
# ============================================================================
#  car_sheet.py - car_render.py 가 만든 프레임들을 한 장의 검토 시트로 합친다.
#
#  실행:  powershell -NoProfile -File tools/car_model/run_blender.ps1 tools/car_model/car_sheet.py car_sheet
#
#  출력: docs/refs/car_sheet.png
#  칸 배치: 왼쪽→오른쪽, 위→아래 순서로 car_frames.json 의 YAWS 순서(0..180).
#  각 칸의 노란 수평선 = 타이어 접지선(anchor), 흰 수직선 = 차 중심(anchor_x).
# ============================================================================
import json
import os

import bpy
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FRAMES_DIR = os.path.join(ROOT, 'assets', 'car', 'frames')
MANIFEST = os.path.join(ROOT, 'assets', 'car', 'car_frames.json')
OUT = os.path.join(ROOT, 'docs', 'refs', 'car_sheet.png')

CELL_DIV = 2            # 원본 384 -> 칸 192
PAD = 16
BG = np.array([13.0, 20.0, 33.0], dtype=np.float32) / 255.0
ANCHOR_COL = np.array([1.0, 0.82, 0.25], dtype=np.float32)
CENTER_COL = np.array([0.55, 0.62, 0.75], dtype=np.float32)


def load_rgb(path, div):
    im = bpy.data.images.load(path)
    w, h = im.size[0], im.size[1]
    buf = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(buf)
    bpy.data.images.remove(im)
    px = buf.reshape((h, w, 4))
    px = px[::-1]                                   # Blender 는 아래→위 순서
    a = px[:, :, 3:4]
    rgb = px[:, :, :3] * a + BG * (1.0 - a)         # 어두운 배경에 합성
    d = div
    rgb = rgb[:h // d * d, :w // d * d]
    return rgb.reshape(h // d, d, w // d, d, 3).mean(axis=(1, 3))


def draw_marks(cell, anchor_y, anchor_x, div):
    ay, ax = int(round(anchor_y / div)), int(round(anchor_x / div))
    h, w = cell.shape[0], cell.shape[1]
    if 0 <= ay < h:
        cell[ay - 1:ay + 2, :] = ANCHOR_COL
    if 0 <= ax < w:
        cell[:, ax - 1:ax + 2] = CENTER_COL
    return cell


def main():
    if not os.path.exists(MANIFEST):
        print('NO_MANIFEST ' + MANIFEST)
        return 1
    with open(MANIFEST, 'r', encoding='utf-8') as f:
        man = json.load(f)
    frames = man['frames']
    ay = man['anchor']['ground_y']
    ax = man['anchor']['ground_x']

    cols = 4
    rows = (len(frames) + cols - 1) // cols
    cell = load_rgb(os.path.join(FRAMES_DIR, frames[0]['file']), CELL_DIV)
    ch, cw = cell.shape[0], cell.shape[1]
    sheet_h = PAD + rows * (ch + PAD)
    sheet_w = PAD + cols * (cw + PAD)
    sheet = np.tile(BG, (sheet_h, sheet_w, 1)).astype(np.float32)

    for idx, fr in enumerate(frames):
        img = load_rgb(os.path.join(FRAMES_DIR, fr['file']), CELL_DIV)
        r, c = divmod(idx, cols)
        y0 = PAD + r * (ch + PAD)
        x0 = PAD + c * (cw + PAD)
        tile = draw_marks(img, ay, ax, CELL_DIV)
        sheet[y0:y0 + ch, x0:x0 + cw] = tile
        print('CELL %02d yaw=%3d at=(%d,%d)' % (fr['i'], fr['yaw_deg'], y0, x0))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im = bpy.data.images.new('car_sheet', sheet_w, sheet_h, alpha=False)
    rgba = np.dstack([sheet, np.ones((sheet_h, sheet_w), dtype=np.float32)])
    im.pixels.foreach_set(rgba[::-1].ravel())      # Blender 의 픽셀 버퍼는 항상 RGBA
    im.filepath_raw = OUT
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)
    print('SHEET_OK %s %dx%d' % (OUT, sheet_w, sheet_h))
    print('SHEET_NOTE rows=%d cols=%d anchor_row=%d anchor_col=%d' % (rows, cols, ay, ax))
    return 0


if __name__ == '__main__':
    main()
