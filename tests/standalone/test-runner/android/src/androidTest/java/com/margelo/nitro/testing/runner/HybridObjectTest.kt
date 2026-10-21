package com.margelo.nitro.testing.runner

import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class HybridObjectTest(
  private val name: String,
  private val names: Array<String>,
  private val skipReason: String?,
) {
  @Test
  fun runJavaScriptSuite() {
    assumeTrue(skipReason, skipReason == null)
    val failure = NativeTestRuntime.runSuite(readAsset("runtime-tests.js"), names)
    if (failure.isNotEmpty()) throw AssertionError("$name\n$failure")
  }

  companion object {
    @JvmStatic
    @Parameterized.Parameters(name = "{0}")
    fun cases(): List<Array<Any?>> {
      val parser = JSONTokener(readAsset("runtime-tests.json"))
      val manifest = parser.nextValue()
      require(manifest is JSONObject && parser.nextClean() == '\u0000') {
        "runtime-tests.json must contain an object of test suites"
      }
      require(manifest.length() > 0) { "runtime-tests.json contains no tests" }

      val skipParser = JSONTokener(readAsset("runtime-test-skips.json"))
      val skips = skipParser.nextValue()
      require(skips is JSONObject && skipParser.nextClean() == '\u0000') {
        "runtime-test-skips.json must contain an object"
      }

      val names = mutableSetOf<String>()
      val cases = mutableListOf<Array<Any?>>()
      manifest.keys().forEach { suite ->
        require(suite.isNotBlank()) { "runtime-tests.json contains a blank suite name" }
        val suiteNames = manifest.get(suite)
        require(suiteNames is JSONArray && suiteNames.length() > 0) {
          "runtime-tests.json suite $suite must contain a nonempty array of test names"
        }
        val enabledNames = mutableListOf<String>()
        for (index in 0 until suiteNames.length()) {
          val name = suiteNames.get(index)
          require(name is String && name.isNotBlank()) {
            "runtime-tests.json suite $suite entry $index must be a nonblank string"
          }
          require(names.add(name)) { "runtime-tests.json contains duplicate test: $name" }
          val rules = if (skips.has(name)) skips.getJSONObject(name) else null
          rules?.keys()?.forEach { key ->
            require(key in listOf("ios", "android", "release") && rules.getString(key).isNotEmpty()) {
              "Invalid exclusion for test $name"
            }
          }
          val reason =
            when {
              rules?.has("android") == true -> rules.getString("android")
              !BuildConfig.DEBUG && rules?.has("release") == true -> rules.getString("release")
              else -> null
            }
          if (reason == null) {
            enabledNames.add(name)
          } else {
            cases.add(arrayOf(name, emptyArray<String>(), reason))
          }
        }
        if (enabledNames.isNotEmpty()) cases.add(arrayOf(suite, enabledNames.toTypedArray(), null))
      }
      require(skips.keys().asSequence().all { it in names }) { "Exclusions contain an unknown test name" }
      return cases
    }

    private fun readAsset(name: String): String =
      InstrumentationRegistry
        .getInstrumentation()
        .context.assets
        .open(name)
        .bufferedReader()
        .use { it.readText() }
  }
}
