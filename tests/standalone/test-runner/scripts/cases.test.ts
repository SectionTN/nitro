import { afterEach, expect, test } from 'bun:test'
import { registerTests } from '../js/index'
import { casesForImplementations, namedCases, withTestTimeout } from '../js/utils/suites'

const originalRun = globalThis.runNitroTest
const originalTimeout = globalThis.getNitroTestTimeoutMs
afterEach(() => {
  globalThis.runNitroTest = originalRun
  globalThis.getNitroTestTimeoutMs = originalTimeout
})

test('unannotated cases leave the native default unchanged', async () => {
  let called = false
  registerTests({
    ordinary: () => {
      called = true
    },
  })
  expect(globalThis.getNitroTestTimeoutMs('ordinary')).toBeUndefined()
  await globalThis.runNitroTest('ordinary')
  expect(called).toBe(true)
})

test('fixture binding preserves timeouts without allocating the fixture', async () => {
  const created: string[] = []
  const received: string[] = []
  const implementation = (name: string) => () => {
    created.push(name)
    return name
  }
  const cases = casesForImplementations(
    'Memory',
    { First: implementation('First'), Second: implementation('Second') },
    {
      allocate: withTestTimeout(150_000, (object: string) => {
        received.push(object)
      }),
      ordinary: () => {},
    }
  )
  registerTests(cases)

  for (const name of ['First', 'Second']) {
    expect(globalThis.getNitroTestTimeoutMs(`Memory / ${name} / allocate`)).toBe(150_000)
    expect(globalThis.getNitroTestTimeoutMs(`Memory / ${name} / ordinary`)).toBeUndefined()
  }
  expect(created).toEqual([])
  await globalThis.runNitroTest('Memory / First / allocate')
  await globalThis.runNitroTest('Memory / Second / allocate')
  expect(created).toEqual(['First', 'Second'])
  expect(received).toEqual(created)
})

test('named cases retain an explicit timeout', () => {
  registerTests(namedCases('Stress', { allocate: withTestTimeout(500, () => {}) }))
  expect(globalThis.getNitroTestTimeoutMs('Stress / allocate')).toBe(500)
})

test('timeout lookup rejects unknown and inherited case names', () => {
  registerTests({ ordinary: () => {} })
  for (const name of ['missing', 'constructor']) {
    expect(() => globalThis.getNitroTestTimeoutMs(name)).toThrow(`Unknown Nitro test: ${name}`)
  }
})
