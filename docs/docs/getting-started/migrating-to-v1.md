---
description: Migrate Nitro specs, JavaScript usage, native implementations, and build setup to v1.
---

# Migrating to v1

Keep `nitro-core`, `react-native-nitro-modules`, and `nitrogen` on the same version. Regenerate your library's bindings and rebuild the consuming app after upgrading. v1 requires React Native 0.88+ with the New Architecture and Swift 6.4+ for iOS.

## Declare and export classes

Replace Hybrid Object interfaces and their platform type arguments with decorated declared classes:

```ts title="Math.nitro.ts"
import { iOS, Android, type HybridObject } from 'nitro-core'

export * from '#nitro/Math'

@iOS({ language: 'swift', implementation: { className: 'HybridMath' } })
@Android({ language: 'kotlin', implementation: { className: 'HybridMath' } })
export declare class Math extends HybridObject {
  constructor()
  add(a: number, b: number): number
}
```

Move native implementation selection out of `nitro.json.autolinking`, then remove that field entirely. Declare a public constructor for classes users can create. Constructors may take arguments. For classes created only by native APIs, omit the constructor or make it protected/private.

In the library's `package.json`, add:

```json
{
  "imports": {
    "#nitro/*": "./nitrogen/generated/shared/javascript/*.cjs"
  }
}
```

Each spec needs an `export * from '#nitro/ClassName'` for each declared class. Nitrogen adds missing lines. Keep them in source control and publish the generated `.cjs` and `.d.cts` files. Re-export classes by name from your public entry point:

```ts
import 'react-native-nitro-modules'

export { Math } from './specs/Math.nitro'
```

Use `new Math()` after importing `Math`, replacing `NitroModules.createHybridObject<Math>('Math')`. `instanceof Math` works directly. Generated registry keys now include the module's `cxxNamespace`; applications normally use imports rather than looking them up manually.

## TypeScript and Babel

Use `moduleResolution: "bundler"`, `"node16"`, or `"nodenext"`, and enable `resolvePackageJsonImports`. React Native's default TypeScript config disables that setting, so override it in consuming apps too.

Enable decorator parsing when Babel/Metro compiles specs:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  parserOpts: { plugins: ['decorators'] },
}
```

`experimentalDecorators` is not required. The decorators belong on `declare class` and must be erased by the compiler. See [setup](how-to-build-a-nitro-module) for transpiler and package-scope details.

## Native code

Regenerate first, then follow the generated signatures:

| Previous API | v1 API |
| --- | --- |
| `HybridObject(TAG)` | Default `HybridObject()` constructor |
| `loadHybridMethods()` / `registerHybrids(...)` | Nested `Class` descriptor with `getHybridClass()` |
| `HybridObjectRegistry` | `HybridClassRegistry` for handwritten bindings |
| C++ `std::function<R(...)>` callback | `Callback<R(...)>` |
| Swift callback closure | `any Callback<Arguments, Return>` |
| `Sync<Fn>` spec marker | Ordinary function type, native `callSync(...)` |
| C++ `std::shared_ptr<Promise<T>>` | `Promise<T>` |
| Swift `Promise<T>` | `any Promise<T>`, constructed with `.async`, `.resolved`, etc. |
| C++ `std::shared_ptr<ArrayBuffer>` | `ArrayBuffer` |
| `AnyMap` | `AnyJSON`, a serialized JSON value |

Normal C++ implementations inherit the generated descriptor. Only handwritten bindings need to define their own `Class`. Use module-qualified generated headers such as `<NitroMath/HybridMathSpec.hpp>`.

For callbacks, choose `callSync`, `callAsync`, or `callAndForget` in native code. Use `Inline<Fn>` for a required parameter borrowed only for the call. See [callbacks](../types/callbacks).

Call `ArrayBuffer.asOwning()` on the JS runtime's thread before retaining borrowed storage in C++ or Swift. It retains recoverable native backing storage or copies JS-managed bytes. See [buffers](../types/array-buffers), [promises](../types/promises), and [JSON values](../types/untyped-maps) for the new APIs.

## Native builds

For iOS, add `Package.swift` and `swiftpmConfig` as shown in [setup](how-to-build-a-nitro-module#swift-package-manager). Keep a metadata-only podspec for React Native discovery. Remove the old CocoaPods source integration. Convert an existing CocoaPods app with `npx react-native spm add --deintegrate`, then run `npx react-native spm` and open its `.xcodeproj`.

Keep the Android Gradle, CMake, and JNI registration wiring, and regenerate its sources with the updated specs. Commit generated bindings and ship them in the library.

## Views and inheritance

Replace `HybridView<Props, Methods>` with a declared class extending `HybridView`. Writable properties become props; methods and readonly properties live on the native ref. Re-export the generated `ClassNameComponent`, `ClassNameProps`, and `ClassNameRef` by name. Render the generated component and use `hybridRef`; remove manual `getHostComponent` initialization.

Use `allowInheritance: true` on inheritable specs and `allowMultipleImplementations: true` when a spec can have multiple native implementations. See [Hybrid Objects](../concepts/hybrid-objects) and [view components](../guides/view-components).
