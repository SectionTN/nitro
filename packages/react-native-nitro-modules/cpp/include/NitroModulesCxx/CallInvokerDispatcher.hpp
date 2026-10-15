//
// Created by Marc Rousavy on 27.03.24.
//

#pragma once

#include <NitroModulesCxx/Dispatcher.hpp>

// This is react-native specific
#if __has_include(<ReactCommon/CallInvoker.h>)
#include <ReactCommon/CallInvoker.h>
#include <thread>

namespace margelo::nitro {

using namespace facebook;

/**
 * A Dispatcher that uses react::CallInvoker for its implementation.
 *
 * It must be created on the JS Thread, as it uses the creating Thread
 * to find out whether code runs on the Dispatcher.
 */
class CallInvokerDispatcher final : public Dispatcher {
public:
  explicit CallInvokerDispatcher(std::shared_ptr<react::CallInvoker> callInvoker)
      : _callInvoker(std::move(callInvoker)), _jsThreadId(std::this_thread::get_id()) {}

  void runAsync(std::function<void()>&& function) override {
    _callInvoker->invokeAsync(std::move(function));
  }

  void runSync(std::function<void()>&& function) override {
    _callInvoker->invokeSync(std::move(function));
  }

  bool isOnDispatcher() override {
    return std::this_thread::get_id() == _jsThreadId;
  }

private:
  std::shared_ptr<react::CallInvoker> _callInvoker;
  std::thread::id _jsThreadId;
};

} // namespace margelo::nitro

#endif
