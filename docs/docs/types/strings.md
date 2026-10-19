---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Strings (`string`)

A JavaScript `string` is a primitive value.
Nitrogen maps it to UTF-8 `std::string` in C++, `String` in Swift, and `String` in Kotlin. C++ string parameters use `const std::string&`; returned strings are values.

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    export declare class MyHybrid extends HybridObject {
      concat(a: string, b: string): string
    }
    ```
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridMyHybrid: HybridMyHybridSpec {
      func concat(a: String, b: String) -> String
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridMyHybrid: HybridMyHybridSpec() {
      fun concat(a: String, b: String): String
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridMyHybrid : public HybridMyHybridSpec {
      std::string concat(const std::string& a, const std::string& b);
    }
    ```
  </TabItem>
</Tabs>
