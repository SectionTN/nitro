#pragma once

#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace margelo::nitro::testing {

// Runs a file's cases in order in one fresh Hermes runtime on the calling thread.
// The first failure stops the suite and includes the case name and JS stack.
// No C++ exception crosses the Swift/JNI boundary. Bundle compilation is cached
// outside the JS deadlines. Setup and each case receive timeoutMs;
// getNitroTestTimeoutMs(name) can override execution only. onTestStarted runs
// after setup, before each case. The runtime is destroyed before returning.
// A non-empty sourceMap is the bundle's source map, which JS reads through
// `__nitroTestSourceMap()` to report failures at their TypeScript locations.
std::string runSuite(const std::string& bundle, const std::vector<std::string>& names, uint32_t timeoutMs = 10000,
                     const std::function<void()>& onTestStarted = {}, const std::string& sourceMap = "");

} // namespace margelo::nitro::testing
