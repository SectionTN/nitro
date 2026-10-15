import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifests = [
  'package.json',
  'packages/react-native-nitro-modules/package.json',
  'packages/nitrogen/package.json',
].map((relativePath) => {
  const filename = path.join(root, relativePath)
  return { filename, json: JSON.parse(readFileSync(filename, 'utf8')) }
})
const check = process.argv[2] === '--check'
const version = check ? manifests[0].json.version : (process.argv[2] ?? manifests[0].json.version)
if (!/^\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?(?:\+[\da-zA-Z.-]+)?$/.test(version)) {
  throw new Error(`Invalid version: ${version}`)
}

const nativeFilename = path.join(
  root,
  'packages/react-native-nitro-modules/cpp/utils/NitroDefines.hpp'
)
const nativeSource = readFileSync(nativeFilename, 'utf8')
const nativeVersion = nativeSource.match(/^#define NITRO_VERSION "([^"]+)"$/m)
if (nativeVersion === null) throw new Error('Could not find NITRO_VERSION')

if (check) {
  for (const { filename, json } of manifests) {
    if (json.version !== version)
      throw new Error(`${filename}: expected version ${version}, found ${json.version}`)
  }
  if (manifests[2].json.dependencies['react-native-nitro-modules'] !== `^${version}`) {
    throw new Error(`Nitrogen must depend on react-native-nitro-modules ^${version}`)
  }
  if (nativeVersion[1] !== version) throw new Error(`NITRO_VERSION must be ${version}`)
  console.log(`Nitro and Nitrogen versions match: ${version}`)
} else {
  for (const { filename, json } of manifests) {
    json.version = version
    if (json.name === 'nitrogen') json.dependencies['react-native-nitro-modules'] = `^${version}`
    writeFileSync(filename, `${JSON.stringify(json, null, 2)}\n`)
  }
  writeFileSync(
    nativeFilename,
    nativeSource.replace(nativeVersion[0], `#define NITRO_VERSION "${version}"`)
  )
  console.log(`Updated Nitro and Nitrogen to ${version}. Run bun install to update bun.lock.`)
}
