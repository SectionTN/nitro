---
title: Nitro typing system
description: TypeScript to C++, Swift, and Kotlin type mappings for Nitro v1.
---

# Nitro's typing system

Nitrogen converts the types in your TypeScript specs into native signatures and generates the converters used at the JS boundary. Enable TypeScript's `strict` option to catch type and nullability errors before building.

## Supported types

| TypeScript | C++ | Swift | Kotlin |
| --- | --- | --- | --- |
| [`number`](primitives) | `double` | `Double` | `Double` |
| [`boolean`](primitives) | `bool` | `Bool` | `Boolean` |
| [`string`](strings) | `std::string` | `String` | `String` |
| [`Int64`](primitives#int64) | `int64_t` | `Int64` | `Long` |
| [`UInt64`](primitives#uint64) | `uint64_t` | `UInt64` | `ULong` |
| `void` (no result) | `void` | `Void` | `Unit` |
| [`T[]`](arrays) | `std::vector<T>` | `[T]` | `Array<T>` or a primitive array |
| [`[A, B]`](tuples) | `std::tuple<A, B>` | `(A, B)` | Unsupported |
| [`A \| B`](variants) | `std::variant<A, B>` | Generated `Variant_...` enum | Generated `Variant_...` class |
| [`Record<string, T>`](typed-maps) | `std::unordered_map<std::string, T>` | `Dictionary<String, T>` | `Map<String, T>` |
| [`T \| undefined`](optionals) | `std::optional<T>` | `T?` | `T?` |
| [`null`](nulls) | `NullType` | `NullType` | `NullType` |
| [`(value: A) => R`](callbacks) | `Callback<R(A)>` | `any Callback<A, R>` | `(A) -> R` |
| [`Inline<(value: A) => R>`](callbacks#inline-callbacks) | `InlineCallback<R(A)>` | Borrowed `InlineCallback<A, R>` | `(A) -> R` |
| [`Error`](errors) | `std::exception_ptr` | `any Error` | `Throwable` |
| [`Promise<T>`](promises) | `Promise<T>` | `any Promise<T>` | `Promise<T>` |
| [`ArrayBuffer`](array-buffers) | `ArrayBuffer` | `ArrayBuffer` | `ArrayBuffer` |
| [`AnyJSON`](untyped-maps) | `AnyJSON` | `AnyJSON` | `AnyJSON` |
| [A Hybrid Object class `Image`](hybrid-objects) | `std::shared_ptr<HybridImageSpec>` | `any HybridImageSpec` | `HybridImageSpec` |
| [`AnyHybridObject`](hybrid-objects#anyhybridobject) | `std::shared_ptr<HybridObject>` | Unsupported | Unsupported |
| [Object `interface` / object `type`](custom-structs) | Generated struct | Generated struct | Generated data class |
| [`enum` / string-literal union](custom-enums) | Generated enum | Generated enum | Generated enum |
| [`CustomType<T, Name, Config>`](custom-types) | Your C++ type | Unsupported | Unsupported |

`T`, `A`, and `R` stand for their native equivalents. The table shows value types: C++ parameters usually use `const T&` for strings, containers, callbacks, promises, buffers, and Hybrid Object pointers. Generated headers are the reference for exact signatures. Swift inline callback parameters use `borrowing some InlineCallback<...> & ~Copyable & ~Escapable`.

## Spec declarations

Declare native objects with `export declare class` extending `HybridObject`. Plain interfaces and object type aliases describe data structs. A standalone `.nitro.ts` file must contain a Hybrid Object; put shared helper-only types in `.ts` files.

The examples on individual type pages may omit imports, decorators, and runtime re-exports to focus on a signature. See [the complete setup](../getting-started/how-to-build-a-nitro-module) for a runnable spec.

## Composition and limits

Supported types can be nested in arrays, optionals, structs, maps, variants, and promises. `Inline` is restricted to required method, static method, and constructor parameters. `AnyJSON` accepts only JSON-serializable values and does not preserve arbitrary class instances.

`null` and `undefined` remain distinct: `T | null` is a variant, while `T | undefined` is optional. `void` describes a missing function result; use an optional for a possibly absent value.

Use `Int64` or `UInt64` explicitly for 64-bit integers. Bare `bigint` is deprecated because it does not specify signedness. `any`, `unknown`, arbitrary classes, and cyclic object graphs do not have general-purpose generated mappings. For `Date`, `Map`, or `Set`, choose an explicit representation such as a number, a record, an array, or a Hybrid Object. A raw JSI method can handle values outside this type system.

## Custom conversion

For handwritten C++, specialize `JSIConverter<T>` with `fromJSI`, `toJSI`, and `canConvert`. [Custom types](custom-types) connect that converter to a TypeScript type through Nitrogen. [Raw JSI methods](raw-jsi-value) expose the runtime and argument values directly when a typed converter is not appropriate.
