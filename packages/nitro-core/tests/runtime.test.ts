import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import {
  NitroModules,
  assertNitroVersion,
  getHybridObjectConstructor,
  getInstalledNitro,
  getNitroModules,
  isRuntimeAlive,
  warnIfNitroVersionMismatch,
} from '../src'
import type { HybridObject, NitroModulesProxy } from '../src'
import { version } from '../src/version'

const originalProxy = globalThis.NitroModulesProxy
const originalCache = globalThis.__nitroJsiCache
const originalDispatcher = globalThis.__nitroDispatcher

afterEach(() => {
  globalThis.NitroModulesProxy = originalProxy
  globalThis.__nitroJsiCache = originalCache
  globalThis.__nitroDispatcher = originalDispatcher
})

function createProxy(): NitroModulesProxy {
  return {
    version,
    createHybridObject() {
      throw new Error('No test HybridObject registered')
    },
  } as unknown as NitroModulesProxy
}

describe('runtime initialization', () => {
  test('imports without a native runtime or framework', () => {
    expect(getInstalledNitro()).toBeUndefined()
    expect(NitroModules).toBeUndefined()
    expect(isRuntimeAlive()).toBe(false)
    expect(() => getNitroModules()).toThrow('Nitro is not installed')
  })

  test('binds and reuses the actual native proxy without wrapping it', () => {
    const proxy = createProxy()
    globalThis.NitroModulesProxy = proxy

    expect(getInstalledNitro()).toBe(proxy)
    expect(getNitroModules()).toBe(proxy)
    expect(NitroModules).toBe(proxy)
    expect(getNitroModules()).toBe(proxy)
    expect(globalThis.NitroModulesProxy).toBe(NitroModules)
  })

  test('requires both cache and dispatcher to report a live runtime', () => {
    globalThis.__nitroJsiCache = {}
    globalThis.__nitroDispatcher = undefined
    expect(isRuntimeAlive()).toBe(false)
    globalThis.__nitroDispatcher = {}
    expect(isRuntimeAlive()).toBe(true)
    globalThis.__nitroJsiCache = undefined
    expect(isRuntimeAlive()).toBe(false)
  })
})

describe('version checks', () => {
  test('allows an existing proxy from the same Nitro version', () => {
    expect(() => assertNitroVersion(createProxy())).not.toThrow()
  })

  test('rejects reusing an incompatible runtime', () => {
    const proxy = createProxy()
    proxy.version = '0.0.0'
    expect(() => assertNitroVersion(proxy)).toThrow('Nitro was installed twice')
  })

  test('warns on an initial native mismatch without preventing installation', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const proxy = createProxy()
      warnIfNitroVersionMismatch(proxy)
      expect(warn).not.toHaveBeenCalled()
      proxy.version = '0.0.0'
      globalThis.NitroModulesProxy = proxy
      expect(getNitroModules()).toBe(proxy)
      warnIfNitroVersionMismatch(proxy)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain(
        'native Nitro Modules core runtime version is 0.0.0'
      )
    } finally {
      warn.mockRestore()
    }
  })
})

describe('HybridObject constructors', () => {
  test('can be declared before host installation and retain constructor identity', () => {
    globalThis.NitroModulesProxy = undefined
    const Constructor = getHybridObjectConstructor<HybridObject<{}>>('LazyTest')
    expect(getHybridObjectConstructor('LazyTest')).toBe(Constructor)

    const prototype = { name: 'LazyTest' }
    const instance = Object.create(prototype)
    const proxy = createProxy()
    const create = spyOn(proxy, 'createHybridObject').mockImplementation(
      function (this: NitroModulesProxy) {
        expect(this).toBe(proxy)
        return instance
      }
    )
    globalThis.NitroModulesProxy = proxy

    expect(new Constructor()).toBe(instance)
    expect(instance instanceof Constructor).toBe(true)
    expect(Object.create(instance) instanceof Constructor).toBe(true)
    expect({} instanceof Constructor).toBe(false)
    expect(create).toHaveBeenCalledWith('LazyTest')
    expect(create).toHaveBeenCalledTimes(1)
  })

  test('initializes the native prototype when instanceof is used first', () => {
    const prototype = { name: 'InstanceofTest' }
    const instance = Object.create(prototype)
    const proxy = createProxy()
    const create = spyOn(proxy, 'createHybridObject').mockReturnValue(instance)
    globalThis.NitroModulesProxy = proxy
    const Constructor = getHybridObjectConstructor('InstanceofTest')

    expect(instance instanceof Constructor).toBe(true)
    expect(instance instanceof Constructor).toBe(true)
    expect(create).toHaveBeenCalledTimes(1)
  })
})
