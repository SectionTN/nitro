#!/bin/bash

set -euo pipefail

cd "$(dirname "$0")/.."

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo 'Usage: bun release VERSION [npm-tag]' >&2
  exit 1
fi
branch=$(git branch --show-current)
if [ "$branch" != main ] && [ "$branch" != core-split ]; then
  echo 'Switch to main or core-split before dispatching a release.' >&2
  exit 1
fi
gh workflow run release.yml --repo margelo/nitro --ref "$branch" \
  -f "source-branch=$branch" -f "version=$1" -f "npm-tag=${2:-}"
