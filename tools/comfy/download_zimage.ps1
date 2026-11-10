# Downloads the Z-Image Turbo split files into the portable ComfyUI models folder.
# Resumable: re-run any time, curl continues partial files (curl.exe -C -).
# ASCII only.

. (Join-Path $PSScriptRoot 'paths.ps1')

$repo = 'https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files'

$required = @(
    [pscustomobject]@{ name = 'diffusion model (int8 convrot)'; sub = 'diffusion_models'; file = 'z_image_turbo_int8_convrot.safetensors'; size = 6201001296 },
    [pscustomobject]@{ name = 'text encoder qwen3-4b (fp8)'; sub = 'text_encoders'; file = 'qwen_3_4b_fp8_mixed.safetensors'; size = 5631994051 },
    [pscustomobject]@{ name = 'vae (ae)'; sub = 'vae'; file = 'ae.safetensors'; size = 335304388 }
)

$optional = @(
    [pscustomobject]@{ name = 'text encoder qwen3-4b (fp4, saves 2.2 GB)'; sub = 'text_encoders'; file = 'qwen_3_4b_fp4_mixed.safetensors'; size = 3479416193 },
    [pscustomobject]@{ name = 'distill patch lora'; sub = 'loras'; file = 'z_image_turbo_distill_patch_lora_bf16.safetensors'; size = 158826336 }
)

$list = $required
if ($env:COMFY_EXTRA) { $list = $required + $optional }

$total = ($list | Measure-Object -Property size -Sum).Sum
Write-Host ("plan: {0} files, {1:N2} GB" -f $list.Count, ($total / 1GB))

$failed = @()
foreach ($f in $list) {
    $dir = Join-Path $ModelRoot $f.sub
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $dest = Join-Path $dir $f.file
    $url = "$repo/$($f.sub)/$($f.file)"

    if ((Test-Path $dest) -and ((Get-Item $dest).Length -eq $f.size)) {
        Write-Host ("skip  {0}  ({1:N2} GB already present)" -f $f.name, ($f.size / 1GB))
        continue
    }

    Write-Host ("get   {0}  {1}" -f $f.name, $url)
    $t0 = Get-Date
    # -C - resumes, --retry copes with dropped CDN connections.
    & curl.exe -sS -L --fail --retry 6 --retry-delay 5 -C - --connect-timeout 20 -o $dest $url
    $code = $LASTEXITCODE
    $len = 0
    if (Test-Path $dest) { $len = (Get-Item $dest).Length }
    $sec = ((Get-Date) - $t0).TotalSeconds
    Write-Host ("      exit={0} bytes={1:N0}/{2:N0} elapsed={3:N0}s avg={4:N1} MB/s" -f $code, $len, $f.size, $sec, ($len / 1MB / [math]::Max($sec, 1)))

    if ($len -ne $f.size) { $failed += $f.file }
}

Write-Host '--- verify ---'
foreach ($f in $list) {
    $dest = Join-Path (Join-Path $ModelRoot $f.sub) $f.file
    $len = 0
    if (Test-Path $dest) { $len = (Get-Item $dest).Length }
    $ok = if ($len -eq $f.size) { 'OK  ' } else { 'BAD ' }
    Write-Host ("{0} {1,-42} {2,14:N0} / {3,14:N0}" -f $ok, $f.file, $len, $f.size)
}

if ($failed.Count -gt 0) {
    Write-Host ("FAILED: {0}  (re-run to resume)" -f ($failed -join ', '))
    exit 1
}
Write-Host 'all files complete'
