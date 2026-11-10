param(
  [string]$ListPath = (Join-Path $PSScriptRoot 'oga_candidates.json'),
  [string]$OutPath  = (Join-Path $PSScriptRoot 'out_harvest.json')
)

$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

$urls = (Get-Content -LiteralPath $ListPath -Raw -Encoding UTF8 | ConvertFrom-Json)
$badPat = '(?i)(/sites/default/files/(css|js|styles|license_images|comment_type_images|pictures|audio_preview)/|sara-logo|package-x-generic|/files/js/|/files/css/)'
$results = New-Object System.Collections.Generic.List[object]

foreach ($u in $urls) {
  $item = [ordered]@{ url = $u; ok = $false; title = ''; author = ''; licenses = ''; desc = ''; files = @(); note = '' }
  try {
    $r = Invoke-WebRequest -Uri $u -UserAgent $ua -TimeoutSec 30 -UseBasicParsing
    $html = $r.Content
    $item.ok = $true

    if ($html -match '(?is)<title>(.*?)</title>') {
      $t = [System.Net.WebUtility]::HtmlDecode($matches[1]).Trim()
      $item.title = ($t -replace '\s*\|\s*OpenGameArt\.org\s*$', '')
    }
    $lics = @()
    foreach ($m in [regex]::Matches($html, "license-name'>([^<]+)<")) { $lics += $m.Groups[1].Value.Trim() }
    foreach ($m in [regex]::Matches($html, 'license_images/([a-zA-Z0-9_\-]+)\.png')) { $lics += $m.Groups[1].Value }
    $item.licenses = (($lics | Where-Object { $_ } | Select-Object -Unique) -join ', ')

    foreach ($m in [regex]::Matches($html, '(?i)<a href="(/users/[a-zA-Z0-9_\-\.\%]+)"[^>]*>([^<]{2,40})</a>')) {
      $item.author = $m.Groups[2].Value.Trim(); break
    }
    if ($html -match '(?is)<meta property="og:description" content="([^"]{0,400})"') {
      $item.desc = [System.Net.WebUtility]::HtmlDecode($matches[1]).Trim()
    }

    foreach ($m in [regex]::Matches($html, '(?i)href="(https?://opengameart\.org/sites/default/files/[^"\x27]+?\.(?:png|jpg|jpeg|gif|webp|svg|ogg|mp3|wav|zip|txt))"')) {
      $cand = $m.Groups[1].Value
      if ([regex]::IsMatch($cand, $badPat)) { continue }
      $item.files += $cand
    }
    $item.files = @($item.files | Select-Object -Unique)
  }
  catch {
    $item.note = $_.Exception.Message
  }
  $results.Add([pscustomobject]$item)
  Write-Output ("{0,-5} nfiles={1,-3} lic={2,-28} {3}" -f $(if ($item.ok) { 'OK' } else { 'FAIL' }), @($item.files).Count, $item.licenses, $item.title)
  Start-Sleep -Milliseconds 200
}

$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutPath -Encoding UTF8
Write-Output ("REPORT: " + $OutPath)
