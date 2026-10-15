#!/bin/bash

set -euo pipefail

cd "$(dirname "$0")/.."

# The workspaces plugin is restricted to packages/nitrogen in package.json.
bun run release-it "$@"
