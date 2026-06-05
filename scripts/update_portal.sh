#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

python3 scripts/collect_materials.py

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This folder is not a Git repository yet."
  exit 1
fi

git add content data portal.config.json index.html assets scripts README.md .github .gitignore

if git diff --cached --quiet; then
  echo "No portal changes to publish."
  exit 0
fi

git commit -m "Update personal portal materials"

if git remote get-url origin >/dev/null 2>&1; then
  git push
else
  echo "Committed locally. Add a GitHub remote named origin, then run this script again to publish."
fi

