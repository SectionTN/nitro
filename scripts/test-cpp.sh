#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TEST_DIRECTORY=$(mktemp -d)
trap 'rm -rf "$TEST_DIRECTORY"' EXIT

# These tests use ASan's live-allocation counter to catch retained bookkeeping
# that is still reachable and therefore is not reported as a leak at process exit.
for TEST_SOURCE in "$REPOSITORY_ROOT"/tests/cpp/*Test.cpp; do
  "${CXX:-clang++}" -std=c++20 -O1 -g \
    -Wall -Wextra -Wpedantic -Wno-nullability-extension \
    -fsanitize=address,undefined -fno-omit-frame-pointer -pthread \
    -I "$REPOSITORY_ROOT/packages/react-native-nitro-modules/cpp/utils" \
    "$TEST_SOURCE" \
    "$REPOSITORY_ROOT/packages/react-native-nitro-modules/cpp/utils/NitroTypeInfo.cpp" \
    -o "$TEST_DIRECTORY/native-test"
  "$TEST_DIRECTORY/native-test"
done
