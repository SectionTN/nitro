package com.margelo.nitro.testing.runner

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.margelo.nitro.test.HybridGrandchild
import com.margelo.nitro.test.HybridJNITestObject
import com.margelo.nitro.test.HybridJNITestObjectSpec
import com.margelo.nitro.test.JNIScalar
import com.margelo.nitro.test.JNIValues
import org.junit.Assert.assertThrows
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class JNILifetimeTest {
  @Test
  fun diagnosesUnconfiguredClosedImplementationsInDebug() {
    assumeTrue(BuildConfig.DEBUG)
    NativeTestRuntime.checkClosedImplementation(HybridJNITestObject())
    val other =
      object : HybridJNITestObjectSpec() {
        override var computedValue: Double = 0.0

        override fun roundtrip(value: JNIValues): JNIValues = value

        override fun roundtripScalar(value: JNIScalar): JNIScalar = value
      }
    assertThrows(RuntimeException::class.java) { NativeTestRuntime.checkClosedImplementation(other) }
  }

  @Test
  fun stringHashesPreserveUnicodeAndEmbeddedNulls() {
    NativeTestRuntime.checkStringHashes()
  }

  @Test
  fun retainedEnumsShareOneGlobalAcrossLocalFrames() {
    NativeTestRuntime.checkRetainedEnums()
  }

  @Test
  fun sharesJavaOwnershipAcrossCrossModuleInheritance() {
    val value = HybridGrandchild()
    NativeTestRuntime.checkHybridObjectCache(value, false)
  }

  @Test
  fun synchronizesConcurrentConversionAndDisposal() {
    val value = HybridGrandchild()
    NativeTestRuntime.checkHybridObjectCache(value, true)
    NativeTestRuntime.checkHybridObjectCache(value, false)
  }
}
