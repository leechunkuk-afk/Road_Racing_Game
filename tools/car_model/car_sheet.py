# -*- coding: utf-8 -*-
# ============================================================================
#  car_sheet.py - car_render.py 가 만든 프레임을 검토 시트로 합친다.
#
#  실행:  powershell -NoProfile -File tools/car_model/run_blender.ps1 tools/car_model/car_sheet.py car_sheet
#
#  출력:
#    docs/refs/car_sheet.png      기본 색 yaw 16프레임 접시(칸 순서 0..180)
#    docs/refs/car_palettes.png   색 3종 비교(행 = 색, 열 = yaw 0/20/45/90)
#
#  각 칸의 노란 수평선 = 타이어 접지선(anchor_y), 흰 수직선 = 차 중심(anchor_x).
# ============================================================================
import json
import os

import bpy
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MANIFEST = os.path.join(ROOT, 'assets', 'car', 'car_frames.json')
OUT_SHEET = os.path.join(ROOT, 'docs', 'refs', 'car_sheet.png')
OUT_PAL = os.path.join(ROOT, 'docs', 'refs', 'car_palettes.png')

CELL_DIV = 2            # 원본 384 -> 칸 192
PAD = 16
BG = np.array([13.0, 20.0, 33.0], dtype=np.float32) / 255.0
ANCHOR_COL = np.array([1.0, 0.82, 0.25], dtype=np.float32)
CENTER_COL = np.array([0.55, 0.62, 0.75], dtype=np.float32)
PAL_YAWS = [0, 20, 45, 90]


def frame_dir(pal_dir):
    return os.path.join(ROOT, *pal_dir.split('/'))


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


def save_sheet(sheet, out):
    sh, sw = sheet.shape[0], sheet.shape[1]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im = bpy.data.images.new('sheet', sw, sh, alpha=False)
    rgba = np.dstack([sheet, np.ones((sh, sw), dtype=np.float32)])
    im.pixels.foreach_set(rgba[::-1].ravel())       # Blender 의 픽셀 버퍼는 항상 RGBA
    im.filepath_raw = out
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)
    print('SHEET_OK %s %dx%d' % (out, sw, sh))


def compose(cells, cols, bg=BG):
    ch, cw = cells[0][0].shape[0], cells[0][0].shape[1]
    rows = (len(cells) + cols - 1) // cols
    sheet = np.tile(bg, (PAD + rows * (ch + PAD), PAD + cols * (cw + PAD), 1)).astype(np.float32)
    for idx, (img, _tag) in enumerate(cells):
        r, c = divmod(idx, cols)
        y0 = PAD + r * (ch + PAD)
        x0 = PAD + c * (cw + PAD)
        sheet[y0:y0 + ch, x0:x0 + cw] = img
    return sheet


def main():
    if not os.path.exists(MANIFEST):
        print('NO_MANIFEST ' + MANIFEST)
        return 1
    with open(MANIFEST, 'r', encoding='utf-8') as f:
        man = json.load(f)
    ay = man['anchor']['ground_y']
    ax = man['anchor']['ground_x']

    # 1) 기본 색 yaw 접시 -----------------------------------------------------
    p0 = man['palettes'][0]
    cells = []
    for fr in p0['frames']:
        img = load_rgb(os.path.join(frame_dir(p0['dir']), fr['file']), CELL_DIV)
        cells.append((draw_marks(img, ay, ax, CELL_DIV), 'yaw=%d' % fr['yaw_deg']))
        print('CELL %02d yaw=%3d' % (fr['i'], fr['yaw_deg']))
    save_sheet(compose(cells, 4), OUT_SHEET)

    # 2) 색 3종 비교 ---------------------------------------------------------
    cells = []
    for pal in man['palettes']:
        by_yaw = {f['yaw_deg']: f for f in pal['frames']}
        for y in PAL_YAWS:
            fr = by_yaw.get(y)
            if not fr:
                continue
            img = load_rgb(os.path.join(frame_dir(pal['dir']), fr['file']), CELL_DIV)
            cells.append((draw_marks(img, ay, ax, CELL_DIV), '%s/%d' % (pal['id'], y)))
            print('PALCELL %s yaw=%3d' % (pal['id'], y))
    if cells:
        save_sheet(compose(cells, len(PAL_YAWS)), OUT_PAL)
    print('SHEET_NOTE rows_anchor=%d col_anchor=%d' % (ay, ax))
    return 0


if __name__ == '__main__':
    main()
