---
title: Platform decorators
description: Configure native implementations, inheritance, Swift protocol conformances, and Kotlin interfaces with @iOS and @Android.
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# Platform decorators

Use `@iOS(...)` and `@Android(...)` on an `export declare class` in a `.nitro.ts` spec to link the native classes for each platform:

```ts title="Math.nitro.ts"
import { type HybridObject, iOS, Android } from 'nitro-core'

@iOS(...)
@Android(...)
export declare class Math extends HybridObject {
  constructor()
  static add(a: number, b: number): number
}
export * from '#nitro/Math'
```

:::tip

Hybrid Objects with constructors or static methods always require a concrete `implementation`, while Hybrid Objects without constructors or
static methods can also be declared abstract via `allowMultipleImplementations: true`.

:::

## Native `language`

Hybrid Objects can be implemented in different languages. C++ is supported on all platforms, and each platform supports other
platform-specific languages:

| Decorator  | Languages           |
| ---------- | ------------------- |
| `@iOS`     | `'swift'`, `'c++'`  |
| `@Android` | `'kotlin'`, `'c++'` |

## Concrete implementations

If your Hybrid Object is known to have a concrete implementation, specify it:

```ts
import { type HybridObject, iOS, Android } from 'nitro-core'

@iOS({
  language: 'swift',
  // highlight-next-line
  implementation: { className: 'HybridMath' }
})
@Android({
  language: 'kotlin',
  // highlight-next-line
  implementation: { className: 'HybridMath' }
})
export declare class Math extends HybridObject {
  ...
}
export * from '#nitro/Math'
```

Now, ensure `HybridMath` is implemented:

<Tabs groupId="native-language">
  <TabItem value="Swift" default>
    ```swift title="HybridMath.swift"
    import NitroModules

    public class HybridMath: HybridMathSpec {
      ...
    }
    ```

    :::tip

    Ensure `HybridMath.swift` is being built by your project/SPM package.

    :::

  </TabItem>
  <TabItem value="Kotlin">
    ```kotlin title="HybridMath.kt"
    package com.margelo.nitro.math

    class HybridMath: HybridMathSpec() {
      companion object : HybridMathSpec.Companion {}

      ...
    }
    ```

    :::tip

    If `HybridMath` lives in a different Java `package` pass `package: [...]` to `@Android(...)`.

    :::

  </TabItem>

</Tabs>

### Concrete Swift references

When `allowMultipleImplementations` is omitted, Swift APIs use the configured implementation class directly. An `Image` implemented by
`HybridImage` appears as `HybridImage` in parameters and return values, including inside arrays, optionals, callbacks, and promises. Swift
rejects a different class that only conforms to `HybridImageSpec` at those API boundaries.

References from other modules use a generated alias such as `NitroImages_ImageImplementation` for the same class.

The implementation class and its protocol requirements must be `public`, because the generated bridge exposes them in public APIs:

```swift
public import NitroModules

public final class HybridImage: HybridImageSpec {
  public let width: Double = 1920
  public let height: Double = 1080
}
```

With `allowMultipleImplementations: true`, Swift APIs continue to use `any HybridImageSpec`, so each implementation can have its own
initializer and native state. A configured `implementation` supplies the JavaScript constructor and static members.

### Allow inheritance

Hybrid Objects can be extended to create inheritance chains. If you want your Hybrid Object to be extendable, set `allowInheritance: true`:

```ts
import { type HybridObject, iOS, Android } from 'nitro-core'

@iOS({
  ...
  // highlight-next-line
  allowInheritance: true
})
@Android({
  ...
  // highlight-next-line
  allowInheritance: true
})
export declare class Image extends HybridObject {
  ...
}
export * from '#nitro/Image'

@iOS(...)
@Android(...)
// highlight-next-line
export declare class GPUImage extends Image {
  ...
}
export * from '#nitro/GPUImage'
```

### Prevent inheritance

To prevent inheritance, set `allowInheritance: false` - this is also a performance optimization and speeds up calls on your Hybrid Object:

```ts
import { type HybridObject, iOS, Android } from 'nitro-core'

@iOS({
  ...
  // highlight-next-line
  allowInheritance: false
})
@Android({
  ...
  // highlight-next-line
  allowInheritance: false
})
export declare class Math extends HybridObject {
  ...
}
export * from '#nitro/Math'
```

## Multiple implementations

If your Hybrid Object is not bound to one specific implementation, set `allowMultipleImplementations: true`. For example, an `Image` could
be backed by a `UIImage`, a `CGImage`, or a GPU buffer:

```ts title="Image.nitro.ts"
import { type HybridObject, iOS } from 'nitro-core'

@iOS({
  language: 'swift',
  // highlight-next-line
  allowMultipleImplementations: true,
})
export declare class Image extends HybridObject {
  readonly width: number
  readonly height: number
}
export * from '#nitro/Image'
```

Now multiple classes can implement the same spec:

```swift title="HybridImage.swift"
class HybridUIImage: HybridImageSpec {
  let uiImage: UIImage
}
class HybridCGImage: HybridImageSpec {
  let cgImage: CGImage
}
class HybridGPUImage: HybridImageSpec {
  let gpuImage: MTLTexture
}
```

Without a configured `implementation`, JavaScript cannot call an `Image` constructor or static members. Another Hybrid Object can create its
native implementations:

```ts title="ImageFactory.nitro.ts"
import { type HybridObject, iOS } from 'nitro-core'

@iOS({
  language: 'swift',
  implementation: { className: 'HybridImageFactory' },
})
export declare class ImageFactory extends HybridObject {
  static createUIImage(): Image
  static createCGImage(): Image
  static createGPUImage(): Image
}
export * from '#nitro/ImageFactory'
```

Then, simply create your instances natively:

```swift title="HybridImageFactory.swift"
public final class HybridImageFactory: HybridImageFactorySpec {
  public static func createUIImage() -> any HybridImageSpec {
    return HybridUIImage()
  }
  public static func createCGImage() -> any HybridImageSpec {
    return HybridCGImage()
  }
  public static func createGPUImage() -> any HybridImageSpec {
    return HybridGPUImage()
  }
}
```

## Additional native interface/protocol conformances

With `allowMultipleImplementations: true`, native APIs use the generated Kotlin spec type or Swift protocol. Accessing an implementation's
native properties can require a downcast:

```swift
class HybridImage: HybridImageSpec {
  let uiImage: UIImage
  ...
}

public final class HybridImageCropper: HybridImageCropperSpec {
  public static func crop(image: any HybridImageSpec) throws -> any HybridImageSpec {
    // If we want to access image.uiImage, we have to downcast from
    // the HybridImageSpec protocol to the HybridImage class first:
    guard let image = image as? HybridImage else {
      throw RuntimeError("Image was not of type HybridImage!")
    }
    let uiImage = image.uiImage
    return ...
  }
}
```

To avoid these repeated downcasts, simply declare a native Kotlin interface/Swift protocol that describes your native type:

<Tabs groupId="native-language">
  <TabItem value="Swift" default>
    ```swift title="NativeImage.swift"
    import UIKit

    public protocol NativeImage {
      var uiImage: UIImage { get }
    }
    ```

  </TabItem>
  <TabItem value="Kotlin">
    ```kotlin title="NativeImage.kt"
    package com.margelo.nitro.image

    public interface NativeImage {
      public val bitmap: android.graphics.Bitmap
    }
    ```

  </TabItem>

</Tabs>

Then declare your interface/protocol conformance via `implementedInterfaces`/`protocolConformances`:

```ts title="Image.nitro.ts"
import { type HybridObject, iOS } from 'nitro-core'

@iOS({
  language: 'swift',
  allowMultipleImplementations: true,
  // highlight-next-line
  protocolConformances: [{ protocol: 'NativeImage' }],
})
@Android({
  language: 'kotlin',
  allowMultipleImplementations: true,
  // highlight-next-line
  implementedInterfaces: [{ interface: 'NativeImage', package: 'com.margelo.nitro.image' }],
})
export declare class Image extends HybridObject {
  readonly width: number
}
export * from '#nitro/Image'
```

Now, any `HybridImageSpec` has to also conform to the `NativeImage` interface/protocol, allowing you to skip the downcast:

```swift
class HybridImage: HybridImageSpec {
  let uiImage: UIImage
  ...
}

public final class HybridImageCropper: HybridImageCropperSpec {
  public static func crop(image: any HybridImageSpec) throws -> any HybridImageSpec {
    // any HybridImageSpec now conforms to NativeImage:
    let uiImage = image.uiImage
    return ...
  }
}
```
