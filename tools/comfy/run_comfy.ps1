# Starts the portable ComfyUI server. ASCII only.
#   run_comfy.ps1               -> attention: sage (default, installed in this env)
#   run_comfy.ps1 -NoSage       -> attention: torch default (baseline comparison)
#   run_comfy.ps1 -Fast         -> adds: --fast fp16_accumulation
#   run_comfy.ps1 -Headless     - > stdout+stderr to tools/comfy/comfy_run.log for log checks
param(
    [switch]$NoSage,
    [switch]$Fast,
    [switch]$Headless
)

. (Join-Path $PSScriptRoot 'paths.ps1')

$flags = @('-s', $MainPy, '--windows-standalone-build')
if ($Headless) { $flags += '--disable-auto-launch' }
if (-not $NoSage) { $flags += '--use-sage-attention' }
if ($Fast) { $flags += @('--fast', 'fp16_accumulation') }

Write-Host "root : $ComfyRoot"
Write-Host "py   : $Py"
Write-Host "flags: $($flags[3..($flags.Count - 1)] -join ' ')"

$env:PYTHONUNBUFFERED = '1'
if ($Headless) {
    Write-Host "log  : $LogFile"
    & $Py @flags 2>&1 | Tee-Object -FilePath $LogFile
}
else {
    Write-Host "open : http://127.0.0.1:8188"
    & $Py @flags
}
