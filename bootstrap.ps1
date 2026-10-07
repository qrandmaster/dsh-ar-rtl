<#
.SYNOPSIS
  One-line installer for the Arabic (RTL) DSH locale plugin.

.DESCRIPTION
  Downloads this repository as an archive, extracts it to a temporary folder, and
  runs its install.ps1. Use it straight from PowerShell:

    irm https://raw.githubusercontent.com/qrandmaster/dsh-ar-rtl/main/bootstrap.ps1 | iex

  Or, to pass parameters, wrap it in a script block:

    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/qrandmaster/dsh-ar-rtl/main/bootstrap.ps1))) -Ref v1.0.5

  The script is deliberately ASCII-only and avoids every non-ASCII character, so
  Windows PowerShell 5.1 (the interpreter behind a double-clicked .bat) reads it
  identically to PowerShell 7.

.PARAMETER Repo
  GitHub repository slug, owner/name.

.PARAMETER Ref
  Branch or tag to install. Default: main.

.PARAMETER KeepFiles
  Keep the extracted folder instead of deleting it afterwards.

.PARAMETER SourceZip
  Install from a local archive (the distributed package or a repository zip)
  instead of downloading. Useful offline and for testing.
#>
[CmdletBinding()]
param(
  [string]$Repo = 'qrandmaster/dsh-ar-rtl',
  [string]$Ref = 'main',
  [switch]$KeepFiles,
  [string]$SourceZip
)

$ErrorActionPreference = 'Stop'

if (-not $SourceZip -and $Repo -notmatch '/') {
  throw "Repository slug must look like owner/name; got '$Repo'. Pass -Repo owner/name."
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
    $downloaded = $false
    foreach ($url in @(
      "https://codeload.github.com/$Repo/zip/refs/heads/$Ref",
      "https://codeload.github.com/$Repo/zip/refs/tags/$Ref"
    )) {
      try {
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        $downloaded = $true
        break
      } catch {
        Write-Host "  could not fetch $url"
      }
    }

    if (-not $downloaded) {
      # Fallback for machines where the HTTP client cannot complete TLS but git
      # can: a shallow clone of the same ref.
      Write-Host 'Falling back to a shallow git clone ...'
      $clone = Join-Path $temp 'clone'
      & git clone --depth 1 --branch $Ref "https://github.com/$Repo.git" $clone
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $clone)) {
        throw 'Download failed and the git fallback did not work either.'
      }
      $extract = $clone
    }
  }

  if (-not (Test-Path -LiteralPath $extract)) {
    Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
  }

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
Write-Host 'Done. Reload the DSH GUI (or restart it), then open Settings - General - Language.'
