#pragma once

#include <NitroModules/NitroHash.hpp>
#include <jsi/jsi.h>

namespace margelo::nitro {

namespace jsi = facebook::jsi;

/** Hashes ASCII code units in place; UTF-8 conversion remains authoritative for Unicode. */
inline uint64_t hashJSIString(jsi::Runtime& runtime, const jsi::String& string) {
  uint64_t hash = 14695981039346656037ull;
  bool needsUTF8 = false;
  auto append = [&](bool ascii, const void* data, size_t count) {
    if (needsUTF8)
      return;
    for (size_t i = 0; i < count; ++i) {
      const uint16_t unit = ascii ? static_cast<const uint8_t*>(data)[i] : static_cast<const char16_t*>(data)[i];
      if (unit > 0x7f) {
        needsUTF8 = true;
        return;
      }
      hash ^= unit;
      hash *= 1099511628211ull;
    }
  };
  string.getStringData(runtime, append);
  if (needsUTF8)
    return hashString(string.utf8(runtime));
  return hash;
}

} // namespace margelo::nitro
