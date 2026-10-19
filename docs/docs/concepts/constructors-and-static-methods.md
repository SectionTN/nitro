---
description: Control JavaScript construction of Hybrid Objects, pass constructor arguments, and expose native static methods and factories.
---

# Constructors and static methods

A Hybrid Object's declared class describes both its instances and its JavaScript constructor. Declare a public constructor to let callers use `new`. Static methods are called on the class itself.

## Constructor visibility

Nitrogen only exposes a native constructor when the spec explicitly declares a public constructor. Constructors and methods are public by default, so the `public` modifier is unnecessary.

| Declaration | JavaScript construction | Use case |
| --- | --- | --- |
| `constructor()` | `new Example()` | Create an object without arguments |
| `constructor(path: string)` | `new Example(path)` | Initialize native state from arguments |
| `protected constructor()` | Not allowed | Objects created by native APIs; other specs may extend this class |
| `private constructor()` | Not allowed | Objects created by native APIs, or a class used only for static methods; TypeScript also rejects subclasses |
| No constructor | No native constructor is exposed | A direct subclass of `HybridObject` inherits its protected constructor in TypeScript |

These modifiers control the JavaScript API. They do not change access to the native class's constructor. Native code can still create a `HybridImage` and return it from a method even if the TypeScript spec has a private constructor. Use native access modifiers or abstract classes separately if you need to restrict native construction.

Without a public constructor, the class still has a runtime export and a prototype. `instanceof` and its static methods continue to work. Calling its constructor from untyped JavaScript throws that the class has no public constructor.

Each constructible spec must declare its own public constructor, including derived specs. Do not rely on TypeScript's inherited constructor signature: Nitrogen does not generate an adapter for an omitted constructor.

## Constructors with arguments

An `Image` is an instance because each image owns native data and has its own dimensions. This declaration loads an image from a path:

```ts title="Image.nitro.ts"
import { iOS, Android, type HybridObject } from 'nitro-core'

export * from '#nitro/Image'

@iOS({ language: 'swift', implementation: { className: 'HybridImage' } })
@Android({ language: 'kotlin', implementation: { className: 'HybridImage' } })
export declare class Image extends HybridObject {
  constructor(path: string)
  readonly width: number
  readonly height: number
}
```

```ts
import { Image } from './Image.nitro'

const image = new Image('/path/to/photo.png')
console.log(image.width, image.height)
console.log(image instanceof Image) // true
```

Nitrogen forwards the arguments to the selected `implementation`. For the example above, implement `init(path: String)` in Swift, `constructor(path: String)` in Kotlin, or `HybridImage(const std::string& path)` in C++. The [Hybrid Objects guide](hybrid-objects) shows the Swift implementation.

Constructors use the same [supported parameter types](../types/typing-system) as methods. For example, an image API that allocates an empty bitmap could instead declare `constructor(width: number, height: number)` and be called as `new Image(640, 480)`. The native initializer then takes two `Double` arguments in Swift/Kotlin or two `double` arguments in C++.

Only one constructor declaration is supported. Use named static factories for alternative creation paths. Constructors are synchronous; for file decoding or other expensive work, prefer a static factory returning `Promise<Image>` and perform the work on a native background thread.

## Constructors without arguments

Declare a public no-argument constructor when all initial state can be chosen by native code:

```ts title="ImageDecoder.nitro.ts"
import { iOS, type HybridObject } from 'nitro-core'

export * from '#nitro/ImageDecoder'

@iOS({ language: 'swift', implementation: { className: 'HybridImageDecoder' } })
export declare class ImageDecoder extends HybridObject {
  constructor()
}
```

Call it with `new ImageDecoder()`. Provide an accessible native no-argument initializer. For C++, a defaulted constructor is enough when the members can be default-initialized; there is no `TAG` argument to pass to `HybridObject`.

## Abstract bases and native-only construction

Use `abstract` and a protected constructor to describe a base that callers cannot instantiate:

```ts title="Media.nitro.ts"
import { iOS, type HybridObject } from 'nitro-core'

export * from '#nitro/Media'

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

Another declared spec can extend `Media` and provide its own public constructor. `allowInheritance: true` permits that relationship in Nitrogen, while the protected constructor permits it in TypeScript. Both are needed. An abstract spec with a public constructor is rejected by Nitrogen.

The TypeScript `abstract` keyword does not force the native implementation to be abstract. Native-created objects can still be returned as `Media`. Use `private constructor()` instead if the spec should also reject TypeScript subclasses.

Inheritance must be declared in the specs and implemented natively. Ordinary JavaScript/TypeScript subclasses are unsupported: the native constructor returns an object with the spec's prototype, not the JavaScript subclass's prototype.

## Static methods

Use a static method when the operation needs no instance state. For example, addition does not need a `Math` object:

```ts title="Math.nitro.ts"
import { iOS, Android, type HybridObject } from 'nitro-core'

export * from '#nitro/Math'

@iOS({ language: 'swift', implementation: { className: 'HybridMath' } })
@Android({ language: 'kotlin', implementation: { className: 'HybridMath' } })
export declare class Math extends HybridObject {
  private constructor()
  static add(a: number, b: number): number
}
```

```ts
import { Math } from './Math.nitro'

const result = Math.add(5, 7) // 12
```

Implement it with `static func` in Swift:

```swift title="HybridMath.swift"
import NitroModules

final class HybridMath: HybridMathSpec {
  static func add(a: Double, b: Double) -> Double {
    return a + b
  }
}
```

In Kotlin, use a companion object method:

```kotlin title="HybridMath.kt"
package com.margelo.nitro.math

import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class HybridMath private constructor(): HybridMathSpec() {
  companion object {
    @DoNotStrip
    fun add(a: Double, b: Double): Double {
      return a + b
    }
  }
}
```

In C++, select this implementation in the platform decorators and declare a static member function:

```cpp title="HybridMath.hpp"
#pragma once
#include <NitroMath/HybridMathSpec.hpp>

namespace margelo::nitro::math {
class HybridMath: public HybridMathSpec {
public:
  static double add(double a, double b) {
    return a + b;
  }
};
}
```

Static methods are called directly on the configured native implementation. They are not instance overrides, so do not use `override` for them in Kotlin or C++.

Static calls have less binding overhead than instance calls: Nitro skips checking and extracting the receiver's native state. They also avoid creating an instance just to call a stateless operation. Argument and return-value conversion still happens, and the total speedup depends on the work performed. See [performance tips](../guides/performance-tips).

## Static factories

A static method can return an instance of its own class. This alternative image API exposes only an asynchronous factory:

```ts title="Image.nitro.ts"
import { iOS, type HybridObject } from 'nitro-core'

export * from '#nitro/Image'

@iOS({ language: 'swift', implementation: { className: 'HybridImage' } })
export declare class Image extends HybridObject {
  private constructor()
  static load(path: string): Promise<Image>
  readonly width: number
  readonly height: number
}
```

```ts
const image = await Image.load('/path/to/photo.png')
console.log(image.width, image.height)
console.log(image instanceof Image) // true
```

The native `load` implementation creates the `HybridImage` internally and resolves the promise with it. The private constructor prevents JavaScript callers from bypassing the factory; it does not prevent native allocation. A public constructor and static factories can also coexist on the same spec.

Public constructors and static methods require `implementation` on every declared platform, even when `allowMultipleImplementations` is enabled. In that case, it selects the constructor/static dispatch target while instance values may still use other native implementations. See [platform decorators](platform-decorators).

Static members must be public methods. Static properties, getters, setters, method overloads, and constructor overloads are unsupported. Use a static method to expose a computed value or constant.
