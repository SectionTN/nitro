# $$packageName$$ is built with Swift Package Manager (see Package.swift), not CocoaPods.
#
# This file only exists because @react-native-community/cli autolinks iOS dependencies
# only if they ship a podspec. React Native's SwiftPM autolinking (`npx react-native spm`)
# then uses Package.swift instead.
raise "$$packageName$$ requires Swift Package Manager and does not support CocoaPods. " \
      "Migrate your app to Swift Package Manager by running `npx react-native spm`."
