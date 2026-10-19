---
description: Generate Nitro v1 native bindings and JavaScript classes from TypeScript declarations.
---

# Nitrogen

Nitrogen reads `export declare class` declarations in `.nitro.ts` files and generates C++ specs, Swift and Kotlin bridges, native class registration, and JavaScript runtime exports.

```ts title="Math.nitro.ts"
import { iOS, type HybridObject } from 'nitro-core'

export * from '#nitro/Math'

@iOS({ language: 'swift', implementation: { className: 'HybridMath' } })
export declare class Math extends HybridObject {
  private constructor()
  static add(a: number, b: number): number
}
```

Implement the generated `HybridMathSpec` in your native `HybridMath` class. Missing methods or incorrect signatures produce native compiler errors.

## Setup and generation

Follow [How to build a Nitro Module](../getting-started/how-to-build-a-nitro-module) for package imports, decorator parsing, SwiftPM, and native implementations. Run Nitrogen from the directory containing your [nitro.json](../getting-started/configuration-nitro-json):

```sh
npx nitrogen
```

Each class gets a `.cjs` module and a `.d.cts` declaration in `nitrogen/generated/shared/javascript/`. The spec's `export * from '#nitro/Math'` exposes the runtime value. Configure the package's `imports` field to resolve that path before generation.

Nitrogen fails when no specs are found or a `.nitro.ts` file contains no Hybrid Objects. Put helper-only types in `.ts` or `.d.ts` files. Class and member names must be ASCII, and class names must be unique within a library, ignoring case.

## Constructors and registration

A declared public constructor enables `new`; it can have parameters, but constructor overloads are unsupported. Static methods and public constructors require a concrete `implementation` in every platform decorator. Objects without public constructors can be returned by other native APIs and still support `instanceof`. See [constructors and static methods](constructors-and-static-methods) for visibility rules and examples, and [platform decorators](platform-decorators) for implementation and inheritance options.

Nitrogen registers class descriptors using a key built from `cxxNamespace` and the class name, such as `math.Math`. The generated runtime export looks up that key. Consumers import the class and do not need to know its registry key.

## Generated files

Commit generated files and include them in the npm package, along with the source specs and referenced types. App users do not run Nitrogen. Generated `.gitattributes` marks the output with `linguist-generated=true` for GitHub.

Run generation before compiling TypeScript or publishing. Refresh the app's SwiftPM integration after generated targets change. Nitrogen owns its output directory and removes files it did not generate, so keep handwritten sources elsewhere.

## Without Nitrogen

Nitrogen is optional. For handwritten C++ bindings, define a [Hybrid Class descriptor](hybrid-objects#handwritten-c-bindings) and maintain the matching TypeScript declarations yourself.
