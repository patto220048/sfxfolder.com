#!/usr/bin/env bash
# ──────────────────────────────────────────────
# finish-feature.sh — Merge feature into develop + cleanup
# Usage: ./scripts/finish-feature.sh <feature-name>
# Example: ./scripts/finish-feature.sh upload-system
# ──────────────────────────────────────────────
set -euo pipefail

FEATURE_NAME="${1:-}"
if [ -z "$FEATURE_NAME" ]; then
  echo "❌ Usage: $0 <feature-name>"
  exit 1
fi

BRANCH="feature/$FEATURE_NAME"
WORKTREE_DIR=".worktrees/$FEATURE_NAME"
ROOT=$(git rev-parse --show-toplevel)

cd "$ROOT"

# Verify branch exists
if ! git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
  echo "❌ Branch '$BRANCH' not found."
  exit 1
fi

# Check for uncommitted changes in worktree
if [ -d "$WORKTREE_DIR" ]; then
  cd "$WORKTREE_DIR"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "⚠️  Uncommitted changes in worktree. Commit or stash first."
    exit 1
  fi
  cd "$ROOT"
fi

echo "🔀 Merging '$BRANCH' into 'develop'..."
git checkout develop
git merge --no-ff "$BRANCH" -m "Merge $BRANCH into develop"

echo "🧹 Cleaning up worktree..."
if [ -d "$WORKTREE_DIR" ]; then
  git worktree remove "$WORKTREE_DIR" --force
fi

echo "🗑️  Deleting branch '$BRANCH'..."
git branch -d "$BRANCH"

echo ""
echo "✅ Feature '$FEATURE_NAME' merged into develop!"
echo ""
echo "   Next steps:"
echo "   1. Push develop: git push origin develop"
echo "   2. Create PR: develop → main (for production)"
echo "   3. Or continue developing on develop"
