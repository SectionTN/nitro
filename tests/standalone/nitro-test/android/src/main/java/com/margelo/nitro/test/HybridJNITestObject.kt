package com.margelo.nitro.test

class HybridJNITestObject : HybridJNITestObjectSpec() {
  override fun roundtrip(value: JNIValues): JNIValues = value
}
