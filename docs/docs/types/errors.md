---
description: Pass JavaScript Error values between JavaScript, C++, Swift, and Kotlin.
---

# Errors (`Error`)

Use the built-in TypeScript `Error` type for error values passed through an API:

```ts
export declare class Worker extends HybridObject {
  onError?: (error: Error) => void
  report(error: Error): void
}
```

Nitrogen maps `Error` to `std::exception_ptr` in C++, `Error` in Swift, and `Throwable` in Kotlin. These types work in callbacks, parameters, and other supported containers.

```cpp
void report(const std::exception_ptr& error) override {
  try {
    std::rethrow_exception(error);
  } catch (const std::exception& exception) {
    logMessage(exception.what());
  }
}
```

The bridge conveys the native error message. Do not rely on preserving a custom JavaScript error subclass or its extra properties. If those fields are part of your API, define a [struct](custom-structs) for them.

Passing an error is separate from throwing one. Native methods can throw and promises can reject without declaring an `Error` parameter. See [error handling](../guides/errors) for examples.
