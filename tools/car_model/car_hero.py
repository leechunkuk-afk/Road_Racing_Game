# -*- coding: utf-8 -*-
# ============================================================================
#  car_hero.py - 검토용으로 큰 사이즈의 정지 프레임 4장을 렌더한다(배경 포함).
#
#  실행:  powershell -NoProfile -File tools/car_model/run_blender.ps1 tools/car_model/car_hero.py car_hero
#  출력:  docs/refs/car_hero_<yaw>.png
#
#  car_sprites.blend(car_render.py 가 저장한 카메라/조명/차체)를 그대로 쓰고,
#  해상만 2배로 올린다(px_per_m = 160). 배경을 투명하게 하지 않아서 페인트와
#  가로등 반사를 눈으로 판단하기 좋다.
# ============================================================================
import math
import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SPRITES = os.path.join(ROOT, 'assets', 'car', 'car_sprites.blend')
OUT_DIR = os.path.join(ROOT, 'docs', 'refs')

PX = 768
ORTHO_SCALE = 4.8          # 768 / 4.8 = 160 px/m
YAWS = [0, 20, 45, 90]
TARGET_Z = 0.62
PITCH = 10.0
CAM_DIST = 9.0


def place(cam, yaw_deg):
    from mathutils import Vector
    a = math.radians(yaw_deg)
    pos = Vector((-math.cos(a) * CAM_DIST, math.sin(a) * CAM_DIST,
                  TARGET_Z + CAM_DIST * math.tan(math.radians(PITCH))))
    cam.location = pos
    d = (Vector((0.0, 0.0, TARGET_Z)) - pos).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def main():
    if not os.path.exists(SPRITES):
        print('NO_SPRITES ' + SPRITES)
        return 1
    bpy.ops.wm.open_mainfile(filepath=SPRITES)
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None:
        print('NO_CAMERA(차단 카메라가 없는 blend 입니다. car_render.py 를 먼저 실행하세요)')
        return 1
    sc.render.resolution_x = PX
    sc.render.resolution_y = PX
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'JPEG'   # TAA 노이즈 때문에 PNG 는 1.7MB 로 부풀어 JPEG 로 저장한다
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.quality = 92
    if hasattr(sc.eevee, 'taa_render_samples'):
        sc.eevee.taa_render_samples = 48
    cam.data.ortho_scale = ORTHO_SCALE
    os.makedirs(OUT_DIR, exist_ok=True)
    for yaw in YAWS:
        place(cam, yaw)
        path = os.path.join(OUT_DIR, 'car_hero_%03d.jpg' % yaw)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print('HERO yaw=%3d px_per_m=%.1f -> %s' % (yaw, PX / ORTHO_SCALE, path))
    print('HERO_OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
