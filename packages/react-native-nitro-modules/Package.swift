// swift-tools-version: 6.2

import PackageDescription

// React Native's SwiftPM autolinking references this package through the symlink
// <app>/ios/build/generated/autolinking/libs/NitroModules, and SwiftPM resolves
// the relative package paths below against that location.
let reactNativeCxxSettings: [CXXSetting] = [
  // Keep React Native's C++ ABI in sync with the prebuilt Debug/Release React.framework.
  .define("DEBUG", .when(configuration: .debug)),
  .define("NDEBUG", .when(configuration: .release)),
]
let warningSettings: [CXXSetting] = [
  .enableWarning("all"),
  .enableWarning("extra"),
  .enableWarning("pedantic"),
  .disableWarning("nullability-extension"),
]
let reactHeaders: [Target.Dependency] = [
  .product(name: "ReactHeaders", package: "ReactNative"),
  .product(name: "ReactNativeHeaders", package: "ReactNative"),
  .product(name: "ReactNativeDependenciesHeaders", package: "ReactNative"),
]

let package = Package(
  name: "NitroModules",
  platforms: [.iOS(.v16)],
  products: [
    .library(
      name: "NitroModules",
      targets: [
        "NitroModulesCxx",
        "NitroModulesAppleCxx",
        "NitroModules",
        "NitroModulesSwiftBridge",
        "NitroModulesReactNative",
      ]
    )
  ],
  dependencies: [
    .package(name: "ReactNative", path: "../../../../xcframeworks"),
    .package(name: "React-GeneratedCode", path: "../../../ios"),
    .package(
      url: "https://github.com/margelo/simdutf-swift.git",
      from: "1.0.1",
      traits: ["UTF8", "UTF16", "ASCII"]
    ),
  ],
  targets: [
    // The shared C++ core (also built for Android).
    .target(
      name: "NitroModulesCxx",
      dependencies: reactHeaders,
      path: "cpp",
      exclude: ["views"],
      publicHeadersPath: "include",
      cxxSettings: reactNativeCxxSettings + warningSettings
    ),
    // Apple-specific C++ implementations and helpers that Swift imports.
    .target(
      name: "NitroModulesAppleCxx",
      dependencies: ["NitroModulesCxx"] + reactHeaders,
      path: "ios/NitroModulesAppleCxx",
      cxxSettings: reactNativeCxxSettings + warningSettings
    ),
    // The Swift APIs (`import NitroModules`).
    .target(
      name: "NitroModules",
      dependencies: [
        "NitroModulesCxx",
        "NitroModulesAppleCxx",
        .product(name: "SimdUTF", package: "simdutf-swift"),
      ],
      path: "ios/NitroModules",
      cxxSettings: reactNativeCxxSettings,
      swiftSettings: [
        .enableUpcomingFeature("InternalImportsByDefault"),
        .enableUpcomingFeature("MemberImportVisibility"),
        // Temporarily relax concurrency checking while migrating Promise to Swift 6.
        .swiftLanguageMode(.v5),
        .unsafeFlags(["-strict-concurrency=minimal"]),
        .enableUpcomingFeature("ApproachableConcurrency"),
        .interoperabilityMode(.Cxx),
        .unsafeFlags(["-Xfrontend", "-clang-header-expose-decls=has-expose-attr-or-stdlib"]),
      ]
    ),
    // C++ converters that use Swift types (`swift::String`, `swift::Array`, ...).
    // They include the generated `NitroModules-Swift.h`, so Swift must not import them.
    .target(
      name: "NitroModulesSwiftBridge",
      dependencies: ["NitroModules", "NitroModulesAppleCxx", "NitroModulesCxx"],
      path: "ios/NitroModulesSwiftBridge",
      cxxSettings: reactNativeCxxSettings + warningSettings + [
        // Include C++ types before the generated Swift header.
        .unsafeFlags(["-I${GENERATED_MODULEMAP_DIR}", "-fno-modules"]),
      ]
    ),
    // Installs Nitro into React Native's JS Runtime using a TurboModule.
    .target(
      name: "NitroModulesReactNative",
      dependencies: [
        "NitroModulesCxx",
        "NitroModulesAppleCxx",
        .product(name: "ReactAppHeaders", package: "React-GeneratedCode"),
      ] + reactHeaders,
      path: "ios/NitroModulesReactNative",
      cxxSettings: reactNativeCxxSettings
    ),
  ],
  cxxLanguageStandard: .cxx20
)
