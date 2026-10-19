---
description: Build a Nitro v1 module with declared TypeScript classes, generated runtime exports, Swift or C++ implementations, and Swift Package Manager.
toc_max_heading_level: 3
---

# How to build a Nitro Module

A Nitro Module packages native implementations with TypeScript declarations and generated bindings. Use C++, Swift, or Kotlin for the native implementation.

## 1. Create a library

Use the v1 template:

```sh
npx nitrogen@alpha init my-nitro-module
```

For an existing library, install matching versions of `nitro-core`, `react-native-nitro-modules`, and `nitrogen` as development dependencies. Declare the runtime packages as peer dependencies, and install them in the consuming app. Keep all three on the same exact v1 version, including the prerelease suffix.

The template includes native build files, `nitro.json`, and a working Swift example. For manual setup, use the following configuration.

### Native names

```json title="nitro.json"
{
  "$schema": "https://nitro.margelo.com/nitro.schema.json",
  "cxxNamespace": ["math"],
  "ios": { "iosModuleName": "NitroMath" },
  "android": {
    "androidNamespace": ["math"],
    "androidCxxLibName": "NitroMath"
  }
}
```

Both platform sections are required by the config schema. Native implementations are selected in the spec decorators. See [configuration](configuration-nitro-json).

### Generated JavaScript imports

Add this to your library's root `package.json`:

```json
{
  "imports": {
    "#nitro/*": "./nitrogen/generated/shared/javascript/*.cjs"
  },
  "swiftpmConfig": {
    "name": "NitroMath",
    "dependencies": ["react-native-nitro-modules"]
  }
}
```

`#nitro/*` is a package import. It resolves through the nearest `package.json`, for both source specs and compiled output. Keep generated files inside the package. If you change Nitrogen's `--out`, update this path too.

Use a TypeScript module resolver that supports package imports:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolvePackageJsonImports": true,
    "strict": true
  }
}
```

React Native's TypeScript config disables `resolvePackageJsonImports`, so override it in libraries and apps that compile these specs or declarations. TypeScript 5 or newer supports the decorators without `experimentalDecorators`.

If Metro/Babel compiles `.nitro.ts` sources, enable decorator parsing in the app:

```js title="babel.config.js"
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  parserOpts: { plugins: ['decorators'] },
}
```

The TypeScript transform removes the declared class and its decorators. Do not turn it into a runtime `class`: the annotation helpers throw if executed. If you use a decorator plugin instead, use syntax-only support; the proposal transform with `version: '2023-11'` does not handle decorated declared classes. Avoid swc for these specs because it can emit decorator calls for declared classes.

### Swift Package Manager

Create the library manifest before running Nitrogen:

```swift title="Package.swift"
// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "NitroMath",
  platforms: [.iOS(.v16)]
)

addNitrogenTargets(to: package)
```

Nitrogen appends the generated target setup to this file. The targets include native sources under `ios/` and `cpp/` and the generated bindings. Keep the template's metadata-only `.podspec` for React Native CLI discovery. SwiftPM builds the native sources; do not add the old `add_nitrogen_files` CocoaPods integration.

### Android

After applying the Android and Kotlin plugins, include Nitrogen's Gradle setup:

```groovy title="android/build.gradle"
apply from: '../nitrogen/generated/android/NitroMath+autolinking.gradle'
```

Include the generated CMake file after defining your native library:

```cmake title="android/CMakeLists.txt"
add_library(NitroMath SHARED src/main/cpp/cpp-adapter.cpp)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroMath+autolinking.cmake)
```

Call the generated registration function during JNI initialization:

```cpp title="android/src/main/cpp/cpp-adapter.cpp"
#include <jni.h>
#include <fbjni/fbjni.h>
#include "NitroMathOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::math::registerAllNatives();
  });
}
```

Call `NitroMathOnLoad.initializeNative()` from your React Native package's initialization. The template includes this wiring. Keep the Gradle/CMake library name equal to `androidCxxLibName`.

## 2. Declare a Hybrid Object

```ts title="src/specs/Math.nitro.ts"
import { iOS, Android, type HybridObject } from 'nitro-core'

export * from '#nitro/Math'

@iOS({
  language: 'swift',
  implementation: { className: 'HybridMath' },
})
@Android({ language: 'kotlin', implementation: { className: 'HybridMath' } })
export declare class Math extends HybridObject {
  constructor()
  add(a: number, b: number): number
}
```

The declared class supplies the TypeScript type. `export * from '#nitro/Math'` supplies its generated runtime value. Nitrogen adds missing runtime re-exports, but keep them in the committed spec. A file with multiple classes needs one re-export per class.

Declare a public constructor to enable `new Math()`. Constructors can take arguments. Omit the constructor, or make it protected/private, for objects that native APIs create and return. A concrete `implementation` alone does not expose a constructor.

For C++, use `language: 'c++'` and the C++ implementation in each platform decorator, for example:

```ts
@iOS({
  language: 'c++',
  implementation: {
    className: 'HybridMath',
    include: '"HybridMath.hpp"',
  },
})
```

## 3. Generate and implement

Run Nitrogen from the library directory, then compile TypeScript:

```sh
npx nitrogen
npx tsc
```

Implement the generated Swift protocol:

```swift title="ios/HybridMath.swift"
import NitroModules

class HybridMath: HybridMathSpec {
  func add(a: Double, b: Double) throws -> Double {
    return a + b
  }
}
```

For Android, implement the generated Kotlin spec in the configured package:

```kotlin title="HybridMath.kt"
package com.margelo.nitro.math

import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class HybridMath @DoNotStrip constructor(): HybridMathSpec() {
  override fun add(a: Double, b: Double): Double {
    return a + b
  }
}
```

Preserve classes and constructors called from JNI when shrinking release builds. For a C++ implementation on either platform, implement the generated C++ spec:

```cpp title="cpp/HybridMath.hpp"
#pragma once
#include <NitroMath/HybridMathSpec.hpp>

namespace margelo::nitro::math {
class HybridMath: public HybridMathSpec {
public:
  HybridMath() = default;

  double add(double a, double b) override {
    return a + b;
  }
};
}
```

The C++ base has a default constructor. The generated spec supplies its nested `Class` descriptor and registration; native implementations do not need to register their methods again.

## 4. Export and use the class

Use a named re-export in the package entry point:

```ts title="src/index.ts"
import 'react-native-nitro-modules'

export { Math } from './specs/Math.nitro'
```

The side-effect import initializes Nitro in React Native before the core spec modules load. Keep it in the library entry point when specs import from `nitro-core`.

Use `export *` for the generated `#nitro/Math` module inside the spec, and named exports for classes in your public entry point. Star re-exports of specs can lose the class value in some bundlers.

Consumers can then construct the native class:

```ts
import { Math } from 'my-nitro-module'

const math = new Math()
console.log(math.add(5, 7)) // 12
console.log(math instanceof Math) // true
```

## 5. Build the app and publish

Install the library and matching Nitro runtime dependencies in a React Native 0.88+ app using the New Architecture. For iOS, use Xcode with Swift 6.4+ and run from the app directory:

```sh
npx react-native spm
```

Open the app's `.xcodeproj`. For an existing CocoaPods app, first run `npx react-native spm add --deintegrate`; this conversion uses CocoaPods to remove its integration. Refresh SwiftPM after adding native files or regenerating targets.

Commit and publish `nitrogen/generated`, `Package.swift`, `nitro.json`, the metadata podspec, native implementations, and the source specs with their referenced types. Preserve the `imports` mapping in the published package. App users should not need to run Nitrogen.

If you use Builder Bob, avoid nested output `package.json` files that hide the root `imports` mapping. Use a `module` target with `esm: false`; see the [Nitrogen README](https://github.com/margelo/nitro/blob/main/packages/nitrogen/README.md) for packaging details.
