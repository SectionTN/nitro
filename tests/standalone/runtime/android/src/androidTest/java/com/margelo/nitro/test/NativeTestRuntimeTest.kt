package com.margelo.nitro.test

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeTestRuntimeTest {
  @Test
  fun reportsJavaScriptFailures() {
    val failure =
      NativeTestRuntime.runTest(
        "globalThis.runNitroTest = async () => { throw new Error('sentinel failure'); };",
        "bridge failure",
      )
    assertTrue(failure, failure.contains("sentinel failure"))
  }

  @Test
  fun reportsSynchronousJavaScriptFailures() {
    val failure = NativeTestRuntime.runTest("throw new Error('sync sentinel');", "bundle failure")
    assertTrue(failure, failure.contains("sync sentinel"))
  }

  @Test
  fun timesOutPendingPromises() {
    val failure =
      NativeTestRuntime.runTest(
        "globalThis.runNitroTest = () => new Promise(() => {});",
        "pending promise",
        50,
      )
    assertTrue(failure, failure.contains("timed out", ignoreCase = true))
    assertTrue(failure, failure.contains("running JS test"))
  }

  @Test
  fun evaluationAndTestHaveSeparateTimeouts() {
    val source =
      """
      function wait(ms) {
        const deadline = Date.now() + ms;
        while (Date.now() < deadline) {}
      }
      wait(600);
      globalThis.runNitroTest = async () => {
        wait(600);
      };
      """.trimIndent()
    val failure = NativeTestRuntime.runTest(source, "separate timeouts", 1000)
    assertTrue(failure, failure.isEmpty())
  }

  @Test
  fun timesOutBundleEvaluation() {
    val source =
      """
      while (true) {}
      """.trimIndent()
    val failure = NativeTestRuntime.runTest(source, "evaluation loop", 100)
    assertTrue(failure, failure.contains("timed out", ignoreCase = true))
    assertTrue(failure, failure.contains("loading JS test bundle"))
  }

  @Test
  fun timesOutSynchronousJavaScript() {
    val source =
      """
      globalThis.runNitroTest = () => {
        while (true) {}
      };
      """.trimIndent()
    val failure = NativeTestRuntime.runTest(source, "test loop", 100)
    assertTrue(failure, failure.contains("timed out", ignoreCase = true))
    assertTrue(failure, failure.contains("running JS test"))
  }

  @Test
  fun timesOutMicrotaskLoops() {
    val source =
      """
      globalThis.runNitroTest = async () => {
        while (true) {
          await Promise.resolve();
        }
      };
      """.trimIndent()
    val failure = NativeTestRuntime.runTest(source, "microtask loop", 100)
    assertTrue(failure, failure.contains("timed out", ignoreCase = true))
    assertTrue(failure, failure.contains("running JS test"))
  }
}
