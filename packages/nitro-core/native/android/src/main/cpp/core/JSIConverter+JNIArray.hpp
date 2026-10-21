#pragma once

#include "JNISize.hpp"
#include "JSIConverter+JNIPrimitives.hpp"
#include <algorithm>
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

template <typename JavaArray, typename Element = typename JavaArray::T>
struct JSIPrimitiveArrayJNIConverter {
  using Primitive = typename JavaArray::T;

  static jni::local_ref<JavaArray> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSIDecodable<Element>
  {
    auto array = value.asObject(runtime).asArray(runtime);
    const jsize size = getJNISize(array.size(runtime));
    auto result = JavaArray::newArray(size);
    // Fill bounded regions without first reading the new Java array's zeroed storage.
    constexpr jsize capacity = 256;
    std::array<Primitive, capacity> elements;
    for (jsize start = 0; start < size;) {
      const jsize count = std::min(capacity, size - start);
      for (jsize i = 0; i < count; ++i) {
        elements[i] =
            JNIConverter<Element, Primitive>::toJNI(JSIConverter<Element>::fromJSI(runtime, array.getValueAtIndex(runtime, start + i)));
      }
      result->setRegion(start, count, elements.data());
      start += count;
    }
    return result;
  }
  static jsi::Array toJSI(jsi::Runtime& runtime, jni::alias_ref<JavaArray> value)
    requires JSIEncodable<Element>
  {
    const size_t size = value->size();
    if (size == 0) {
      return jsi::Array(runtime, 0);
    }
    // Region reads do not copy unchanged values back to the Java array.
    constexpr size_t capacity = 256;
    std::array<Primitive, capacity> elements;
    size_t start = 0;
    size_t end = 0;
    return detail::createJNIArrayJSI(runtime, size, [&](size_t i) {
      if (i == end) {
        start = i;
        const size_t count = std::min(capacity, size - i);
        value->getRegion(static_cast<jsize>(start), static_cast<jsize>(count), elements.data());
        end = start + count;
      }
      return JSIConverter<Element>::toJSI(runtime, JNIConverter<Element, Primitive>::fromJNI(elements[i - start]));
    });
  }
  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSITypeCheckable<Element>
  {
    return detail::canConvertJNIArray<Element>(runtime, value);
  }
};

template <typename JArrayType>
struct JSIConverter<jni::local_ref<jni::JPrimitiveArray<JArrayType>>> : JSIPrimitiveArrayJNIConverter<jni::JPrimitiveArray<JArrayType>> {};

template <>
struct JSIConverter<jni::local_ref<JArrayUInt64>> : JSIPrimitiveArrayJNIConverter<JArrayUInt64, uint64_t> {};

template <typename Element>
struct JSIConverter<jni::local_ref<jni::JArrayClass<Element>>> {
  using JavaArray = jni::JArrayClass<Element>;
  using OwnedElement = jni::local_ref<Element>;

  static jni::local_ref<JavaArray> fromJSI(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSIDecodable<OwnedElement>
  {
    auto array = value.asObject(runtime).asArray(runtime);
    const jsize size = getJNISize(array.size(runtime));
    auto result = JavaArray::newArray(size);
    for (jsize i = 0; i < size; ++i) {
      auto element = JSIConverter<OwnedElement>::fromJSI(runtime, array.getValueAtIndex(runtime, i));
      result->setElement(i, *element);
    }
    return result;
  }
  static jsi::Array toJSI(jsi::Runtime& runtime, jni::alias_ref<JavaArray> value)
    requires JSIEncodable<OwnedElement>
  {
    return detail::createJNIArrayJSI(runtime, value->size(),
                                     [&](size_t i) { return JSIConverter<OwnedElement>::toJSI(runtime, value->getElement(i)); });
  }
  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    requires JSITypeCheckable<OwnedElement>
  {
    return detail::canConvertJNIArray<OwnedElement>(runtime, value);
  }
};

} // namespace margelo::nitro
