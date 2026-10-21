package com.margelo.nitro.testing.runner

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.facebook.jni.HybridData
import com.margelo.nitro.core.Promise
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class JNIPromiseTest {
  @Before
  fun initializeNativeLibrary() {
    NativeTestRuntime.singletonNull()
  }

  @Test
  fun resolvedPromiseDeliversPendingAndLateListeners() {
    val promise = Promise<String>()
    val values = mutableListOf<String>()
    promise.then { values.add("first:$it") }
    promise.then { values.add("second:$it") }
    promise.resolve("value")
    promise.then { values.add("late:$it") }
    assertEquals(listOf("first:value", "second:value", "late:value"), values)
  }

  @Test
  fun rejectionPreservesThrowableForEveryListener() {
    val promise = Promise<Unit>()
    val error = IllegalStateException("sentinel rejection")
    val errors = mutableListOf<Throwable>()
    promise.catch { errors.add(it) }
    promise.reject(error)
    promise.catch { errors.add(it) }
    assertEquals(2, errors.size)
    errors.forEach { assertSame(error, it) }
  }

  @Test
  fun settledListenerCanReleaseItsNativeOwnerReentrantly() {
    val promise = NativeTestRuntime.resolvedVoidPromise()
    val field = Promise::class.java.getDeclaredField("mHybridData")
    field.isAccessible = true
    var called = false
    promise.then { value ->
      assertSame(Unit, value)
      (field.get(promise) as HybridData).resetNative()
      called = true
    }
    assertTrue(called)
  }
}
