import { chai, expect } from 'react-native-harness'
import { arrayBufferEquality } from '@vitest/expect'
import { printDiffOrStringify } from '@vitest/utils/diff'
import { NitroModules, type HybridObject } from 'react-native-nitro-modules'

/**
 * Harness only forwards `error.message` (plus a code frame) of a failed
 * assertion to the CLI - `actual`, `expected` and the diff are dropped. So
 * everything a failure should show has to end up in the message itself.
 */

function isHybridObject(value: unknown): value is HybridObject<{}> {
  return (
    typeof value === 'object' &&
    value != null &&
    NitroModules.isHybridObject(value)
  )
}

/**
 * HybridObjects keep all of their state behind getters on the prototype, so
 * `toEqual` would consider any two HybridObjects of the same type equal.
 * Compare them by their native instance instead.
 */
function hybridObjectEquality(a: unknown, b: unknown): boolean | undefined {
  if (!isHybridObject(a) || !isHybridObject(b)) return undefined
  return a.equals(b)
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value != null
}

/**
 * Appends a vitest-style `- Expected / + Received` diff to a failed
 * structural assertion (`toEqual`, `toStrictEqual`, `toMatchObject`, ...).
 */
function appendDiff(error: unknown): void {
  if (!(error instanceof chai.AssertionError)) return
  const { actual, expected, showDiff } = error as {
    actual?: unknown
    expected?: unknown
    showDiff?: boolean
  }
  if (showDiff !== true) return
  const isStructural =
    isObject(actual) &&
    isObject(expected) &&
    Array.isArray(actual) === Array.isArray(expected)
  const isMultilineString =
    typeof actual === 'string' &&
    typeof expected === 'string' &&
    (actual.includes('\n') || expected.includes('\n'))
  if (!isStructural && !isMultilineString) return
  try {
    const diff = printDiffOrStringify(actual, expected)
    if (diff != null && diff.length > 0) {
      error.message += `\n\n${diff}`
    }
  } catch {
    // Never let the diff hide the original assertion error.
  }
}

const SETUP_KEY = Symbol.for('nitro.example.harness-expect-setup')

/**
 * Configures Harness' `expect` for Nitro tests. Safe to call more than once.
 */
export function setupNitroExpect(): void {
  const globals = globalThis as { [SETUP_KEY]?: boolean }
  if (globals[SETUP_KEY]) return
  globals[SETUP_KEY] = true

  // chai cuts values off at 40 characters by default (`{ year: 2018, …(6) }`).
  chai.config.truncateThreshold = 0

  // `toEqual` ignores ArrayBuffer contents (only `toStrictEqual` compares them),
  // and treats all HybridObjects of one type as equal.
  expect.addEqualityTesters([hybridObjectEquality, arrayBufferEquality])

  const prototype = chai.Assertion.prototype as unknown as {
    assert: (...args: unknown[]) => void
  }
  const originalAssert = prototype.assert
  prototype.assert = function (this: unknown, ...args: unknown[]) {
    try {
      return originalAssert.apply(this, args)
    } catch (error) {
      appendDiff(error)
      throw error
    }
  }
}

setupNitroExpect()
