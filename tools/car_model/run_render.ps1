# car_render.py 를 Blender 헤드리스로 실행하고 핵심 로그만 뽑는다.
# 사용: powershell -NoProfile -File tools/car_model/run_render.ps1
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root

$blender = 'C:\Users\dronc\AppData\Local\Programs\blender\blender-5.2.4-windows-x64\blender.exe'
if (-not (Test-Path $blender)) { Write-Output 'NO_BLENDEXE'; exit 1 }

$py = 'C:\Users\dronc\comfyui\ComfyUI_windows_portable\python_embeded\python.exe'
& $py -m py_compile (Join-Path $PSScriptRoot 'car_render.py')
Write-Output ('py_compile_exit=' + $LASTEXITCODE)
if ($LASTEXITCODE -ne 0) { exit 1 }

$log  = Join-Path $env:TEMP 'car_render_out.txt'
$errf = Join-Path $env:TEMP 'car_render_err.txt'
foreach ($f in @($log, $errf)) { if (Test-Path $f) { Remove-Item $f -Force } }

$p = Start-Process -FilePath $blender `
  -ArgumentList @('-b', '-P', (Join-Path $PSScriptRoot 'car_render.py')) `
  -NoNewWindow -Wait -PassThru `
  -RedirectStandardOutput $log -RedirectStandardError $errf
Write-Output ('blender_exit=' + $p.ExitCode)

$pat = 'RENDER_OK|^FRAME |MANIFEST|VIEW_TRANSFORM|MIRROR |LOOK_FAIL|VT_FAIL|EMPTY_FRAME|NUMPY_FAIL|NO_BLEND|Error|Traceback|line [0-9]+, in |ModuleNotFoundError|AttributeError|TypeError|ValueError|NameError'
Write-Output '--- filtered(stdout) ---'
Get-Content $log | Select-String -Pattern $pat | ForEach-Object { $_.Line }
Write-Output '--- stderr ---'
if (Test-Path $errf) { Get-Content $errf | Select-Object -Last 20 }
