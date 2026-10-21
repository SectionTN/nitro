#pragma once

#include "JNIConverter.hpp"
#include "JTypedPromise.hpp"
#include "JUnit.hpp"

namespace margelo::nitro {

template <typename Cpp, typename JNIResult>
struct JNIConverter<Promise<Cpp>, jni::local_ref<JTypedPromise<JNIResult>>> {
  using JavaPromise = JTypedPromise<JNIResult>;

  static jni::local_ref<JavaPromise> toJNI(const Promise<Cpp>& value) {
    auto promise = JavaPromise::create();
    auto owner = jni::make_global(promise);
    if constexpr (std::is_void_v<Cpp>) {
      static_assert(std::is_void_v<JNIResult>);
      value.addOnResolvedListener([owner] { owner->cthis()->resolve(JUnit::instance()); });
    } else {
      value.addOnResolvedListener([owner](const Cpp& result) {
        try {
          JNIResult converted = JNIConverter<Cpp, JNIResult>::toJNI(result);
          owner->cthis()->resolve(converted);
        } catch (...) {
          owner->cthis()->reject(std::current_exception());
        }
      });
    }
    value.addOnRejectedListener([owner](const std::exception_ptr& error) { owner->cthis()->reject(error); });
    return promise;
  }

  static Promise<Cpp> fromJNI(jni::alias_ref<JavaPromise> value) {
    auto promise = Promise<Cpp>::pending();
    const auto state = value->cthis()->getPromise();
    if constexpr (std::is_void_v<Cpp>) {
      static_assert(std::is_void_v<JNIResult>);
      state.addOnResolvedListener([promise](const JPromise::ResultType&) { promise.resolve(); });
    } else {
      state.addOnResolvedListener([promise](const JPromise::ResultType& result) {
        try {
          using JavaResult = typename detail::JNIPromiseResult<JNIResult>::JavaClass;
          Cpp converted = JNIConverter<Cpp, JNIResult>::fromJNI(jni::static_ref_cast<JavaResult>(jni::alias_ref<jni::JObject>(result)));
          promise.resolve(std::move(converted));
        } catch (...) {
          promise.reject(std::current_exception());
        }
      });
    }
    state.addOnRejectedListener([promise](const std::exception_ptr& error) { promise.reject(std::exception_ptr(error)); });
    return promise;
  }
};

} // namespace margelo::nitro
