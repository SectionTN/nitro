---
description: Map a JavaScript type to a custom C++ type using CustomType and JSIConverter.
---

# Custom types

Use `CustomType` to map a JavaScript value to a C++ type with a handwritten converter. Custom types work in C++ implementations. For Swift or Kotlin, use a supported type or wrap the resource in a Hybrid Object.

## Declare the mapping

```ts title="Angle.nitro.ts"
import { iOS, type HybridObject, type CustomType } from 'nitro-core'

export * from '#nitro/Angle'

export type Degrees = CustomType<
  number,
  'Degrees',
  { include: 'Degrees.hpp' }
>

@iOS({
  language: 'c++',
  implementation: { className: 'HybridAngle', include: '"HybridAngle.hpp"' },
})
export declare class Angle extends HybridObject {
  constructor()
  normalize(value: Degrees): Degrees
}
```

The first argument is the JavaScript type. The second is the C++ type name, and the third tells Nitrogen which header defines the type and its converter. `include` is a user-search-path header name without extra quotes or angle brackets.

Set `canBePassedByReference: true` for a heavy type whose generated parameters should use `const T&`. The default passes custom types by value.

## Implement the converter

Put the type in your module's C++ namespace and specialize `JSIConverter` inside `margelo::nitro`:

```cpp title="Degrees.hpp"
#pragma once
#include <NitroModules/JSIConverter.hpp>

namespace margelo::nitro::angles {
struct Degrees {
  double value;
};
}

namespace margelo::nitro {
template <>
struct JSIConverter<angles::Degrees> {
  static angles::Degrees fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    return {JSIConverter<double>::fromJSI(runtime, value)};
  }

  static jsi::Value toJSI(jsi::Runtime& runtime, angles::Degrees value) {
    return JSIConverter<double>::toJSI(runtime, value.value);
  }

  static bool canConvert(jsi::Runtime&, const jsi::Value& value) {
    return value.isNumber();
  }
};
}
```

This example assumes `cxxNamespace: ["angles"]` in `nitro.json`. Include the converter before registering methods that use it. Nitrogen includes the configured header for generated bindings; handwritten descriptors must include it themselves.

The native implementation now uses the C++ type:

```cpp
Degrees normalize(Degrees value) override {
  return Degrees{std::fmod(value.value, 360.0)};
}
```

Include `<cmath>` for this example. From TypeScript, the value remains a number.

## Foreign native types

A converter can also bridge a type from another library, including a type held in a `jsi::Object`'s native state. Validate that the object has the expected state in `canConvert` and `fromJSI`; do not assume arbitrary JavaScript objects carry that state. Keep ownership and runtime-thread requirements explicit in the converter.

Use [raw JSI methods](raw-jsi-value) if the operation itself needs direct runtime access rather than a reusable type mapping.
