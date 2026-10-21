package com.margelo.nitro.testing.runner

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class JNIMapTest {
  @Test
  fun convertsCustomMapWithoutAssumingHashMap() {
    val expected = linkedMapOf("a" to "世界", "b" to "value", "c" to "")
    var traversals = 0
    val custom =
      object : AbstractMap<String, String>() {
        override val size: Int get() = 3
        override val entries: Set<Map.Entry<String, String>>
          get() {
            traversals++
            return expected.entries
          }
      }
    assertEquals(expected, NativeTestRuntime.roundtripStringMap(custom))
    assertEquals(1, traversals)
    assertEquals(emptyMap<String, String>(), NativeTestRuntime.roundtripStringMap(emptyMap<String, String>()))
  }

  @Test
  fun rejectsInvalidErasedKeyAndValueTypes() {
    assertThrows(ClassCastException::class.java) { NativeTestRuntime.roundtripStringMap(mapOf(42 to "value")) }
    assertThrows(ClassCastException::class.java) { NativeTestRuntime.roundtripStringMap(mapOf("key" to 42)) }
  }
}
