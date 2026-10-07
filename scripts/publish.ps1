<#
.SYNOPSIS
  Prepare this folder as a GitHub repository and optionally push it.

.DESCRIPTION
  Fills the repository placeholders (__OWNER__/__REPO__ in bootstrap.ps1 and
  README.md, __YEAR__/__AUTHOR__ in LICENSE), initialises git if needed, commits
  everything with your identity, points `origin` at the new repository and, with
  -Push, pushes it.

  Create the empty repository on GitHub first (no README, no licence), then run:

    powershell -ExecutionPolicy Bypass -File scripts\publish.ps1 -Owner you -Repo dsh-ar-rtl -Push

  NOTE ON LANGUAGE: this file is deliberately ASCII-only, like install.ps1 and
  the .bat wrappers. Windows PowerShell 5.1 reads a script without a UTF-8 BOM
  using the ANSI code page, so Arabic text here would print as mojibake. All
  documentation in this repository is Arabic; the running scripts stay English
  on purpose.

.PARAMETER Owner
  GitHub user or organisation that owns the new repository.

.PARAMETER Repo
  Repository name.

.PARAMETER Author
  Name recorded in LICENSE and in the git identity. Defaults to -Owner.

.PARAMETER AuthorEmail
  Email recorded in the git identity. Defaults to the GitHub noreply address.

.PARAMETER Ref
  Branch name to publish. Default: main.

.PARAMETER Message
  Commit message for the release commit.

.PARAMETER Push
  Push to origin after committing.

.PARAMETER DryRun
  Show what would change without writing anything.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Owner,
  [Parameter(Mandatory)][string]$Repo,
  [string]$Author,
  [string]$AuthorEmail,
  [string]$Ref = 'main',
  [string]$Message = 'Release: Arabic (RTL) locale and layout fixes for the DSH Web GUI',
  [switch]$Push,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Author) { $Author = $Owner }
if (-not $AuthorEmail) { $AuthorEmail = "$Owner@users.noreply.github.com" }
$slug = "$Owner/$Repo"
$year = (Get-Date).Year

function Set-Placeholders {
  param([string]$RelativePath)
  $path = Join-Path $root $RelativePath
  if (-not (Test-Path -LiteralPath $path)) { Write-Host "skip (missing): $RelativePath"; return }
  # Explicit UTF-8 through .NET: Windows PowerShell 5.1 reads and writes with the
  # ANSI code page by default, which silently turns every Arabic character in
  # README.md into mojibake. That happened once; never again.
  $utf8 = New-Object Text.UTF8Encoding($false)
  $original = [IO.File]::ReadAllText($path, $utf8)
  $updated = $original.
    Replace('__OWNER__/__REPO__', $slug).
    Replace('__YEAR__', "$year").
    Replace('__AUTHOR__', $Author)
  if ($updated -eq $original) {
    Write-Host "unchanged: $RelativePath"
    return
  }
  if ($DryRun) { Write-Host "would update: $RelativePath"; return }
  [IO.File]::WriteAllText($path, $updated, $utf8)
  Write-Host "updated: $RelativePath"
}

Write-Host "Repository: $slug   branch: $Ref   author: $Author <$AuthorEmail>"
Set-Placeholders 'bootstrap.ps1'
Set-Placeholders 'README.md'
Set-Placeholders 'LICENSE'

if ($DryRun) { Write-Host "`ndry run: git steps skipped"; return }

# ---------------------------------------------------------------- git
$gitDir = Join-Path $root '.git'
if (-not (Test-Path -LiteralPath $gitDir)) {
  Write-Host '== git init'
  & git -C $root init --initial-branch=$Ref
}

& git -C $root config user.name $Author
& git -C $root config user.email $AuthorEmail

Write-Host '== staging'
& git -C $root add -A

$staged = & git -C $root diff --cached --name-only
if (-not $staged) {
  # Nothing new to stage: re-author the existing commit so LICENSE/git identity
  # match the owner given here instead of the placeholder used before publishing.
  $hasCommit = & git -C $root rev-parse --verify HEAD 2>$null
  if ($hasCommit) {
    Write-Host '== re-authoring the existing commit'
    & git -C $root commit --amend --reset-author --no-edit
  } else {
    Write-Host 'nothing staged and no commit yet; skipping'
  }
} else {
  Write-Host '== commit'
  & git -C $root commit -m $Message
}

# `git remote` lists quietly when there is none, whereas `git remote get-url`
# writes to stderr and, with $ErrorActionPreference = 'Stop', aborts the script
# on a fresh repository with no remote yet.
$remotes = @(& git -C $root remote)
if ($remotes -contains 'origin') {
  Write-Host "== origin already set: $(& git -C $root remote get-url origin)"
} else {
  Write-Host '== adding origin'
  & git -C $root remote add origin "https://github.com/$slug.git"
}

if (-not $Push) {
  Write-Host ''
  Write-Host 'Committed locally. To publish:'
  Write-Host "  git -C `"$root`" push -u origin $Ref"
  return
}

Write-Host '== push'
try {
  & git -C $root push -u origin $Ref
} catch {
  Write-Warning "push failed: $($_.Exception.Message)"
  Write-Host 'Retrying with the OpenSSL TLS backend (some Windows builds mishandle schannel here)...'
  & git -C $root -c http.sslBackend=openssl push -u origin $Ref
}

Write-Host ''
Write-Host "Published. One-line install for anyone:"
Write-Host "  irm https://raw.githubusercontent.com/$slug/$Ref/bootstrap.ps1 | iex"
