# car_build.py 를 Blender 헤드리스로 실행하고 핵심 로그만 뽑는다.
# 사용: powershell -NoProfile -File tools/car_model/run_build.ps1
# Blender 는 progress 를 stderr 로 흘리므로 ErrorActionPreference=Stop 과 상성이 나쁘다
# -> Start-Process 로 파일 리다이렉트를 써서 스트림을 깔끔하게 분리한다.
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root

$blender = 'C:\Users\dronc\AppData\Local\Programs\blender\blender-5.2.4-windows-x64\blender.exe'
if (-not (Test-Path $blender)) { Write-Output 'NO_BLENDEXE'; exit 1 }

$py = 'C:\Users\dronc\comfyui\ComfyUI_windows_portable\python_embeded\python.exe'
& $py -m py_compile (Join-Path $PSScriptRoot 'car_build.py')
Write-Output ('py_compile_exit=' + $LASTEXITCODE)
if ($LASTEXITCODE -ne 0) { exit 1 }

$log  = Join-Path $env:TEMP 'car_build_out.txt'
$errf = Join-Path $env:TEMP 'car_build_err.txt'
foreach ($f in @($log, $errf)) { if (Test-Path $f) { Remove-Item $f -Force } }

$p = Start-Process -FilePath $blender `
  -ArgumentList @('-b', '-P', (Join-Path $PSScriptRoot 'car_build.py')) `
  -NoNewWindow -Wait -PassThru `
  -RedirectStandardOutput $log -RedirectStandardError $errf
Write-Output ('blender_exit=' + $p.ExitCode)

$pat = 'CAR_BUILD_OK|^  OBJ |^  DIFF |^BLEND |SLOT |SCENE_OBJS|MATS_READY|BOOL_FAIL|SMOOTH_FAIL|Error|Traceback|line [0-9]+, in |ModuleNotFoundError|AttributeError|TypeError|ValueError'
Write-Output '--- filtered(stdout) ---'
Get-Content $log | Select-String -Pattern $pat | ForEach-Object { $_.Line }
Write-Output '--- stderr ---'
if (Test-Path $errf) { Get-Content $errf | Select-Object -Last 25 }
