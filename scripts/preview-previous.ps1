param(
    [string] $Destination
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tag = 'backup/pre-ux-redesign-2026-11-15'
$tagRef = "refs/tags/$tag"
$commit = '0cf92c61b26932662885d3bdab762f760ec08cb3'

if (-not $Destination) {
    $Destination = Join-Path (Split-Path -Parent $repoRoot) 'PUSH-vor-umbau'
}
$Destination = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Destination)
if (Test-Path -LiteralPath $Destination) {
    throw "Der Zielordner existiert bereits. Waehle mit -Destination einen neuen Ordner."
}

$backupCommit = git -C $repoRoot rev-parse --verify --quiet ($tagRef + '^{}')
if ($LASTEXITCODE -ne 0) {
    git -C $repoRoot fetch origin ($tagRef + ':' + $tagRef)
    if ($LASTEXITCODE -ne 0) { throw "Der Backup-Tag konnte nicht geladen werden." }
    $backupCommit = git -C $repoRoot rev-parse --verify --quiet ($tagRef + '^{}')
}
if ($backupCommit -ne $commit) {
    throw "Der Backup-Tag zeigt auf einen unerwarteten Commit."
}

git -C $repoRoot worktree add --detach -- $Destination $backupCommit
if ($LASTEXITCODE -ne 0) { throw "Die Vorversion konnte nicht ausgecheckt werden." }

Write-Output "PUSH vor dem Umbau in $Destination ($backupCommit)"
