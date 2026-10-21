#pragma once

#include "JNIConverter.hpp"
#include "JOptional.hpp"
#include <optional>

namespace margelo::nitro {

template <typename Cpp, typename JavaClass>
struct JNIConverter<std::optional<Cpp>, jni::local_ref<JOptional<JavaClass>>> {
  static jni::local_ref<JOptional<JavaClass>> toJNI(const std::optional<Cpp>& value) {
    if (!value) {
      return nullptr;
    }
    auto wrapped = JNIConverter<Cpp, jni::local_ref<JavaClass>>::toJNI(*value);
    return jni::adopt_local(static_cast<typename JOptional<JavaClass>::javaobject>(static_cast<jobject>(wrapped.release())));
  }
  static std::optional<Cpp> fromJNI(jni::alias_ref<JOptional<JavaClass>> value) {
    if (!value) {
      return std::nullopt;
    }
    return JNIConverter<Cpp, jni::local_ref<JavaClass>>::fromJNI(
        jni::static_ref_cast<JavaClass>(jni::static_ref_cast<jni::JObject>(value)));
  }
};

} // namespace margelo::nitro
