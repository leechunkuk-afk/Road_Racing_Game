param([string]$Ws = (Get-Item $PSScriptRoot).Parent.Parent.FullName)
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Drawing

$A = Join-Path $Ws 'assets'
$S = Join-Path $A 'source'
$G = Join-Path $A 'game'
foreach ($d in @('bg', 'cars', 'props', 'sfx', 'music', 'atlas')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $G $d) | Out-Null
}
# 잘못된 중첩 폴더가 남아있으면 제거
$bad = Join-Path $G 'game'
if (Test-Path -LiteralPath $bad) { Remove-Item -LiteralPath $bad -Recurse -Force }

function Resize-Image([string]$srcRel, [string]$dstRel, [int]$maxW, [int]$maxH, [bool]$jpeg, [bool]$nearest) {
  $src = Join-Path $S ($srcRel -replace '/', '\')
  $dst = Join-Path $G ($dstRel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $src)) { Write-Output ('MISS  ' + $srcRel); return }
  $img = [System.Drawing.Image]::FromFile($src)
  $w = $img.Width; $h = $img.Height
  $sc = [Math]::Min($maxW / $w, $maxH / $h)
  if ($sc -gt 1) { $sc = 1 }
  $nw = [int][Math]::Round($w * $sc); $nh = [int][Math]::Round($h * $sc)
  $bmp = New-Object System.Drawing.Bitmap($nw, $nh, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  if ($nearest) { $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor }
  else {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  }
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $g.Dispose(); $img.Dispose()
  if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
  if ($jpeg) { $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Jpeg) } else { $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png) }
  $bmp.Dispose()
  Write-Output ('{0,7}KB {1,5}x{2,-5} {3}' -f [math]::Round((Get-Item -LiteralPath $dst).Length / 1KB), $nw, $nh, $dstRel)
}

function Copy-Asset([string]$srcRel, [string]$dstRel) {
  $src = Join-Path $S ($srcRel -replace '/', '\')
  $dst = Join-Path $G ($dstRel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $src)) { Write-Output ('MISS  ' + $srcRel); return }
  if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
  Copy-Item -LiteralPath $src -Destination $dst -Force
  Write-Output ('{0,7}KB copy     {1}' -f [math]::Round((Get-Item -LiteralPath $dst).Length / 1KB), $dstRel)
}

Write-Output '--- BG ---'
Copy-Asset 'backgrounds/parallax_night_sky.png'    'bg/px_sky.png'
Copy-Asset 'backgrounds/parallax_night_far.png'    'bg/px_far.png'
Copy-Asset 'backgrounds/parallax_night_mid.png'    'bg/px_mid.png'
Copy-Asset 'backgrounds/parallax_night_close.png'  'bg/px_close.png'
Copy-Asset 'backgrounds/parallax_night_carsfar.png'   'bg/px_cars_far.png'
Copy-Asset 'backgrounds/parallax_night_carsclose.png' 'bg/px_cars_close.png'
Resize-Image 'backgrounds/city_night_full.png' 'bg/photo_city_night.jpg' 1600 1000 $true $false
Resize-Image 'backgrounds/night_fullmoon_bg.png' 'bg/photo_fullmoon.jpg' 1400 900 $true $false
Resize-Image 'backgrounds/pixel_night_city.png' 'bg/pixel_city_wide.png' 1100 700 $false $true

Write-Output '--- CARS ---'
$unl = 'cars/unluckystudio_topdown_vehicles/Topdown_vehicle_sprites_pack'
foreach ($n in @('Audi', 'Black_viper', 'Car', 'taxi', 'truck', 'Mini_van', 'Mini_truck', 'Police')) {
  Resize-Image ($unl + '/' + $n + '.png') ('cars/td_' + $n.ToLower() + '.png') 128 128 $false $false
}
Resize-Image 'cars/cars_2d_topdown_sheet.png' 'cars/td_sheet_gameassets.png' 384 128 $false $false
Resize-Image 'cars/police_car_topdown.png' 'cars/td_police_pixel.png' 96 96 $false $true
foreach ($n in @('10', '16', '27', '33', '40')) {
  Resize-Image ('cars/old_cars_pack_48/Cars-04-' + $n + '.png') ('cars/old_' + $n + '.png') 112 112 $false $false
}

Write-Output '--- ATLAS ---'
foreach ($n in @('spritesheet_vehicles', 'spritesheet_objects', 'spritesheet_characters')) {
  Copy-Asset ('cars/kenney_racing_pack/Spritesheets/' + $n + '.png') ('atlas/kenney_' + $n + '.png')
  Copy-Asset ('cars/kenney_racing_pack/Spritesheets/' + $n + '.xml') ('atlas/kenney_' + $n + '.xml')
}

Write-Output '--- PROPS ---'
Copy-Asset 'props/streetlight_anim.gif' 'props/streetlight_anim.gif'

Write-Output '--- SFX ---'
foreach ($n in @('engine_loop_1', 'engine_loop_2', 'engine_loop_3', 'engine_start')) {
  Copy-Asset ('sfx/' + $n + '.wav') ('sfx/' + $n + '.wav')
}
foreach ($n in @('boost-start', 'boost-loop', 'boost-end')) {
  Copy-Asset ('sfx/nitro_boost/boost-ogg/' + $n + '.ogg') ('sfx/' + $n + '.ogg')
}
foreach ($n in @('bfh1_hit_02', 'bfh1_metal_falling_01', 'bfh1_breaking_01', 'bfh1_glass_breaking_03', 'bfh1_rock_breaking_01', 'bfh1_misc_06')) {
  Copy-Asset ('sfx/crash_breaking_sfx/' + $n + '.ogg') ('sfx/crash_' + $n + '.ogg')
}

$total = (Get-ChildItem -LiteralPath $G -Recurse -File | Measure-Object Length -Sum).Sum
Write-Output ('GAME_ASSETS_KB=' + [math]::Round($total / 1KB) + '  COUNT=' + (Get-ChildItem -LiteralPath $G -Recurse -File).Count)
