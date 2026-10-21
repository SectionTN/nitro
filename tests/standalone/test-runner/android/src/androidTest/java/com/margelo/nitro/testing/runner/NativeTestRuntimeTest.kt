package com.margelo.nitro.testing.runner

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeTestRuntimeTest {
  @Test
  fun reportsJavaScriptFailures() {
    val failure =
      NativeTestRuntime.runSuite(
        "globalThis.runNitroTest = async () => { throw new Error('sentinel failure'); };",
        arrayOf("bridge failure"),
      )
    assertTrue(failure, failure.contains("sentinel failure"))
  }

  @Test
  fun reportsSynchronousJavaScriptFailures() {
    val failure = NativeTestRuntime.runSuite("throw new Error('sync sentinel');", arrayOf("bundle failure"))
    assertTrue(failure, failure.contains("sync sentinel"))
  }

  @Test
  fun reusingBundleKeepsRuntimesIsolated() {
    val source =
      """
      globalThis.bundleEvaluations = (globalThis.bundleEvaluations ?? 0) + 1;
      globalThis.executionCount = 0;
      globalThis.runNitroTest = async (name) => {
        if (globalThis.bundleEvaluations !== 1) throw new Error('runtime was reused');
        globalThis.executionCount++;
        if (globalThis.executionCount !== Number(name)) throw new Error('unexpected runtime state');
      };
      """.trimIndent()
    repeat(2) {
      val failure = NativeTestRuntime.runSuite(source, arrayOf("1", "2"), 1000)
      assertTrue(failure, failure.isEmpty())
    }
  }

  @Test
  fun changedBundleReplacesPreparedSource() {
    for (message in listOf("alpha", "bravo", "alpha")) {
      val source = "globalThis.runNitroTest = async () => { throw new Error('$message'); };"
      val failure = NativeTestRuntime.runSuite(source, arrayOf("changed source"), 1000)
      assertTrue(failure, failure.contains(message))
    }
  }

  @Test
  fun invalidSourceDoesNotPoisonPreparedBundle() {
    val source = "globalThis.runNitroTest = async () => {};"
    val first = NativeTestRuntime.runSuite(source, arrayOf("valid source"), 1000)
    assertTrue(first, first.isEmpty())
    val invalid = NativeTestRuntime.runSuite("globalThis.runNitroTest = async () => {", arrayOf("invalid source"), 1000)
    assertTrue("Invalid source unexpectedly passed", invalid.isNotEmpty())
    val repeated = NativeTestRuntime.runSuite(source, arrayOf("valid source"), 1000)
    assertTrue(repeated, repeated.isEmpty())
  }

  @Test
  fun timeoutOverridesApplyOnlyToSelectedCase() {
    val source =
      """
      globalThis.getNitroTestTimeoutMs = (name) => name === 'slow' ? 2000 : undefined;
      globalThis.runNitroTest = async () => {
        const deadline = Date.now() + 1200;
        while (Date.now() < deadline) {}
      };
      """.trimIndent()
    val ordinary = NativeTestRuntime.runSuite(source, arrayOf("slow", "ordinary"), 1000)
    assertTrue(ordinary, ordinary.contains("timed out", ignoreCase = true))
    assertTrue(ordinary, ordinary.contains("running JS test"))
  }

  @Test
  fun rejectsInvalidTimeoutOverrides() {
    for (value in listOf("0", "-1", "1.5", "NaN", "Infinity", "4294967296", "'1000'", "null")) {
      val source =
        """
        globalThis.getNitroTestTimeoutMs = () => $value;
        globalThis.runNitroTest = async () => {};
        """.trimIndent()
      val failure = NativeTestRuntime.runSuite(source, arrayOf("invalid timeout $value"), 1000)
      assertTrue(failure, failure.contains("getNitroTestTimeoutMs"))
    }
  }

  @Test
  fun timesOutPendingPromises() {
    val failure =
      NativeTestRuntime.runSuite(
        "globalThis.runNitroTest = () => new Promise(() => {});",
        arrayOf("pending promise"),
        1000,
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
    val failure = NativeTestRuntime.runSuite(source, arrayOf("separate timeouts"), 1000)
    assertTrue(failure, failure.isEmpty())
  }

  @Test
  fun timesOutBundleEvaluation() {
    val source =
      """
      while (true) {}
      """.trimIndent()
    val failure = NativeTestRuntime.runSuite(source, arrayOf("evaluation loop"), 1000)
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
    val failure = NativeTestRuntime.runSuite(source, arrayOf("test loop"), 1000)
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
    val failure = NativeTestRuntime.runSuite(source, arrayOf("microtask loop"), 1000)
    assertTrue(failure, failure.contains("timed out", ignoreCase = true))
    assertTrue(failure, failure.contains("running JS test"))
  }
}
