---
description: Configure native implementations, inheritance, and dispatch performance with Nitro's iOS and Android decorators.
---

# Platform decorators

`@iOS(...)` and `@Android(...)` tell Nitrogen which bindings to generate for a declared class. Put one decorator on the class for each supported platform:

```ts title="Image.nitro.ts"
import { iOS, Android, type HybridObject } from 'nitro-core'

export * from '#nitro/Image'

@iOS({
  language: 'swift',
  implementation: { className: 'HybridImage' },
  allowInheritance: false,
})
@Android({ language: 'kotlin', implementation: { className: 'HybridImage' }, allowInheritance: false })
export declare class Image extends HybridObject {
  public constructor(path: string)
  readonly width: number
  readonly height: number
}
```

The options are metadata read from source. Use literal objects, strings, booleans, and arrays; variables, spreads, and computed values are unsupported. The declared class and decorators are erased during compilation. They must not run at runtime. See [TypeScript and Babel setup](../getting-started/how-to-build-a-nitro-module#generated-javascript-imports).

## Options

| Option | Meaning |
| --- | --- |
| `language` | Native language: `swift` or `c++` on iOS; `kotlin` or `c++` on Android |
| `implementation` | Native class to construct and call static methods on; in concrete mode, also the class used for instance bindings |
| `allowInheritance` | Whether other declared specs may extend this class on this platform; defaults to `false` |
| `allowMultipleImplementations` | Set to `true` to allow several native classes to implement this spec; required for inheritable specs |
| `protocolConformances` | Swift-only list of additional public protocols for the generated spec protocol to inherit |
| `implementedInterfaces` | Kotlin-only list of additional interfaces for the generated spec class to implement |

Each decorator must supply either an `implementation` or `allowMultipleImplementations: true`. Public constructors and static methods always need an `implementation` on every declared platform.

## Selecting the implementation

The name is the native class you write, not the generated `HybridImageSpec`:

| Language | Example |
| --- | --- |
| Swift | `implementation: { className: 'HybridImage' }` |
| C++ | `implementation: { className: 'HybridImage', include: '"HybridImage.hpp"' }` |
| Kotlin | `implementation: { className: 'HybridImage' }` |

A Swift implementation must be in the same Swift module as its generated bindings.

C++ also requires `include`, with quotes or angle brackets included in the string. An optional `namespace` array selects a namespace within the project's `cxxNamespace`. Kotlin's optional `package` array works the same way within `androidNamespace`. For example, with `['image']` in `nitro.json`, `namespace: ['internal']` selects `margelo::nitro::image::internal`; `package: ['internal']` selects `com.margelo.nitro.image.internal`. Omit these arrays or use `[]` for the project's configured root. They cannot select a namespace/package outside that project.

## Concrete implementations and performance

Prefer a concrete `implementation` with `allowInheritance: false` when your API has one native implementation and no derived specs. This is the default when you provide only `implementation`.

These choices let Nitrogen generate faster calls. In Swift, the bridge stores the concrete implementation type instead of `any HybridImageSpec`, avoiding protocol existential dispatch. Disabling inheritance makes the generated Swift wrapper and C++ bridge final, giving the compiler more opportunities to resolve calls statically. Mark your own native implementation `final` too when appropriate; the decorator does not change the declaration of your handwritten class.

These options describe the API as well as enabling optimizations. Do not disable inheritance on a spec that consumers must extend. The effect on total execution time depends on the native work and compiler optimizations.

## Multiple native implementations

Use `allowMultipleImplementations: true` when several native classes implement the same spec. For example, one image might wrap `UIImage` and another might wrap a different image representation:

```ts
@iOS({ language: 'swift', allowMultipleImplementations: true })
export declare class Image extends HybridObject {
  protected constructor()
  readonly width: number
  readonly height: number
}
```

Native APIs can return either implementation as `Image`. The Swift bridge stores `any HybridImageSpec` in this mode. This option alone does not permit another TypeScript spec to extend `Image`.

You can also supply `implementation` in this mode when the spec has a public constructor or static methods. It selects the class to construct or call statics on. It does not restrict returned instances to that class, and the Swift bridge still stores a protocol existential. Nitrogen rejects an otherwise unused `implementation` on a multiple-implementation object spec with no public constructor or static methods.

## Inheritance between specs

An inheritable base must enable both `allowMultipleImplementations` and `allowInheritance` on each platform used by its derived specs:

```ts
@iOS({
  language: 'swift',
  allowMultipleImplementations: true,
  allowInheritance: true,
})
export declare abstract class Media extends HybridObject {
  protected constructor()
  readonly width: number
  readonly height: number
}
```

A derived `Image` spec can then extend `Media`. Its generated JavaScript prototype inherits from `Media.prototype`, and `image instanceof Media` works. Swift wrappers become open so derived bindings can inherit from them. The base's native instance binding must accept implementations of derived specs, which is why the multiple-implementation mode is required.

`allowInheritance` governs inheritance between specs. The generated abstract C++ spec remains inheritable by your native implementation even with `allowInheritance: false`. Constructor visibility is a separate TypeScript rule: a private constructor blocks subclasses, so use a protected constructor for native-only bases. See [constructors](constructors-and-static-methods#constructor-visibility).

## Additional native protocols and interfaces

For Swift, add public protocols with `protocolConformances`:

```ts
@iOS({
  language: 'swift',
  implementation: { className: 'HybridImage' },
  protocolConformances: [
    { protocol: 'ImageMetadata', module: 'ImageSupport' },
  ],
})
```

The generated spec inherits `ImageMetadata` and imports `ImageSupport`. Omit `module` for a protocol in the current module. Your native implementation must satisfy its requirements.

For Kotlin, provide the interface name and its full package:

```ts
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridImage' },
  implementedInterfaces: [
    { interface: 'ImageMetadata', package: 'com.example.images' },
  ],
})
```

These options add native contracts; they do not expose those protocols' or interfaces' members to JavaScript. Declare each JavaScript-visible member in the spec. Add any required native dependency to your build configuration.
