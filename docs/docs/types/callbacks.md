---
description: Pass JavaScript functions as native Callback values, choose synchronous or asynchronous invocation, and borrow Inline callbacks.
---

# Callbacks

Use ordinary function types in TypeScript. Nitrogen maps them to `Callback<R(Args...)>` in C++ and `any Callback<Arguments, Return>` in Swift. `Callback` is a native type; there is no TypeScript `Callback` wrapper to import.

```ts title="Device.nitro.ts"
import { iOS, type HybridObject, type Inline } from 'nitro-core'

export * from '#nitro/Device'

@iOS({ language: 'swift', implementation: { className: 'HybridDevice' } })
export declare class Device extends HybridObject {
  constructor()
  listen(onValue: (value: number) => void): void
  read(getValue: () => number): Promise<number>
  transform(value: number, callback: Inline<(value: number) => number>): number
}
```

An owning callback can be stored and invoked repeatedly. An event listener is just a stored callback; release it when the subscription ends. Callbacks can also appear in structs, arrays, properties, return values, and optionals.

## Invocation

| Native operation | Behavior |
| --- | --- |
| `callSync(...)` | Calls immediately and returns the declared result. JS callbacks must be invoked on their owning runtime's thread. Errors propagate to the caller. |
| `callAsync(...)` | Schedules JS execution through the owning runtime's dispatcher and returns a `Promise` for the result. |
| `callAndForget(...)` | Schedules execution without exposing a result. Use when you do not need to observe completion. |
| `callback(...)` | Convenience syntax: calls `callAndForget` for a `void` result and `callAsync` otherwise. |

The function signature keeps its declared return type. The native invocation method decides whether to call synchronously or return a promise. There is no `Sync<T>` marker in v1.

### C++

```cpp
void listen(const Callback<void(double)>& onValue) override {
  listeners.push_back(onValue);
}

Promise<double> read(const Callback<double()>& getValue) override {
  return getValue.callAsync();
}
```

Copying a `Callback` retains its shared state. Include `<NitroModules/Callback.hpp>` when using it outside generated headers. Create a callback implemented in C++ with `Callback<double(double)>::make([](double value) { return value * 2; })`.

### Swift

```swift
private var listeners: [any Callback<Double, Void>] = []

func listen(onValue: any Callback<Double, Void>) {
  listeners.append(onValue)
}

func read(getValue: any Callback<(), Double>) -> any Promise<Double> {
  return getValue.callAsync()
}
```

Multiple arguments form a tuple, for example `any Callback<(Double, String), Void>`. Use `try callback.callSync(...)` for synchronous invocation, or `try await callback.callAsync(...)` in async Swift code. To return a native closure for a signature used in your specs, use `let callback: any Callback<Double, Double> = .native { $0 * 2 }`.

### Kotlin

Kotlin uses function types in generated signatures:

```kotlin
private val listeners = mutableListOf<(Double) -> Unit>()

override fun listen(onValue: (Double) -> Unit) {
  listeners.add(onValue)
}
```

Use the generated Kotlin signature for the callback's parameters and result. `Callback` and `InlineCallback` are the C++/Swift APIs described above.

## Inline callbacks

Wrap a required method, static method, or constructor parameter in `Inline<...>` when native code borrows the callback for the duration of the call. This avoids the owning callback's allocations for synchronous use:

```cpp
// For a C++ implementation of Device:
double transform(double value, const InlineCallback<double(double)>& callback) override {
  return callback.call(value);
}
```

```swift
func transform(
  value: Double,
  callback: borrowing some InlineCallback<Double, Double> & ~Copyable & ~Escapable
) throws -> Double {
  return try callback(value)
}
```

An inline callback must stay within the call and run on the JS runtime's thread. It cannot be stored as-is. Call `escape()` to create an owning `Callback` before storing it or calling it asynchronously. Swift enforces the borrowed lifetime with its noncopyable, nonescapable type.

`Inline` is not accepted for optional parameters, return values, properties, or callbacks nested inside other types. Use an ordinary function type in those positions. Include `<NitroModules/InlineCallback.hpp>` for handwritten C++ code.

## Threading and lifetime

Asynchronous JS calls need a [dispatcher](../guides/worklets#dispatcher) installed on the originating runtime. A callback's JavaScript function remains tied to that runtime; retaining the native callback does not make a destroyed runtime usable. Never use `callSync` from a worker thread to call into JS.
