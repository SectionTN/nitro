package com.margelo.nitro.testing.runner

import com.margelo.nitro.test.NitroTest

internal object NativeTestRuntime {
  init {
    NitroTest.initialize()
    System.loadLibrary("NitroTestRunner")
  }

  /** Runs the cases sequentially in one runtime and returns the first failure, or an empty string. */
  external fun runSuite(
    bundle: String,
    names: Array<String>,
    timeoutMs: Int = 10_000,
  ): String
}
