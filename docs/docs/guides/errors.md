---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Errors

Every method in a [Hybrid Object](../concepts/hybrid-objects) can throw an error using the language-default error throwing feature:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMath.swift"
    class HybridMath : HybridMathSpec {
      static func add(a: Double, b: Double) throws -> Double {
        if a < 0 || b < 0 {
          throw RuntimeError("Value cannot be negative!")
        }
        return a + b
      }
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMath.kt"
    class HybridMath : HybridMathSpec() {
      companion object {
        fun add(a: Double, b: Double): Double {
          if (a < 0 || b < 0) {
            throw Error("Value cannot be negative!")
          }
          return a + b
        }
      }
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp title="HybridMath.hpp"
    class HybridMath: public HybridMathSpec {
    public:
      static double add(double a, double b) {
        if (a < 0 || b < 0) {
          throw std::runtime_error("Value cannot be negative!");
        }
        return a + b;
      }
    };
    ```
  </TabItem>
</Tabs>

These examples implement a static `add` method as in the [getting started guide](../getting-started/how-to-build-a-nitro-module). Instance methods and public constructors can throw in the same way.

Errors will be propagated upwards to JS and can be caught just like any other kind of error using `try`/`catch`:

```diff
// code-error
`Math.add(...)`: Value cannot be negative!
```

### Promise rejections

For a spec declaring `static add(a: number, b: number): Promise<number>`, reject the promise by throwing inside the asynchronous operation:

<Tabs groupId="native-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMath.swift"
    class HybridMath : HybridMathSpec {
      static func add(a: Double, b: Double) throws -> any Promise<Double> {
        return .async {
          if a < 0 || b < 0 {
            throw RuntimeError("Value cannot be negative!")
          }
          return a + b
        }
      }
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMath.kt"
    class HybridMath : HybridMathSpec() {
      companion object {
        fun add(a: Double, b: Double): Promise<Double> {
          return Promise.async {
            if (a < 0 || b < 0) {
              throw Error("Value cannot be negative!")
            }
            return@async a + b
          }
        }
      }
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp title="HybridMath.hpp"
    class HybridMath: public HybridMathSpec {
    public:
      static Promise<double> add(double a, double b) {
        return Promise<double>::async([=]() -> double {
          if (a < 0 || b < 0) {
            throw std::runtime_error("Value cannot be negative!");
          }
          return a + b;
        });
      }
    };
    ```
  </TabItem>
</Tabs>

Promise rejections are handled as usual using the `.catch`, or `await`/`catch` syntax in JS:

```ts
import { Math } from './Math.nitro'

try {
  await Math.add(-5, -1)
} catch (error) {
  console.log(error)
}
```
