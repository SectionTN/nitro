---
description: Declare and construct native classes with Nitro v1, including inheritance, native lifetime, and handwritten C++ bindings.
---

# Hybrid Objects

A Hybrid Object is a native instance exposed to JavaScript. Its properties and methods live on a shared JavaScript prototype, while the instance holds native state.

```ts title="Math.nitro.ts"
import { iOS, type HybridObject } from 'nitro-core'

export * from '#nitro/Math'

@iOS({ language: 'swift', implementation: { className: 'HybridMath' } })
export declare class Math extends HybridObject {
  constructor()
  readonly pi: number
  add(a: number, b: number): number
}
```

In React Native, initialize the host with `import 'react-native-nitro-modules'` in your entry point before importing specs from `nitro-core`.

The declared class supplies types, and the generated `#nitro/Math` module supplies its runtime value. See [setup](../getting-started/how-to-build-a-nitro-module) for the required package import mapping.

```swift title="HybridMath.swift"
import NitroModules

class HybridMath: HybridMathSpec {
  var pi: Double { Double.pi }

  func add(a: Double, b: Double) throws -> Double {
    return a + b
  }
}
```

## Working with Hybrid Objects

Import the class from its spec or your library's public entry point:

```ts
import { Math } from './Math.nitro'

const math = new Math()
console.log(math.add(5, 7)) // 12
console.log(math instanceof Math) // true
```

A spec needs an explicitly declared public constructor to support `new`. Constructors may take arguments. Without one, native code creates the object and returns it from another Hybrid Object's method or property. Declared static methods call the selected native implementation and do not require creating an instance first.

Every Hybrid Object inherits `toString()`, `equals(other)`, and `dispose()`. `equals` compares the underlying native object. `toString()` defaults to a representation containing its class name. Native implementations can override `toString()` and `dispose()`.

## Native implementation and inheritance

For C++, implement the generated `HybridMathSpec` and use a default constructor:

```cpp
#include <NitroMath/HybridMathSpec.hpp>

namespace margelo::nitro::math {
class HybridMath: public HybridMathSpec {
public:
  HybridMath() = default;
  double getPi() override { return 3.141592653589793; }
  double add(double a, double b) override { return a + b; }
};
}
```

The generated spec provides a nested `Class` descriptor and overrides `getHybridClass()`. It registers methods, properties, constructors, and static methods without constructing an instance. Normal native implementations inherit this descriptor and do not write their own registration code.

### Multiple implementations

A concrete `implementation` selects the native type stored by the Swift bridge. All instances returned for that spec must use that implementation. For several native classes implementing the same spec, use `allowMultipleImplementations: true`:

```ts
import { iOS, type HybridObject } from 'nitro-core'

export * from '#nitro/Media'
export * from '#nitro/Image'

@iOS({
  language: 'swift',
  allowMultipleImplementations: true,
  allowInheritance: true,
})
export declare class Media extends HybridObject {
  readonly width: number
  readonly height: number
}

@iOS({ language: 'swift', implementation: { className: 'HybridImage' } })
export declare class Image extends Media {
  constructor(path: string)
  saveToFile(path: string): Promise<void>
}
```

`allowInheritance` defaults to `false`. Enable it on each platform where another spec extends the base. An inheritable base must use `allowMultipleImplementations: true`. The generated JavaScript prototype chain follows the declared class chain, so an `Image` is also an instance of `Media` and `HybridObject`.

A spec with multiple implementations can also select an `implementation` for its public constructor or static methods. Other native implementations can still be returned through its instance type. See [Hybrid Object types](../types/hybrid-objects).

## Lifetime and memory size

JavaScript garbage collection and native reference counting manage object lifetime together. Calling `dispose()` is optional. It releases the JavaScript object's native state, and that JavaScript object must not be used again afterward. Override native cleanup only when your API needs explicit resource release.

Report external allocations so the JavaScript collector can account for native memory. In Swift, implement `memorySize`; in C++, override `size_t getExternalMemorySize() noexcept`. Return the size of external heap allocations in bytes. Returning zero is valid when there are no such allocations.

```swift
var memorySize: Int {
  return image.bytesPerRow * image.height
}
```

## Handwritten C++ bindings

Without Nitrogen, define the class metadata yourself. The descriptor's `Base` points at the base descriptor, and `getHybridClass()` returns your descriptor:

```cpp
#include <NitroModules/HybridObject.hpp>
#include <NitroModules/HybridClassRegistry.hpp>

using namespace margelo::nitro;

class HybridMath: public HybridObject {
public:
  HybridMath() = default;
  double add(double a, double b) { return a + b; }

  struct Class {
    using Base = HybridObject::Class;
    static constexpr const char* name = "Math";
    static const std::shared_ptr<const HybridClass>& get();
  };

protected:
  const std::shared_ptr<const HybridClass>& getHybridClass() override {
    return Class::get();
  }
};

inline const std::shared_ptr<const HybridClass>& HybridMath::Class::get() {
  static const auto descriptor = HybridClass::create<Class>([](HybridClass& cls) {
    cls.registerHybridMethod("add", &HybridMath::add);
    cls.registerHybridConstructor(+[]() -> std::shared_ptr<HybridMath> {
      return std::make_shared<HybridMath>();
    });
  });
  return descriptor;
}
```

Register it before JavaScript imports the class:

```cpp
HybridClassRegistry::registerHybridClass("math.Math", HybridMath::Class::get());
```

Without generated exports, provide its JavaScript type and retrieve the registered constructor explicitly:

```ts
import { NitroModules, type HybridObject } from 'nitro-core'

interface MathInstance extends HybridObject {
  add(a: number, b: number): number
}
const Math = NitroModules.getHybridClass<{ new(): MathInstance; readonly prototype: MathInstance }>('math.Math')
const math = new Math()
```

Handwritten descriptors can also use `registerHybridGetter`, `registerHybridSetter`, `registerHybridStaticMethod`, and [raw JSI methods](../types/raw-jsi-value). For a derived native class, set `Class::Base` to its base class's descriptor. Keep these manual bindings and their TypeScript declarations in sync.
