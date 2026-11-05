# Downloads the pinned PocketBase version for local development and verifies its checksum.
# Read the release notes before changing the version: PocketBase is pre-1.0.
$ErrorActionPreference = 'Stop'
$Version = '0.40.6'

$Root = Split-Path -Parent $PSScriptRoot
$Target = Join-Path $Root 'pocketbase'
$Exe = Join-Path $Target 'pocketbase.exe'
$Zip = "pocketbase_${Version}_windows_amd64.zip"
$Base = "https://github.com/pocketbase/pocketbase/releases/download/v$Version"

$Temp = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $Temp | Out-Null
try {
    $ZipPath = Join-Path $Temp $Zip
    $ChecksumPath = Join-Path $Temp 'checksums.txt'
    Invoke-WebRequest -UseBasicParsing -Uri "$Base/$Zip" -OutFile $ZipPath
    Invoke-WebRequest -UseBasicParsing -Uri "$Base/checksums.txt" -OutFile $ChecksumPath

    $Line = Get-Content $ChecksumPath | Where-Object { $_ -match "\s\*?$([regex]::Escape($Zip))$" } | Select-Object -First 1
    if (-not $Line) { throw "No checksum listed for $Zip" }
    $Expected = ($Line -split '\s+')[0]
    $Actual = (Get-FileHash -Algorithm SHA256 $ZipPath).Hash
    if ($Actual -ine $Expected) { throw "Checksum mismatch for $Zip" }

    $Extracted = Join-Path $Temp 'extracted'
    Expand-Archive -Path $ZipPath -DestinationPath $Extracted
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    Copy-Item (Join-Path $Extracted 'pocketbase.exe') $Exe -Force
    Write-Output "PocketBase $Version installed and checksum verified: $Exe"
}
finally {
    Remove-Item -Recurse -Force $Temp
}
