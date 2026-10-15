#!/bin/bash

set -euo pipefail

cd "$(dirname "$0")/.."

# Publish nitro-core before Nitrogen. React Native packaging is released separately.
bun run release-it "$@"
