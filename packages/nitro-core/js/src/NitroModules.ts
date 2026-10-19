import type { NitroModulesProxy } from './NitroModulesProxy.js'

const proxy = globalThis.NitroModulesProxy
if (proxy == null) {
  throw new Error('Nitro Modules must be installed before importing nitro-core.')
}

export const NitroModules: NitroModulesProxy = proxy
