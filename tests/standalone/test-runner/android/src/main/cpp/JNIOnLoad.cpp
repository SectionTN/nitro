#include "TestRuntime.hpp"
#include <fbjni/fbjni.h>
#include <jni.h>

namespace {
using namespace facebook;

class JNativeTestRuntime final : public jni::JavaClass<JNativeTestRuntime> {
public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/testing/runner/NativeTestRuntime;";

  static jni::local_ref<jni::JString> runSuite(jni::alias_ref<JNativeTestRuntime>, jni::alias_ref<jni::JString> bundle,
                                               jni::alias_ref<jni::JArrayClass<jni::JString>> names, jint timeoutMs) {
    const jsize count = static_cast<jsize>(names->size());
    std::vector<std::string> testNames;
    testNames.reserve(count);
    for (jsize index = 0; index < count; ++index) {
      testNames.push_back(names->getElement(index)->toStdString());
    }
    return jni::make_jstring(margelo::nitro::testing::runSuite(bundle->toStdString(), testNames, timeoutMs));
  }

  static void registerNatives() {
    javaClassStatic()->registerNatives({makeNativeMethod("runSuite", JNativeTestRuntime::runSuite)});
  }
};
} // namespace

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, [] { JNativeTestRuntime::registerNatives(); });
}
