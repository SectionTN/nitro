#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <array>
#include <vector>

namespace margelo::nitro {

namespace detail {
  template <typename Convert>
  jsi::Array createJNIArrayJSI(jsi::Runtime& runtime, size_t size, Convert convert) {
    jsi::Array result(runtime, 0);
    if (size == 0) {
      return result;
    }
    // Match the shared array converters' single push(...) path.
    constexpr size_t inlineCapacity = 8;
    std::array<jsi::Value, inlineCapacity> inlineValues;
    std::vector<jsi::Value> heapValues;
    if (size > inlineCapacity) {
      heapValues.resize(size);
    }
    jsi::Value* values = size <= inlineCapacity ? inlineValues.data() : heapValues.data();
    for (size_t i = 0; i < size; ++i) {
      values[i] = convert(i);
    }
    result.push(runtime, static_cast<const jsi::Value*>(values), size);
    return result;
  }

  template <typename Element>
  bool canConvertJNIArray(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) {
      return false;
    }
    auto object = value.getObject(runtime);
    if (!object.isArray(runtime)) {
      return false;
    }
    auto array = object.getArray(runtime);
    return array.size(runtime) == 0 || JSIConverter<Element>::canConvert(runtime, array.getValueAtIndex(runtime, 0));
  }
} // namespace detail

} // namespace margelo::nitro
