import { expect } from 'chai'
import { casesForTestObjects, delay, recordCallback, rejection, waitFor, withTimeout, settledWithin, STILL_PENDING } from './utils/cases'
import { type Car } from 'nitro-test'
import { TEST_CAR, TEST_CAR_2 } from './utils/fixtures'
import { deferred } from './utils/helpers'
import { NitroModules } from 'nitro-core'

// Owning callbacks invoked through their default call operator run asynchronously
// through the JS dispatcher. Inline callbacks run before the native method returns.
const CALLBACK_TIMEOUT = { timeout: 2000 }

// `createArrayBuffer()` allocates 10 MB on every platform.
const CREATED_ARRAY_BUFFER_SIZE = 1024 * 1024 * 10

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Matches exactly `text`, not just a substring of the error message. */
function exactly(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}$`)
}

/** A JS reference implementation of `calculateFibonacciSync(n)`. */
function fibonacci(n: number): bigint {
  let current = 0n
  let next = 1n
  for (let i = 0; i < n; i++) {
    ;[current, next] = [next, current + next]
  }
  return current
}

/**
 * Matches `prefix` followed by exactly `message`. Kotlin exceptions reach JS
 * through fbjni as `<java class>: <message>` followed by `\n\tat ...` stack
 * lines, so an optional class name and trailing lines are allowed.
 */
function exactNativeMessage(prefix: string, message: string): RegExp {
  return new RegExp(`^${escapeRegExp(prefix)}(?:[\\w.$]+: )?${escapeRegExp(message)}(?:\\n|$)`)
}

/** Matches the message of a rejected native Promise (no method prefix). */
function rejectionMessage(message: string): RegExp {
  return exactNativeMessage('', message)
}

/** Matches the message of a synchronous throw from `<object>.<method>(...)`. */
function nativeErrorMessage(objectName: string, method: string, message: string): RegExp {
  return exactNativeMessage(`${objectName}.${method}(...): `, message)
}

export const cases = {
  ...casesForTestObjects('Callbacks', {
    'callInlineCallback(...) runs synchronously exactly once': (testObject) => {
      const order: string[] = ['before']
      testObject.callInlineCallback(() => {
        order.push('callback')
      })
      order.push('after')
      expect(order).to.deep.equal(['before', 'callback', 'after'])
    },

    'callInlineCallbackWithValue(...) forwards the argument and returns the result': (testObject) => {
      const values: number[] = []
      const result = testObject.callInlineCallbackWithValue(21, (value) => {
        values.push(value)
        return value * 2
      })
      expect(values).to.deep.equal([21])
      expect(result).to.equal(42)
    },

    'callInlineCallback(...) propagates a thrown callback error': (testObject) => {
      expect(() =>
        testObject.callInlineCallback(() => {
          throw new Error('Inline void callback failed')
        })
      ).to.throw('Inline void callback failed')
    },

    'callInlineCallbackWithValue(...) propagates a thrown callback error': (testObject) => {
      expect(() =>
        testObject.callInlineCallbackWithValue(21, () => {
          throw new Error('Inline value callback failed')
        })
      ).to.throw('Inline value callback failed')
    },

    'callCallback(...) calls the callback once without arguments': async (testObject) => {
      const callback = recordCallback()
      testObject.callCallback(callback)
      await waitFor(() => expect(callback.calls).to.have.length(1), CALLBACK_TIMEOUT)
      expect(callback.calls).to.deep.include([])
    },

    'callWithOptional(undefined) calls back with undefined': async (testObject) => {
      const callback = recordCallback()
      testObject.callWithOptional(undefined, callback)
      await waitFor(() => expect(callback.calls).to.deep.include([undefined]), CALLBACK_TIMEOUT)
    },

    'callWithOptional(433) calls back with 433': async (testObject) => {
      const callback = recordCallback()
      testObject.callWithOptional(433, callback)
      await waitFor(() => expect(callback.calls).to.deep.include([433]), CALLBACK_TIMEOUT)
    },

    'getValueFromJsCallback(...) passes the JS value to the second callback': async (testObject) => {
      const andThenCall = recordCallback()
      await withTimeout(testObject.getValueFromJsCallback(() => 'hello', andThenCall))
      await waitFor(() => expect(andThenCall.calls).to.deep.include(['hello']), CALLBACK_TIMEOUT)
    },

    'callCallbackThatReturnsPromiseVoid(...) awaits the returned Promise': async (testObject) => {
      const callback = recordCallback(() => Promise.resolve())
      await expect(await withTimeout(testObject.callCallbackThatReturnsPromiseVoid(callback))).to.equal(undefined)
      expect(callback.calls).to.have.length(1)
    },

    'getValueFromJSCallbackAndWait(...) awaits a single callback': async (testObject) => {
      await expect(Object.is(await withTimeout(testObject.getValueFromJSCallbackAndWait(() => 73)), 73)).to.equal(true)
    },

    'callAll(...) calls all three callbacks in order': async (testObject) => {
      const calls: string[] = []
      const first = recordCallback(() => {
        calls.push('first')
      })
      const second = recordCallback(() => {
        calls.push('second')
      })
      const third = recordCallback(() => {
        calls.push('third')
      })
      testObject.callAll(first, second, third)
      await waitFor(() => {
        expect(first.calls).to.have.length(1)
        expect(second.calls).to.have.length(1)
        expect(third.calls).to.have.length(1)
      }, CALLBACK_TIMEOUT)
      expect(calls).to.deep.equal(['first', 'second', 'third'])
    },

    'callSumUpNTimes(...) calls the callback multiple times': async (testObject) => {
      const callback = recordCallback(() => 7)
      await expect(Object.is(await withTimeout(testObject.callSumUpNTimes(callback, 5)), 7 * 5)).to.equal(true)
      expect(callback.calls).to.have.length(5)
    },

    'callbackAsyncPromise(...) awaits an async callback on native': async (testObject) => {
      await expect(Object.is(await withTimeout(testObject.callbackAsyncPromise(async () => 13)), 13)).to.equal(true)
    },

    'callbackAsyncPromiseBuffer(...) awaits an async ArrayBuffer callback on native': async (testObject) => {
      const result = await withTimeout(
        testObject.callbackAsyncPromiseBuffer(async () => {
          const buffer = await testObject.createArrayBufferAsync()
          // The 10 MB are uninitialized, so mark a few bytes to compare.
          const bytes = new Uint8Array(buffer)
          bytes.set([13, 37])
          bytes[bytes.length - 1] = 42
          return buffer
        })
      )
      expect(result).to.be.instanceOf(ArrayBuffer)
      expect(Object.is(result.byteLength, CREATED_ARRAY_BUFFER_SIZE)).to.equal(true)
      const bytes = new Uint8Array(result)
      expect([bytes[0], bytes[1], bytes[bytes.length - 1]]).to.deep.equal([13, 37, 42])
    },

    'callbackAsyncPromise(...) rejects when the JS callback throws': async (testObject) => {
      await expect(
        await rejection(
          withTimeout(
            testObject.callbackAsyncPromise(() => {
              throw new Error('throwing in JS!')
            })
          )
        )
      )
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('throwing in JS!')
    },

    'getComplexCallback() returns a native function': (testObject) => {
      const callback = testObject.getComplexCallback()
      expect(callback).to.be.a('function')
      expect(callback(55)).to.equal(undefined)
    },

    'twoOptionalCallbacks(...) calls both callbacks': async (testObject) => {
      const first = recordCallback()
      const second = recordCallback()
      testObject.twoOptionalCallbacks(55, first, second)
      await waitFor(() => {
        expect(first.calls).to.deep.include([55])
        // Swift passes 'Hello', C++ and Kotlin pass 'Hello!'
        expect(second.calls.some((args) => args.length === 1 && typeof args[0] === 'string' && args[0].includes('Hello'))).to.equal(true)
      }, CALLBACK_TIMEOUT)
    },

    'twoOptionalCallbacks(...) works without callbacks': (testObject) => {
      testObject.twoOptionalCallbacks(55)
    },

    'errorCallback(...) calls back with an Error': async (testObject) => {
      const onError = recordCallback()
      testObject.errorCallback(onError)
      await waitFor(
        () => expect(onError.calls.some((args) => args.length === 1 && args[0] instanceof Error)).to.equal(true),
        CALLBACK_TIMEOUT
      )
      // Kotlin's message is the JniException's text: the Throwable class name
      // prefix, possibly followed by a stack trace.
      expect(onError.calls[0]?.[0])
        .to.have.property('message')
        .that.matches(/^(?:[\w.$]+: )?Some Error!(?:\n|$)/)
    },

    'createNativeCallback(...) invokes the wrapped JS callback': async (testObject) => {
      const wrapped = recordCallback()
      const callback = testObject.createNativeCallback(wrapped)
      callback(55)
      await waitFor(() => expect(wrapped.calls).to.deep.include([55]), CALLBACK_TIMEOUT)
    },

    'callCallback(...) calls the callback only after returning': async (testObject) => {
      const callback = recordCallback()
      testObject.callCallback(callback)
      expect(callback.calls).to.have.length(0)
      await waitFor(() => expect(callback.calls).to.have.length(1), CALLBACK_TIMEOUT)
    },

    'callWithOptional(0, ...) calls back with 0 instead of undefined': async (testObject) => {
      const callback = recordCallback()
      testObject.callWithOptional(0, callback)
      await waitFor(() => expect(callback.calls).to.deep.include([0]), CALLBACK_TIMEOUT)
    },

    'twoOptionalCallbacks(...) calls only the first callback without a second one': async (testObject) => {
      const first = recordCallback()
      testObject.twoOptionalCallbacks(55, first)
      await waitFor(() => expect(first.calls).to.deep.include([55]), CALLBACK_TIMEOUT)
    },

    'twoOptionalCallbacks(...) calls the second callback when the first is undefined': async (testObject) => {
      const second = recordCallback()
      testObject.twoOptionalCallbacks(55, undefined, second)
      await waitFor(
        // Swift passes 'Hello', C++ and Kotlin pass 'Hello!'
        () =>
          expect(second.calls.some((args) => args.length === 1 && typeof args[0] === 'string' && /^Hello/.test(args[0]))).to.equal(true),
        CALLBACK_TIMEOUT
      )
    },

    'createNativeCallback(...) forwards every call in order': async (testObject) => {
      const wrapped = recordCallback()
      const callback = testObject.createNativeCallback(wrapped)
      callback(1)
      callback(2)
      callback(3)
      await waitFor(() => expect(wrapped.calls).to.have.length(3), CALLBACK_TIMEOUT)
      expect(wrapped.calls).to.deep.equal([[1], [2], [3]])
    },

    'getComplexCallback() returns a function with length 1': (testObject) => {
      expect(testObject.getComplexCallback()).to.have.length(1)
    },

    'getComplexCallback() function throws when called without arguments': (testObject) => {
      const callback = testObject.getComplexCallback()
      expect(() =>
        // @ts-expect-error intentionally omitting the argument
        callback()
      ).to.throw(exactly('Callback expected 1 arguments, but received 0!'))
    },

    'getComplexCallback() function throws when called with too many arguments': (testObject) => {
      const callback = testObject.getComplexCallback()
      expect(() =>
        // @ts-expect-error intentionally passing an extra argument
        callback(1, 2)
      ).to.throw(exactly('Callback expected 1 arguments, but received 2!'))
    },

    'callSumUpNTimes(..., 0) resolves to 0 without calling back': async (testObject) => {
      const callback = recordCallback(() => 7)
      await expect(Object.is(await withTimeout(testObject.callSumUpNTimes(callback, 0)), 0)).to.equal(true)
      expect(callback.calls).to.have.length(0)
    },

    'callSumUpNTimes(..., 20) sums 20 sequential callback results': async (testObject) => {
      let count = 0
      const callback = recordCallback(() => ++count)
      await expect(Object.is(await withTimeout(testObject.callSumUpNTimes(callback, 20), 5000), (20 * 21) / 2)).to.equal(true)
      expect(callback.calls).to.have.length(20)
    },

    'callSumUpNTimes(...) rejects when the callback throws': async (testObject) => {
      const callback = () => {
        throw new Error('sum callback failed')
      }
      await expect(await rejection(withTimeout(testObject.callSumUpNTimes(callback, 3))))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('sum callback failed')
    },

    'callSumUpNTimes(...) stops calling back after the callback threw': async (testObject) => {
      let count = 0
      const callback = recordCallback(() => {
        count++
        if (count === 2) {
          throw new Error('second call failed')
        }
        return 1
      })
      await expect(await rejection(withTimeout(testObject.callSumUpNTimes(callback, 5))))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('second call failed')
      expect(callback.calls).to.have.length(2)
    },

    'getValueFromJSCallbackAndWait(...) rejects when getValue throws': async (testObject) => {
      const getValue = () => {
        throw new Error('getValue failed')
      }
      await expect(await rejection(withTimeout(testObject.getValueFromJSCallbackAndWait(getValue))))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('getValue failed')
    },

    'getValueFromJsCallback(...) rejects when the callback throws': async (testObject) => {
      const callback = () => {
        throw new Error('getting the value failed')
      }
      await expect(await rejection(withTimeout(testObject.getValueFromJsCallback(callback, () => {}))))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('getting the value failed')
    },

    'getValueFromJsCallback(...) skips andThenCall when the callback throws': async (testObject) => {
      const andThenCall = recordCallback()
      const callback = () => {
        throw new Error('getting the value failed')
      }
      await expect(await rejection(withTimeout(testObject.getValueFromJsCallback(callback, andThenCall)))).to.be.instanceOf(Error)
      expect(andThenCall.calls).to.have.length(0)
    },

    'getValueFromJsCallback(...) passes a non-ASCII string unchanged': async (testObject) => {
      const value = 'Grüße, 世界 👋'
      const andThenCall = recordCallback()
      await withTimeout(testObject.getValueFromJsCallback(() => value, andThenCall))
      await waitFor(() => expect(andThenCall.calls).to.deep.include([value]), CALLBACK_TIMEOUT)
    },

    'callbackAsyncPromise(...) awaits a callback that resolves later': async (testObject) => {
      const callback = () => delay(50, 21)
      await expect(Object.is(await withTimeout(testObject.callbackAsyncPromise(callback)), 21)).to.equal(true)
    },

    'callbackAsyncPromise(...) rejects with "<name>: <message>" when the async callback rejects': async (testObject) => {
      const callback = () => Promise.reject<number>(new Error('rejected in an async callback'))
      await expect(await rejection(withTimeout(testObject.callbackAsyncPromise(callback))))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('Error: rejected in an async callback')
    },

    'callCallbackThatReturnsPromiseVoid(...) rejects when the returned Promise rejects': async (testObject) => {
      const callback = () => Promise.reject<void>(new Error('void Promise rejected'))
      await expect(await rejection(withTimeout(testObject.callCallbackThatReturnsPromiseVoid(callback))))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('Error: void Promise rejected')
    },

    'callbackAsyncPromiseBuffer(...) keeps the bytes of a JS ArrayBuffer': async (testObject) => {
      const buffer = new Uint8Array([0, 1, 127, 128, 255]).buffer
      const result = await withTimeout(testObject.callbackAsyncPromiseBuffer(() => Promise.resolve(buffer)))
      expect(result).to.be.instanceOf(ArrayBuffer)
      expect(new Uint8Array(result)).to.deep.equal(new Uint8Array([0, 1, 127, 128, 255]))
    },
  }),
  ...casesForTestObjects('Sync callbacks', {
    'callbackSync(...) calls the callback synchronously': (testObject) => {
      const callback = recordCallback(() => 55)
      expect(Object.is(testObject.callbackSync(callback), 55)).to.equal(true)
      expect(callback.calls).to.have.length(1)
    },

    'getSyncNumberCallback() returns a callback that returns 55': (testObject) => {
      const callback = testObject.getSyncNumberCallback()
      expect(Object.is(callback(), 55)).to.equal(true)
    },

    'bounceSyncInt64Callback(...) roundtrips -9223372036854775808': (testObject) => {
      const value = [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n][0]!

      const callback = testObject.bounceSyncInt64Callback((input) => input)
      expect(Object.is(callback(value), value)).to.equal(true)
    },

    'bounceSyncInt64Callback(...) roundtrips -1': (testObject) => {
      const value = [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n][1]!

      const callback = testObject.bounceSyncInt64Callback((input) => input)
      expect(Object.is(callback(value), value)).to.equal(true)
    },

    'bounceSyncInt64Callback(...) roundtrips 0': (testObject) => {
      const value = [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n][2]!

      const callback = testObject.bounceSyncInt64Callback((input) => input)
      expect(Object.is(callback(value), value)).to.equal(true)
    },

    'bounceSyncInt64Callback(...) roundtrips 9223372036854775807': (testObject) => {
      const value = [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n][3]!

      const callback = testObject.bounceSyncInt64Callback((input) => input)
      expect(Object.is(callback(value), value)).to.equal(true)
    },

    'callbackSync(...) calls the callback without arguments': (testObject) => {
      const callback = recordCallback(() => 55)
      testObject.callbackSync(callback)
      expect(callback.calls).to.deep.include([])
    },

    'callbackSync(...) returns a fractional result unchanged': (testObject) => {
      expect(
        Object.is(
          testObject.callbackSync(() => -13.37),
          -13.37
        )
      ).to.equal(true)
    },

    'callbackSync(...) rethrows the JS error with the method name': (testObject) => {
      const callback = () => {
        throw new Error('sync callback failed')
      }
      expect(() => testObject.callbackSync(callback)).to.throw(
        new RegExp(`^${escapeRegExp(`${testObject.constructor.name}.callbackSync(...): `)}.*sync callback failed`)
      )
    },

    'getSyncNumberCallback() function throws when called with an argument': (testObject) => {
      const callback = testObject.getSyncNumberCallback()
      expect(() =>
        // @ts-expect-error intentionally passing an extra argument
        callback(1)
      ).to.throw(exactly('Callback expected 0 arguments, but received 1!'))
    },

    'bounceSyncInt64Callback(...) returns the result of the JS callback': (testObject) => {
      const callback = testObject.bounceSyncInt64Callback((input) => input * 2n)
      expect(Object.is(callback(21n), 42n)).to.equal(true)
    },

    'bounceSyncInt64Callback(...) calls the JS callback synchronously': (testObject) => {
      const jsCallback = recordCallback((input: bigint) => input)
      const callback = testObject.bounceSyncInt64Callback(jsCallback)
      callback(5n)
      expect(jsCallback.calls).to.deep.include([5n])
    },
  }),
  ...casesForTestObjects('Promises', {
    'wait(0.1) resolves': async (testObject) => {
      await expect(await testObject.wait(0.1)).to.equal(undefined)
    },

    'calculateFibonacciSync(10) returns 55n': (testObject) => {
      expect(Object.is(testObject.calculateFibonacciSync(10), 55n)).to.equal(true)
    },

    'calculateFibonacciAsync(10) resolves to 55n': async (testObject) => {
      await expect(Object.is(await testObject.calculateFibonacciAsync(10), 55n)).to.equal(true)
    },

    'promiseThrows() rejects': async (testObject) => {
      // Native rejects the returned Promise instead of throwing synchronously.
      const promise = testObject.promiseThrows()
      expect(promise).to.be.instanceOf(Promise)
      await expect(await rejection(promise)).to.be.instanceOf(Error)
      await expect(await rejection(promise))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.match(rejectionMessage('Promise throws :)'))
    },

    'promiseReturnsInstantly() resolves to 55': async (testObject) => {
      await expect(Object.is(await testObject.promiseReturnsInstantly(), 55)).to.equal(true)
    },

    'promiseReturnsInstantlyAsync() resolves to 55': async (testObject) => {
      await expect(Object.is(await testObject.promiseReturnsInstantlyAsync(), 55)).to.equal(true)
    },

    'promiseReturnsInstantlyAsync() resolves 100 parallel calls': async (testObject) => {
      const results = await Promise.all(Array.from({ length: 100 }, () => testObject.promiseReturnsInstantlyAsync()))
      expect(results).to.deep.equal(Array(100).fill(55))
    },

    'promiseThatResolvesVoidInstantly() resolves to undefined': async (testObject) => {
      await expect(await testObject.promiseThatResolvesVoidInstantly()).to.equal(undefined)
    },

    'promiseThatResolvesToUndefined() resolves to undefined': async (testObject) => {
      await expect(await testObject.promiseThatResolvesToUndefined()).to.equal(undefined)
    },

    'awaitNullablePromise() resolves to undefined': async (testObject) => {
      await expect(await testObject.awaitNullablePromise()).to.equal(undefined)
    },

    'wait(0.5) twice runs in parallel': async (testObject) => {
      const start = Date.now()
      // 0.5s + 0.5s = ~1s in serial, ~0.5s in parallel
      await Promise.all([testObject.wait(0.5), testObject.wait(0.5)])
      const duration = Date.now() - start
      expect(duration, 'ms for two parallel wait(0.5) calls').to.be.lessThan(1000)
    },

    'calculateFibonacciAsync(0) resolves to 0n': async (testObject) => {
      await expect(Object.is(await testObject.calculateFibonacciAsync(0), 0n)).to.equal(true)
    },

    'calculateFibonacciAsync(1) resolves to 1n': async (testObject) => {
      await expect(Object.is(await testObject.calculateFibonacciAsync(1), 1n)).to.equal(true)
    },

    'calculateFibonacciAsync(...) resolves 50 parallel calls with their own results': async (testObject) => {
      // The C++ implementation is recursive, so keep `n` small.
      const inputs = Array.from({ length: 50 }, (_, i) => i % 25)
      const results = await Promise.all(inputs.map((n) => testObject.calculateFibonacciAsync(n)))
      expect(results).to.deep.equal(inputs.map(fibonacci))
    },

    'wait(...) does not block the JS thread': async (testObject) => {
      // Kotlin truncates the seconds to a whole number, so wait at least 1s.
      const waited = testObject.wait(1).then(() => 'wait finished')
      await expect(Object.is(await Promise.race([waited, delay(20, 'JS timer fired')]), 'JS timer fired')).to.equal(true)
    },
  }),
  ...casesForTestObjects('Pending native Promises', {
    // Each TestObject only has one pending Promise slot, so every test uses its
    // own TestObject to not leak a pending Promise into the next test.

    'createPendingPromise() stays pending until it is triggered': async (testObject) => {
      const object = testObject.newTestObject()
      const promise = object.createPendingPromise()
      try {
        await expect(Object.is(await settledWithin(promise), STILL_PENDING)).to.equal(true)
      } finally {
        object.resolvePendingPromiseOnWorker()
      }
    },

    'resolvePendingPromiseOnWorker() resolves the pending Promise to 55': async (testObject) => {
      const object = testObject.newTestObject()
      const promise = object.createPendingPromise()
      object.resolvePendingPromiseOnWorker()
      await expect(Object.is(await withTimeout(promise), 55)).to.equal(true)
    },

    'createPendingPromise() throws while another Promise is pending': async (testObject) => {
      const object = testObject.newTestObject()
      const first = object.createPendingPromise()
      try {
        expect(() => object.createPendingPromise()).to.throw(
          nativeErrorMessage(testObject.constructor.name, 'createPendingPromise', 'A pending Promise is already waiting for completion.')
        )
      } finally {
        object.resolvePendingPromiseOnWorker()
      }
      await expect(Object.is(await withTimeout(first), 55)).to.equal(true)
    },

    'resolvePendingPromiseOnWorker() throws without a pending Promise': (testObject) => {
      const object = testObject.newTestObject()
      expect(() => object.resolvePendingPromiseOnWorker()).to.throw(
        nativeErrorMessage(testObject.constructor.name, 'resolvePendingPromiseOnWorker', 'No pending Promise is waiting for completion.')
      )
    },

    'createPendingPromise() works again after the previous Promise resolved': async (testObject) => {
      const object = testObject.newTestObject()
      const first = object.createPendingPromise()
      object.resolvePendingPromiseOnWorker()
      await expect(Object.is(await withTimeout(first), 55)).to.equal(true)

      const second = object.createPendingPromise()
      object.resolvePendingPromiseOnWorker()
      await expect(Object.is(await withTimeout(second), 55)).to.equal(true)
    },

    'createPendingPromise() has a separate pending slot per TestObject': async (testObject) => {
      const first = testObject.newTestObject()
      const second = testObject.newTestObject()
      const firstPromise = first.createPendingPromise()
      const secondPromise = second.createPendingPromise()
      first.resolvePendingPromiseOnWorker()
      second.resolvePendingPromiseOnWorker()
      await expect(await withTimeout(Promise.all([firstPromise, secondPromise]))).to.deep.equal([55, 55])
    },
  }),
  ...casesForTestObjects('JS Promises awaited on native', {
    'awaitAndGetPromise(...) resolves to the JS number': async (testObject) => {
      const jsPromise = deferred<number>()
      const nativePromise = testObject.awaitAndGetPromise(jsPromise.promise)
      jsPromise.resolve(5)
      await expect(Object.is(await withTimeout(nativePromise), 5)).to.equal(true)
    },

    'awaitAndGetComplexPromise(...) resolves to the JS Car': async (testObject) => {
      const jsPromise = deferred<Car>()
      const nativePromise = testObject.awaitAndGetComplexPromise(jsPromise.promise)
      jsPromise.resolve(TEST_CAR)
      await expect(await withTimeout(nativePromise)).to.deep.equal(TEST_CAR)
    },

    'awaitPromise(...) resolves when the JS Promise resolves': async (testObject) => {
      const jsPromise = deferred<void>()
      const nativePromise = testObject.awaitPromise(jsPromise.promise)
      jsPromise.resolve()
      await expect(await withTimeout(nativePromise)).to.equal(undefined)
    },

    'awaitPromise(...) rejects when the JS Promise rejects': async (testObject) => {
      const jsPromise = deferred<void>()
      const nativePromise = testObject.awaitPromise(jsPromise.promise)
      jsPromise.reject(new Error('rejected from JS!'))
      await expect(await rejection(withTimeout(nativePromise)))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('rejected from JS!')
    },

    'awaitAndGetPromise(...) stays pending while the JS Promise is pending': async (testObject) => {
      const jsPromise = deferred<number>()
      const nativePromise = testObject.awaitAndGetPromise(jsPromise.promise)
      try {
        await expect(Object.is(await settledWithin(nativePromise), STILL_PENDING)).to.equal(true)
      } finally {
        jsPromise.resolve(0)
      }
    },

    'awaitAndGetPromise(...) resolves an already resolved JS Promise': async (testObject) => {
      await expect(Object.is(await withTimeout(testObject.awaitAndGetPromise(Promise.resolve(42))), 42)).to.equal(true)
    },

    'awaitAndGetPromise(...) rejects with "<name>: <message>" of the JS error': async (testObject) => {
      const jsPromise = deferred<number>()
      const nativePromise = testObject.awaitAndGetPromise(jsPromise.promise)
      jsPromise.reject(new Error('rejected from JS!'))
      await expect(await rejection(withTimeout(nativePromise)))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.match(rejectionMessage('Error: rejected from JS!'))
    },

    'awaitAndGetComplexPromise(...) rejects when the JS Promise rejects': async (testObject) => {
      const jsPromise = deferred<Car>()
      const nativePromise = testObject.awaitAndGetComplexPromise(jsPromise.promise)
      jsPromise.reject(new Error('no car from JS!'))
      await expect(await rejection(withTimeout(nativePromise)))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('Error: no car from JS!')
    },

    'awaitPromise(...) rejection keeps the name of a TypeError': async (testObject) => {
      const jsPromise = deferred<void>()
      const nativePromise = testObject.awaitPromise(jsPromise.promise)
      jsPromise.reject(new TypeError('wrong type from JS!'))
      await expect(await rejection(withTimeout(nativePromise)))
        .to.be.instanceOf(Error)
        .and.have.property('message')
        .that.include('TypeError: wrong type from JS!')
    },

    'awaitAndGetComplexPromise(...) keeps every optional Car field': async (testObject) => {
      await expect(await withTimeout(testObject.awaitAndGetComplexPromise(Promise.resolve(TEST_CAR_2)))).to.deep.equal(TEST_CAR_2)
    },

    'awaitAndGetPromise(...) resolves 50 parallel JS Promises with their own values': async (testObject) => {
      const jsPromises = Array.from({ length: 50 }, () => deferred<number>())
      const nativePromises = jsPromises.map((jsPromise) => testObject.awaitAndGetPromise(jsPromise.promise))
      // Settle them in reverse order, so results can't line up by accident.
      for (let i = jsPromises.length - 1; i >= 0; i--) {
        jsPromises[i]!.resolve(i * 1.5)
      }
      await expect(await withTimeout(Promise.all(nativePromises))).to.deep.equal(jsPromises.map((_, i) => i * 1.5))
    },

    'awaitPromise(...) throws synchronously for a non-Promise argument': (testObject) => {
      expect(() =>
        // @ts-expect-error intentionally passing a number instead of a Promise
        testObject.awaitPromise(5)
      ).to.throw(`${testObject.constructor.name}.awaitPromise(...): `)
    },
  }),
  ...casesForTestObjects('Promises under parallel load', {
    // Resolve HybridObjects off the JS thread while JSIConverter::toJSI reads
    // Promise state on the JS thread.

    'newTestObjectAsync() resolves HybridObjects under parallel load': async (testObject) => {
      let objects: object[] = []
      for (let round = 0; round < 20; round++) {
        objects = await Promise.all(Array.from({ length: 32 }, () => testObject.newTestObjectAsync()))
      }
      // Only check the last round, so the stress loop itself stays cheap.
      expect(objects).to.have.length(32)
      for (const object of objects) {
        expect(Object.is(NitroModules.isHybridObject(object), true)).to.equal(true)
      }
    },
  }),
}
