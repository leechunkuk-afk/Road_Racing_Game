# 세이브포인트 2026-11-11 — Blender 차량 렌더 + ComfyUI 가속 설치

직전 세이브포인트: M2(위험노면·점프대) 완료, `index.html` 129.4KB, FPS 83~165, 콘솔 오류 0.
지금 작업 축: **플레이어 차량을 Blender 렌더 스프라이트로 교체** + **ComfyUI(CUDA 가속) 설치**.

---

## 1. 사용자 결정 (확정)

| 항목 | 결정 |
|---|---|
| Blender 설치 방식 | 포터블 ZIP 해제 (관리자 권한 불필요) |
| Blender 버전 | **5.2.4 LTS로 올린다** (5.3.0은 bpy API 변경 위험으로 보류) |
| 차량 종 | 근현대 스포츠 쿠페 (낮고 넓음, 큰 휠, 각진 LED 테일램프) |
| 스프라이트 방식 | 요각(yaw)별 프레임 24~32장 투명 PNG + 손상/브레이크/니트로는 캔버스 오버레이 |
| ComfyUI | CUDA 가속되는 공식 포터블 + **SageAttention** (사용자가 "무슨 어텐션"으로 지목) |
| Z-Image Turbo | GGUF 양자화 추천 수락 |
| 실사 캐릭터 보드 사진 용도 | **Blender 캐릭터 모델링 레퍼런스** (게임 파일로는 사용 안 함) |

---

## 2. 환경 (확인 완료)

- GPU: **RTX 3070 Laptop 8GB**, driver 616.92, sm_86, `torch.cuda.is_available() = True`
- C: 여유 ~170GB (7z/zip 해제 가능 공간 충분)
- Blender (포터블,两处 X `C:\Users\dronc\AppData\Local\Programs\blender\`)
  - `blender-5.2.3-windows-x64\blender.exe` (설치됨, 프로브에 사용)
  - `blender-5.2.4-windows-x64\blender.exe` ← **이걸로 통일** (SHA256 `bbd78f89…967c` 검증 OK, 5.2.4 LTS build 2026-11-10)
  - zip 원본: `%LOCALAPPDATA%\blender_dl\blender.zip`(5.2.3), `blender524.zip`(5.2.4) → 삭제 가능
- ComfyUI 포터블 v0.44.0 (2026-11-04 릴리스, `ComfyUI-Org/ComfyUI` 릴리스 에셋)
  - 경로: `C:\Users\dronc\comfyui\ComfyUI_windows_portable\`
  - `python_embeded`: **Python 3.13.14 / torch 2.14.1+cu130 / CUDA 13.0**
  - 7z 해제는 `tar -xf`(bsdtar 3.8.9 / libarchive) 로 성공. 7-Zip 미설치.
  - 설치된 가속 패키지: **sageattention 2.2.0+cu130torch2.10.0andhigher.post6**, **triton-windows 3.9.0.post30**
    - 휠: `https://github.com/woct0rdho/SageAttention/releases/download/v2.2.0-windows.post6/sageattention-2.2.0+cu130torch2.10.0andhigher.post6-cp310-abi3-win_amd64.whl`
  - 내장 `comfy_kitchen` 있음, 그러나 `supports_fp8_compute() = False` → **`--use-ck-attention` 부적합(Ampere)**. SageAttention 또는 기본 SDPA 사용.
  - ComfyUI 어텐션 플래그 확인됨: `--use-sage-attention`, `--use-flash-attention`, `--use-ck-attention`, `--fast <features>`
- 벤치 스크립트(미실행): `C:\Users\dronc\AppData\Local\Temp\opencode\sage_bench.py`
  → 실행하면 sm_86 커널 존재 여부 + SDPA 대비 배속 확인. **미완료 항목.**
- ComfyUI 모델 파일: **아직 아무것도下載 안 함.** Z-Image Turbo GGUF 트리 조회는 HF API 401 로 실패 → 저장소명/파일명 재확인 필요.

### Z-Image 주의사항 (중요)
Z-Image 계열은 SageAttention/CK 같은 고속 어텐션에서 **검은 화면**이 나는known 문제가 있어,
Z-Image 작업용 실행 배치는 어텐션 플래그 없이(기본 PyTorch SDPA) 돌린다.
SageAttention 은 SDXL/FLUX/WAN 등 다른 모델용으로 사용.

---

## 3. Blender 5.2 API 프로브 결과 (`tools/car_model/probe.py`)

재확인하지 말 것. 5.2.3 기준, 5.2.4 동일 가정.

- `bpy.ops.object.shade_auto_smooth(angle=…)` → **동작** (NODES modifier 추가, 적용 안 해도 렌더됨)
- `bpy.ops.object.modifier_apply` / `join` → 존재 (불리언 EXACT 적용 시도 시 구조적으로 통과)
- **`bmesh.ops.transform_each` 없음** → 얼굴 중심 확장/이동은 직접 계산해야 함
- `bmesh.ops.triangle_fill` 에 `use_beautify` **없음**
- `Image.crop` **없음**, `Image.scale(width:int, height:int)` 는 int 인자 (tuple 불가), `img.pixels` 읽기 가능(len 확인)
  → 크롭은 직접 픽셀 슬라이싱하거나, **캔버스 유지 + bbox만 매니페스트에 저장**하는 편이 안전
- 렌더 엔진: `BLENDER_EEVEE`(=EEVEE Next), `BLENDER_WORKBENCH`, `CYCLES` / `BLENDER_EEVEE_NEXT` 이름은 **없음**
- Cycles prefers: `get_device_type` **없음** → `compute_device_type='CUDA'` + `get_devices()` 사용
- 미검증: EEVEE 헤드리스(`-b`) 렌더 가능 여부, Cycles GPU(CUDA/OPTIX) 동작, `film_transparent` alpha 출력

---

## 4. 차량 모델링 진행

### 완성
`tools/car_model/car_geo.py` — 순수 기하 데이터 (bpy.ops 미사용), `py_compile` 통과.
- 좌표계: **+X = 앞, +Y = 좌, +Z = 위, 미터, 지면 z=0**
- 차원: 전장 4.24m(앞 +2.08 / 뒤 −2.16), 전폭 1.95m(트레드 반 0.845 + 타이어 반폭 0.13),
  전고 1.225m(지붕 z=0.912+0.312), 휠베이스 2.45m(앞축 1.30 / 뒤축 −1.15), 타이어 r0.345 w0.26, 아치 r0.435
- `BODY_RINGS` / `CABIN_RINGS`: (x, 반폭, 반높이, 중심z, 모서리지수) — **앞→뒤 내림차순 정렬** (loft가 인접 항목을 이으므로 순서 필수)
  - 모서리지수 p 는 중앙 6.2(플랭크가 수직에 가깝게), 앞뒤 끝 3.0 (실차 느낌)
- 함수: `ring_pts`, `loft`(닫힌 매니폴드, 캡 n-gon), `cyl_solid`, `box_pydata`, `taper_cyl_pydata`
- `TRIM` 테이블: (재질, sx, sy, sz, cx, cy, cz, 미러링) — 스커트/디퓨저/범퍼인서트/그릴/에어인테이크/스플리터/
  리어LED스트립/리어클러스터/DRL/덕테일/번호판/미러본체/미러암
- `DIFFUSER_FINS = 5`, `EXHAUST` 좌표

### 미작성 (다음에 만들 파일)
1. `tools/car_model/car_build.py` — 씬 클리어 → 재질(페인트/유리/타이어/트림/메탈/램프R/램프W/플레이트/휠웰)
   → 본체 loft(n=24) + 휠 아치 원통 4개 DIFFERENCE(EXACT, 재질 슬롯 휠웰)
   → 캐빈 loft + 면노름 z>0.25 이면 페인트 아니면 유리 (transform_each 없으므로 수동 계산)
   → TRIM/EXHAUST/미러/디퓨저핀/휠(타이어+디스크+스포크+허브) 생성
   → 재질별 join + `shade_auto_smooth(35°)` → `car.blend` 저장 + `car.json`(차원) 기록
2. `tools/car_model/car_render.py` — 스튜디오 라이트(키/필/림 area) + 월드, 카메라(50mm, 약 7.6m,
   `(0,0,0.65)` 조준, 회전 고정), `film_transparent`, yaw 24~32턴테이블 렌더
   → `assets/game/cars/rear_NN.png` + 매니페스트 JSON(캔버스 크기, bbox, px/m, 접지 앵커)
   - 앵커 아이디어: 카 중심은 Y 축 회전만 하므로 **지면 (0,0,0) 의 스크린 투영은 모든 프레임에서 동일** → 그 점을 앵커로 저장
3. 콘택트시트 → `browser.preview` 로 사용자 승인 (이미지 판독 불가라 미리보기 필수)

### 게임 연결 예정 지점
- `src/01_config.js` `CONFIG.assets.list` 에 car 프레임 등록, `assets/game/cars/` 신규
- `src/04_sprites.js` car 스프라이트 로드 + yaw 양자화 프레임 선택 (`carRear` 는 폴백 유지)
- `src/08_render.js` `drawPlayer`: 현재 `w = W * (chase ? 0.30 : 0.34)` → **너무 큼**.
  도로 투영 폭 기준으로 산정 계획: 플레이어 스크린 행(`cy = H*0.80`)에 가장 가까운 세그먼트의
  `p1.screen.w` 를 이용해 `carW = roadHalfPx*2 * (315 / (CONFIG.road.width*2))` (차폭 1.9m ≈ 315 유닛, 1m ≈ 165 유닛)
- `CREDITS.md` 자체 렌더 항목 표기 추가

---

## 5. ComfyUI 남은 절차

1. `sage_bench.py` 실행 → sm_86 커널 확인, SDPA 대비 배속 기록
2. 실행 배치 2종 생성 (`ComfyUI_windows_portable\`):
   - `run_fast_sage.bat`: `--windows-standalone-build --use-sage-attention --reserve-vram 1.5`
   - `run_zimage.bat`: `--windows-standalone-build --reserve-vram 1.5` (어텐션 플래그 없음 = SDPA)
3. ComfyUI 를 잠깐 띄워 로그에 `Using sage attention` 확인
4. Z-Image Turbo GGUF + 텍스트인코더(Qwen3-4B) + VAE 다운로드 → `ComfyUI\models\` (저장소/파일명 재확인 필요)
5. 캐릭터 레퍼런스 시트 워크플로 JSON(정면/측면/후면 + 중립 스튜디오) → API 로 헤드리스 실행
   → 출력은 게임 에셋이 아니라 `docs\refs\character\` 등에 저장 (Blender 모델링 레퍼런스 용도)

---

## 6. 검증 절차 (매번 지킬 것)

- 파일 작성 후 CJK 혼입 스캔: `C:\Users\dronc\AppData\Local\Temp\opencode\scan_cjk.ps1`
  (한자/가나/전각/라틴 확장 범위 검출) → 치환. 지금까지 `共用`, `verticale` 같은 오염이 실제로 발생함
- JS: `& "C:\Program Files\nodejs\node.exe" --check src\NN_x.js` 파일별
- 빌드: `& "C:\Program Files\nodejs\node.exe" tools\build_single_html.js`
- 브라우저 재검증: 오류 0, FPS. code mode 브라우저 도구는 `evaluate`→`script`, `find`→`text`
- 이 모델은 이미지를 읽을 수 없음 → 픽셀 프로브 + `browser.preview` 로 사용자에게 확인
- code mode 런타임에 `setTimeout` 없음 → 대기 셸은 `Start-Sleep`
- git 저장소 아님 (변경은 워킹트리에만 존재)
- 백그라운드 셸: `node tools/serve.js 8123` 실행 중이었을 수 있음(세션 재개 시 확인)
