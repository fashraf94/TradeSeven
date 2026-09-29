param(
  [string]$EvidenceRoot = (Join-Path $env:USERPROFILE 'FantasyTrades-Test-Evidence')
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('ft-tester-' + [guid]::NewGuid().ToString('N'))
$output = Join-Path $EvidenceRoot ('BACKING-OFFLINE-001-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$commit = $null

function Write-Blocked([string]$reason) {
  New-Item -ItemType Directory -Force -Path $output | Out-Null
  $now = (Get-Date).ToUniversalTime().ToString('o')
  @{ missionId = 'BACKING-OFFLINE-001'; outcome = 'BLOCKED'; reason = $reason
     sourceCommit = $commit; startedAt = $now; finishedAt = $now
     durationMs = 0; command = @('docker run'); testFiles = @('scripts/backingSmokeLib.test.js', 'api/_utils/backingSmoke.test.js')
     exitCode = $null; testsPassed = $null; testFilesPassed = $null; logPath = 'run.log' } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $output 'result.json') -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $output 'run.log') -Value $reason -Encoding UTF8
  Write-Host "BACKING-OFFLINE-001: BLOCKED ($reason)"
  Write-Host "Evidence: $output"
}

try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is missing' }
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is missing' }
  $commit = (git -C $repoRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[0-9a-f]{40}$') { throw 'Cannot identify the source commit' }
  $changes = git -C $repoRoot status --porcelain=v1 --untracked-files=all
  if ($LASTEXITCODE -ne 0) { throw 'Cannot check the working tree' }
  if ($changes) { throw 'Working tree has uncommitted changes. Commit the test package first' }

  New-Item -ItemType Directory -Force -Path $tempRoot, $output | Out-Null
  $archive = Join-Path $tempRoot 'source.zip'
  $buildDir = Join-Path $tempRoot 'source'
  git -C $repoRoot archive --format=zip "--output=$archive" $commit
  if ($LASTEXITCODE -ne 0) { throw 'Git archive failed' }
  Expand-Archive -LiteralPath $archive -DestinationPath $buildDir

  $image = 'fantasytrades-tester:' + $commit.Substring(0, 12)
  docker build --tag $image --file (Join-Path $buildDir 'tester/Dockerfile') $buildDir
  if ($LASTEXITCODE -ne 0) { throw 'Docker image build failed' }

  docker run --rm --network none --read-only --cap-drop ALL `
    --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 2 `
    --user 1000:1000 `
    --tmpfs /tmp:rw,nosuid,nodev,size=128m,uid=1000,gid=1000 `
    --tmpfs /app/node_modules/.vite:rw,nosuid,nodev,size=64m,uid=1000,gid=1000 `
    --tmpfs /app/node_modules/.vite-temp:rw,nosuid,nodev,size=64m,uid=1000,gid=1000 `
    --mount "type=bind,source=$output,target=/evidence" `
    $image --output /evidence --commit $commit
  $runExit = $LASTEXITCODE
  if (-not (Test-Path -LiteralPath (Join-Path $output 'result.json'))) {
    throw "Docker run failed before the tester wrote evidence (exit $runExit)"
  }
  Write-Host "Evidence: $output"
  exit $runExit
} catch {
  Write-Blocked $_.Exception.Message
  exit 2
} finally {
  if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
