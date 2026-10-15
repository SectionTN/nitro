import { describe, expect, fn, it, waitFor } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import { itIf } from './utils/helpers'
import { describeEachTestObject, type TestObject } from './utils/testObjects'

// 55k allocations verify that there are no memory leaks for two reasons;
// 1) It's a lot of allocations and any VM (JS, JVM) will likely trigger GC
// 2) In JVM, 51_200 is the limit for `jni::global_ref`s, then the app crashes - this intentionally exhausts that
const MEMORY_LEAK_TEST_ALLOCATION_COUNT = 55_000
const EXTERNAL_MEMORY_TEST_SIZE = 1024 * 1024
// If less than 10% of the allocations are still alive, GC freed most of them
const MAX_REMAINING_ALLOCATIONS = MEMORY_LEAK_TEST_ALLOCATION_COUNT * 0.1
const GC_BATCH_SIZE = 1000

type HermesInternal = {
  getInstrumentedStats?: () => { js_externalBytes: number }
}

function getHermesInternal(): HermesInternal | undefined {
  return (globalThis as typeof globalThis & { HermesInternal?: HermesInternal })
    .HermesInternal
}

function getHermesExternalMemorySize(): number {
  const hermesInternal = getHermesInternal()

  if (hermesInternal?.getInstrumentedStats == null) {
    throw new Error('Hermes instrumentation is unavailable!')
  }

  return hermesInternal.getInstrumentedStats().js_externalBytes
}

const IS_HERMES = getHermesInternal() != null

// Kept alive across tests on purpose - each run drops the previous run's
// callbacks, so `gc()` has to free callbacks that are bound to native functions.
let lotsOfCallbacks: ((num: number) => void)[] = []

describeEachTestObject('Memory', (testObject) => {
  it('createNativeCallback(...) callbacks still work after gc()', async () => {
    lotsOfCallbacks = []
    const onCalled = fn<(num: number) => void>()
    for (let i = 0; i < 10_000; i++) {
      const cb = testObject.createNativeCallback((num) => {
        onCalled(i + num)
      })
      lotsOfCallbacks.push(cb)
    }
    gc()

    lotsOfCallbacks[lotsOfCallbacks.length - 1]?.(1)
    await waitFor(() => expect(onCalled).toHaveBeenCalledWith(10_000), {
      timeout: 2000,
    })
  })

  it('newTestObject() objects are reclaimed by JS GC', () => {
    const baselineAllocations =
      NitroModules.debug_getTotalAllocatedHybridObjects()

    const objects: TestObject[] = []
    for (let i = 0; i < MEMORY_LEAK_TEST_ALLOCATION_COUNT; i++) {
      const object = testObject.newTestObject()
      object.numberValue = i
      objects.push(object)

      if (objects.length >= GC_BATCH_SIZE) {
        objects.length = 0
        gc()
      }
    }

    objects.length = 0
    gc()
    gc()
    gc()

    const currentAllocations =
      NitroModules.debug_getTotalAllocatedHybridObjects()
    expect(
      currentAllocations - baselineAllocations,
      `HybridObjects still alive (baseline: ${baselineAllocations}, current: ${currentAllocations})`
    ).toBeLessThan(MAX_REMAINING_ALLOCATIONS)
  })

  it('newTestObject() objects are released by manual dispose()', () => {
    const baselineAllocations =
      NitroModules.debug_getTotalAllocatedHybridObjects()

    for (let i = 0; i < MEMORY_LEAK_TEST_ALLOCATION_COUNT; i++) {
      const object = testObject.newTestObject()
      object.dispose()

      if ((i + 1) % GC_BATCH_SIZE === 0) {
        gc()
      }
    }

    gc()

    const currentAllocations =
      NitroModules.debug_getTotalAllocatedHybridObjects()
    expect(
      currentAllocations - baselineAllocations,
      `HybridObjects still alive (baseline: ${baselineAllocations}, current: ${currentAllocations})`
    ).toBeLessThan(MAX_REMAINING_ALLOCATIONS)
  })

  it('dispose() calls optionalCallback one last time', async () => {
    const hybridObject = testObject.newTestObject()
    const optionalCallback = fn<(value: number) => void>()
    hybridObject.optionalCallback = optionalCallback
    // dispose() will call this.optionalCallback() one last time then the object is gone
    hybridObject.dispose()
    await waitFor(() => expect(optionalCallback).toHaveBeenCalledWith(13), {
      timeout: 2000,
    })
  })

  itIf(IS_HERMES)(
    'NitroModules.updateMemorySize(obj) updates external memory pressure',
    () => {
      const originalString = testObject.stringValue

      try {
        testObject.stringValue = ''
        NitroModules.updateMemorySize(testObject)

        testObject.stringValue = 'x'.repeat(EXTERNAL_MEMORY_TEST_SIZE)
        // Reporting external memory can trigger a GC, which would then also free
        // unrelated garbage (like the 1 MiB string above) - so collect it first.
        gc()
        const externalBytesBefore = getHermesExternalMemorySize()
        NitroModules.updateMemorySize(testObject)
        const externalBytesAfter = getHermesExternalMemorySize()

        expect(externalBytesAfter - externalBytesBefore).toBe(
          EXTERNAL_MEMORY_TEST_SIZE
        )
      } finally {
        testObject.stringValue = originalString
        NitroModules.updateMemorySize(testObject)
      }
    }
  )
})

describe('NitroModules memory', () => {
  itIf(IS_HERMES)(
    'NitroModules.createNativeArrayBuffer(...) reports external memory pressure',
    () => {
      const size = EXTERNAL_MEMORY_TEST_SIZE
      // Reporting external memory can trigger a GC, which would then also free
      // garbage of earlier tests (like 1 MiB strings) - so collect it first.
      gc()
      const externalBytesBefore = getHermesExternalMemorySize()
      const buffer = NitroModules.createNativeArrayBuffer(size)
      const externalBytesAfter = getHermesExternalMemorySize()

      expect(buffer.byteLength).toBe(size)
      expect(externalBytesAfter - externalBytesBefore).toBe(size)
    }
  )
})
