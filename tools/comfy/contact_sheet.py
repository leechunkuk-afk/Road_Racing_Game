"""Builds a review contact sheet from the generated character refs (PIL + numpy are in python_embeded).

  python_embeded\\python.exe -s tools\\comfy\\contact_sheet.py
Rows = sage / sdpa, columns = front / side / back. Output: docs/refs/character_sheet.png
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
REF = os.path.normpath(os.path.join(ROOT, '..', '..', 'docs', 'refs'))
CELL_W, CELL_H = 416, 608
LABEL_H = 26

VIEWS = ['front', 'side', 'back']
ROWS = [('sage --use-sage-attention', 'character_sage_%s_00001.png'),
        ('sdpa baseline (no flag)', 'character_sdpa_%s_00001.png')]

cells = []
missing = []
for label, pat in ROWS:
    row = []
    for v in VIEWS:
        p = os.path.join(REF, 'character', pat % v)
        if not os.path.exists(p):
            missing.append(p)
            continue
        im = Image.open(p).convert('RGB').resize((CELL_W, CELL_H), Image.LANCZOS)
        row.append((label + ' / ' + v, im))
    cells.append(row)

if missing:
    print('missing:', ', '.join(missing))

w = CELL_W * max(len(r) for r in cells)
h = (CELL_H + LABEL_H) * len(cells)
sheet = Image.new('RGB', (w, h), (24, 24, 24))
d = ImageDraw.Draw(sheet)
for ri, row in enumerate(cells):
    y = ri * (CELL_H + LABEL_H)
    for ci, (label, im) in enumerate(row):
        sheet.paste(im, (ci * CELL_W, y + LABEL_H))
        d.text((ci * CELL_W + 6, y + 7), label, fill=(240, 240, 240))
out = os.path.join(REF, 'character_sheet.png')
sheet.save(out, optimize=True)
print('saved', out, sheet.size, str(os.path.getsize(out)) + 'B')
