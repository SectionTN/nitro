import assert from 'node:assert/strict'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// This is the installed package contract consumed by the RN staging command.
export const corePackageFiles = [
  'package.json',
  'LICENSE',
  'js/src/index.ts',
  'js/src/HybridObject.ts',
  'js/src/version.ts',
  'js/lib/commonjs/index.js',
  'js/lib/module/index.js',
  'js/lib/typescript/commonjs/index.d.ts',
  'js/lib/typescript/module/index.d.ts',
  'native/cpp/core/HybridObject.hpp',
  'native/cpp/utils/NitroDefines.hpp',
  'native/apple/core/HybridObject.swift',
  'native/android/src/main/cpp/JNIOnLoad.cpp',
  'native/android/src/main/java/com/margelo/nitro/core/HybridObject.kt',
]

export function verifyCorePackage(directory) {
  const walk = (location) => {
    const stat = lstatSync(location)
    assert(!stat.isSymbolicLink(), `Package contains a symlink: ${location}`)
    if (!stat.isDirectory()) return
    for (const name of readdirSync(location)) {
      assert(
        ![
          '.git',
          'node_modules',
          '.gradle',
          '.cxx',
          'hermes',
          '__tests__',
        ].includes(name),
        `Development files in core package: ${location}/${name}`
      )
      walk(path.join(location, name))
    }
  }
  walk(directory)
  for (const relative of corePackageFiles)
    assert(
      lstatSync(path.join(directory, relative)).isFile(),
      `Missing core package file: ${relative}`
    )
  const pkg = JSON.parse(
    readFileSync(path.join(directory, 'package.json'), 'utf8')
  )
  assert.equal(pkg.name, 'nitro-core')
  const native = readFileSync(
    path.join(directory, 'native/cpp/utils/NitroDefines.hpp'),
    'utf8'
  )
  const js = readFileSync(path.join(directory, 'js/src/version.ts'), 'utf8')
  assert.equal(
    native.match(/^#define NITRO_VERSION "([^"]+)"$/m)?.[1],
    pkg.version,
    'Native version must match the npm package'
  )
  assert.equal(
    js.match(/^export const version = '([^']+)'$/m)?.[1],
    pkg.version,
    'JS version must match the npm package'
  )
  return pkg.version
}
