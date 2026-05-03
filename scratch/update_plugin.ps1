$src = "f:\re-src-web\plugins\premiere\*"
$dest = "$env:APPDATA\Adobe\CEP\extensions\com.resrc.premiere"
if (Test-Path $dest) { Remove-Item -Path $dest -Recurse -Force }
New-Item -Path $dest -ItemType Directory -Force
Copy-Item -Path $src -Destination $dest -Recurse -Force
Write-Host "Update successful"
