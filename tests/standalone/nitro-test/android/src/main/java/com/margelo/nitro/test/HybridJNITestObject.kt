package com.margelo.nitro.test

class HybridJNITestObject : HybridJNITestObjectSpec() {
  private var storage: Double = 0.0
  override var computedValue: Double
    get() = storage * 2
    set(value) {
      storage = value + 1
    }

  override fun roundtripScalar(value: JNIScalar): JNIScalar = value

  override fun roundtrip(value: JNIValues): JNIValues = value
}
