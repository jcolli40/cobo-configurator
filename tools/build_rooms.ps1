# Room photos for v5's Environment option: "_Web Configurator/generated backgrounds" -> img/rooms/<id>.jpg + <id>-t.jpg
# Uses the upscaled copy in the "upscaled" subfolder when there is one (any file whose name starts with the original's).
# Photos are shrunk to at most 4096 px wide (larger won't show on many phones). Room ids/placement: ENVIRONMENTS in js/config.js.
# Run:  powershell -ExecutionPolicy Bypass -File tools\build_rooms.ps1          (add -Only brick-cafe,rustic-wood for some)
param([string[]]$Only = @())
$Only = @($Only | ForEach-Object { $_ -split ',' } | Where-Object { $_ })   # (-File passes "a,b" as one string)
Add-Type -AssemblyName System.Drawing
$src = 'E:\Levitate-creative Dropbox\01_Clients\COBO - Compliance Boards\_Web Configurator\generated backgrounds'
$dst = Join-Path $PSScriptRoot '..\img\rooms'
$map = [ordered]@{
  'Elegant Warm Dining Room' = 'elegant-dining';             'Industrial Cafe with Exposed Brick Wall' = 'brick-cafe'
  'Luxurious Walnut Steakhouse Interior' = 'walnut-steakhouse'; 'Modern Café with Tiled Feature Wall' = 'white-tile-cafe'
  'Modern Industrial Café Interior' = 'concrete-loft';        'Moody Green Lounge with Brass Accents' = 'green-lounge'
  'Moody Luxury Dining Room Backdrop' = 'moody-dining';       'Retro Mint-Tile Diner Interior' = 'retro-diner'
  'Sunlit Coastal Café with Textured Wall' = 'coastal-cafe';  'Symmetrical Stainless Kitchen Backdrop' = 'steel-kitchen'
  'Warm Mediterranean Café Interior' = 'mediterranean-cafe';  'Warm Minimalist Japanese-Scandinavian Café' = 'slat-wood-cafe'
  'Warm Modern Café Interior with Blank Feature Wall' = 'modern-cafe'; 'Warm Rustic Café Wood Wall' = 'rustic-wood'
}
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
function Save-Jpg($bmp, $path, $q) {
  $p = New-Object System.Drawing.Imaging.EncoderParameters 1
  $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$q)
  $bmp.Save($path, $enc, $p)
}
function Resized($img, $w, $h) {
  $b = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
  $attr = New-Object System.Drawing.Imaging.ImageAttributes; $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)   # no dark edge
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $g.Dispose(); return $b
}
foreach ($name in $map.Keys) {
  $id = $map[$name]
  if ($Only.Count -and $Only -notcontains $id) { continue }
  $up = Get-ChildItem (Join-Path $src 'upscaled') -File -ErrorAction SilentlyContinue | Where-Object { $_.Name.StartsWith($name) } | Select-Object -First 1
  $file = if ($up) { $up.FullName } else { Join-Path $src "$name.png" }
  if (-not (Test-Path $file)) { "MISSING: $name"; continue }
  $img = [System.Drawing.Image]::FromFile($file)
  $w = [Math]::Min(4096, $img.Width * 2); $h = [int][Math]::Round($w * $img.Height / $img.Width)   # originals get a smooth 2x
  $big = Resized $img $w $h; Save-Jpg $big (Join-Path $dst "$id.jpg") 85; $big.Dispose()
  $t = Resized $img 240 ([int][Math]::Round(240 * $img.Height / $img.Width)); Save-Jpg $t (Join-Path $dst "$id-t.jpg") 80; $t.Dispose()
  '{0,-20} {1,-9} {2}x{3}  {4} KB' -f $id, $(if ($up) { 'upscaled' } else { 'original' }), $w, $h, [int]((Get-Item (Join-Path $dst "$id.jpg")).Length / 1KB)
  $img.Dispose()
}
