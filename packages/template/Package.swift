// swift-tools-version: 6.2

import PackageDescription

let package = Package(
  name: "$$iosModuleName$$",
  platforms: [.iOS(.v16)]
)

// Nitrogen generates this function at the end of the file when you run `npx nitrogen`.
// It adds the `$$iosModuleName$$` library with your Swift sources in `ios/`,
// your C++ sources in `cpp/`, and all generated code.
addNitrogenTargets(to: package)
