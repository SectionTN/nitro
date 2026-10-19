---
description: Return and receive JavaScript promises with Nitro's C++ Promise values and Swift Promise protocol.
---

# Promises (`Promise<T>`)

Use the built-in TypeScript `Promise<T>` for an asynchronous result. Returning a promise does not move work off the calling thread by itself; schedule the work in the native implementation.

```ts
export declare class Math extends HybridObject {
  fibonacci(n: number): Promise<number>
}
```

This is a spec excerpt; see [setup](../getting-started/how-to-build-a-nitro-module) for the decorator and runtime export.

## C++

Nitrogen generates `Promise<T>` values, and takes promise parameters by `const Promise<T>&`. Include `<NitroModules/Promise.hpp>` in handwritten code.

```cpp
Promise<double> fibonacci(double n) override {
  return Promise<double>::async([n]() -> double {
    return calculateFibonacciSequence(n);
  });
}
```

`async` runs the closure on Nitro's thread pool and rejects if it throws. `Promise<T>::resolved(value)` and `Promise<T>::rejected(error)` create settled promises. Use `Promise<void>::resolved()` for a void result. `awaitFuture` adapts a `std::future`.

For callback-based native APIs, create `Promise<T>::pending()`, copy the handle into the completion handler, and call `resolve` or `reject` there. Copies share the same state. Always arrange for one completion path; creating a promise does not guarantee it will settle.

## Swift

Nitrogen generates return types such as `any Promise<Double>`. `Promise` is a protocol whose concrete specializations are generated from your specs. Use the inferred factories rather than constructing the protocol:

```swift
func fibonacci(n: Double) -> any Promise<Double> {
  return .async {
    return try await calculateFibonacciSequence(n)
  }
}
```

Use `.resolved(with: value)`, `.resolved()` for `Void`, `.rejected(with: error)`, or `.pending()` with an explicit `any Promise<T>` context. A pending promise exposes `resolve(result:)` and `reject(error:)`.

```swift
func getCachedValue() -> any Promise<Double> {
  return .resolved(with: 42)
}

func readInput(input: any Promise<Double>) -> any Promise<Double> {
  return .async {
    return try await input.await()
  }
}
```

Promise listener callbacks run on the thread that settles the promise, or immediately when it is already settled. Dispatch UI work to the main thread yourself.

## Kotlin

Import `com.margelo.nitro.core.Promise`. Use `Promise.async` with suspending native work:

```kotlin
override fun fibonacci(n: Double): Promise<Double> {
  return Promise.async {
    calculateFibonacciSequence(n)
  }
}
```

## Passing promises

Promises work in either direction and can be used in parameters, properties, containers, and callback results. JavaScript awaits the result as usual:

```ts
const result = await math.fibonacci(13)
```

The originating runtime needs a [dispatcher](../guides/worklets#dispatcher) so native completion can reach JS. See [sync vs async](../guides/sync-vs-async) for choosing where to perform work.
