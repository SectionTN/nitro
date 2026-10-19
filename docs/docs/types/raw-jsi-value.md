---
description: Register handwritten C++ methods that access jsi::Runtime and jsi::Value directly.
---

# Raw JSI values

A raw JSI method receives the runtime, `this`, arguments, and argument count directly. Use it when a typed converter cannot express your API. You must validate arguments and maintain the matching TypeScript declaration yourself.

Register the method in a handwritten [class descriptor](../concepts/hybrid-objects#handwritten-c-bindings):

```cpp
#include <NitroModules/HybridObject.hpp>

using namespace margelo::nitro;

class HybridMath: public HybridObject {
public:
  struct Class {
    using Base = HybridObject::Class;
    static constexpr const char* name = "Math";
    static const std::shared_ptr<const HybridClass>& get();
  };

  jsi::Value add(jsi::Runtime& runtime,
                 const jsi::Value& thisValue,
                 const jsi::Value* args,
                 size_t count) {
    if (count != 2 || !args[0].isNumber() || !args[1].isNumber()) {
      throw jsi::JSError(runtime, "add expects two numbers");
    }
    return jsi::Value(args[0].asNumber() + args[1].asNumber());
  }

protected:
  const std::shared_ptr<const HybridClass>& getHybridClass() override {
    return Class::get();
  }
};

inline const std::shared_ptr<const HybridClass>& HybridMath::Class::get() {
  static const auto descriptor = HybridClass::create<Class>([](HybridClass& cls) {
    cls.registerRawHybridMethod("add", 2, &HybridMath::add);
    cls.registerHybridConstructor(+[]() -> std::shared_ptr<HybridMath> {
      return std::make_shared<HybridMath>();
    });
  });
  return descriptor;
}
```

The expected argument count supplies JavaScript function metadata; validate `count` before indexing `args`. Register `HybridMath::Class::get()` through `HybridClassRegistry` before exposing the constructor.

For a handwritten subclass of a generated spec, its descriptor can set `Base = HybridMathSpec::Class` and register additional raw methods. Override `getHybridClass()` to return that descriptor. Keep Nitrogen's generated files unchanged.

All JSI access must stay on the runtime's thread and within its lifetime. Do not retain the argument array or move runtime operations to a worker thread. You can still use `JSIConverter<T>::fromJSI(runtime, value)` and `toJSI` inside a raw method by including `<NitroModules/JSIConverter.hpp>`.
