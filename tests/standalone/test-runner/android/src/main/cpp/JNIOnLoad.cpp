#include "TestRuntime.hpp"
#include <NitroModules/ByteBufferArrayBuffer.hpp>
#include <NitroModules/JArrayBuffer.hpp>
#include <NitroModules/JNIConverter+Map.hpp>
#include <NitroModules/JNIConverter+Promise.hpp>
#include <NitroModules/JNIConverter+String.hpp>
#include <NitroModules/JNull.hpp>
#include <NitroModules/JSIConverter+JOptional.hpp>
#include <NitroModules/JUnit.hpp>
#include <NitroTest/private/JHybridGrandchildSpec.hpp>
#include <NitroTest/private/JPowertrain.hpp>
#include <android/hardware_buffer_jni.h>
#include <array>
#include <barrier>
#include <exception>
#include <fbjni/fbjni.h>
#include <hermes/hermes.h>
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

  static void checkGlobalRefCleanup(jni::alias_ref<JNativeTestRuntime>) {
    using namespace margelo::nitro;
    for (bool attach : {false, true}) {
      auto reference = jni::make_global(jni::make_jstring("worker-owned"));
      auto buffer = std::make_shared<ByteBufferArrayBuffer>(jni::JByteBuffer::allocateDirect(64));
      std::exception_ptr error;
      std::thread worker([&, reference = std::move(reference), buffer = std::move(buffer)]() mutable {
        try {
          auto release = [&] {
            buffer->data()[0] = 42;
            if (buffer->size() != 64) {
              throw std::runtime_error("Native buffer storage changed on a worker.");
            }
            buffer.reset();
            resetGlobalRef(reference);
          };
          if (attach) {
            jni::ThreadScope scope;
            release();
            if (jni::detail::currentOrNull() == nullptr) {
              throw std::runtime_error("Cleanup detached its caller's JNI scope.");
            }
          } else {
            release();
          }
          if (jni::detail::currentOrNull() != nullptr) {
            throw std::runtime_error("Cleanup leaked a native worker attachment.");
          }
        } catch (...) {
          error = std::current_exception();
        }
      });
      worker.join();
      if (error) {
        std::rethrow_exception(error);
      }
    }
  }

  static void checkHybridObjectCache(jni::alias_ref<JNativeTestRuntime>, jni::alias_ref<margelo::nitro::JHybridObject::JavaPart> value,
                                     bool dispose) {
    using namespace margelo::nitro;
    constexpr size_t count = 8;
    auto owner = jni::make_global(value);
    std::barrier start(count);
    std::array<std::shared_ptr<JHybridObject>, count> objects;
    std::mutex errorMutex;
    std::exception_ptr error;
    std::vector<std::thread> workers;
    for (size_t i = 0; i < count; ++i) {
      workers.emplace_back([&, i] {
        start.arrive_and_wait();
        try {
          jni::ThreadScope::WithClassLoader([&] {
            for (size_t iteration = 0; iteration < 100; ++iteration) {
              auto object = owner->getJHybridObject();
              auto grandchild = std::dynamic_pointer_cast<test::JHybridGrandchildSpec>(object);
              if (!grandchild) {
                throw std::runtime_error("Cross-module HybridObject conversion lost its derived type.");
              }
              const jobject root = object->getJavaPart().get();
              if (static_cast<jobject>(grandchild->getJavaPart().get()) != root ||
                  static_cast<jobject>(grandchild->test::JHybridChildSpec::getJavaPart().get()) != root) {
                throw std::runtime_error("HybridObject inheritance must borrow one owning global reference.");
              }
              objects[i] = object;
              if (dispose && i == 0) {
                object->dispose();
              }
            }
          });
        } catch (...) {
          std::lock_guard lock(errorMutex);
          error = std::current_exception();
        }
      });
    }
    for (auto& worker : workers)
      worker.join();
    if (error)
      std::rethrow_exception(error);
    if (!dispose) {
      for (const auto& object : objects) {
        if (object != objects.front()) {
          throw std::runtime_error("Concurrent conversions created different HybridObject facades.");
        }
      }
    }
  }

  static jni::local_ref<margelo::nitro::JArrayBuffer::javaobject> nativeBuffer(jni::alias_ref<JNativeTestRuntime>, jint size,
                                                                               bool byteBufferBacking) {
    using namespace margelo::nitro;
    if (byteBufferBacking) {
      ArrayBuffer buffer(std::make_shared<ByteBufferArrayBuffer>(jni::JByteBuffer::allocateDirect(size)));
      return JArrayBuffer::wrap(buffer);
    }
    return JArrayBuffer::wrap(ArrayBuffer::allocate(size));
  }

  static void checkRetainedEnums(jni::alias_ref<JNativeTestRuntime>) {
    using namespace margelo::nitro;
    using Enum = test::JPowertrain;
    auto runtime = facebook::hermes::makeHermesRuntime();
    auto value = facebook::jsi::Value(facebook::jsi::String::createFromAscii(*runtime, "gas"));
    const auto first = JSIConverter<jni::alias_ref<Enum>>::fromJSI(*runtime, value);
    for (size_t i = 0; i < 100; ++i) {
      jni::JniLocalScope frame(jni::Environment::current(), 16);
      const auto next = JSIConverter<jni::alias_ref<Enum>>::fromJSI(*runtime, value);
      const auto optional = JSIConverter<jni::alias_ref<JOptional<Enum>>>::fromJSI(*runtime, value);
      if (static_cast<jobject>(first.get()) != static_cast<jobject>(next.get()) ||
          static_cast<jobject>(first.get()) != static_cast<jobject>(optional.get())) {
        throw std::runtime_error("Retained enum conversions must share the cached global owner.");
      }
    }
    const auto missing = JSIConverter<jni::alias_ref<JOptional<Enum>>>::fromJSI(*runtime, facebook::jsi::Value::undefined());
    if (missing) {
      throw std::runtime_error("An absent enum must remain absent.");
    }
  }

  static void registerNatives() {
    javaClassStatic()->registerNatives({makeNativeMethod("runTest", JNativeTestRuntime::runTest),
                                        makeNativeMethod("checkRetainedEnums", JNativeTestRuntime::checkRetainedEnums),
                                        makeNativeMethod("nativeBuffer", JNativeTestRuntime::nativeBuffer),
                                        makeNativeMethod("checkHybridObjectCache", JNativeTestRuntime::checkHybridObjectCache),
                                        makeNativeMethod("checkGlobalRefCleanup", JNativeTestRuntime::checkGlobalRefCleanup),
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
