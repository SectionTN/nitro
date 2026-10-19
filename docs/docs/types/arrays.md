---
description: Exchange typed arrays between JavaScript, C++, Swift, and Kotlin.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Arrays (`T[]`)

Arrays are represented with the most common and efficient native data structures, such as `std::vector<T>` in C++ or `Array<T>` in Swift and Kotlin.


<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    export declare class Contacts extends HybridObject {
      getAllUsers(): User[]
    }
    ```
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridContacts: HybridContactsSpec {
      func getAllUsers() throws -> [User]
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridContacts: HybridContactsSpec() {
      fun getAllUsers(): Array<User>
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridContacts : public HybridContactsSpec {
      std::vector<User> getAllUsers();
    }
    ```
  </TabItem>
</Tabs>

## Kotlin `PrimitiveArray`

As a performance improvement, the JNI (C++ -> Kotlin interface) provides **Primitive Array** datatypes which can avoid boxing primitives into `Object`s, and provides bulk copy methods.
This makes all array operations **a lot faster**, and Nitrogen is smart enough to ✨**automagically**✨ use Primitive Arrays whenever possible.
This will replace the following arrays:

- `Array<Double>` -> [`DoubleArray`](https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-double-array/)
- `Array<Boolean>` -> [`BooleanArray`](https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-boolean-array/)
- `Array<Long>` -> [`LongArray`](https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-long-array/)

Arrays are converted element by element when crossing the boundary. The native container and JavaScript array are separate containers; changing one does not update the other. Elements that are Hybrid Objects still refer to the same native instances. Use `ArrayBuffer` for bulk binary data instead of a number array.
