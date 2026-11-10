param([string]$Ws = (Get-Item $PSScriptRoot).Parent.Parent.FullName)
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$targets = @(
  'cars/kenney_racing_pack.zip',
  'cars/unluckystudio_topdown_vehicles.zip',
  'cars/old_cars_pack_48.zip',
  'track/basic_art_racing.zip',
  'sfx/nitro_boost.zip',
  'sfx/crash_breaking_sfx.zip',
  'music/chiptunes_action_5.zip'
)

foreach ($t in $targets) {
  $zip = Join-Path $Ws ('assets\' + ($t -replace '/', '\'))
  if (-not (Test-Path -LiteralPath $zip)) { Write-Output ('MISSING ' + $t); continue }
  $stem = [IO.Path]::GetFileNameWithoutExtension($zip)
  $dir  = Join-Path ([IO.Path]::GetDirectoryName($zip)) $stem
  if (-not (Test-Path -LiteralPath $dir)) {
    try { [IO.Compression.ZipFile]::ExtractToDirectory($zip, $dir) } catch { Write-Output ('EXTRACT_FAIL ' + $t + ' :: ' + $_.Exception.Message); continue }
  }
  Write-Output ('=== ' + $t + ' -> ' + $stem + '/')
  $files = Get-ChildItem -LiteralPath $dir -Recurse -File | Sort-Object Length -Descending
  Write-Output ('    files=' + $files.Count + '  totalKB=' + [math]::Round(($files | Measure-Object Length -Sum).Sum / 1KB))
  $i = 0
  foreach ($f in $files) {
    if ($i -ge 22) { Write-Output ('    ... +' + ($files.Count - $i) + ' more'); break }
    $dim = ''
    if ($f.Extension -match '^\.(png|jpg|jpeg|gif)$') {
      try { $img = [System.Drawing.Image]::FromFile($f.FullName); $dim = $img.Width + 'x' + $img.Height; $img.Dispose() } catch { $dim = '?' }
    }
    $rel = $f.FullName.Substring($dir.Length + 1) -replace '\\', '/'
    Write-Output ('    ' + ('{0,7}' -f [math]::Round($f.Length / 1KB)) + 'KB ' + $dim.PadRight(11) + ' ' + $rel)
    $i++
  }
  Write-Output ''
}
