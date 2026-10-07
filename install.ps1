<#
.SYNOPSIS
  Install, update, or remove the Arabic (RTL) client plugin for the DSH Web GUI.

.DESCRIPTION
  The plugin lives entirely outside the application, in the user profile:

    <DSH_HOME>/profiles/<profile>/plugins/dsh-ar-rtl/     the package
    <DSH_HOME>/profiles/<profile>/cordis.patch.yml        one loader row

  A DSH update replaces the application, never this profile, so the plugin
  survives it. What can break after an update is the *hashed* CSS-module class
  names that the RTL overrides target; -Update re-derives them from the newly
  installed app.asar, rebuilds the bundle, and redeploys it.

  NOTE ON LANGUAGE: this file is deliberately ASCII-only. Windows PowerShell
  5.1 -- the interpreter behind a double-clicked .bat -- reads a script without
  a UTF-8 BOM using the ANSI code page, so Arabic text here would print as
  mojibake. All documentation in this repository is Arabic; the running scripts
  stay English on purpose.

.PARAMETER Uninstall
  Removes the loader row and the installed package.

.PARAMETER Update
  Refreshes hashed selectors from the installed app.asar, rebuilds client.js,
  and redeploys. Run this after a DSH update.

.PARAMETER AsarPath
  Explicit path to the installed app.asar (otherwise auto-detected).

.PARAMETER Profile
  DSH profile name. Default: desktop.

.PARAMETER DshHome
  DSH home directory. Default: $env:DSH_HOME, else %USERPROFILE%\.dsh.

.PARAMETER DryRun
  Show what would happen without writing anything.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install.ps1
  powershell -ExecutionPolicy Bypass -File install.ps1 -Update
  powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [switch]$Uninstall,
  [switch]$Update,
  [string]$DshHome,
  [string]$Profile = 'desktop',
  [string]$AsarPath,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$marker = '@local/dsh-ar-rtl'
$pluginDirName = 'dsh-ar-rtl'

# ---------------------------------------------------------------- locate DSH
if (-not $DshHome) {
  $DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
}
if (-not (Test-Path -LiteralPath $DshHome)) {
  throw "DSH home not found: $DshHome. Pass -DshHome <path> if DSH keeps its state elsewhere."
}

$profilesRoot = Join-Path $DshHome 'profiles'
$profileDir = Join-Path $profilesRoot $Profile
if (-not (Test-Path -LiteralPath $profileDir)) {
  $available = Get-ChildItem -LiteralPath $profilesRoot -Directory -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty Name
  throw "Profile '$Profile' not found under $profilesRoot. Available: $($available -join ', ')"
}

$patchFile = Join-Path $profileDir 'cordis.patch.yml'
$pluginsRoot = Join-Path $profileDir 'plugins'
$target = Join-Path $pluginsRoot $pluginDirName
$rowBlock = @(
  ''
  '# Arabic (RTL) client plugin; package installed beside this patch file.'
  '- insert:'
  '    - id: ar-rtl'
  "      name: './plugins/$pluginDirName/index.js'"
) -join [Environment]::NewLine

function Read-Utf8 {
  param([string]$Path)
  # Explicit encoding: Windows PowerShell 5.1 defaults to the ANSI code page,
  # which would corrupt any non-ASCII character already in the file.
  return [IO.File]::ReadAllText($Path, (New-Object Text.UTF8Encoding($false)))
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Text)
  # Written through .NET on purpose: 5.1's `-Encoding utf8` emits a BOM, and
  # after the first append that BOM would sit in the middle of a YAML file the
  # loader still has to parse.
  [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}

function Resolve-Asar {
  param([string]$Explicit)
  if ($Explicit) {
    if (-not (Test-Path -LiteralPath $Explicit)) { throw "app.asar not found: $Explicit" }
    return (Resolve-Path -LiteralPath $Explicit).Path
  }
  $candidates = @(
    @(
      (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\app.asar'),
      (Join-Path $env:ProgramFiles 'DeepSeek Harness\resources\app.asar'),
      (Join-Path ${env:ProgramFiles(x86)} 'DeepSeek Harness\resources\app.asar'),
      (Join-Path $env:ProgramW6432 'DeepSeek Harness\resources\app.asar')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  )
  if ($candidates.Count -eq 0) { return $null }
  return (Resolve-Path -LiteralPath $candidates[0]).Path
}

function Resolve-Node {
  # @() matters: without it a single surviving candidate is a plain string and
  # $candidates[0] would return its first character.
  $candidates = @(
    @(
      (Join-Path $DshHome 'dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'),
      (Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  )
  if ($candidates.Count -eq 0) { return $null }
  return $candidates[0]
}

function Copy-Package {
  New-Item -ItemType Directory -Force -Path $pluginsRoot | Out-Null
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  foreach ($item in 'package.json', 'index.js', 'client.js', 'README.md', 'src', 'ar', 'tools') {
    $from = Join-Path $source $item
    if (Test-Path -LiteralPath $from) { Copy-Item -LiteralPath $from -Destination $target -Recurse -Force }
  }
  Write-Host "Copied the package to $target"
}

function Add-LoaderRow {
  if (-not (Test-Path -LiteralPath $patchFile)) {
    Write-Utf8NoBom -Path $patchFile -Text ((@(
      '# Your patch layer for this dsh profile: a top-level YAML array of loader patch entries.'
    ) -join [Environment]::NewLine) + [Environment]::NewLine)
    Write-Host "Created $patchFile"
  }
  $text = Read-Utf8 -Path $patchFile
  if ($text -match [regex]::Escape($marker) -or $text -match "plugins/$pluginDirName") {
    Write-Host "Loader row already present in $patchFile"
    return
  }
  if (-not $text.EndsWith([Environment]::NewLine)) { $text += [Environment]::NewLine }
  Write-Utf8NoBom -Path $patchFile -Text ($text + $rowBlock + [Environment]::NewLine)
  Write-Host "Appended the loader row to $patchFile"
}

function Remove-LoaderRow {
  $lines = Read-Utf8 -Path $patchFile -split "`r?`n"
  $kept = New-Object System.Collections.Generic.List[string]
  foreach ($line in $lines) {
    if ($line -match "plugins/$pluginDirName" -or $line -match '^\s*-\s*id:\s*ar-rtl\s*$') {
      while ($kept.Count -gt 0 -and $kept[$kept.Count - 1] -match '^\s*-\s*insert:\s*$') { $kept.RemoveAt($kept.Count - 1) }
      if ($kept.Count -gt 0 -and $kept[$kept.Count - 1] -match '^# Arabic \(RTL\) client plugin') { $kept.RemoveAt($kept.Count - 1) }
      while ($kept.Count -gt 0 -and $kept[$kept.Count - 1].Trim() -eq '') { $kept.RemoveAt($kept.Count - 1) }
      continue
    }
    $kept.Add($line)
  }
  Write-Utf8NoBom -Path $patchFile -Text (($kept -join [Environment]::NewLine) + [Environment]::NewLine)
  Write-Host "Removed the loader row from $patchFile"
}

# ---------------------------------------------------------------- uninstall
if ($Uninstall) {
  if (Test-Path -LiteralPath $patchFile) { Remove-LoaderRow }
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
    Write-Host "Removed $target"
  }
  Write-Host ''
  Write-Host 'Arabic (RTL) plugin removed. Reload http://127.0.0.1:19387 (or restart DSH).'
  return
}

# ---------------------------------------------------------------- update
if ($Update) {
  $node = Resolve-Node
  $asar = Resolve-Asar -Explicit $AsarPath
  if (-not $node) { throw 'Node.js was not found (DSH bundles one under <DSH_HOME>\dsh-runtimes\node).' }
  if (-not $asar) { throw 'app.asar was not found. Pass -AsarPath <full path to app.asar>.' }

  Write-Host '== Refreshing hashed CSS selectors from the installed build'
  & $node (Join-Path $source 'tools\refresh-selectors.mjs') --asar $asar
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Some selectors could not be re-derived (the component changed shape). The rebuild continues; review the lines above.'
  }

  Write-Host '== Rebuilding the client bundle'
  & $node (Join-Path $source 'tools\build-client.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'build-client.mjs failed' }
  & $node (Join-Path $source 'tools\selftest.mjs') | Select-Object -Last 2
  if ($LASTEXITCODE -ne 0) { throw 'selftest.mjs failed' }

  Write-Host '== Redeploying to the profile'
  Copy-Package
  Add-LoaderRow

  Write-Host ''
  Write-Host "Updated in $target"
  Write-Host 'Reload http://127.0.0.1:19387 to pick up the new bundle.'
  return
}

# ---------------------------------------------------------------- install
if (-not (Test-Path -LiteralPath (Join-Path $source 'client.js'))) {
  throw "client.js is missing next to this script. Run 'node tools/build-client.mjs' first."
}

if ($DryRun) {
  Write-Host "dry run: would install to $target and add one row to $patchFile"
  return
}

Write-Host '== Installing the package'
Copy-Package
Write-Host '== Adding the loader row'
Add-LoaderRow

Write-Host ''
Write-Host "Installed to: $target"
Write-Host 'Next: reload http://127.0.0.1:19387 (restart DSH if the language list is unchanged),'
Write-Host 'then open Settings - General - Language and pick the Arabic entry.'
Write-Host ''
Write-Host 'After a DSH update run:  install.bat -Update'
