# -*- coding: utf-8 -*-
# yaw 부호 규약 확인용 프로브. 렌더를 다시 하지 않고 카메라 행렬만으로
# "차 앞쪽이 화면 어느 쪽에 보이는지"를 계산한다.
# 실행: powershell -NoProfile -File tools/car_model/run_blender.ps1 tools/car_model/car_yaw_probe.py yaw_probe
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SPRITES = os.path.join(ROOT, 'assets', 'car', 'car_sprites.blend')
CAM_DIST = 9.0
TARGET_Z = 0.62
PITCH = 10.0


def place(cam, yaw_deg):
    a = math.radians(yaw_deg)
    pos = Vector((-math.cos(a) * CAM_DIST, math.sin(a) * CAM_DIST,
                  TARGET_Z + CAM_DIST * math.tan(math.radians(PITCH))))
    cam.location = pos
    d = (Vector((0.0, 0.0, TARGET_Z)) - pos).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()


def main():
    if not os.path.exists(SPRITES):
        print('NO_SPRITES ' + SPRITES)
        return 1
    bpy.ops.wm.open_mainfile(filepath=SPRITES)
    cam = bpy.context.scene.camera
    for yaw in (20, 45, 90):
        place(cam, yaw)
        inv = cam.matrix_world.inverted()
        front = inv @ Vector((2.0, 0.0, 0.5))     # 차 앞끝(+X = 전진)
        rear = inv @ Vector((-2.0, 0.0, 0.5))     # 차 뒤끝
        left = inv @ Vector((0.0, 0.9, 0.5))      # 차 좌측(+Y)
        right = inv @ Vector((0.0, -0.9, 0.5))    # 차 우측
        flank = 'LEFT(+Y)' if left.z > right.z else 'RIGHT(-Y)'
        print('PROBE yaw=%3d front_x=%+.2f rear_x=%+.2f left_x=%+.2f right_x=%+.2f '
              'depth_front=%.2f depth_rear=%.2f depth_left=%.2f depth_right=%.2f'
              % (yaw, front.x, rear.x, left.x, right.x, -front.z, -rear.z, -left.z, -right.z))
        print('  => nose_on_screen=%s  near_flank=%s'
              % ('RIGHT' if front.x > 0 else 'LEFT', flank))
    print('PROBE_OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
