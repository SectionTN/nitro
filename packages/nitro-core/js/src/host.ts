import type { NitroModulesProxy } from './NitroModulesProxy.js'
import './globals.js'

/** Returns Nitro's installed native entry point without loading native classes. */
export function getInstalledNitro(): NitroModulesProxy | undefined {
  return globalThis.NitroModulesProxy
}

/** Returns the native entry point after the host has installed Nitro. */
export function getNitroModules(): NitroModulesProxy {
  const nitroModules = getInstalledNitro()
  if (nitroModules == null) {
    throw new Error(
      'Nitro is not installed in this JavaScript runtime. Initialize the host integration before using NitroModules.'
    )
  }
  return nitroModules
}

/** Returns whether this JavaScript runtime has an installed Nitro entry point. */
export function isRuntimeAlive(): boolean {
  return getInstalledNitro() != null
}

export { assertNitroVersion, warnIfNitroVersionMismatch } from './checkNitroVersion.js'
