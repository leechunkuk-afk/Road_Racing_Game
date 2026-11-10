# -*- coding: utf-8 -*-
# ============================================================================
#  car_build.py - 플레이어 차량 메시를 조립해 assets/car/car.blend 로 저장한다.
#
#  실행:  blender.exe -b -P tools/car_model/car_build.py
#
#  좌표계: +X = 전진(차 앞), +Y = 좌측, +Z = 위. 지면 z = 0.
#  치수는 car_geo.py 의 상수 하나만 따른다(게임의 CONFIG.car 와 동일한 실측).
#  지오메트리는 전부 from_pydata 로 만들고, bpy.ops 는 조립/불리언/스무딩에만 쓴다.
# ============================================================================
import json
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_geo as G                                            # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR = os.path.join(ROOT, 'assets', 'car')
BLEND_PATH = os.path.join(OUT_DIR, 'car.blend')
JSON_PATH = os.path.join(OUT_DIR, 'car.json')

N_LOFT = 24              # 로프트 단면 분할(매끄러움을 결정하는 값)
N_WHEEL = 36             # 타이어 원주 분할
ARCH_Y = (0.46, 1.08)    # 휠아치 컷이 지나는 y 구간(차체 바깥면을 관통)
SMOOTH_ANGLE = math.radians(35.0)

# ---------------------------------------------------------------------------
#  재질 정의
#  (이름, base_color, metallic, roughness, emission_color, emission_strength)
#  발광 재질은 렌더에서 가로등에 반응하지 않는 자체 발광(테일/디테일램프) 이 된다.
#  paint 는 car_geo.PALETTES 의 기본 색으로 만든다 (색 3종은 car_render 에서 갈아낀다).
# ---------------------------------------------------------------------------
PAL = {p[0]: p for p in G.PALETTES}
P0 = PAL[G.DEFAULT_PALETTE]

MATS = [
    ('paint',   (P0[3][0], P0[3][1], P0[3][2], 1.0), P0[4], P0[5], None, 0.0),
    ('trim',    (0.020, 0.021, 0.025, 1.0), 0.10, 0.620, None, 0.0),
    ('glass',   (0.008, 0.011, 0.018, 1.0), 0.35, 0.085, None, 0.0),
    ('lampR',   (0.450, 0.020, 0.030, 1.0), 0.00, 0.400, (1.00, 0.035, 0.055, 1.0), 6.0),
    ('lampW',   (0.320, 0.360, 0.430, 1.0), 0.00, 0.350, (0.85, 0.92, 1.00, 1.0), 2.2),
    ('plate',   (0.780, 0.770, 0.720, 1.0), 0.00, 0.550, None, 0.0),
    ('tire',    (0.015, 0.015, 0.017, 1.0), 0.00, 0.860, None, 0.0),
    ('rim',     (0.420, 0.430, 0.450, 1.0), 0.95, 0.215, None, 0.0),
    ('caliper', (0.620, 0.060, 0.045, 1.0), 0.25, 0.330, None, 0.0),
]


def set_in(node, names, value):
    """Principled 입력명은 버전마다 바뀌므로 후보를 순서대로 시도한다.
    색상 소켓은 4개 성분을 요구하므로 3항 색은 alpha 를 붙여 채운다."""
    if isinstance(value, (tuple, list)) and len(value) == 3:
        value = tuple(value) + (1.0,)
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False


def make_material(spec):
    name, col, metal, rough, emis, estr = spec
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    ng = m.node_tree
    ng.nodes.clear()
    out = ng.nodes.new('ShaderNodeOutputMaterial')
    b = ng.nodes.new('ShaderNodeBsdfPrincipled')
    ng.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    set_in(b, ['Base Color'], col)
    set_in(b, ['Metallic'], metal)
    set_in(b, ['Roughness'], rough)
    if emis is not None:
        set_in(b, ['Emission Color', 'Emission'], emis)
        set_in(b, ['Emission Strength'], estr)
    else:
        if name == 'paint':
            # 얇은 코트 = 야간에 가로등이 번져 보이는 이유
            set_in(b, ['Coat Weight'], 0.55)
            set_in(b, ['Coat Roughness'], 0.06)
        if name == 'glass':
            # 투명도는 렌더 알파와 섞으면 건물이 비치므로 짙은 틴트로만 처리한다
            set_in(b, ['IOR'], 1.45)
    return m


# ---------------------------------------------------------------------------
#  오브젝트 헬퍼
# ---------------------------------------------------------------------------
def new_obj(name, verts, faces, mats=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if mats:
        for m in (mats if isinstance(mats, (list, tuple)) else [mats]):
            me.materials.append(m)
    return ob


def link_bool(target, cutter, operation='DIFFERENCE'):
    """EXACT 솔버로 불리언을 적용해 결과 지오메트리를 남긴다."""
    mod = target.modifiers.new('bool', 'BOOLEAN')
    mod.operation = operation
    if hasattr(mod, 'solver'):
        mod.solver = 'EXACT'
    mod.object = cutter
    mod.use_self = False
    if hasattr(mod, 'use_hole_tolerant'):
        mod.use_hole_tolerant = True
    prev = bpy.context.view_layer.objects.active
    bpy.context.view_layer.objects.active = target
    ok = True
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception as e:
        print('BOOL_FAIL %s %r' % (target.name, e))
        ok = False
    bpy.context.view_layer.objects.active = prev or target
    bpy.data.objects.remove(cutter, do_unlink=True)
    return ok


def smooth(obj, angle=SMOOTH_ANGLE):
    """모서리 각도 기준으로만 스무스(35도 초과 모서리는 유지) 처리."""
    prev = bpy.context.view_layer.objects.active
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    done = False
    for op, kw in (('shade_smooth_by_angle', {'angle': angle}),
                   ('shade_auto_smooth', {'angle': angle})):
        if hasattr(bpy.ops.object, op):
            try:
                getattr(bpy.ops.object, op)(**kw)
                done = True
                break
            except Exception as e:
                print('SMOOTH_FAIL %s %r' % (op, e))
    if not done:
        for p in obj.data.polygons:
            p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = prev or obj
    return done


def join(objs, name):
    objs = [o for o in objs if o is not None]
    if not objs:
        return None
    if len(objs) == 1:
        objs[0].name = name
        objs[0].data.name = name
        return objs[0]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    bpy.ops.object.select_all(action='DESELECT')
    objs[0].name = name
    objs[0].data.name = name
    return objs[0]


# ---------------------------------------------------------------------------
#  차체 / 캐빈
# ---------------------------------------------------------------------------
def make_body(mats):
    verts, faces = G.loft(G.BODY_RINGS, N_LOFT)
    ob = new_obj('body', verts, faces)          # 재질은 불리언 뒤에 붙인다(빈 슬롯 방지)
    # 휠아치: 타이어가 들어가는 반원 홈을 좌우로 관통해 만든다
    for (wx, wy) in G.WHEELS:
        y0, y1 = ARCH_Y if wy > 0 else (-ARCH_Y[1], -ARCH_Y[0])
        cv, cf = G.cyl_solid(G.ARCH_R, (y1 - y0) + 0.12, res=N_WHEEL, axis='y',
                             c=(wx, (y0 + y1) * 0.5, G.TIRE_R))
        link_bool(ob, new_obj('arch_cut', cv, cf))
    ob.data.materials.append(mats['paint'])
    return ob


def make_cabin(mats):
    verts, faces = G.loft(G.CABIN_RINGS, N_LOFT)
    ob = new_obj('cabin', verts, faces)
    ob.data.materials.append(mats['paint'])    # slot 0
    ob.data.materials.append(mats['glass'])    # slot 1
    # 면노름의 위쪽 성분만으로 지붕/필러(페인트) 와 유리를 나눈다.
    for p in ob.data.polygons:
        p.material_index = 0 if p.normal.z > 0.42 else 1
    return ob


# ---------------------------------------------------------------------------
#  트림 / 디퓨저 / 배기구
# ---------------------------------------------------------------------------
def make_trim(mats):
    groups = {}
    for (mat, sx, sy, sz, cx, cy, cz, mirror) in G.TRIM:
        for sgn in ([1, -1] if mirror else [1]):
            v, f = G.box_pydata(sx, sy, sz, (cx, cy * sgn, cz))
            groups.setdefault(mat, []).append(new_obj('trim_' + mat, v, f, [mats[mat]]))

    # 디퓨저 세로 핀
    for i in range(G.DIFFUSER_FINS):
        t = (i / (G.DIFFUSER_FINS - 1.0)) - 0.5
        v, f = G.box_pydata(0.17, 0.035, 0.115, (-2.110, t * 1.12, 0.185))
        groups.setdefault('trim', []).append(new_obj('fin', v, f, [mats['trim']]))

    # 배기구(원통 관)
    for (x, y, z) in G.EXHAUST:
        v, f = G.cyl_solid(0.075, 0.115, res=20, axis='x', c=(x, y, z))
        groups.setdefault('rim', []).append(new_obj('exhaust', v, f, [mats['rim']]))
    return groups


# ---------------------------------------------------------------------------
#  바퀴(타이어 + 림 + 허브 + 캘리퍼)
# ---------------------------------------------------------------------------
def make_wheels(mats):
    tires, rims, cals = [], [], []
    for (wx, wy) in G.WHEELS:
        s = 1.0 if wy > 0 else -1.0
        y_out = wy + s * G.TIRE_W * 0.5
        y_in = wy - s * G.TIRE_W * 0.5

        v, f = G.cyl_solid(G.TIRE_R, G.TIRE_W, res=N_WHEEL, axis='y', c=(wx, wy, G.TIRE_R))
        tires.append(new_obj('tire', v, f, [mats['tire']]))

        # 휠 면(바깥으로 10mm 돌출) + 허브캡. 스포크 패턴은 생략한다
        # (게임에서 차 전체가 200px 안쪽으로 그려져 세부 패턴이 보이지 않는다).
        v, f = G.cyl_solid(G.TIRE_R - 0.095, G.TIRE_W - 0.06, res=N_WHEEL, axis='y',
                           c=(wx, wy + s * 0.040, G.TIRE_R))
        rims.append(new_obj('rim_face', v, f, [mats['rim']]))
        v, f = G.cyl_solid(0.058, 0.030, res=18, axis='y',
                           c=(wx, y_out - s * 0.002, G.TIRE_R))
        rims.append(new_obj('hub', v, f, [mats['rim']]))

        v, f = G.box_pydata(0.155, 0.050, 0.215, (wx + 0.02, y_in - s * 0.045, G.TIRE_R + 0.02))
        cals.append(new_obj('caliper', v, f, [mats['caliper']]))
    return tires, rims, cals


def slot_names(ob):
    """재질 슬롯 이름을 순서대로 뽑는다. 빈 슬롯은 '#' 으로 표시한다."""
    return [(m.name if m is not None else '#empty') for m in ob.data.materials]


def fix_slots(ob):
    """빈 재질 슬롯(정확한 불리언/조인이 남긴다)을 없애고 면의 슬롯 번호를 다시 맞춘다."""
    old = list(ob.data.materials)
    if all(m is not None for m in old):
        return
    remap, nxt = {}, 0
    for i, m in enumerate(old):
        if m is not None:
            remap[i] = nxt
            nxt += 1
    default = remap.get(0, 0)
    for p in ob.data.polygons:
        p.material_index = remap.get(p.material_index, default)
    ob.data.materials.clear()
    for m in old:
        if m is not None:
            ob.data.materials.append(m)


def report_materials(mats):
    print('MATS_READY ' + ', '.join('%s(users=%d)' % (k, v.users) for k, v in mats.items()))


# ---------------------------------------------------------------------------
#  조립
# ---------------------------------------------------------------------------
def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.lights,
                   bpy.data.cameras, bpy.data.materials):
        for b in list(blocks):
            if b.users == 0:
                blocks.remove(b)


def build():
    clear_scene()
    mats = {s[0]: make_material(s) for s in MATS}

    body = make_body(mats)
    cabin = make_cabin(mats)
    trim_groups = make_trim(mats)
    tires, rims, cals = make_wheels(mats)

    parts = {}
    parts['body'] = join([body, cabin] + trim_groups.get('paint', []), 'car_body')
    for mat in ('trim', 'lampR', 'lampW', 'plate'):
        if trim_groups.get(mat):
            parts[mat] = join(trim_groups[mat], 'car_' + mat)
    parts['tire'] = join(tires, 'wheel_tire')
    parts['rim'] = join(rims + trim_groups.get('rim', []), 'wheel_rim')
    parts['caliper'] = join(cals, 'wheel_caliper')

    report_materials(mats)
    for key, ob in parts.items():
        if ob is not None:
            fix_slots(ob)
            print('SLOT %-10s -> %s' % (key, ','.join(slot_names(ob))))

    for ob in parts.values():
        if ob is not None:
            smooth(ob)

    # 타이어 최저점이 정확히 z=0 이 되도록 전체를 내린다(지면 앵커 보정)
    bpy.context.view_layer.update()
    zs = [(ob.matrix_world @ v.co).z for ob in parts.values() if ob for v in ob.data.vertices]
    dz = min(zs) if zs else 0.0
    if abs(dz) > 1e-5:
        for ob in parts.values():
            if ob is not None:
                ob.location.z -= dz
        bpy.context.view_layer.update()

    bpy.ops.object.select_all(action='DESELECT')
    print('SCENE_OBJS %d (parts=%d)' % (len(bpy.data.objects), len(parts)))
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    # -------------------------------------------------------------------------
    #  매니페스트: 게임이 실측을 그대로 사용하도록 치수를 숫자로 남긴다
    # -------------------------------------------------------------------------
    objs_info = {}
    allv = []
    for name, ob in parts.items():
        if ob is None:
            continue
        co = [ob.matrix_world @ v.co for v in ob.data.vertices]
        allv += co
        xs, ys, zs2 = [c.x for c in co], [c.y for c in co], [c.z for c in co]
        objs_info[name] = {
            'verts': len(co),
            'mats': slot_names(ob),
            'bbox_min': [round(min(xs), 4), round(min(ys), 4), round(min(zs2), 4)],
            'bbox_max': [round(max(xs), 4), round(max(ys), 4), round(max(zs2), 4)],
        }
    man = {
        'blender': bpy.app.version_string,
        'units': 'meters',
        'axis': '+X 앞, +Y 좌, +Z 위, 지면 z=0',
        'car': {
            'length_m': round(max(c.x for c in allv) - min(c.x for c in allv), 4),
            'width_m': round(max(c.y for c in allv) - min(c.y for c in allv), 4),
            'height_m': round(max(c.z for c in allv) - min(c.z for c in allv), 4),
            'wheelbase_m': round(G.L_FRONT - G.L_REAR, 4),
            'track_m': round(G.TRACK_H * 2, 4),
            'tire_r_m': G.TIRE_R,
            'ground_z': round(min(c.z for c in allv), 4),
            'front_x': round(max(c.x for c in allv), 4),
            'rear_x': round(min(c.x for c in allv), 4),
        },
        'expected': {'lengthM': 4.30, 'widthM': 1.95, 'heightM': 1.22, 'tol_m': 0.03},
        'objects': objs_info,
    }
    c = man['car']
    keymap = {'lengthM': 'length_m', 'widthM': 'width_m', 'heightM': 'height_m'}
    man['diff'] = {k: round(c[keymap[k]] - man['expected'][k], 4) for k in keymap}
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=2)

    print('CAR_BUILD_OK ' + json.dumps(man['car'], ensure_ascii=False))
    for k, d in man['diff'].items():
        flag = 'OK' if abs(d) <= man['expected']['tol_m'] else 'OVER'
        print('  DIFF %-9s measured=%.3f expected=%.2f delta=%+.3f %s'
              % (k, c[keymap[k]], man['expected'][k], d, flag))
    for k, v in objs_info.items():
        print('  OBJ %-12s verts=%-6d mats=%s' % (k, v['verts'], ','.join(v['mats'])))
    print('BLEND ' + BLEND_PATH)
    return man


if __name__ == '__main__':
    build()
