# Nitro Modules does not support CocoaPods anymore - it is built with Swift Package Manager (see Package.swift).
#
# This file only exists because @react-native-community/cli autolinks iOS dependencies
# only if they ship a podspec. React Native's SwiftPM autolinking (`npx react-native spm`)
# then uses Package.swift instead.
raise "react-native-nitro-modules requires Swift Package Manager and no longer supports CocoaPods. " \
      "Migrate your app to Swift Package Manager by running `npx react-native spm` (React Native 0.87+)."
