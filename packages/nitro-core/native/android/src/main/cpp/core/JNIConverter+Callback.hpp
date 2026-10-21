#pragma once

#include "JInlineCallback.hpp"
#include "JNICallback.hpp"

namespace margelo::nitro {

template <typename CppCallback, typename KotlinCallback>
struct JNICallbackConverter;

template <typename R, typename... Args, typename KotlinResult, typename... KotlinArgs>
struct JNICallbackConverter<Callback<R(Args...)>, Callback<KotlinResult(KotlinArgs...)>> {
  using Cpp = Callback<R(Args...)>;
  using Kotlin = Callback<KotlinResult(KotlinArgs...)>;
  static Cpp fromJNI(const Kotlin& value) {
    if constexpr (std::is_same_v<Cpp, Kotlin>) {
      return value;
    } else if (auto* native = std::get_if<typename Kotlin::NativeCallback>(&value._impl)) {
      return Cpp::make([callback = *native](Args... args) -> R {
        if constexpr (std::is_void_v<R>) {
          callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::toJNI(args)...);
        } else {
          return JNIConverter<R, KotlinResult>::fromJNI(
              callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::toJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Kotlin::JSCallback>(value._impl);
      return Cpp(typename Cpp::JSCallback(callback._runtime, BorrowingReference(callback._function), callback._dispatcher));
    }
  }
  static Kotlin toJNI(const Cpp& value) {
    if constexpr (std::is_same_v<Cpp, Kotlin>) {
      return value;
    } else if (auto* native = std::get_if<typename Cpp::NativeCallback>(&value._impl)) {
      return Kotlin::make([callback = *native](KotlinArgs... args) -> KotlinResult {
        if constexpr (std::is_void_v<KotlinResult>) {
          callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::fromJNI(args)...);
        } else {
          return JNIConverter<R, KotlinResult>::toJNI(
              callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::fromJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Cpp::JSCallback>(value._impl);
      return Kotlin(typename Kotlin::JSCallback(callback._runtime, BorrowingReference(callback._function), callback._dispatcher));
    }
  }
};

template <typename R, typename... Args, typename KotlinResult, typename... KotlinArgs>
struct JNICallbackConverter<InlineCallback<R(Args...)>, InlineCallback<KotlinResult(KotlinArgs...)>> {
  using Cpp = InlineCallback<R(Args...)>;
  using Kotlin = InlineCallback<KotlinResult(KotlinArgs...)>;
  static decltype(auto) toJNI(const Cpp& value) {
    if constexpr (std::is_same_v<Cpp, Kotlin>) {
      return (value);
    } else if (auto* native = std::get_if<typename Cpp::NativeCallback>(&value._impl)) {
      return Kotlin::make([callback = *native](KotlinArgs... args) -> KotlinResult {
        if constexpr (std::is_void_v<KotlinResult>) {
          callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::fromJNI(args)...);
        } else {
          return JNIConverter<R, KotlinResult>::toJNI(
              callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::fromJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Cpp::JSCallback>(value._impl);
      jsi::Runtime& runtime = callback._runtime;
      jsi::Function function = jsi::Value(runtime, callback._function).getObject(runtime).getFunction(runtime);
      return Kotlin::make(runtime, std::move(function));
    }
  }
  static decltype(auto) fromJNI(const Kotlin& value) {
    if constexpr (std::is_same_v<Cpp, Kotlin>) {
      return (value);
    } else if (auto* native = std::get_if<typename Kotlin::NativeCallback>(&value._impl)) {
      return Cpp::make([callback = *native](Args... args) -> R {
        if constexpr (std::is_void_v<R>) {
          callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::toJNI(args)...);
        } else {
          return JNIConverter<R, KotlinResult>::fromJNI(
              callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::toJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Kotlin::JSCallback>(value._impl);
      jsi::Runtime& runtime = callback._runtime;
      jsi::Function function = jsi::Value(runtime, callback._function).getObject(runtime).getFunction(runtime);
      return Cpp::make(runtime, std::move(function));
    }
  }
};

template <typename R, typename... Args, typename KotlinResult, typename... KotlinArgs>
struct JNIConverter<Callback<R(Args...)>, Callback<KotlinResult(KotlinArgs...)>>
    : JNICallbackConverter<Callback<R(Args...)>, Callback<KotlinResult(KotlinArgs...)>> {};

template <typename R, typename... Args, typename KotlinResult, typename... KotlinArgs>
struct JNIConverter<InlineCallback<R(Args...)>, InlineCallback<KotlinResult(KotlinArgs...)>>
    : JNICallbackConverter<InlineCallback<R(Args...)>, InlineCallback<KotlinResult(KotlinArgs...)>> {};

template <typename R, typename... Args, typename KotlinResult, typename... KotlinArgs>
struct JNICallbackConverter<InlineCallback<R(Args...)>, Callback<KotlinResult(KotlinArgs...)>> {
  using Cpp = InlineCallback<R(Args...)>;
  using Kotlin = Callback<KotlinResult(KotlinArgs...)>;

  static Kotlin toJNI(const Cpp& value) {
    return JNICallbackConverter<Callback<R(Args...)>, Kotlin>::toJNI(value.escape());
  }

  static Cpp fromJNI(const Kotlin& value) {
    if (auto* native = std::get_if<typename Kotlin::NativeCallback>(&value._impl)) {
      return Cpp::make([callback = *native](Args... args) -> R {
        if constexpr (std::is_void_v<R>) {
          callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::toJNI(args)...);
        } else {
          return JNIConverter<R, KotlinResult>::fromJNI(
              callback(JNIConverter<std::remove_cvref_t<Args>, std::remove_cvref_t<KotlinArgs>>::toJNI(args)...));
        }
      });
    } else {
      const auto& callback = std::get<typename Kotlin::JSCallback>(value._impl);
      jsi::Runtime& runtime = callback._runtime;
      jsi::Function function = jsi::Value(runtime, *callback._function).getObject(runtime).getFunction(runtime);
      return Cpp::make(runtime, std::move(function));
    }
  }
};

/** Native C++ callback conversion is separate from its direct JNI/JSI
 * representation. */
template <typename R, typename... Args, typename JavaCallback>
struct JNIConverter<Callback<R(Args...)>, jni::local_ref<JavaCallback>> {
  using Cpp = Callback<R(Args...)>;
  using NativeCallback = Callback<typename JavaCallback::NativeSignature>;
  using CxxPart = typename JavaCallback::CxxPart;

  static jni::local_ref<JavaCallback> toJNI(const Cpp& value) {
    return CxxPart::create(JNICallbackConverter<Cpp, NativeCallback>::toJNI(value), false);
  }

  static Cpp fromJNI(jni::alias_ref<JavaCallback> value) {
    return JNICallbackConverter<Cpp, NativeCallback>::fromJNI(getJNICallback<JavaCallback>(value));
  }
};

template <typename R, typename... Args, typename JavaCallback>
struct JNIConverter<InlineCallback<R(Args...)>, jni::local_ref<JavaCallback>> {
  using Cpp = InlineCallback<R(Args...)>;
  using NativeCallback = Callback<typename JavaCallback::NativeSignature>;
  using CxxPart = typename JavaCallback::CxxPart;

  static jni::local_ref<JavaCallback> toJNI(const Cpp& value) {
    return CxxPart::create(JNICallbackConverter<Cpp, NativeCallback>::toJNI(value), true);
  }

  static Cpp fromJNI(jni::alias_ref<JavaCallback> value) {
    return JNICallbackConverter<Cpp, NativeCallback>::fromJNI(getJNICallback<JavaCallback>(value));
  }
};

template <typename R, typename... Args, typename JavaCallback>
struct JNIConverter<InlineCallback<R(Args...)>, jni::local_ref<JInlineCallback<JavaCallback>>> {
  using Cpp = InlineCallback<R(Args...)>;
  using Java = JInlineCallback<JavaCallback>;

  static jni::local_ref<Java> toJNI(const Cpp& value) {
    auto result = JNIConverter<Cpp, jni::local_ref<JavaCallback>>::toJNI(value);
    return jni::adopt_local(reinterpret_cast<typename Java::javaobject>(result.release()));
  }

  static Cpp fromJNI(jni::alias_ref<Java> value) {
    auto callback = jni::static_ref_cast<JavaCallback>(jni::static_ref_cast<jni::JObject>(value));
    return JNIConverter<Cpp, jni::local_ref<JavaCallback>>::fromJNI(callback);
  }
};

} // namespace margelo::nitro
