#!/usr/bin/env bash
# ──────────────────────────────────────────────
# new-feature.sh — Create a feature branch + worktree
# Usage: ./scripts/new-feature.sh <feature-name>
# Example: ./scripts/new-feature.sh upload-system
# ──────────────────────────────────────────────
set -euo pipefail

FEATURE_NAME="${1:-}"
if [ -z "$FEATURE_NAME" ]; then
  echo "❌ Usage: $0 <feature-name>"
  echo "   Example: $0 upload-system"
  exit 1
fi

BRANCH="feature/$FEATURE_NAME"
WORKTREE_DIR=".worktrees/$FEATURE_NAME"
ROOT=$(git rev-parse --show-toplevel)

cd "$ROOT"

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
  echo "⚠️  Branch '$BRANCH' already exists."
  echo "   Use: git worktree add $WORKTREE_DIR $BRANCH"
  exit 1
fi

# Ensure develop branch exists
if ! git show-ref --verify --quiet "refs/heads/develop" 2>/dev/null; then
  echo "📌 Creating 'develop' branch from 'main'..."
  git branch develop main
fi

# Create worktree directory
mkdir -p .worktrees

# Create worktree + branch
echo "🌿 Creating branch '$BRANCH' from 'develop'..."
git worktree add "$WORKTREE_DIR" -b "$BRANCH" develop

# Install dependencies
echo "📦 Installing dependencies..."
cd "$WORKTREE_DIR"
npm install --silent

echo ""
echo "✅ Feature worktree ready!"
echo "   📁 Path:   $ROOT/$WORKTREE_DIR"
echo "   🌿 Branch: $BRANCH"
echo ""
echo "   Next steps:"
echo "   1. cd $WORKTREE_DIR"
echo "   2. Start coding!"
echo "   3. When done: ./scripts/finish-feature.sh $FEATURE_NAME"
