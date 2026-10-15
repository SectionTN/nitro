#!/usr/bin/env bash
set -euo pipefail
cd "${1:?Usage: build-ios.sh <checkout-root> [application-id]}"
bun install --frozen-lockfile
cd apps/benchmark
if [ -f ios/Podfile.lock ]; then
  # Checkouts from before Swift Package Manager (e.g. the base branch) still use CocoaPods.
  bundle install
  bun pods
  cd ios
  project_args=(-workspace NitroBenchmark.xcworkspace)
else
  bunx react-native spm update --yes
  cd ios
  project_args=(-project NitroBenchmark.xcodeproj)
fi
xcodebuild \
  -derivedDataPath build-benchmark \
  "${project_args[@]}" \
  -scheme NitroBenchmark \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  "PRODUCT_BUNDLE_IDENTIFIER=${2:-com.margelo.nitrobenchmark}" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build
