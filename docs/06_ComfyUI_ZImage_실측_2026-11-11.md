# 06. ComfyUI(CUDA 가속) + Z-Image Turbo 구축 실측 — 2026-11-11

`docs/03_세이브포인트_차량렌더_comfyui.md` 5절 "ComfyUI 남은 절차"를 모두 끝낸 기록.
여기에 적힌 숫자는 모두 이 컴퓨터에서 직접 실행해 얻은 실측값이다.

## 1. 한 줄 결론

- ComfyUI 포터블은 **이미 CUDA 가속이 동작**하는 상태였고(0.44.0 / torch 2.14.1+cu130), **SageAttention 커널도 정상 동작**한다.
- Z-Image Turbo는 **GGUF 없이 공식 split_files(int8 convrot)로 설치**했다. 커스텀 노드 불필요, `file://`·오프라인과 무관(게임 파일과 분리).
- 세이브포인트에 적어둔 "**Z-Image + SageAttention = 검은 화면**" 우려는 **이 환경에서 재현되지 않았다**(이미지 실제 콘텐츠 확인 + SDPA 결과와 평균 차이 0.5/255).
- 단, 이 GPU·이 해상도에서 SageAttention의 실측 이득은 **커널 단위 2.5배, 전체 생성 시간 8% 정도**다(선형 레이어·VRAM 부담이 지배). 안전하니 기본은 Sage, 비교는 무플래그로 돌리면 된다.

## 2. 실측 환경

| 항목 | 값 |
|---|---|
| ComfyUI | v0.44.0 (git `2c75dc1`), frontend 1.57.6, comfy-kitchen 0.2.40, comfy-aimdo 0.6.0 |
| 경로 | `C:\Users\dronc\comfyui\ComfyUI_windows_portable` |
| python_embeded | Python 3.13.14, torch 2.14.1+cu130, CUDA 13.0 |
| GPU | RTX 3070 Laptop, driver 616.92, cc 8.6(sm86), VRAM 8192MiB (`torch` 총 8.59GB) |
| RAM | 32158MB (가용 16.4GB), ComfyUI pinned memory 12863MB |
| 어텐션 패키지 | **sageattention 2.2.0+cu130torch2.10.0andhigher.post6** (xformers·flash_attn 없음) |
| 커스텀 노드 | 없음(예제 2개만) → GGUF 경로 불필요 판단의 근거 |
| VRAM 상태 | `NORMAL_VRAM`, dynamic VRAM loading + async weight offloading(2 streams) |

## 3. 설치한 모델 파일 (바이트까지 검증 완료)

저장소 `Comfy-Org/z_image_turbo` → `ComfyUI\models\` 아래 배치. 총 **11.33GB**, 다운로드 평균 **약 96MB/s**(DiT 62s / TE 56s / VAE 5s).

| 파일 | 크기(B) | 위치 |
|---|---|---|
| `z_image_turbo_int8_convrot.safetensors` | 6,201,001,296 | `models\diffusion_models\` |
| `qwen_3_4b_fp8_mixed.safetensors` | 5,631,994,051 | `models\text_encoders\` |
| `ae.safetensors` | 335,304,388 | `models\vae\` |

미설치(선택): `qwen_3_4b_fp4_mixed.safetensors`(3,479,416,193B, 2.2GB 절약), `z_image_turbo_distill_patch_lora_bf16.safetensors`(158,826,336B).
→ `download_zimage.ps1`에 `COMFY_EXTRA=1`로 추가 가능.

로그에서 확인된 양자화 경로: `Found quantization metadata version 1` → `Native ops: w6a8_int8, int8_tensorwise, asym_w4a8_int8, convrot_w4a4`(emulated: fp8/nvfp4/mxfp8), DiT staged **5888MB**, TE **5370MB**, VAE **159MB**. 8GB VRAM에서 TE·DiT를 동적으로 올리고 내려서 동작한다.

## 4. 어텐션 실측

### 4.1 커널 단위 (`tools/comfy/sage_probe.py`, B1 H30 S4200 D128 = Z-Image 1024급 토큰 수)

| dtype | torch SDPA | SageAttention | 배속 | 수치 정확성 |
|---|---|---|---|---|
| fp16 | 14.647 ms | 5.901 ms | **2.48x** | maxdiff 0.0032, out_std 0.0254(기준과 동일), zero 0.000 |
| bf16 | 12.507 ms | 6.007 ms | **2.08x** | maxdiff 0.0029, zero 0.000 |

`S=1024·D=64` 같은 짧은 순서에서는 1.07배에 그친다 → 토큰이 많을수록 이득.

**위험 커널(사용 금지):** `sageattn_qk_int8_pv_fp8_cuda`는 sm86에서 `CUDA error: unspecified launch failure`로 **CUDA 컨텍스트를 죽인다**(sticky). 프로브에서 기본 제외했고, 다시 켜려면 `SAGE_RISKY=1`. ComfyUI의 `--use-sage-attention`은 `sageattn()` 자동 경로를 쓰므로 이 커널을 호출하지 않는다.

### 4.2 생성 단위 (832×1216, 8 steps, seed 고정, Z-Image Turbo)

| 실행 배치 | 어텐션 로그 | it/s | 프롬프트 3개 실행 시간 |
|---|---|---|---|
| `run_comfy.ps1`(Sage) | `Using sage attention` | 1.06~1.09 | 14.68 / 11.28 / 11.24 s |
| `run_comfy.ps1 -NoSage` | `Using pytorch attention` | 1.01~1.02 | 15.00 / 12.18 / 12.88 s |

동일 시드 결과물 비교(`tools/comfy/image_diff.py`): 평균 절대차 **0.48~0.57 / 255**, 16 초과 픽셀 0.3~0.4% → 눈으로 구분 불가.
콘텐츠 유효성(`tools/comfy/image_stats.py`): mean 69.0 / 71.1 / 83.3, std 30.2 / 32.8 / 31.6,near-black 1.2~2.6% → **검은 화면 아님**.

## 5. 만든 도구 (`tools/comfy/`)

| 파일 | 용도 |
|---|---|
| `paths.ps1` | ComfyUI 경로 통합 상수(`COMFY_ROOT`로 재지정 가능) |
| `download_zimage.ps1` | 3개 파일 재개 가능 다운로드 + 바이트 검증. `COMFY_EXTRA=1`로 선택 파일 추가 |
| `run_comfy.ps1` | 실행 배치. `-NoSage`(SDPA 비교), `-Fast`(`--fast fp16_accumulation`), `-Headless`(로그 파일 + 자동 브라우저 해제) |
| `sage_probe.py` | 어텐션 커널 동작·정확도·속도 프로브 (python_embeded로 실행) |
| `gen_character.js` | HTTP API로 Z-Image 워크플로 실행 + 이미지를 `docs\refs\character\`로 복사. 인자: `gen [w] [h] [prefix]`, `info` |
| `image_stats.py` | 이미지 밝기/채도/흑백 비율 수치(이미지를 못 보므로 검증용) |
| `image_diff.py` | 두 렌더 픽셀 차이(백엔드 비교) |
| `contact_sheet.py` | 생성물 6장 검토 시트 → `docs\refs\character_sheet.png` |

실행 예:

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\comfy\run_comfy.ps1
node tools\comfy\gen_character.js gen 832 1216
```

GUI에서 직접 할 경우: 설치본의 공식 블루프린트 `ComfyUI\blueprints\Text to Image (Z-Image-Turbo).json`을 부르고 모델 이름만 위 파일로 바꾸면 된다(우리가 쓴 파라미터와 동일).

## 6. 함정 기록 (다시 헤매지 말 것)

1. `CLIPLoader`의 `type` 목록에 v0.44에는 **`z_image`가 없다** → 공식 블루프린트처럼 **`lumina2`**를 쓴다. DiT는 `Lumina2`클래스로 감지된다(`model_type FLOW`).
2. 파라미터 기준값(블루프린트와 동일): `ModelSamplingAuraFlow shift 3`, KSampler `steps 8, cfg 1.0, res_multistep + simple, denoise 1`, `EmptySD3LatentImage`, `ConditioningZeroOut`(cfg 1이라 사실상 미사용).
3. 양자화 파일은 `UNETLoader weight_dtype = default`가 정답(파일 안에 양자화 메타데이터가 있음).
4. PowerShell로 python 출력을 파일에 담으면 stderr가 `NativeCommandError`로 보이지만 실제 로그는 정상이다. `$env:PYTHONUNBUFFERED=1` 권장.
5. 이미지 파일명은 `SaveImage filename_prefix`의 하위 폴더가 `im.subfolder`로 분리해서 온다(접두어를 파일명에 붙이려면 subfolder를 합칠 것).
6. 생성 중 ComfyUI 프로세스를 죽이면 대기자 노드도 끊긴다 → 재시작 후 재실행.

## 7. 결과물과 용도

- `docs/refs/character/character_sage_{front,side,back}_00001.png`, `character_sdpa_*` 3장(비교용)
- `docs/refs/character_sheet.png` — 2행(sage/sdpa) × 3열(정면/측면/후면) 검토 시트
- 용도는 **Blender 캐릭터 모델링 레퍼런스**. 게임 `index.html`에는 절대 넣지 않는다(실사 사진 = 게임 에셋 아님, 크레딧에도 무관).

## 8. 다음

1. 캐릭터 레퍼런스 보정(원하면 정장/점퍼/선글라스 등 의상 변형, `gen_character.js`의 `BASE`/`VIEWS` 문자열만 고치면 됨) → Blender 캐릭터 블록아웃.
2. 게임 본류: **M3**(AI·교통차·체크포인트·순위) → **M4**(포인트·상점·업그레이드/정비).
3. 대기 항목: yaw 50/55 프레임 추가 렌더, 음악 커트 3MB 이하 축소.
