<#
.SYNOPSIS
  One-line installer for the Arabic (RTL) DSH locale plugin.

.DESCRIPTION
  Downloads this repository as a zip, extracts it to a temporary folder, and runs
  its install.ps1. Use it directly from PowerShell:

    irm https://raw.githubusercontent.com/__OWNER__/__REPO__/main/bootstrap.ps1 | iex

  Or with parameters:

    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/__OWNER__/__REPO__/main/bootstrap.ps1))) -Ref v1.0.0

.PARAMETER Repo
  GitHub repository slug, owner/name.

.PARAMETER Ref
  Branch or tag to install. Default: main.

.PARAMETER KeepFiles
  Keep the extracted folder instead of deleting it afterwards.

.PARAMETER SourceZip
  Install straight from a local zip (the distributed package or a repository
  archive) instead of downloading. Useful for offline machines and for testing
  the bootstrap without publishing.
#>
[CmdletBinding()]
param(
  [string]$Repo = '__OWNER__/__REPO__',
  [string]$Ref = 'main',
  [switch]$KeepFiles,
  [string]$SourceZip
)

$ErrorActionPreference = 'Stop'

if (-not $SourceZip -and $Repo -like '__*__*') {
  throw "This bootstrap is not configured yet: replace the __OWNER__/__REPO__ placeholder with the real repository slug (run scripts/publish.ps1), or pass -Repo owner/name."
}

$temp = Join-Path $env:TEMP ("dsh-ar-rtl-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$zip = Join-Path $temp 'source.zip'
$extract = Join-Path $temp 'source'

New-Item -ItemType Directory -Force -Path $temp | Out-Null

try {
  if ($SourceZip) {
    if (-not (Test-Path -LiteralPath $SourceZip)) { throw "SourceZip not found: $SourceZip" }
    Copy-Item -LiteralPath $SourceZip -Destination $zip -Force
    Write-Host "Using local archive $SourceZip"
  } else {
    Write-Host "Downloading $Repo ($Ref) ..."
    $url = "https://codeload.github.com/$Repo/zip/refs/heads/$Ref"
    try {
      Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    } catch {
      # A tag (not a branch) lives under a different codeload path.
      $url = "https://codeload.github.com/$Repo/zip/refs/tags/$Ref"
      Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    }
  }

  Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force

  $installer = Get-ChildItem -LiteralPath $extract -Recurse -Filter 'install.ps1' |
    Select-Object -First 1
  if (-not $installer) { throw 'install.ps1 was not found inside the downloaded archive.' }

  Write-Host "Running $($installer.FullName)"
  & $installer.FullName
  if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { throw "install.ps1 exited with $LASTEXITCODE" }
} finally {
  if ($KeepFiles) {
    Write-Host "Files kept in $temp"
  } else {
    Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ''
Write-Host 'Done. Reload the DSH GUI (or restart it) and choose Settings -> General -> Language -> العربية.'
