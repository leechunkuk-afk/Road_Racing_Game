param([string]$Ws = (Get-Item $PSScriptRoot).Parent.Parent.FullName)
Add-Type -AssemblyName System.Drawing
$loose = @(
 'backgrounds/parallax_night_sky.png','backgrounds/parallax_night_far.png','backgrounds/parallax_night_mid.png',
 'backgrounds/parallax_night_close.png','backgrounds/parallax_night_carsfar.png','backgrounds/parallax_night_carsclose.png',
 'backgrounds/city_night_full.png','backgrounds/night_fullmoon_bg.png','backgrounds/pixel_night_city.png',
 'cars/cars_2d_topdown_sheet.png','cars/car_pixelart_topdown.png','cars/police_car_topdown.png',
 'track/track_tiles_2.png','track/racetrack_tiles_192.png','track/highway_topdown_seamless.png',
 'props/streetlight_anim.gif',
 'cars/kenney_racing_pack/Spritesheets/spritesheet_vehicles.png',
 'cars/kenney_racing_pack/Spritesheets/spritesheet_objects.png',
 'cars/kenney_racing_pack/Spritesheets/spritesheet_tiles.png',
 'cars/kenney_racing_pack/Spritesheets/spritesheet_characters.png',
 'cars/unluckystudio_topdown_vehicles/Topdown_vehicle_sprites_pack/Audi.png',
 'cars/unluckystudio_topdown_vehicles/Topdown_vehicle_sprites_pack/Black_viper.png',
 'cars/unluckystudio_topdown_vehicles/Topdown_vehicle_sprites_pack/Police.png',
 'cars/unluckystudio_topdown_vehicles/Topdown_vehicle_sprites_pack/truck.png',
 'cars/old_cars_pack_48/Cars-04-27.png'
)
foreach ($l in $loose) {
  $p = Join-Path $Ws ('assets\' + ($l -replace '/', '\'))
  if (-not (Test-Path -LiteralPath $p)) { Write-Output ('MISSING ' + $l); continue }
  $kb = [math]::Round((Get-Item -LiteralPath $p).Length / 1KB)
  $dim = '?'
  try { $img = [System.Drawing.Image]::FromFile($p); $dim = $img.Width.ToString() + 'x' + $img.Height; $img.Dispose() } catch { $dim = 'ERR' }
  Write-Output ('{0,7}KB  {1,-12} {2}' -f $kb, $dim, $l)
}
Write-Output '--- audio probe ---'
foreach ($a in @('sfx/engine_loop_1.wav','sfx/engine_start.wav','music/night_runner.mp3','music/race_loop.mp3','music/death_of_hope.mp3')) {
  $p = Join-Path $Ws ('assets\' + ($a -replace '/', '\'))
  if (Test-Path -LiteralPath $p) { Write-Output ('{0,8}KB  {1}' -f [math]::Round((Get-Item -LiteralPath $p).Length/1KB), $a) }
}
Write-Output '--- tools ---'
foreach ($t in @('ffmpeg','ffprobe','magick','node','python')) {
  $c = Get-Command $t -ErrorAction SilentlyContinue
  Write-Output ($t + '=' + $(if ($c) { $c.Source } else { 'absent' }))
}
