# -*- coding: utf-8 -*-
"""블렌더 5.2 환경에서 쓸 API/렌더러를 미리 확인하는 프로브 스크립트."""
import math

import bpy

out = []


def has(opname):
    return hasattr(bpy.ops.object, opname)


out.append("blender=" + bpy.app.version_string)
out.append("op.shade_auto_smooth=%s" % has("shade_auto_smooth"))
out.append("op.shade_smooth=%s" % has("shade_smooth"))
out.append("op.modifier_apply=%s" % has("modifier_apply"))
out.append("op.object_join=%s" % has("join"))

me = bpy.data.meshes.new("t")
me.from_pydata([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0), (0.5, 0.5, 1)], [],
               [(0, 1, 2, 3), (0, 4, 1), (1, 4, 2), (2, 4, 3)])
ob = bpy.data.objects.new("t", me)
bpy.context.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob
for a in ob.data.polygons:
    a.use_smooth = True
out.append("has_poly_use_smooth=%s" % hasattr(ob.data.polygons[0], "use_smooth"))

# 캐빈 상/하 소분류에 쓸 transform_each
import bmesh
from mathutils import Matrix, Vector
bm = bmesh.new()
bm.from_mesh(me)
ok = True
try:
    bmesh.ops.transform_each(bm, how=('VERT', 'FACE'),
                             matrix=Matrix.Translation(Vector((0, 0, 0.05))),
                             elements=bm.verts[:])
except Exception as exc:  # noqa: BLE001
    ok = "FAIL " + str(exc)
out.append("bmesh.transform_each=%s" % ok)
bm.to_mesh(me)
bm.free()

# 불리언 EXACT + apply
cub = bpy.data.meshes.new("c")
cub.from_pydata([(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                 (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)], [],
                [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5),
                 (2, 3, 7, 6), (3, 0, 4, 7)])
cut = bpy.data.objects.new("cut", cub)
bpy.context.collection.objects.link(cut)
mod = ob.modifiers.new("bool", 'BOOLEAN')
mod.operation = 'DIFFERENCE'
mod.solver = 'EXACT'
mod.object = cut
bpy.context.view_layer.objects.active = ob
try:
    bpy.context.view_layer.update()
    bpy.ops.object.modifier_apply(modifier=mod.name)
    out.append("bool_apply=OK verts=%d" % len(ob.data.vertices))
except Exception as exc:  # noqa: BLE001
    out.append("bool_apply=FAIL %s" % exc)

# 스무스 바이 앵글
try:
    if has("shade_auto_smooth"):
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
        out.append("shade_auto_smooth=OK mods=%s" % [m.type for m in ob.modifiers])
except Exception as exc:  # noqa: BLE001
    out.append("shade_auto_smooth=FAIL %s" % exc)

# 이미지 crop / scale / 파일출력 API
img = bpy.data.images.new("probe", 32, 16, alpha=True)
try:
    img.crop(0, 0, 4, 4)
    out.append("img_crop=OK %dx%d" % (img.size[0], img.size[1]))
except Exception as exc:  # noqa: BLE001
    out.append("img_crop=FAIL %s" % exc)
try:
    img.scale((8, 4))
    out.append("img_scale=OK %dx%d" % (img.size[0], img.size[1]))
except Exception as exc:  # noqa: BLE001
    out.append("img_scale=FAIL %s" % exc)
try:
    out.append("pixels_len=%d" % len(img.pixels))
except Exception as exc:  # noqa: BLE001
    out.append("pixels=FAIL %s" % exc)

# 렌더 엔진 목록
try:
    out.append("engines=%s" % sorted({i.identifier for i in
                                      bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}))
except Exception as exc:  # noqa: BLE001
    out.append("engines=FAIL %s" % exc)
sc = bpy.context.scene
for eng in ('BLENDER_EEVEE_NEXT', 'CYCLES'):
    try:
        sc.render.engine = eng
        out.append("set_engine_%s=OK" % eng)
    except Exception as exc:  # noqa: BLE001
        out.append("set_engine_%s=FAIL %s" % (eng, exc))
sc.render.engine = 'CYCLES'
sc.render.film_transparent = True
try:
    sc.cycles.device = 'CPU'
    out.append("cycles_samples_max=%s" % sc.cycles.samples)
    pref = bpy.context.preferences.addons.get('cycles')
    if pref:
        cp = pref.preferences
        out.append("cuda_available=%s" % cp.get_device_type('CUDA') is not None)
        try:
            cp.compute_device_type = 'CUDA'
            cp.get_devices()
            out.append("devices=%s" % [(d.name, d.type) for d in cp.devices])
        except Exception as exc:  # noqa: BLE001
            out.append("cuda_devices=FAIL %s" % exc)
except Exception as exc:  # noqa: BLE001
    out.append("cycles=FAIL %s" % exc)

print("PROBE-BEGIN")
for line in out:
    print("PROBE|" + line)
print("PROBE-END")
