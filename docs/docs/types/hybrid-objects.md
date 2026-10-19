---
description: Pass native Hybrid Object instances, use multiple implementations, and accept AnyHybridObject in C++.
---

# Hybrid Object types

A Hybrid Object can accept or return another Hybrid Object. The bridge passes the native object by reference, so mutations affect the same instance.

```ts title="Camera.nitro.ts"
import { iOS, type HybridObject } from 'nitro-core'

export * from '#nitro/Image'
export * from '#nitro/Camera'

@iOS({ language: 'swift', allowMultipleImplementations: true })
export declare class Image extends HybridObject {
  readonly width: number
  readonly height: number
}

@iOS({ language: 'swift', implementation: { className: 'HybridCamera' } })
export declare class Camera extends HybridObject {
  constructor()
  takePhoto(): Image
}
```

`Image` has no public constructor: `Camera.takePhoto()` supplies its instances. Consumers import both classes normally and can test `image instanceof Image`.

| TypeScript | C++ | Swift | Kotlin |
| --- | --- | --- | --- |
| `Image` | `std::shared_ptr<HybridImageSpec>` | `any HybridImageSpec` | `HybridImageSpec` |

Use `const std::shared_ptr<HybridImageSpec>&` for a generated C++ parameter. Shared ownership keeps the native instance alive while JS or native code still retains it.

## Multiple implementations

`allowMultipleImplementations: true` allows several native classes to implement one spec. For example, `HybridUIImage` and `HybridCGImage` can both conform to `HybridImageSpec`, and a Swift method can return either as `any HybridImageSpec`.

With a concrete `implementation` and no multiple-implementation option, the Swift bridge expects instances of that selected class. Use the multiple-implementation option when returning different classes, and `allowInheritance: true` if another spec extends this one. See [class inheritance](../concepts/hybrid-objects#native-implementation-and-inheritance).

## `AnyHybridObject`

For a C++ API that accepts any native Hybrid Object, use `AnyHybridObject` from `nitro-core`:

```ts
import type { AnyHybridObject } from 'nitro-core'

export declare class Store extends HybridObject {
  retain(object: AnyHybridObject): void
}
```

```cpp
void retain(const std::shared_ptr<HybridObject>& object) override;
```

`AnyHybridObject` is C++-only. Use a specific Hybrid Object spec for Swift or Kotlin APIs.
