---
description: Improve Nitro Module performance by choosing static types, efficient Hybrid Object APIs, and lower-overhead native binding patterns.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Performance Tips

API design affects how much work Nitro performs for each call.

## Use static methods for stateless operations

If a method does not need instance state, declare it `static` and call it on the class, such as `Math.add(a, b)`. Static bindings skip extracting and checking a receiver's native state, so they have less overhead than instance bindings. You also avoid allocating an object solely to call that method. See [static methods](../concepts/constructors-and-static-methods#static-methods).

Keep instance methods for stateful objects such as images, database connections, or decoders. Static calls still convert arguments and return values; the total performance difference depends on the native work.

## Choose concrete implementations when possible

Set `implementation` and leave `allowInheritance: false` when your spec has one native implementation and no derived specs. The Swift bridge can then store the concrete class instead of a protocol existential, and generated wrappers can be final. This reduces dispatch overhead and lets the compiler optimize calls more effectively. Mark your own native class `final` when appropriate too.

Use `allowMultipleImplementations: true` and `allowInheritance: true` when the API needs them. Supplying an `implementation` alongside `allowMultipleImplementations: true` only chooses the constructor/static target; instance bindings still accept multiple implementations. See [platform decorators](../concepts/platform-decorators).

## Avoid dynamic types

Any dynamic types require runtime type checking, and cannot be optimized as good as statically known types (compile-time).

### JSON values

`AnyJSON` serializes values to JSON text at the native boundary. For a known shape, a [typed struct](../types/custom-structs) avoids that parse and stringify work:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
export declare class BadDatabase extends HybridObject {
  getUser(): AnyJSON
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
interface User {
  name: string
  age: number
}
export declare class GoodDatabase extends HybridObject {
  getUser(): User
}
```

</div>
</div>

In some cases (e.g. network requests) you do not know the shape of your data, like in a JSON web-request.
`AnyJSON` already uses JSON text for this exchange. If the payload should stay opaque, a `string` or `ArrayBuffer` lets the caller choose when to parse it. Benchmark that choice with representative data.

### Variants

[Variants](../types/variants) (`A | B`) are dynamic types. Each time you pass a variant to native, Nitro has to check its type at runtime - is it `A` or `B`?
Those type-checks are very efficient so this is considered a micro-optimization, but if you can, avoid variants like so:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
export declare class BadDatabase extends HybridObject {
  set(value: number | string): void
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
export declare class GoodDatabase extends HybridObject {
  setNumber(value: number): void
  setString(value: string): void
}
```

</div>
</div>

## Avoid unnecessary objects

It is a common pattern to wrap everything in an object in JavaScript.
In Nitro, every object gets its own struct and has to be allocated.
On iOS this performance impact is almost zero, but on Android the struct is a heap-allocation.

If you can, avoid unnecessarily wrapping everything in objects, and flatten the types out in the function signature:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
interface SetPayload {
  key: string
  value: string
  onCompleted: () => void
}
export declare class BadDatabase extends HybridObject {
  set(payload: SetPayload): void
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
export declare class GoodDatabase extends HybridObject {
  set(key: string,
      value: string,
      onCompleted: () => void): void
}
```

</div>
</div>

## Use Threading/Asynchronous Promises

By default, every function in Nitro is fully synchronous.
If your function takes long to execute, the JS Thread can not do any other work in the meantime.

In such cases, mark your function asynchronous by returning a [`Promise`](../types/promises), which you can then use to run the heavy processing code on a different thread:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
export declare class BadDatabase extends HybridObject {
  writeLargeData(data: string): void
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
export declare class GoodDatabase extends HybridObject {
  writeLargeData(data: string): Promise<void>
}
```

</div>
</div>

Keep in mind that switching to a different Thread on the native side introduces a small overhead by itself. This only benefits performance if the actual computation inside the function body takes longer than the thread-switch.

## Use `ArrayBuffer` for large data

For large data sets, conventional [arrays](../types/arrays) are in-efficient as each value has to be copied individually.
In contrast to conventional arrays, [Array Buffers](../types/array-buffers) are zero-copy, meaning native memory can be directly shared to JS without copying the data.

For example, to return a large list of numbers we could use [array buffers](../types/array-buffers) (`Float64Array`) instead of [arrays](../types/arrays):

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
export declare class BadDatabase extends HybridObject {
  getAsBlob(): number[]
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
export declare class GoodDatabase extends HybridObject {
  getAsBlob(): ArrayBuffer
}
```

</div>
</div>

## Use Hybrid Objects to implement proxy-results

If a function returns a large amount of data to JS, but only a sub-set of that data is used, we can implement it as a [Hybrid Object](../types/hybrid-objects) instead of a [struct](../types/custom-structs).

This way data will be accessed lazily, and all the data that the user does not access will never be converted to JS, which means Nitro has to do less work:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
interface AllData {
  rows: DataRow[]
}


export declare class BadDatabase extends HybridObject {
  getAllData(): AllData
}

const database = // ...
const data = database.getAllData()
const row = data.rows
  .find((r) => r.name === "Marc")
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
export declare class AllData extends HybridObject {
  findRowWithName(name: string): DataRow
}

export declare class GoodDatabase extends HybridObject {
  getAllData(): AllData
}

const database = // ...
const data = database.getAllData()
const row = data.findRowWithName("Marc")
```

</div>
</div>

The **Bad** example is significantly slower than **Good**, because Nitro has to convert **all rows** to JS, and there could be thousands of rows - even if we only use the row with the `name` "Marc".

The **Good** example is significantly faster than **Bad** because the result of `getAllData()` is a [Hybrid Object](../types/hybrid-objects), and all the thousands of rows do not have to be converted to JS at all, instead they are simply held in native memory. The function `findRowWithName(...)` iterates through the list on the native side and finds the matching row - only this single row will then have to be converted to JS.

## Properly use `memorySize`

Since Hybrid Objects are implemented in native code, the JS runtime does not know the memory size of such objects.
To let the JavaScript runtime know about a Hybrid Object's actual size in memory, Nitro exposes a `memorySize` (or C++ `getExternalMemorySize()` in bytes) API which you can use to give a rough estimation on the native object's memory size (including any heap allocations you perform):

```swift
class HybridImage : HybridImageSpec {
  private var cgImage: CGImage
  var memorySize: Int {
    let imageSize = cgImage.bytesPerRow * cgImage.height
    return imageSize
  }
}
```

That way the JS garbage collector knows how big an `Image` is exactly in memory, and can delete any unused `Image` objects sooner to free up the native memory (`cgImage`), potentially avoiding memory warnings or garbage collector panics.

## Implement view recycling (`RecyclableView`)

If a view is rendered multiple times throughout an app's lifetime, Fabric can recycle old views and re-use them to display new views.
This requires you to reset your internal state to its default values, otherwise stale views may show up, so recycling is disabled by default.
To enable recycling, implement the `RecyclableView` interface/protocol, and override the `prepareForRecycle()` method:

<Tabs groupId="native-view-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMyView.swift"
    import NitroModules

    class HybridMyView: HybridMyViewSpec, RecyclableView {
      // ...
      func prepareForRecycle() {}
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMyView.kt"
    import com.margelo.nitro.views.RecyclableView

    class HybridMyView: HybridMyViewSpec(), RecyclableView {
      // ...
      override fun prepareForRecycle() {}
    }
    ```
  </TabItem>
</Tabs>

See [View Components: Recycling](view-components#recycling) for more information.

## Avoid too many native calls

While Nitro is insanely fast, there is still an unavoidable overhead associated with calling native code from JS.
In general, it is a good practice to stay within one environment (here; JavaScript) as long as possible, and only call into native when really needed.

Some things (like the `Math.add(...)` function I often use) are faster in JavaScript, as the overhead of calling into native might be greater than the overall execution time of the function.

## Use C++ if possible

If possible, write Nitro Modules in C++. This is faster as bridging to Swift or Kotlin is not required.

## Avoid large arrays

Large arrays have to be deep-copied, as they are immutable memory in JS. If possible, avoid sending large arrays back and forth - this is the same principle as ["Use Hybrid Objects to implement proxy-results"](#use-hybrid-objects-to-implement-proxy-results).
