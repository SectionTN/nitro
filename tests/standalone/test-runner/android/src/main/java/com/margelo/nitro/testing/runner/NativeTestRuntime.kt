package com.margelo.nitro.testing.runner

import com.margelo.nitro.core.NullType
import com.margelo.nitro.core.Promise
import com.margelo.nitro.test.NitroTest

internal object NativeTestRuntime {
  init {
    NitroTest.initialize()
    System.loadLibrary("NitroTestRunner")
  }

  external fun checkHardwareBufferBytes(
    buffer: Any,
    write: Boolean,
  ): Boolean

  external fun roundtripStringMap(value: Map<*, *>): Map<String, String>

  external fun singletonNull(): NullType

  external fun resolvedVoidPromise(): Promise<Unit>

  external fun checkConcurrentSingletons()

  /** Returns an empty string on success, or the JavaScript failure and its stack. */
  external fun runTest(
    bundle: String,
    name: String,
    timeoutMs: Int = 10_000,
  ): String
}
