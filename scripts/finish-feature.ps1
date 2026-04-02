# ──────────────────────────────────────────────
# finish-feature.ps1 — Merge feature into develop + cleanup (Windows)
# Usage: .\scripts\finish-feature.ps1 <feature-name>
# ──────────────────────────────────────────────
param([string]$FeatureName)

if (-not $FeatureName) {
    Write-Host "❌ Usage: .\scripts\finish-feature.ps1 <feature-name>" -ForegroundColor Red
    exit 1
}

$Branch = "feature/$FeatureName"
$WorktreeDir = ".worktrees/$FeatureName"
$Root = git rev-parse --show-toplevel

Set-Location $Root

# Verify branch exists
git show-ref --verify --quiet "refs/heads/$Branch" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Branch '$Branch' not found." -ForegroundColor Red
    exit 1
}

# Check uncommitted changes
if (Test-Path $WorktreeDir) {
    Set-Location $WorktreeDir
    $status = git status --porcelain
    if ($status) {
        Write-Host "⚠️  Uncommitted changes in worktree. Commit or stash first." -ForegroundColor Yellow
        exit 1
    }
    Set-Location $Root
}

Write-Host "🔀 Merging '$Branch' into 'develop'..." -ForegroundColor Green
git checkout develop
git merge --no-ff $Branch -m "Merge $Branch into develop"

Write-Host "🧹 Cleaning up worktree..." -ForegroundColor Cyan
if (Test-Path $WorktreeDir) {
    git worktree remove $WorktreeDir --force
}

Write-Host "🗑️  Deleting branch '$Branch'..." -ForegroundColor Cyan
git branch -d $Branch

Write-Host ""
Write-Host "✅ Feature '$FeatureName' merged into develop!" -ForegroundColor Green
Write-Host ""
Write-Host "   Next steps:"
Write-Host "   1. Push develop: git push origin develop"
Write-Host "   2. Create PR: develop → main (for production)"
