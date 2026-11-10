# tools/comfy — ComfyUI 유틸 (Z-Image Turbo 캐릭터 레퍼런스 생성)

풀 설명과 실측 수치는 `docs/06_ComfyUI_ZImage_실측_2026-11-11.md`.
이 폴더의 스크립트는 **게임 파일(index.html)과 무관**한 개발 보조 도구다.

## 대상 환경 (실측)

`C:\Users\dronc\comfyui\ComfyUI_windows_portable` · ComfyUI 0.44.0 · python_embeded 3.13.14 ·
torch 2.14.1+cu130 · RTX 3070 Laptop 8GB(sm86) · sageattention 2.2.0
경로는 `COMFY_ROOT` 환경변수로 바꿀 수 있다.

## 자주 쓰는 명령

```powershell
# 서버 실행(브라우저 자동 열림). SageAttention 사용.
powershell -NoProfile -ExecutionPolicy Bypass -File tools\comfy\run_comfy.ps1

# 비교용: 기본 PyTorch SDPA(어텐션 플래그 없음)
powershell -NoProfile -ExecutionPolicy Bypass -File tools\comfy\run_comfy.ps1 -NoSage

# 모델 재다운로드/무결성 검증(재개됨)
powershell -NoProfile -ExecutionPolicy Bypass -File tools\comfy\download_zimage.ps1

# 노드 스키마·모델 파일 인식 확인 (서버 실행 중일 때)
node tools\comfy\gen_character.js info

# 캐릭터 정면/측면/후면 생성 -> docs\refs\character\
node tools\comfy\gen_character.js gen 832 1216

# 어텐션 커널 프로브 / 이미지 수치 검증
& "C:\Users\dronc\comfyui\ComfyUI_windows_portable\python_embeded\python.exe" -s tools\comfy\sage_probe.py
& "C:\Users\dronc\comfyui\ComfyUI_windows_portable\python_embeded\python.exe" -s tools\comfy\image_stats.py docs\refs\character
& "C:\Users\dronc\comfyui\ComfyUI_windows_portable\python_embeded\python.exe" -s tools\comfy\contact_sheet.py
```

## Z-Image 설정 요약 (블루프린트와 동일)

`UNETLoader(z_image_turbo_int8_convrot.safetensors, default)` +
`CLIPLoader(qwen_3_4b_fp8_mixed.safetensors, type=lumina2)` + `VAELoader(ae.safetensors)` +
`ModelSamplingAuraFlow(shift 3)` + `KSampler(steps 8, cfg 1.0, res_multistep/simple, denoise 1)` +
`EmptySD3LatentImage`.

## 주의

- `sageattn_qk_int8_pv_fp8_cuda`는 sm86에서 CUDA 컨텍스트를 죽인다 → 프로브에서 기본 비활성(`SAGE_RISKY=1`일 때만 시도).
- 생성물은 Blender 모델링 레퍼런스 전용. 게임 에셋으로 쓰지 않는다.
