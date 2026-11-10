# -*- coding: utf-8 -*-
# ============================================================================
#  car_render.py - assets/car/car.blend 의 차량을 게임용 yaw 스프라이트로 렌더한다.
#
#  실행:  powershell -NoProfile -File tools/car_model/run_render.ps1
#         (또는 blender.exe -b -P tools/car_model/car_render.py)
#
#  출력:
#    assets/game/car/<palette>/car_<i>_<yaw>deg.png   RGBA(straight alpha) 스프라이트
#    assets/car/car_frames.json                      매니페스트(치수/접지선/앵커/색)
#
#  카메라는 직교(orthographic). 게임이 일정한 화면 크기로 그리므로 원근 카메라는
#  쓰면 안 된다. ortho_scale 로 1m 당 픽셀을 정확히 고정한다(px_per_m = 80).
#
#  yaw 규약: 0 = 정후방. + 는 카메라가 차 좌측(+Y)으로 도는 각도 -> 화면에서 차 코가
#  왼쪽을 향한다(car_yaw_probe.py 실측). 게임의 +yaw 는 우핸들(코가 오른쪽) 이므로
#  게임은 |yaw| 프레임을 쓰고 양수일 때 좌우 반전한다.
#  차체/조명이 XZ 평면 대해 대칭이라 음수 yaw 는 양수 yaw 의 반전으로 대신한다.
# ============================================================================
import json
import math
import os
import sys

import bpy
from mathutils import Vector

try:
    import numpy as np
except Exception as e:                                              # noqa: BLE001
    print('NUMPY_FAIL %r' % e)
    raise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_geo as G                                                # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BLEND_PATH = os.path.join(ROOT, 'assets', 'car', 'car.blend')
CAR_JSON = os.path.join(ROOT, 'assets', 'car', 'car.json')
MANIFEST = os.path.join(ROOT, 'assets', 'car', 'car_frames.json')
GAME_CAR_DIR = os.path.join(ROOT, 'assets', 'game', 'car')         # 게임이 읽는 위치

# --- 렌더 설정 ---------------------------------------------------------------
PX = 384                       # 프레임 한 변 픽셀
ORTHO_SCALE = 4.8              # 카메라 시야 폭(m). PX / ORTHO_SCALE = 80 px/m
PITCH = 10.0                   # 카메라 피치(도, 위에서 내려보는 각). 게임 추격 카메라와 동일
SAMPLES = 24
YAWS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75, 90, 120, 150, 180]
TARGET_Z = 0.62                # 카메라가 보는 높이(차 중심 부근)
CAM_DIST = 9.0                 # 직교라 크기에 영향 없음. 그림자/클립만 결정
PALETTES = G.PALETTES          # (id, 표시 이름, hex, base, metal, rough, coat, coat_rough)


def set_prop(obj, names, value):
    for n in names:
        if hasattr(obj, n):
            setattr(obj, n, value)
            return True
    return False


def set_in(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False


# ---------------------------------------------------------------------------
#  카메라 / 조명 / 월드
# ---------------------------------------------------------------------------
def add_camera():
    cam = bpy.data.cameras.new('sprite_cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = ORTHO_SCALE
    cam.clip_start = 0.1
    cam.clip_end = 60.0
    ob = bpy.data.objects.new('sprite_cam', cam)
    bpy.context.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    return ob


def place_camera(ob, yaw_deg):
    """yaw 는 카메라의 방위. yaw 0 = 정후방(-X), + 이면 카메라가 차 좌측(+Y)으로 돈다."""
    a = math.radians(yaw_deg)
    pos = Vector((-math.cos(a) * CAM_DIST, math.sin(a) * CAM_DIST,
                  TARGET_Z + CAM_DIST * math.tan(math.radians(PITCH))))
    ob.location = pos
    d = (Vector((0.0, 0.0, TARGET_Z)) - pos).normalized()
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()


def add_area(name, loc, target, size, power, color=(1.0, 1.0, 1.0)):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = power
    ld.size = size
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    d = (Vector(target) - Vector(loc)).normalized()
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


def setup_rig():
    """XZ 평면 대해 좌우 대칭인 조명. 그래야 -yaw 프레임을 반전으로 쓸 수 있다."""
    cam = add_camera()
    add_area('key_front', (2.6, 0.0, 3.6), (0.4, 0.0, 0.5), 5.0, 210.0, (0.86, 0.92, 1.00))
    add_area('key_rear', (-3.4, 0.0, 2.9), (-0.8, 0.0, 0.6), 4.5, 120.0, (1.00, 0.86, 0.72))
    add_area('side_l', (0.0, 3.6, 1.5), (0.0, 0.9, 0.6), 3.0, 70.0, (0.70, 0.80, 1.00))
    add_area('side_r', (0.0, -3.6, 1.5), (0.0, -0.9, 0.6), 3.0, 70.0, (0.70, 0.80, 1.00))
    w = bpy.data.worlds.get('world') or bpy.data.worlds.new('world')
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    if bg:
        bg.inputs[0].default_value = (0.020, 0.030, 0.055, 1.0)
        bg.inputs[1].default_value = 0.35
    bpy.context.view_layer.update()
    return cam


# ---------------------------------------------------------------------------
#  색 갈아끼우기 / 픽셀 앵커
# ---------------------------------------------------------------------------
def paint_node():
    m = bpy.data.materials.get('paint')
    if m is None or m.node_tree is None:
        return None
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            return n
    return None


def set_paint(pal):
    """car_geo.PALETTES 의 한 행을 paint 재질에 심는다."""
    b = paint_node()
    if b is None:
        print('NO_PAINT_NODE')
        return False
    pid, label, hexc, col, metal, rough, coat, coat_r = pal
    set_in(b, ['Base Color'], (col[0], col[1], col[2], 1.0))     # 소켓은 RGBA 를 요구한다
    set_in(b, ['Metallic'], metal)
    set_in(b, ['Roughness'], rough)
    set_in(b, ['Coat Weight'], coat)
    set_in(b, ['Coat Roughness'], coat_r)
    if not getattr(set_paint, 'dumped', False):
        set_paint.dumped = True
        names = [i.name for i in b.inputs]
        print('PRIM_SOCKETS ' + ', '.join([n for n in names
                                          if any(k in n for k in ('Base', 'etal', 'ough', 'Coat'))]))
    print('PAINT %s %s base=%s metal=%.2f rough=%.2f coat=%.2f'
          % (pid, label, col, metal, rough, coat))
    return True


def project(cam, pt, ppm):
    """월드 좌표 -> 프레임 픽셀. 리턴 = [열, 위에서 기준 행]. 직교 투영이라 렌더 불필요."""
    lp = cam.matrix_world.inverted() @ Vector((pt[0], pt[1], pt[2]))
    return [round(PX * 0.5 + lp.x * ppm, 1), round(PX * 0.5 - lp.y * ppm, 1)]


def frame_anchors(cam, ppm):
    """게임이 브레이크 발광 / 니트로 불꽃 / 손상 연기를 얹을 위치(프레임 픽셀)."""
    pts = {k: project(cam, v, ppm) for k, v in G.FX_POINTS.items()}
    c, r = pts['center'], pts['rear']
    dx, dy = r[0] - c[0], r[1] - c[1]
    ln = math.hypot(dx, dy) or 1.0
    pts['out'] = [round(dx / ln, 4), round(dy / ln, 4)]      # 차 뒤쪽 방향(불꽃이 뻗는 방향)
    return pts


# ---------------------------------------------------------------------------
#  프레임 측정(alpha bbox) - 접지선과 여백을 숫자로 남긴다
# ---------------------------------------------------------------------------
def read_rgba(path):
    im = bpy.data.images.load(path)
    w, h = im.size[0], im.size[1]
    buf = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(buf)
    bpy.data.images.remove(im)
    return buf.reshape((h, w, 4))[::-1]          # row 0 = 위


def measure(path):
    """저장된 PNG 에서 alpha 로 그림의 외접 상자를 구한다. (row 0 = 위)"""
    px = read_rgba(path)
    h, w = px.shape[0], px.shape[1]
    a, rgb = px[:, :, 3], px[:, :, :3]
    rows = np.where(a.max(axis=1) > 0.004)[0]
    cols = np.where(a.max(axis=0) > 0.004)[0]
    if not len(rows) or not len(cols):
        return None
    top, bottom = int(rows.min()), int(rows.max())
    left, right = int(cols.min()), int(cols.max())
    sub = px[top:bottom + 1, left:right + 1]
    sa, sr = sub[:, :, 3], sub[:, :, :3]
    ink = sa > 0.05
    premul_leak = int(((sr.max(axis=2) - sa) > 0.05)[ink].sum())    # 0 에 가까우면 straight alpha
    return {'w': w, 'h': h,
            'left': left, 'right': right, 'top': top, 'bottom': bottom,
            'ink_w': right - left + 1, 'ink_h': bottom - top + 1,
            'cx': (left + right) * 0.5, 'contact_y': bottom,
            'lum_mean': round(float((sr.mean(axis=2)[ink]).mean()), 4),
            'opaque_frac': round(float((sa > 0.9)[ink].mean()), 4),
            'premul_leak': premul_leak}


def verify_mirror(cam, frames_dir, by_yaw):
    """조명/차체가 좌우 대칭인지 확인한다. -yaw 를 렌더해 +yaw 와 좌우 반전 비교."""
    sc = bpy.context.scene
    for yaw in (20, 90):
        fr = by_yaw.get(yaw)
        if not fr:
            continue
        tmp = os.path.join(frames_dir, '_verify_neg_%03d.png' % yaw)
        place_camera(cam, -yaw)
        sc.render.filepath = tmp
        bpy.ops.render.render(write_still=True)
        neg, pos = read_rgba(tmp), read_rgba(os.path.join(frames_dir, fr['file']))
        diff = float(np.abs(neg[:, ::-1, :3] * neg[:, ::-1, 3:4] -
                            pos[:, :, :3] * pos[:, :, 3:4]).mean())
        alpha_diff = float(np.abs(neg[:, ::-1, 3] - pos[:, :, 3]).mean())
        print('MIRROR yaw=%3d rgb_mad=%.4f alpha_mad=%.4f (0 에 가까울수록 반전 재사용 안전)'
              % (yaw, diff, alpha_diff))
        if os.path.exists(tmp):
            os.remove(tmp)


# ---------------------------------------------------------------------------
#  렌더
# ---------------------------------------------------------------------------
def configure_scene():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = PX
    sc.render.resolution_y = PX
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    # Blender 5.2 에는 premultiply 옵션이 없고 PNG 는 straight alpha 로 저장된다.
    # (canvas drawImage 가 요구하는 형식이라 그대로 둔다)
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.compression = 15
    # AgX 는 색을 눌러버린다. 스프라이트는 만든 색을 그대로 써야 한다.
    for vt in ('Standard', 'Standard 2.4'):
        try:
            sc.view_settings.view_transform = vt
            break
        except Exception as e:                                       # noqa: BLE001
            print('VT_FAIL %s %r' % (vt, e))
    try:
        sc.view_settings.look = 'None'
    except Exception as e:                                           # noqa: BLE001
        print('LOOK_FAIL %r' % e)
    print('VIEW_TRANSFORM ' + str(sc.view_settings.view_transform))
    set_prop(sc.eevee, ['taa_render_samples'], SAMPLES)
    set_prop(sc.eevee, ['use_raytracing'], True)
    set_prop(sc.eevee, ['use_shadows'], True)
    return sc


def render_pass(cam, sc, pal, ppm):
    """한 색으로 yaw 16프레임(검증용 반전 렌더는 별도) 을 assets/game/car/<id>/ 에 만든다."""
    pid = pal[0]
    frames_dir = os.path.join(GAME_CAR_DIR, pid)
    os.makedirs(frames_dir, exist_ok=True)
    if not set_paint(pal):
        return []
    frames = []
    for i, yaw in enumerate(YAWS):
        place_camera(cam, yaw)
        name = 'car_%02d_%03ddeg.png' % (i, yaw)
        path = os.path.join(frames_dir, name)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        m = measure(path)
        if m is None:
            print('EMPTY_FRAME %s/%s' % (pid, name))
            continue
        rec = {'i': i, 'yaw_deg': yaw, 'file': name}
        rec.update(m)
        frames.append(rec)
        print('FRAME %s %02d yaw=%3d ink=%dx%d contact_y=%d lum=%.3f opaque=%.2f premul=%d'
              % (pid, i, yaw, m['ink_w'], m['ink_h'], m['contact_y'],
                 m['lum_mean'], m['opaque_frac'], m['premul_leak']))
    return frames


def main():
    if not os.path.exists(BLEND_PATH):
        print('NO_BLEND ' + BLEND_PATH)
        return 1
    bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)
    cam = setup_rig()
    sc = configure_scene()
    ppm = PX / ORTHO_SCALE

    palettes = []
    for pal in PALETTES:
        frames = render_pass(cam, sc, pal, ppm)
        if not frames:
            print('PASS_FAIL ' + pal[0])
            return 1
        if pal is PALETTES[0]:
            # 좌우 반전 재사용 안전성 확인 (재질과 무관하므로 한 번만)
            verify_mirror(cam, os.path.join(GAME_CAR_DIR, pal[0]),
                          {f['yaw_deg']: f for f in frames})
        # 픽셀 앵커는 기하학만 쓰므로 색과 무관하다. yaw 인덱스당 한 번만 계산해 저장한다.
        anchors = []
        for yaw in YAWS:
            place_camera(cam, yaw)
            anchors.append(frame_anchors(cam, ppm))
        palettes.append({'id': pal[0], 'label': pal[1], 'hex': pal[2],
                         'dir': 'assets/game/car/' + pal[0],
                         'frames': frames, 'fx': anchors})

    set_paint(PALETTES[0])          # blend 은 기본 색으로 저장해 둔다(검수 재현성)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'assets', 'car', 'car_sprites.blend'))

    src = {}
    if os.path.exists(CAR_JSON):
        with open(CAR_JSON, 'r', encoding='utf-8') as f:
            src = json.load(f)

    contacts = [f['contact_y'] for p in palettes for f in p['frames']]
    # 접지선(anchor): 차 오리지널 (0,0,0) 이 스크린의 몇 번째 행에 오는지.
    # 직교 카메라라 yaw 와 무관하게 고정이다. (타이어 접지점 x=0 기준)
    ground_row = PX * 0.5 + TARGET_Z * math.cos(math.radians(PITCH)) * ppm
    man = {
        'blender': bpy.app.version_string,
        'frame_px': PX,
        'ortho_scale_m': ORTHO_SCALE,
        'px_per_m': round(ppm, 4),
        'pitch_deg': PITCH,
        'target_z': TARGET_Z,
        'yaw_convention': '렌더 +yaw = 카메라가 차 좌측(+Y). 화면에서 코가 왼쪽. '
                          '게임 +yaw(우핸들) 는 |yaw| 프레임을 쓰고 좌우 반전해야 한다',
        'mirror_negative_yaw': True,
        'yaws': YAWS,
        'anchor': {
            'ground_y': int(round(ground_row)),
            'ground_x': int(round(PX * 0.5)),
            'note': 'ground_y = 차 중심의 타이어 접지선이 있는 행(위에서 기준). '
                    '게임은 이 점을 도로 위 차 위치에 맞춘다. bbox bottom 는 범퍼 아래로, '
                    'ground_y 보다 항상 아래에 있다.',
            'measured_bottom_avg': int(round(sum(contacts) / len(contacts))),
        },
        'fx_note': 'fx[i] 는 YAWS[i] 프레임에서 오버레이(브레이크/니트로/손상) 를 얹을 픽셀 좌표. '
                   'u = 열, v = 위에서 기준 행. out = 차 뒤쪽 방향 단위벡터. 색과 무관하다.',
        'palettes': palettes,
        'car': src.get('car', {}),
    }
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=2)
    n = sum(len(p['frames']) for p in palettes)
    print('RENDER_OK palettes=%d frames=%d px_per_m=%.3f ground_row=%.1f bottom_avg=%d'
          % (len(palettes), n, ppm, ground_row, man['anchor']['measured_bottom_avg']))
    print('MANIFEST ' + MANIFEST)
    return 0


if __name__ == '__main__':
    sys.exit(main())
