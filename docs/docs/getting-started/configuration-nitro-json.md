---
title: Configuration (nitro.json)
description: Configure nitro.json for a React Native Nitro Module, including C++ namespace, iOS module name, Android package, and code generation paths.
---

# Configuration (`nitro.json`)

[Nitrogen](../concepts/nitrogen) requires a `nitro.json` file to be configured at the root of each [Nitro Module](../concepts/nitro-modules).

```json
{
  "$schema": "https://nitro.margelo.com/nitro.schema.json",
  "cxxNamespace": ["$$cxxNamespace$$"],
  "ios": {
    "iosModuleName": "$$iosModuleName$$"
  },
  "android": {
    "androidNamespace": ["$$androidNamespace$$"],
    "androidCxxLibName": "$$androidCxxLibName$$"
  },
  "ignorePaths": ["**/node_modules"]
}
```

Nitrogen parses this file with Zod, see [`NitroUserConfig.ts`](https://github.com/margelo/nitro/blob/main/packages/nitrogen/src/config/NitroUserConfig.ts) for more information.

## `cxxNamespace`

The `cxxNamespace` is the C++ namespace that all C++ specs will be generated in. It is always relative to `margelo::nitro`, and can also have multiple sub-namespaces:

<div className="side-by-side-container">
  <div className="side-by-side-block">
  ```json
  {
    "cxxNamespace": ["math", "extra"]
  }
  ```
  </div>
  <div className="side-by-side-block">
  ```cpp
  namespace margelo::nitro::math::extra {
    // ...generated classes
  }
  ```
  </div>
</div>

## `ios`

Settings specifically for the iOS platform.

### `iosModuleName`

The `iosModuleName` represents the name of the [clang module](https://clang.llvm.org/docs/Modules.html) that will be emitted by the Swift compiler.
Use the same name in `Package.swift`, `package.json`'s `swiftpmConfig.name`, and the metadata-only podspec:

<div className="side-by-side-container">
  <div className="side-by-side-block">
  ```json
  {
    "ios": {
      "iosModuleName": "NitroMath"
    }
  }
  ```
  </div>
  <div className="side-by-side-block">
  ```ruby title="NitroMath.podspec"
  Pod::Spec.new do |s|
    s.name         = "NitroMath"
    # ...
  ```
  </div>
</div>

## `android`

Settings specifically for the Android platform.

### `androidNamespace`

The `androidNamespace` represents the package namespace in which all Java/Kotlin files are generated and written in.
Similar to the `cxxNamespace`, this is always relative to `com.margelo.nitro`, and can also have multiple sub-namespaces.

In most cases, you should keep this in sync with the `namespace` specified in your `build.gradle`.

<div className="side-by-side-container">
  <div className="side-by-side-block">
  ```json
  {
    "android": {
      "androidNamespace": ["math", "extra"]
    }
  }
  ```
  </div>
  <div className="side-by-side-block">
  ```kotlin
  package com.margelo.nitro.math.extra

  // ...
  ```
  </div>
</div>

### `androidCxxLibName`

The `androidCxxLibName` represents the name of the native C++ library that JNI will load to connect Java/Kotlin to C++.

When this Nitro Module is using CMake, this is the same thing as the library defined in `CMakeLists.txt`.
Nitro will load this library at runtime using `System.loadLibrary`.

<div className="side-by-side-container">
  <div className="side-by-side-block">
  ```json
  {
    "android": {
      "androidCxxLibName": "NitroMath"
    }
  }
  ```
  </div>
  <div className="side-by-side-block">
  ```cmake
  project(NitroMath)
  add_library(NitroMath SHARED
          src/main/cpp/cpp-adapter.cpp
          ../cpp/HybridMath.cpp
  )
  ```
  </div>
</div>

## Native implementations

Choose implementations in `.nitro.ts` decorators:

```ts
@iOS({
  language: 'c++',
  implementation: {
    className: 'HybridMath',
    include: '"HybridMath.hpp"',
  },
})
export declare class Math extends HybridObject {
  constructor()
  add(a: number, b: number): number
}
```

For Swift, use `language: 'swift'` and `implementation: { className: 'HybridMath' }`. The class must be in the generated spec's Swift module. C++ `include` must contain quotes or angle brackets; its filename does not have to match the class name. Optional C++ `namespace` and Kotlin `package` arrays select sub-namespaces within the module's configured namespace.

Every platform must specify an `implementation` or `allowMultipleImplementations: true`. Public constructors and static methods require an implementation. See [Hybrid Objects](../concepts/hybrid-objects) for inheritance and multiple implementations.

The old `autolinking` property is rejected, including an empty object. Remove it when migrating to v1. Native registration comes from decorators and public constructor declarations.

## `ignorePaths`

Configures the TypeScript parser to ignore specific given paths when looking for `*.nitro.ts` specs.

By default, this is empty (`[]`), but it can be set to ignore paths like `["node_modules", "lib"]`.
