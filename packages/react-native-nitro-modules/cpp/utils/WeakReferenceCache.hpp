//
//  WeakReferenceCache.hpp
//  NitroModules
//

#pragma once

#include "BorrowingReference.hpp"
#include <algorithm>
#include <cstddef>
#include <vector>

namespace margelo::nitro {

/**
 * Tracks borrowing references so their values can be invalidated together.
 * Expired registrations are reclaimed during insertion, even when the cache
 * outlives every value ever added to it. Access requires external synchronization.
 */
template <typename T>
class WeakReferenceCache final {
public:
  void add(const BorrowingReference<T>& reference) {
    if (_references.size() >= _nextCleanupSize) {
      std::erase_if(_references, [](const WeakReference<T>& candidate) { return !candidate.lock(); });
      // Wait for at least as many new entries as survivors before scanning
      // again. This keeps cleanup amortized constant-time when most are live.
      _nextCleanupSize = std::max(MIN_CLEANUP_INTERVAL, _references.size() * 2);
    }
    _references.push_back(reference.weak());
  }

  void destroyReferences() {
    for (const auto& weak : _references) {
      BorrowingReference<T> reference = weak.lock();
      if (reference) {
        reference.destroy();
      }
    }
    _references.clear();
    _nextCleanupSize = MIN_CLEANUP_INTERVAL;
  }

private:
  static constexpr size_t MIN_CLEANUP_INTERVAL = 256;
  std::vector<WeakReference<T>> _references;
  size_t _nextCleanupSize = MIN_CLEANUP_INTERVAL;
};

} // namespace margelo::nitro
