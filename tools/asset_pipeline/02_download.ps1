param(
  [string]$Manifest = (Join-Path $PSScriptRoot 'assets_manifest.json'),
  [string]$Workspace = (Get-Item $PSScriptRoot).Parent.Parent.FullName
)
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

$m = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$totalKb = 0
foreach ($e in $m) {
  $d = Join-Path $Workspace ('assets\' + $e.dir)
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  $p = Join-Path $d $e.name
  if ((Test-Path $p) -and ((Get-Item $p).Length -gt 1000)) {
    Write-Output ('SKIP  ' + $e.dir + '/' + $e.name)
    continue
  }
  try {
    Invoke-WebRequest -Uri $e.url -OutFile $p -UserAgent $ua -TimeoutSec 180 -UseBasicParsing
    $kb = [math]::Round((Get-Item $p).Length / 1KB)
    $totalKb += $kb
    Write-Output ('OK    ' + ('{0,7}' -f $kb) + 'KB  ' + $e.dir + '/' + $e.name)
  }
  catch {
    Write-Output ('FAIL  ' + $e.dir + '/' + $e.name + ' :: ' + $_.Exception.Message)
  }
  Start-Sleep -Milliseconds 150
}
Copy-Item -LiteralPath $Manifest -Destination (Join-Path $Workspace 'assets\source_manifest.json') -Force
Write-Output ('TOTAL_KB=' + $totalKb)
