# Blender 헤드리스로 python 스크립트를 실행하고 stdout/stderr 를 파일로 나눈다.
# 사용: powershell -NoProfile -File tools/car_model/run_blender.ps1 <script.py> [logname]
param([string]$Script = '', [string]$LogName = 'blender_run')
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root

$blender = 'C:\Users\dronc\AppData\Local\Programs\blender\blender-5.2.4-windows-x64\blender.exe'
if (-not (Test-Path $blender)) { Write-Output 'NO_BLENDEXE'; exit 1 }
if ($Script -eq '') { Write-Output 'NEED_SCRIPT'; exit 1 }
$sp = if (Test-Path $Script) { (Resolve-Path $Script).Path } else { $Script }

$py = 'C:\Users\dronc\comfyui\ComfyUI_windows_portable\python_embeded\python.exe'
& $py -m py_compile $sp
Write-Output ('py_compile_exit=' + $LASTEXITCODE)
if ($LASTEXITCODE -ne 0) { exit 1 }

$log  = Join-Path $env:TEMP ($LogName + '_out.txt')
$errf = Join-Path $env:TEMP ($LogName + '_err.txt')
foreach ($f in @($log, $errf)) { if (Test-Path $f) { Remove-Item $f -Force } }

$p = Start-Process -FilePath $blender -ArgumentList @('-b', '-P', $sp) `
  -NoNewWindow -Wait -PassThru -RedirectStandardOutput $log -RedirectStandardError $errf
Write-Output ('blender_exit=' + $p.ExitCode)
Write-Output '--- stdout ---'
if (Test-Path $log) { Get-Content $log }
Write-Output '--- stderr(tail) ---'
if (Test-Path $errf) { Get-Content $errf | Select-Object -Last 20 }
