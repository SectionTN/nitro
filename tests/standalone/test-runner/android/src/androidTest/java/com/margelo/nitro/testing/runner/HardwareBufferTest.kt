package com.margelo.nitro.testing.runner

import android.hardware.HardwareBuffer
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.margelo.nitro.utils.HardwareBufferUtils
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class HardwareBufferTest {
  @Before
  fun initializeNativeLibrary() {
    NativeTestRuntime.singletonNull()
  }

  private fun blob(size: Int): HardwareBuffer =
    HardwareBuffer.create(
      size,
      1,
      HardwareBuffer.BLOB,
      1,
      HardwareBuffer.USAGE_CPU_READ_OFTEN or HardwareBuffer.USAGE_CPU_WRITE_OFTEN,
    )

  private fun openFileDescriptors(): Int {
    return checkNotNull(File("/proc/self/fd").list()).size
  }

  @Test
  fun copiedBufferOwnsItsBytesAfterSourceCloses() {
    val copy =
      blob(64).use { source ->
        assertTrue(NativeTestRuntime.checkHardwareBufferBytes(source, true))
        HardwareBufferUtils.copyHardwareBuffer(source)
      }
    copy.use {
      assertEquals(64, it.width)
      assertTrue(NativeTestRuntime.checkHardwareBufferBytes(it, false))
    }
  }

  @Test
  fun closingCopiesReleasesNativeAllocation() {
    blob(64).use { source ->
      repeat(16) { HardwareBufferUtils.copyHardwareBuffer(source).close() }
      val before = openFileDescriptors()
      repeat(64) { HardwareBufferUtils.copyHardwareBuffer(source).close() }
      val after = openFileDescriptors()
      assertTrue("Closed copies leaked file descriptors: $before -> $after", after <= before + 8)
    }
  }

  @Test
  fun failedCopiesReleaseDestinationAllocation() {
    HardwareBuffer.create(16, 16, HardwareBuffer.RGBA_8888, 1, HardwareBuffer.USAGE_GPU_SAMPLED_IMAGE).use { source ->
      repeat(16) {
        assertThrows(RuntimeException::class.java) { HardwareBufferUtils.copyHardwareBuffer(source) }
      }
      val before = openFileDescriptors()
      repeat(64) {
        assertThrows(RuntimeException::class.java) { HardwareBufferUtils.copyHardwareBuffer(source) }
      }
      val after = openFileDescriptors()
      assertTrue("Failed copies leaked file descriptors: $before -> $after", after <= before + 8)
    }
  }

  @Test
  fun rejectsMismatchedSizesBeforeCopying() {
    blob(128).use { source ->
      blob(64).use { destination ->
        assertThrows(RuntimeException::class.java) { HardwareBufferUtils.copyHardwareBuffer(source, destination) }
      }
    }
  }
}
