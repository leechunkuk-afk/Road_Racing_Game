param([string]$Ws = (Get-Item $PSScriptRoot).Parent.Parent.FullName)
$paths = @()
$paths += (Get-ChildItem -LiteralPath (Join-Path $Ws 'docs') -Filter '*.md' -File | ForEach-Object { $_.FullName })
$paths += (Join-Path $Ws 'CREDITS.md')
foreach ($p in $paths) {
  if (-not (Test-Path -LiteralPath $p)) { Write-Output 'MISSING'; continue }
  $lines = Get-Content -LiteralPath $p -Encoding UTF8
  $kana = 0; $han = 0
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $L = $lines[$i]
    if ($L -match '[\u3041-\u3096\u30a1-\u30ff\u31f0-\u31ff]') {
      $kana++
      Write-Output ('KANA  L' + ($i+1) + '  ' + ($L -replace '[^\x20-\x7e]', '?'))
    }
    $h = [regex]::Matches($L, '[\u4e00-\u9faf]')
    if ($h.Count -gt 0) {
      $han++
      $names = @(); foreach ($m in $h) { $names += $m.Value }
      Write-Output ('HANJA L' + ($i+1) + ' [' + ($names -join '') + '] ' + ($L -replace '[^\x20-\x7e]', '?'))
    }
  }
  Write-Output ('SCAN  ' + [IO.Path]::GetFileName($p) + '  lines=' + $lines.Count + '  kana=' + $kana + '  hanja=' + $han)
  Write-Output ''
}
