import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseVersion } from './releases/lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifests = [
  'package.json',
  'packages/nitro-core/package.json',
  'packages/nitrogen/package.json',
].map((relativePath) => {
  const filename = path.join(root, relativePath)
  return { filename, json: JSON.parse(readFileSync(filename, 'utf8')) }
})
const check = process.argv[2] === '--check'
const version = check
  ? manifests[0].json.version
  : (process.argv[2] ?? manifests[0].json.version)
parseVersion(version)

const sourceVersions = [
  {
    path: 'packages/nitro-core/cpp/utils/NitroDefines.hpp',
    pattern: /^#define NITRO_VERSION "([^"]+)"$/m,
    line: `#define NITRO_VERSION "${version}"`,
  },
  {
    path: 'packages/nitro-core/js/version.ts',
    pattern: /^export const version = '([^']+)'$/m,
    line: `export const version = '${version}'`,
  },
].map((entry) => {
  const filename = path.join(root, entry.path)
  const source = readFileSync(filename, 'utf8')
  const match = source.match(entry.pattern)
  if (match === null) throw new Error(`Could not find version in ${entry.path}`)
  return { ...entry, filename, source, match }
})

if (check) {
  for (const { filename, json } of manifests) {
    if (json.version !== version)
      throw new Error(
        `${filename}: expected version ${version}, found ${json.version}`
      )
  }
  const nitrogen = manifests.find(({ json }) => json.name === 'nitrogen').json
  if (nitrogen.dependencies['nitro-core'] !== `^${version}`) {
    throw new Error(`Nitrogen must depend on nitro-core ^${version}`)
  }
  for (const entry of sourceVersions) {
    if (entry.match[1] !== version)
      throw new Error(`${entry.path} must use ${version}`)
  }
  console.log(`Nitro core, Nitrogen and native versions match: ${version}`)
} else {
  for (const { filename, json } of manifests) {
    json.version = version
    if (json.name === 'nitrogen')
      json.dependencies['nitro-core'] = `^${version}`
    writeFileSync(filename, `${JSON.stringify(json, null, 2)}\n`)
  }
  for (const entry of sourceVersions) {
    writeFileSync(
      entry.filename,
      entry.source.replace(entry.match[0], entry.line)
    )
  }
  console.log(
    `Updated Nitro core and Nitrogen to ${version}. Run bun install to update bun.lock.`
  )
}
