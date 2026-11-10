param(
  [string]$Manifest = (Join-Path (Get-Item $PSScriptRoot).Parent.Parent.FullName 'assets\source_manifest.json'),
  [string]$OutPath  = (Join-Path (Get-Item $PSScriptRoot).Parent.Parent.FullName 'assets\credit_report.json')
)

$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

$items = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$pages = @($items | ForEach-Object { $_.page } | Select-Object -Unique)

$out = New-Object System.Collections.Generic.List[object]

foreach ($u in $pages) {
  $rec = [ordered]@{ page = $u; ok = $false; title = ''; author = ''; author_url = ''; licenses = @(); lic_urls = @(); note = '' }
  try {
    $r = Invoke-WebRequest -Uri $u -UserAgent $ua -TimeoutSec 30 -UseBasicParsing
    $html = $r.Content
    $rec.ok = $true

    if ($html -match '(?is)<title>(.*?)</title>') {
      $t = [System.Net.WebUtility]::HtmlDecode($matches[1]).Trim()
      $rec.title = ($t -replace '\s*\|\s*OpenGameArt\.org\s*$', '')
    }

    # AUTHOR: field-name-author-submitter -> username link
    $m = [regex]::Match($html, "(?is)field-name-author-submitter.{0,600}?<a href=`"(/users/[^`"]+)`">([^<]+)</a>")
    if ($m.Success) {
      $rec.author_url = $m.Groups[1].Value
      $rec.author = [System.Net.WebUtility]::HtmlDecode($m.Groups[2].Value).Trim()
    }

    # LICENSES: take a window after the licenses field label (license-icon divs only occur here)
    $licIdx = $html.IndexOf('field-name-field-art-licenses')
    if ($licIdx -ge 0) {
      $block = $html.Substring($licIdx, [Math]::Min(8000, $html.Length - $licIdx))
      foreach ($lm in [regex]::Matches($block, "(?is)<div class='license-icon'>.*?</div></a>")) {
        $b2 = $lm.Value
        $nm = [regex]::Match($b2, "license-name'>([^<]+)<")
        $hr = [regex]::Match($b2, "href='([^']+)'")
        if ($nm.Success) { $rec.licenses += $nm.Groups[1].Value.Trim() }
        if ($hr.Success) { $rec.lic_urls += $hr.Groups[1].Value }
      }
      if (@($rec.licenses).Count -eq 0) {
        foreach ($lm in [regex]::Matches($block, "license_images/([a-zA-Z0-9_\-]+)\.png")) { $rec.licenses += $lm.Groups[1].Value }
      }
      $rec.licenses = @($rec.licenses | Select-Object -Unique)
      $rec.lic_urls = @($rec.lic_urls | Select-Object -Unique)
    }
  }
  catch { $rec.note = $_.Exception.Message }

  $out.Add([pscustomobject]$rec)
  Write-Output ('{0,-5} {1,-22} {2,-26} {3}' -f $(if ($rec.ok) { 'OK' } else { 'FAIL' }), $rec.author, ($rec.licenses -join '/'), $rec.title)
  Start-Sleep -Milliseconds 200
}

$out | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutPath -Encoding UTF8
Write-Output ('WROTE: ' + $OutPath)
