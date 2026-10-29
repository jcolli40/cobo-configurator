# Usage: powershell -File shots.ps1 -Path "<path + query on the site, e.g. /?size=24x36 or /v2/>" -Name <prefix> [-Base <site root url>]
# Writes <Name>-desktop.png (1440x900) and <Name>-mobile.png (390x844) into the project's screenshots\ folder (git-ignored).
# Phones: headless Edge won't size a window under ~500px, so a 390px-wide iframe page (served by the local preview
# server, same origin) gives a true phone layout, which is then cropped. Each Edge run has a hard 40s limit.
param([string]$Path = '/', [string]$Name = 'shot', [string]$Base = 'http://localhost:8000')
$ErrorActionPreference = 'Continue'
$proj = 'E:\Levitate-creative Dropbox\01_Clients\COBO - Compliance Boards\_Claude\cobo-configurator'
$dir = Join-Path $proj 'screenshots'; New-Item -ItemType Directory -Force $dir | Out-Null
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$prof = Join-Path $env:TEMP 'cobo-shots-edge-profile'

function Shot([string]$size, [string]$file, [string]$url) {
  # a fresh profile per shot: Edge leaves helper processes behind, and a second run on the same profile waits on them
  $prof = Join-Path $env:TEMP ('cobo-shots-edge-profile-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  $args = @('--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', "--user-data-dir=$prof",
            '--virtual-time-budget=6000', "--window-size=$size", "`"--screenshot=$file`"", "`"$url`"")   # quoted: the project path has spaces
  $p = Start-Process -FilePath $edge -ArgumentList $args -PassThru -WindowStyle Hidden
  if (-not $p.WaitForExit(90000)) {
    Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match 'cobo-shots-edge-profile' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    "TIMEOUT: $file"
  }
  Start-Sleep -Milliseconds 500
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match [regex]::Escape($prof) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
}

$url = "$Base$Path"
# desktop also goes through a frame page: loading the local page directly in headless mode can hang
$desk = Join-Path $dir "$Name-desktop.png"
Set-Content -Path (Join-Path $dir 'desk-frame.html') -Encoding utf8 -Value "<!doctype html><html><body style=`"margin:0`"><iframe src=`"$url`" style=`"border:0;width:1440px;height:900px;display:block`"></iframe></body></html>"
Shot '1440,900' $desk "$Base/screenshots/desk-frame.html"

$frame = Join-Path $dir 'phone-frame.html'
Set-Content -Path $frame -Encoding utf8 -Value "<!doctype html><html><body style=`"margin:0;background:#fff`"><iframe src=`"$url`" style=`"border:0;width:390px;height:844px;display:block`"></iframe></body></html>"
$raw = Join-Path $dir "$Name-mobile-raw.png"
Shot '600,844' $raw "$Base/screenshots/phone-frame.html"

if (Test-Path $raw) {
  Add-Type -AssemblyName System.Drawing
  $img = [System.Drawing.Image]::FromFile($raw)
  $crop = New-Object System.Drawing.Bitmap 390, ([Math]::Min(844, $img.Height))
  $g = [System.Drawing.Graphics]::FromImage($crop)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, 390, $crop.Height), (New-Object System.Drawing.Rectangle 0, 0, 390, $crop.Height), [System.Drawing.GraphicsUnit]::Pixel)
  $crop.Save((Join-Path $dir "$Name-mobile.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $crop.Dispose(); $img.Dispose(); Remove-Item $raw
}
Get-ChildItem $dir -Filter "$Name-*.png" | ForEach-Object { "$($_.FullName)  $([math]::Round($_.Length/1KB)) KB" }
