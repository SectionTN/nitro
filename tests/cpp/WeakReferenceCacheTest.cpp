#include "WeakReferenceCache.hpp"
#include <cstdio>
#include <memory>
#include <sanitizer/allocator_interface.h>
#include <stdexcept>
#include <vector>

using namespace margelo::nitro;

namespace {

struct Value final {
  static inline size_t destroyed = 0;
  int value;

  explicit Value(int value) : value(value) {}
  ~Value() {
    ++destroyed;
  }
};

void require(bool condition, const char* message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

BorrowingReference<Value> makeValue(int value) {
  auto owned = std::make_unique<Value>(value);
  BorrowingReference<Value> reference(owned.get());
  owned.release();
  return reference;
}

void testBoundedRegistrations() {
  const auto allocatedBefore = __sanitizer_get_current_allocated_bytes();
  {
    WeakReferenceCache<Value> cache;
    const auto churn = [&] {
      for (size_t index = 0; index < 100'000; ++index) {
        auto temporary = makeValue(-1);
        cache.add(temporary);
      }
    };
    churn();
    require(Value::destroyed == 100'000, "Cache must not retain values");
    require(__sanitizer_get_current_allocated_bytes() - allocatedBefore < 256 * 1024,
            "Expired cache registrations must have bounded memory usage");

    // Live registrations must survive cleanup and remain available to runtime
    // teardown, even when their number grows beyond the initial cleanup budget.
    std::vector<BorrowingReference<Value>> live;
    for (int index = 0; index < 4'000; ++index) {
      auto value = makeValue(index);
      cache.add(value);
      live.push_back(value);
    }
    churn();
    require(__sanitizer_get_current_allocated_bytes() - allocatedBefore < 1024 * 1024,
            "Expired registrations must stay bounded with live references present");
    for (size_t index = 0; index < live.size(); ++index) {
      require(live[index] && live[index]->value == static_cast<int>(index), "Cleanup invalidated a live reference");
    }

    // After a burst of live values expires, subsequent inserts must reclaim
    // their control states too. Keep one value to verify teardown invalidation.
    live.resize(1);
    churn();
    require(__sanitizer_get_current_allocated_bytes() - allocatedBefore < 256 * 1024,
            "Cleanup must reclaim expired control states after a burst of live values");
    cache.destroyReferences();
    require(!live.front(), "Runtime teardown must invalidate references held by native callers");
    cache.destroyReferences();
    require(Value::destroyed == 304'000, "Every value must be destroyed exactly once");
  }
  require(__sanitizer_get_current_allocated_bytes() == allocatedBefore, "Cache must release all registration memory");
}

} // namespace

int main() {
  try {
    testBoundedRegistrations();
    std::puts("WeakReferenceCache: bounded memory and runtime invalidation passed");
    return 0;
  } catch (const std::exception& error) {
    std::fprintf(stderr, "%s\n", error.what());
    return 1;
  }
}
