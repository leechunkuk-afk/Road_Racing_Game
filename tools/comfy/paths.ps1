# Shared paths for the ComfyUI helper scripts. ASCII only (PowerShell 5.1 safety).
# The portable install lives outside this repo; override with $env:COMFY_ROOT if it moves.
if ($env:COMFY_ROOT) { $script:ComfyRoot = $env:COMFY_ROOT }
else { $script:ComfyRoot = 'C:\Users\dronc\comfyui\ComfyUI_windows_portable' }

$script:Py = Join-Path $ComfyRoot 'python_embeded\python.exe'
$script:MainPy = Join-Path $ComfyRoot 'ComfyUI\main.py'
$script:ModelRoot = Join-Path $ComfyRoot 'ComfyUI\models'
$script:LogFile = Join-Path $PSScriptRoot 'comfy_run.log'

if (-not (Test-Path $Py)) {
    Write-Error "python_embeded not found: $Py (set COMFY_ROOT and retry)"
    exit 1
}
