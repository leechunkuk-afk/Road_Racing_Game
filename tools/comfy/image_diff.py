"""Pairwise pixel difference between two renders (same seed, different attention backend).

  python_embeded\\python.exe -s tools\\comfy\\image_diff.py <a.png> <b.png>
Both must be the same size; prints mean/max absolute difference and a verdict.
"""
import sys

import numpy as np
from PIL import Image

a_path, b_path = sys.argv[1], sys.argv[2]
ia = Image.open(a_path).convert('RGB')
ib = Image.open(b_path).convert('RGB')
if ia.size != ib.size:
    ib = ib.resize(ia.size)
    print('(resized second image to match)')

a = np.asarray(ia).astype(np.int16)
b = np.asarray(ib).astype(np.int16)
d = np.abs(a - b)
print(a_path.split('\\')[-1], 'vs', b_path.split('\\')[-1], ia.size)
print("mean abs diff %.2f / 255   max %d   pixels over 16: %.1f%%   over 48: %.1f%%"
      % (d.mean(), d.max(), (d.max(axis=2) > 16).mean() * 100, (d.max(axis=2) > 48).mean() * 100))
print("brightness  A %.1f  B %.1f" % (a.mean(), b.mean()))
same = d.mean() < 2.0
print("VERDICT", "identical within quantisation noise" if same else "visibly different (check both by eye)")
