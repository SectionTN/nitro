---
description: Share bytes between JavaScript and native code with ArrayBuffer, including ownership, copies, and thread-safe lifetime handling.
---

# ArrayBuffers (`ArrayBuffer`)

Use the built-in JavaScript `ArrayBuffer` to exchange binary data. Nitrogen maps it to an `ArrayBuffer` value in both C++ and Swift. Passing the buffer shares its bytes; copying a native handle does not copy its contents.

```ts
export declare class Image extends HybridObject {
  getData(): ArrayBuffer
  setData(data: ArrayBuffer): void
}
```

This is a spec excerpt; see [setup](../getting-started/how-to-build-a-nitro-module) for the decorator and runtime export.

```cpp
ArrayBuffer getData() override;
void setData(const ArrayBuffer& data) override;
```

```swift
func getData() throws -> ArrayBuffer
func setData(data: ArrayBuffer) throws
```

## Ownership

A native-backed owning buffer retains its storage independently of the JS runtime. A JS-backed buffer borrows storage tied to that runtime. Check `isOwner()` in C++ or `isOwner` in Swift; a buffer received from JS may be borrowed even when native code originally allocated its bytes.

Before keeping JS-backed bytes for later or accessing them on another thread, call `asOwning()` synchronously on the owning JS runtime's thread. It retains recoverable native backing storage without a copy, or copies JS-managed bytes into native storage:

```cpp
void setData(const ArrayBuffer& data) override {
  storedData = data.asOwning();
}
```

```swift
func setData(data: ArrayBuffer) {
  storedData = data.asOwning()
}
```

Use an optional member for `storedData` if it starts empty: `ArrayBuffer` has no default constructor. Call `ArrayBuffer::empty()` in C++ or `ArrayBuffer.empty()` in Swift for an owning zero-length buffer.

Owning handles keep storage alive, but do not synchronize access. Coordinate readers and writers across JS and native threads to avoid data races. Raw pointers must not outlive their buffer, and borrowed pointers must not escape the synchronous JS call.

## Creating buffers in C++

Include `<NitroModules/ArrayBuffer.hpp>`:

```cpp
auto buffer = ArrayBuffer::allocate(4096);
auto copy = ArrayBuffer::copy(buffer);

std::vector<uint8_t> bytes = {1, 2, 3};
auto moved = ArrayBuffer::move(std::move(bytes));

auto data = new uint8_t[4096];
auto wrapped = ArrayBuffer::wrap(data, 4096, [data]() {
  delete[] data;
});
```

`wrap` does not copy. Its cleanup function runs after the final owner releases the storage. Keep wrapped bytes valid until then. `copy` also accepts a pointer and size, or a `std::vector<uint8_t>`.

Read `buffer.data()` and `buffer.size()` to access the bytes. Empty or invalidated JS buffers can have a null data pointer. Equality compares backing-handle identity, not byte contents.

## Creating buffers in Swift

Import `NitroModules`:

```swift
let buffer = ArrayBuffer.allocate(4096)
let copy = ArrayBuffer.copy(buffer)

let bytes = UnsafeMutablePointer<UInt8>.allocate(capacity: 4096)
let wrapped = ArrayBuffer.wrap(
  dataWithoutCopy: bytes,
  size: 4096,
  onDelete: { bytes.deallocate() }
)
```

Prefer scoped access when reading or writing bytes:

```swift
buffer.withUnsafeMutableBytes { bytes in
  bytes[0] = 42
}
```

The pointer passed to `withUnsafeBytes` or `withUnsafeMutableBytes` must stay inside the closure. These helpers do not make a borrowed JS buffer owning or synchronize writes.

Use `try ArrayBuffer.copy(data: data)` to copy Foundation `Data`. `buffer.toData(copyIfNeeded: true)` copies borrowed bytes if needed; an owning buffer can be shared with `Data` without copying. Passing `false` requires keeping the borrowed storage valid yourself.

## Creating buffers in Kotlin

Import `com.margelo.nitro.core.ArrayBuffer`. Kotlin buffers can wrap or copy a `ByteBuffer`:

```kotlin
val bytes = ByteBuffer.allocateDirect(4096)
val wrapped = ArrayBuffer.wrap(bytes)
val copied = ArrayBuffer.copy(bytes)
val allocated = ArrayBuffer.allocate(4096)
```

`getBuffer(copyIfNeeded = true)` returns a `ByteBuffer`, copying when needed for safe access. Each returned buffer has its own position and limit while shared storage still shares writes. Call `buffer.asOwning()` before retaining borrowed bytes or sending them to a worker; Kotlin copies the bytes when the buffer is borrowed. Kotlin also supports wrapping Android `HardwareBuffer` instances on supported API levels.

## Creating buffers in JavaScript

```ts
const buffer = new ArrayBuffer(4096)
const bytes = new Uint8Array(buffer)
bytes[0] = 64
```

Pass the `ArrayBuffer`, not the typed-array view. A view's `.buffer` can include bytes outside its `byteOffset` and `byteLength`; slice the relevant range when your API needs only that range.

For a native allocation, use `NitroModules.createNativeArrayBuffer(4096)` from `nitro-core`. Native code should still use `asOwning()` when retaining a buffer received from JS.
