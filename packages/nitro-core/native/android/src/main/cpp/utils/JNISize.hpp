#pragma once

#include <cstddef>
#include <jni.h>
#include <limits>
#include <stdexcept>

namespace margelo::nitro {

inline jsize getJNISize(size_t size) {
  if (size > static_cast<size_t>(std::numeric_limits<jsize>::max())) [[unlikely]] {
    throw std::length_error("Collection exceeds JNI's maximum length.");
  }
  return static_cast<jsize>(size);
}

} // namespace margelo::nitro
