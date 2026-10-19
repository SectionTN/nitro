---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# JSON values (`AnyJSON`)

`AnyJSON` represents a JSON value: a string, number, boolean, `null`, array, or object. Arrays and objects can contain nested JSON values. Import it from `react-native-nitro-modules` or `nitro-core`.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    import { type AnyJSON, type HybridObject, iOS } from 'react-native-nitro-modules'

    @iOS(...)
    export declare class Fetch extends HybridObject {
      get(url: string): AnyJSON
    }
    ```
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    import NitroModules

    func get(url: String) throws -> AnyJSON {
      return try AnyJSON(encoding: ["url": url])
    }
    ```

    Swift stores the encoded JSON as `Data`. Use `AnyJSON(data:)` for existing UTF-8 JSON, or `AnyJSON(encoding:)` for an `Encodable` value. Decode it with `let value: MyDecodableType = try json.decode()`.
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    #include <NitroModules/AnyJSON.hpp>

    AnyJSON get(const std::string& url) {
      return AnyJSON{R"({"status":"ok"})"};
    }
    ```

    C++ stores UTF-8 JSON in `AnyJSON::stringRepresentation`. Return it by value and use your preferred JSON library to encode or decode its contents.
  </TabItem>
</Tabs>

Nitro serializes JavaScript values to JSON when passing them to native, and parses the encoded JSON when returning them to JavaScript. `AnyJSON` replaces the old `AnyMap` API. Native initializers that accept encoded data do not validate it, so provide valid JSON.

`bigint`, `undefined`, functions, and Hybrid Objects are not JSON values. Use a [typed struct](custom-structs) or a dedicated method parameter for these types. Kotlin support for `AnyJSON` is not implemented in the current v1 generator.

Prefer [typed structs](custom-structs) when the fields are known. They provide compile-time checks and avoid JSON serialization.
