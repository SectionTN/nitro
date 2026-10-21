package com.margelo.nitro.testing.runner

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.margelo.nitro.test.HybridGrandchild
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class JNILifetimeTest {
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
