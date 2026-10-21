#import "NitroTestBridge.h"
#include "TestRuntime.hpp"
#include <exception>

NSString* _Nullable NitroRunSuite(NSString* bundle, NSArray<NSString*>* names, uint32_t timeoutMs, void (^onTestStarted)(void)) {
  try {
    std::vector<std::string> cases;
    cases.reserve(names.count);
    for (NSString* name in names)
      cases.emplace_back(name.UTF8String);
    auto failure = margelo::nitro::testing::runSuite(bundle.UTF8String, cases, timeoutMs, [onTestStarted] {
      if (onTestStarted)
        onTestStarted();
    });
    if (failure.empty()) {
      return nil;
    }
    return [[NSString alloc] initWithBytes:failure.data() length:failure.size() encoding:NSUTF8StringEncoding]
               ?: @"Native test failure could not be decoded as UTF-8.";
  } catch (const std::exception& error) {
    return [NSString stringWithUTF8String:error.what()] ?: @"Native exception could not be decoded as UTF-8.";
  } catch (...) {
    return @"Unknown native exception while running the JavaScript test.";
  }
}
