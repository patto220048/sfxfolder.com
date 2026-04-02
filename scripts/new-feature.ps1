# ──────────────────────────────────────────────
# new-feature.ps1 — Create a feature branch + worktree (Windows)
# Usage: .\scripts\new-feature.ps1 <feature-name>
# ──────────────────────────────────────────────
param([string]$FeatureName)

if (-not $FeatureName) {
    Write-Host "❌ Usage: .\scripts\new-feature.ps1 <feature-name>" -ForegroundColor Red
    Write-Host "   Example: .\scripts\new-feature.ps1 upload-system"
    exit 1
}

$Branch = "feature/$FeatureName"
$WorktreeDir = ".worktrees/$FeatureName"
$Root = git rev-parse --show-toplevel

Set-Location $Root

# Check if branch exists
$branchExists = git show-ref --verify --quiet "refs/heads/$Branch" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "⚠️  Branch '$Branch' already exists." -ForegroundColor Yellow
    exit 1
}

# Ensure develop exists
$devExists = git show-ref --verify --quiet "refs/heads/develop" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "📌 Creating 'develop' branch from 'main'..." -ForegroundColor Cyan
    git branch develop main
}

# Create worktree
New-Item -ItemType Directory -Force -Path ".worktrees" | Out-Null

Write-Host "🌿 Creating branch '$Branch' from 'develop'..." -ForegroundColor Green
git worktree add $WorktreeDir -b $Branch develop

Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
Set-Location $WorktreeDir
npm install --silent

Write-Host ""
Write-Host "✅ Feature worktree ready!" -ForegroundColor Green
Write-Host "   📁 Path:   $Root/$WorktreeDir"
Write-Host "   🌿 Branch: $Branch"
Write-Host ""
Write-Host "   Next steps:"
Write-Host "   1. cd $WorktreeDir"
Write-Host "   2. Start coding!"
Write-Host "   3. When done: .\scripts\finish-feature.ps1 $FeatureName"
