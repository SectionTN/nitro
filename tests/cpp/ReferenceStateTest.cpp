#include "BorrowingReference.hpp"
#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <latch>
#include <memory>
#include <thread>

using namespace margelo::nitro;

namespace {

struct Value final {
  std::latch& deleting;
  std::latch& resumeDeletion;
  std::atomic_size_t& destroyed;

  Value(std::latch& deleting, std::latch& resumeDeletion, std::atomic_size_t& destroyed)
      : deleting(deleting), resumeDeletion(resumeDeletion), destroyed(destroyed) {}

  ~Value() {
    deleting.count_down();
    resumeDeletion.wait();
    ++destroyed;
  }
};

} // namespace

int main() {
  std::latch deleting(1);
  std::latch resumeDeletion(1);
  std::atomic_size_t destroyed = 0;
  auto value = std::make_unique<Value>(deleting, resumeDeletion, destroyed);
  BorrowingReference<Value> strong(value.get());
  value.release();
  auto weak = strong.weak();
  std::thread owner([reference = std::move(strong)]() mutable { reference = BorrowingReference<Value>(); });
  deleting.wait();

  // The last strong count is already zero, but the payload destructor has not
  // returned yet. A weak lock must not resurrect it during this window.
  auto promoted = weak.lock();
  if (promoted) {
    std::fputs("Weak lock resurrected a value during its final destructor\n", stderr);
    std::abort();
  }
  // Drop the last explicit weak reference while destruction is paused. The
  // implicit weak reference must keep the control state alive for the owner.
  weak = WeakReference<Value>();
  resumeDeletion.count_down();
  owner.join();
  if (destroyed != 1) {
    std::fputs("The payload must be destroyed exactly once\n", stderr);
    return 1;
  }
  std::puts("ReferenceState: final strong/weak release and weak promotion passed");
}
