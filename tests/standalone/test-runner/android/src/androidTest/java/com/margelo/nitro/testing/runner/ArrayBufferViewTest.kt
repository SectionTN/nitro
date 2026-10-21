package com.margelo.nitro.testing.runner

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.margelo.nitro.core.ArrayBuffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotSame
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.nio.ByteOrder

@RunWith(AndroidJUnit4::class)
class ArrayBufferViewTest {
  @Before
  fun initializeNativeLibrary() {
    NativeTestRuntime.singletonNull()
  }

  @Test
  fun everyBackingReturnsIndependentNativeOrderViews() {
    for (size in listOf(0, 1, 64)) {
      val buffers =
        listOf(
          ArrayBuffer.allocate(size),
          NativeTestRuntime.nativeBuffer(size, false),
          NativeTestRuntime.nativeBuffer(size, true),
        )
      for (buffer in buffers) {
        for (copy in listOf(false, true)) {
          val first = buffer.getBuffer(copy)
          val second = buffer.getBuffer(copy)
          assertNotSame(first, second)
          assertEquals(ByteOrder.nativeOrder(), first.order())
          assertEquals(ByteOrder.nativeOrder(), second.order())
          assertEquals(0, first.position())
          assertEquals(size, first.limit())
          if (size > 0) {
            first.put(0, 42)
            first.limit(0)
            assertEquals(0, second.position())
            assertEquals(size, second.limit())
            if (!copy || buffer.isByteBuffer) assertEquals(42.toByte(), second.get(0))
          }
        }
      }
    }
  }
}
