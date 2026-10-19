---
title: JSON values (AnyJSON)
description: Exchange arbitrary JSON values with AnyJSON in TypeScript, C++, and Swift.
---

# JSON values (`AnyJSON`)

`AnyJSON` represents a JSON-serializable value: a string, number, boolean, null, array, or object with string keys. Arrays and objects can recursively contain any of these values. Import it from `nitro-core` or the React Native package.

```ts
import { iOS, type HybridObject, type AnyJSON } from 'nitro-core'

export * from '#nitro/JSONStore'

@iOS({ language: 'swift', implementation: { className: 'HybridJSONStore' } })
export declare class JSONStore extends HybridObject {
  constructor()
  read(): AnyJSON
  write(value: AnyJSON): void
}
```

`AnyJSON` is a value, not just a map. It does not support `undefined`, `bigint` (including `Int64` and `UInt64`), functions, Hybrid Objects, or cyclic structures. Use [structs](custom-structs) or [typed maps](typed-maps) when you know the shape of the data.

Kotlin signatures use `AnyJSON` for the same JSON value contract.

## C++

`AnyJSON` is a struct containing UTF-8 JSON text in `stringRepresentation`. Include `<NitroModules/AnyJSON.hpp>`:

```cpp
AnyJSON read() override {
  return AnyJSON{R"({"enabled":true,"count":3})"};
}

void write(const AnyJSON& value) override {
  saveJSONText(value.stringRepresentation);
}
```

Nitro stringifies incoming JS values and parses JSON text when returning values to JS. Produce valid JSON text. If you need to inspect or modify the payload in C++, parse it with your chosen JSON library.

Equality compares the serialized text byte by byte. Whitespace and key order can make equivalent JSON values compare unequal.

## Swift

`AnyJSON` stores UTF-8 JSON in Foundation `Data`. It supports `Codable` conversion:

```swift
struct Settings: Codable {
  var enabled: Bool
  var count: Int
}

func read() throws -> AnyJSON {
  return try AnyJSON(encoding: Settings(enabled: true, count: 3))
}

func write(value: AnyJSON) throws {
  let settings: Settings = try value.decode()
  saveSettings(settings)
}
```

Use `AnyJSON(data: data)` when you already have valid JSON bytes. This initializer stores the data; it does not parse or validate it. Equality and hashing use those bytes.

Serialization allocates and parses text. Prefer a typed struct for frequently used payloads with a known schema. `AnyJSON` can also be nested in arrays, structs, variants, and promises.
