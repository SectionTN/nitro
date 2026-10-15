//
//  JSICache.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 20.06.24.
//

#pragma once

#include <NitroModulesCxx/BorrowingReference.hpp>
#include <NitroModulesCxx/JSClass.hpp>
#include <NitroModulesCxx/NitroLogger.hpp>
#include <NitroModulesCxx/WeakReference.hpp>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <unordered_map>
#include <vector>
#include <typeindex>

namespace margelo::nitro {

using namespace facebook;

class JSICacheReference;

/**
 * A `JSICache` can safely store `jsi::Value` instances (e.g. `jsi::Object` or
 * `jsi::Function`) inside `BorrowingReference<T>`.
 *
 * `jsi::Value`s are managed by a `jsi::Runtime`, and will be deleted if the `jsi::Runtime`
 * is deleted - even if there are still strong references to the `jsi::Value`.
 *
 * To access a `BorrowingReference<jsi::Value>` safely, make sure you are using it from
 * the same Thread that it was created on. This ensures that the `jsi::Runtime` cannot
 * delete it while you are still using it.
 */
class JSICache final : public jsi::NativeState {
public:
  ~JSICache();

public:
  JSICache(const JSICache&) = delete;
  JSICache(JSICache&&) = delete;

private:
  JSICache() = default;

public:
  /**
   Gets or creates a `JSICache` for the given `jsi::Runtime`.
   The returned `shared_ptr` should not be stored in
   If it can be locked, you can access data in the cache. Otherwise the Runtime has already been deleted.
   Do not hold the returned `shared_ptr` in memory, only use it in the calling function's scope.
   */
  [[nodiscard]]
  static JSICacheReference getOrCreateCache(jsi::Runtime& runtime);

private:
  friend class JSICacheReference;

private:
  std::mutex _mutex;
  std::vector<WeakReference<jsi::Value>> _valueCache;
  std::vector<WeakReference<jsi::Object>> _objectCache;
  std::vector<WeakReference<jsi::Function>> _functionCache;
  std::vector<WeakReference<jsi::WeakObject>> _weakObjectCache;
  std::vector<WeakReference<jsi::PropNameID>> _propNameIDCache;
  std::vector<WeakReference<jsi::ArrayBuffer>> _arrayBufferCache;
  // Own the constructor and instance prototype together until Runtime teardown.
  // Callers borrow an entry on the Runtime's thread and clone the handle they need.
  std::unordered_map<std::type_index, JSClass> _classesCache;

private:
  static inline std::unordered_map<jsi::Runtime*, std::weak_ptr<JSICache>> _globalCache;

private:
  static constexpr auto TAG = "JSICache";
};

class JSICacheReference final {
public:
  JSICacheReference() = delete;
  JSICacheReference(const JSICacheReference&) = delete;
  JSICacheReference(JSICacheReference&&) = delete;

  ~JSICacheReference() {
    _strongCache->_mutex.unlock();
  }

public:
  const JSClass* NULLABLE getClass(const std::type_index& type) const {
    auto entry = _strongCache->_classesCache.find(type);
    return entry == _strongCache->_classesCache.end() ? nullptr : &entry->second;
  }

  const JSClass& setClass(const std::type_index& type, JSClass&& jsClass) {
    auto entry = _strongCache->_classesCache.try_emplace(type, std::move(jsClass));
    return entry.first->second;
  }

  BorrowingReference<jsi::Value> makeShared(jsi::Value&& value) {
    BorrowingReference<jsi::Value> owning(new jsi::Value(std::move(value)));
    addToCache(_strongCache->_valueCache, owning);
    return owning;
  }
  BorrowingReference<jsi::Object> makeShared(jsi::Object&& value) {
    BorrowingReference<jsi::Object> owning(new jsi::Object(std::move(value)));
    addToCache(_strongCache->_objectCache, owning);
    return owning;
  }
  BorrowingReference<jsi::Function> makeShared(jsi::Function&& value) {
    BorrowingReference<jsi::Function> owning(new jsi::Function(std::move(value)));
    addToCache(_strongCache->_functionCache, owning);
    return owning;
  }
  BorrowingReference<jsi::WeakObject> makeShared(jsi::WeakObject&& value) {
    BorrowingReference<jsi::WeakObject> owning(new jsi::WeakObject(std::move(value)));
    addToCache(_strongCache->_weakObjectCache, owning);
    return owning;
  }
  BorrowingReference<jsi::PropNameID> makeShared(jsi::PropNameID&& value) {
    BorrowingReference<jsi::PropNameID> owning(new jsi::PropNameID(std::move(value)));
    addToCache(_strongCache->_propNameIDCache, owning);
    return owning;
  }
  BorrowingReference<jsi::ArrayBuffer> makeShared(jsi::ArrayBuffer&& value) {
    BorrowingReference<jsi::ArrayBuffer> owning(new jsi::ArrayBuffer(std::move(value)));
    addToCache(_strongCache->_arrayBufferCache, owning);
    return owning;
  }

private:
  template <typename T>
  static void addToCache(std::vector<WeakReference<T>>& cache, const BorrowingReference<T>& reference) {
    if (cache.size() == cache.capacity()) [[unlikely]] {
      // before the cache grows, remove all references whose values have already been deleted
      std::erase_if(cache, [](const WeakReference<T>& weak) { return weak.isExpired(); });
      if (cache.size() > cache.capacity() / 2) {
        // most references are still alive - grow now so we don't scan the whole cache again on the next add
        cache.reserve(cache.capacity() * 2);
      }
    }
    cache.push_back(reference.weak());
  }

private:
  explicit JSICacheReference(const std::shared_ptr<JSICache>& cache) : _strongCache(cache) {
    _strongCache->_mutex.lock();
  }

private:
  std::shared_ptr<JSICache> _strongCache;

  friend class JSICache;
};

} // namespace margelo::nitro
