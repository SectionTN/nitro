#include "TestRuntime.hpp"
#include <NitroModules/JNIConverter+Map.hpp>
#include <NitroModules/JNIConverter+Promise.hpp>
#include <NitroModules/JNIConverter+String.hpp>
#include <NitroModules/JNull.hpp>
#include <NitroModules/JUnit.hpp>
#include <android/hardware_buffer_jni.h>
#include <barrier>
#include <exception>
#include <fbjni/fbjni.h>
#include <jni.h>
#include <mutex>
#include <thread>
#include <vector>

namespace {
using namespace facebook;

class JNativeTestRuntime final : public jni::JavaClass<JNativeTestRuntime> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/testing/runner/NativeTestRuntime;";

  static jni::local_ref<jni::JString> runTest(jni::alias_ref<JNativeTestRuntime>, jni::alias_ref<jni::JString> bundle,
                                              jni::alias_ref<jni::JString> name, jint timeoutMs) {
    return jni::make_jstring(margelo::nitro::testing::runTest(bundle->toStdString(), name->toStdString(), timeoutMs));
  }

  static jni::local_ref<margelo::nitro::JNull> singletonNull(jni::alias_ref<JNativeTestRuntime>) {
    return jni::make_local(margelo::nitro::JNull::null());
  }

  static jni::local_ref<margelo::nitro::JTypedPromise<void>> resolvedVoidPromise(jni::alias_ref<JNativeTestRuntime>) {
    using namespace margelo::nitro;
    return JNIConverter<Promise<void>, jni::local_ref<JTypedPromise<void>>>::toJNI(Promise<void>::resolved());
  }

  static void checkConcurrentSingletons(jni::alias_ref<JNativeTestRuntime>) {
    constexpr size_t count = 8;
    std::barrier start(count);
    std::mutex errorMutex;
    std::exception_ptr error;
    std::vector<std::thread> workers;
    for (size_t i = 0; i < count; ++i) {
      workers.emplace_back([&] {
        start.arrive_and_wait();
        try {
          jni::ThreadScope::WithClassLoader([] {
            for (size_t iteration = 0; iteration < 100; ++iteration) {
              jni::JniLocalScope frame(jni::Environment::current(), 8);
              const auto nullValue = margelo::nitro::JNull::null();
              const auto unitValue = margelo::nitro::JUnit::instance();
              auto* env = jni::Environment::current();
              if (env->GetObjectRefType(nullValue.get()) != JNIGlobalRefType ||
                  env->GetObjectRefType(unitValue.get()) != JNIGlobalRefType) {
                throw std::runtime_error("JNI singletons must borrow an owning global reference.");
              }
              auto localNull = jni::make_local(nullValue);
              auto localUnit = jni::make_local(unitValue);
            }
          });
        } catch (...) {
          std::lock_guard lock(errorMutex);
          error = std::current_exception();
        }
      });
    }
    for (auto& worker : workers) {
      worker.join();
    }
    if (error) {
      std::rethrow_exception(error);
    }
  }

  static bool checkHardwareBufferBytes(jni::alias_ref<JNativeTestRuntime>, jni::alias_ref<jni::JObject> boxed, bool write) {
    auto* buffer = AHardwareBuffer_fromHardwareBuffer(jni::Environment::current(), boxed.get());
    AHardwareBuffer_Desc description;
    AHardwareBuffer_describe(buffer, &description);
    void* data = nullptr;
    const auto usage = write ? AHARDWAREBUFFER_USAGE_CPU_WRITE_OFTEN : AHARDWAREBUFFER_USAGE_CPU_READ_OFTEN;
    if (AHardwareBuffer_lock(buffer, usage, -1, nullptr, &data) != 0) {
      throw std::runtime_error("Failed to lock test HardwareBuffer.");
    }
    auto* bytes = static_cast<uint8_t*>(data);
    bool matches = true;
    for (size_t i = 0; i < description.width; ++i) {
      const auto expected = static_cast<uint8_t>(i * 31);
      if (write) {
        bytes[i] = expected;
      } else {
        matches = matches && bytes[i] == expected;
      }
    }
    AHardwareBuffer_unlock(buffer, nullptr);
    return matches;
  }

  using StringMap = jni::JMap<jni::JString, jni::JString>;
  static jni::local_ref<StringMap> roundtripStringMap(jni::alias_ref<JNativeTestRuntime>, jni::alias_ref<StringMap> value) {
    using Converter = margelo::nitro::JNIConverter<std::unordered_map<std::string, std::string>, jni::local_ref<StringMap>>;
    return Converter::toJNI(Converter::fromJNI(value));
  }

  static void registerNatives() {
    javaClassStatic()->registerNatives({makeNativeMethod("runTest", JNativeTestRuntime::runTest),
                                        makeNativeMethod("roundtripStringMap", JNativeTestRuntime::roundtripStringMap),
                                        makeNativeMethod("singletonNull", JNativeTestRuntime::singletonNull),
                                        makeNativeMethod("checkHardwareBufferBytes", JNativeTestRuntime::checkHardwareBufferBytes),
                                        makeNativeMethod("resolvedVoidPromise", JNativeTestRuntime::resolvedVoidPromise),
                                        makeNativeMethod("checkConcurrentSingletons", JNativeTestRuntime::checkConcurrentSingletons)});
  }
};
} // namespace

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, [] { JNativeTestRuntime::registerNatives(); });
}
