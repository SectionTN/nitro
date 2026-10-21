#include "JNIConverter+String.hpp"
#include <fbjni/detail/utf8.h>
#include <limits>
#include <stdexcept>
#include <vector>

namespace margelo::nitro {

jni::local_ref<jni::JString> JNIConverter<std::string, jni::local_ref<jni::JString>>::toJNI(const std::string& value) {
  if (value.size() > static_cast<size_t>(std::numeric_limits<jsize>::max())) [[unlikely]] {
    throw std::length_error("String exceeds JNI's maximum length.");
  }
  if (value.find('\0') == std::string::npos) {
    return jni::make_jstring(value);
  }

  // fbjni's std::string overload uses c_str(). Convert with the explicit length to preserve embedded nulls.
  const size_t length = jni::detail::modifiedLength(value);
  std::vector<uint8_t> modified(length + 1);
  jni::detail::utf8ToModifiedUTF8(reinterpret_cast<const uint8_t*>(value.data()), value.size(), modified.data(), modified.size());
  auto result = jni::Environment::current()->NewStringUTF(reinterpret_cast<const char*>(modified.data()));
  FACEBOOK_JNI_THROW_PENDING_EXCEPTION();
  return jni::adopt_local(result);
}

std::string JNIConverter<std::string, jni::local_ref<jni::JString>>::fromJNI(jni::alias_ref<jni::JString> value) {
  return value->toStdString();
}

} // namespace margelo::nitro
