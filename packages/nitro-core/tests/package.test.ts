import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

describe('compiled package', () => {
  for (const format of ['commonjs', 'module']) {
    test(`${format} imports in Node without a host and keeps the live native binding`, () => {
      const entry = `./lib/${format}/index.js`
      const importCore =
        format === 'commonjs'
          ? `const core = require('${entry}')`
          : `const core = await import('${entry}')`
      const script = `
        ${importCore}
        if (core.NitroModules !== undefined || core.getInstalledNitro() !== undefined) {
          throw new Error('Importing nitro-core should not initialize a runtime')
        }
        globalThis.NitroModulesProxy = { version: 'test' }
        const installed = core.getNitroModules()
        if (installed !== globalThis.NitroModulesProxy || core.NitroModules !== installed) {
          throw new Error('NitroModules must be a live binding to the original native object')
        }
      `
      const result = spawnSync(
        'node',
        [`--input-type=${format}`, '-e', script],
        {
          cwd: packageRoot,
          encoding: 'utf8',
        }
      )
      expect(result.error).toBeUndefined()
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
    })
  }
})
