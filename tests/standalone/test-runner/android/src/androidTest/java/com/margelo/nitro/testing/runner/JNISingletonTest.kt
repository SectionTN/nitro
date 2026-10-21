package com.margelo.nitro.testing.runner

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.margelo.nitro.core.NullType
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class JNISingletonTest {
  @Test
  fun singletonsSurviveLocalFramesAndConcurrentNativeThreads() {
    NativeTestRuntime.checkConcurrentSingletons()
    repeat(100) { assertSame(NullType.NULL, NativeTestRuntime.singletonNull()) }
    Runtime.getRuntime().gc()
    assertSame(NullType.NULL, NativeTestRuntime.singletonNull())
  }

  @Test
  fun nativeVoidPromiseDeliversKotlinUnitToTypedListener() {
    var called = false
    NativeTestRuntime.resolvedVoidPromise().then { value ->
      assertSame(Unit, value)
      called = true
    }
    assertTrue("The already resolved Promise must invoke its listener", called)
  }
}
