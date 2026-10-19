#!/bin/bash

# Do not exit on errors
set +e

cd "$(pwd)" || exit 0

# Run commands and ignore any errors
{
  # Install JS lockfiles
  bun i
  bun run build

  # Resolve app Swift packages
  for app in example benchmark; do
    project=NitroExample
    if [ "$app" = benchmark ]; then project=NitroBenchmark; fi
    bun "$app" spm
    xcodebuild -resolvePackageDependencies \
      -project "tests/react-native/apps/$app/ios/$project.xcodeproj" \
      -scheme "$project"
  done

  # Add everything to git
  git add bun.lock Package.resolved tests/react-native/apps/*/ios/*.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
} || true

# No errors - whatever.
exit 0
