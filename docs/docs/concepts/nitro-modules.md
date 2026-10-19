---
description: Structure a Nitro Module with TypeScript specs, native implementations, and generated bindings.
---

# Nitro Modules

A Nitro Module is a library exposing one or more [Hybrid Objects](hybrid-objects), and optionally [Hybrid Views](hybrid-views).

## Structure

A module contains:

- TypeScript `.nitro.ts` specs and a public entry point with named exports.
- Native implementations in C++, Swift, or Kotlin.
- `nitro.json` for native names and namespaces.
- `nitrogen/generated` with native bindings and JavaScript class exports.
- A `package.json` `imports` mapping for `#nitro/*`.
- `Package.swift`, `swiftpmConfig`, and a metadata-only podspec for React Native's iOS integration.
- Gradle, CMake, and JNI setup for Android.

## Create and use a module

```sh
npx nitrogen@alpha init react-native-math
```

Declare a class, select native implementations in its decorators, and add a public constructor if users should create it with `new`. Run Nitrogen, implement the generated native spec, and re-export the class by name from your library.

Nitrogen generates class registration. For handwritten C++ bindings, define a `Class` descriptor and register it with `HybridClassRegistry` before JavaScript accesses the class.

See [How to build a Nitro Module](../getting-started/how-to-build-a-nitro-module) for the full setup and [entry points](../guides/entry-point) for host runtime installation.
