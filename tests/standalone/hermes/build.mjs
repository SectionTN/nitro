import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { availableParallelism, arch, platform } from 'node:os'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const tests = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(tests, 'hermes/hermes')
const options = resolve(tests, 'hermes/options.cmake')
const output = resolve(tests, '.build/hermes')
const { values, positionals } = parseArgs({
  options: {
    'arch': { type: 'string', default: arch() === 'arm64' ? 'arm64' : 'x86_64' },
    'jobs': {
      type: 'string',
      default: String(Math.min(availableParallelism(), 4)),
    },
    'deployment-target': { type: 'string', default: '16.0' },
  },
  allowPositionals: true,
})
const [target] = positionals
const architecture = values.arch
const jobs = Number(values.jobs)
const deploymentTarget = values['deployment-target']
if (positionals.length !== 1 || !['host', 'ios'].includes(target)) {
  throw new Error('Usage: bun tests/standalone/hermes/build.mjs host|ios [--arch arm64|x86_64] [--jobs N] [--deployment-target 16.0]')
}
if (!['arm64', 'x86_64'].includes(architecture)) {
  throw new Error(`Unsupported simulator architecture: ${architecture}`)
}
if (!Number.isSafeInteger(jobs) || jobs < 1) {
  throw new Error('--jobs must be a positive integer')
}
if (!/^\d+\.\d+$/.test(deploymentTarget) || Number(deploymentTarget) < 16) {
  throw new Error('--deployment-target must be an iOS version of 16.0 or newer')
}
if (target === 'ios' && platform() !== 'darwin') {
  throw new Error('iOS builds require macOS and Xcode')
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status ?? result.signal})`)
  }
}

function read(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal})`)
  return result.stdout
}

// Everything that determines the XCFramework. A fresh checkout makes every
// source newer than a cached build tree, so CMake cannot tell a restored build
// is current; this fingerprint can, and a mismatch always rebuilds.
const xcframework = resolve(output, 'NitroTestHermes.xcframework')
const fingerprintFile = resolve(output, 'NitroTestHermes.fingerprint')
const fingerprint =
  target === 'ios'
    ? createHash('sha256')
        .update(read('git', ['-C', source, 'rev-parse', 'HEAD']))
        .update(read('xcodebuild', ['-version']))
        .update(read('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-version']))
        .update(read('cmake', ['--version']))
        .update(read('ninja', ['--version']))
        .update(readFileSync(fileURLToPath(import.meta.url)))
        .update(readFileSync(options))
        .update(`${architecture} ${deploymentTarget}`)
        .digest('hex')
    : undefined
if (fingerprint && existsSync(xcframework) && existsSync(fingerprintFile) && readFileSync(fingerprintFile, 'utf8') === fingerprint) {
  console.log(`Reusing ${xcframework}; its sources and toolchain are unchanged.`)
  process.exit(0)
}
rmSync(fingerprintFile, { force: true })

const host = resolve(output, 'host')
run('cmake', [
  '-C',
  options,
  '-S',
  source,
  '-B',
  host,
  '-G',
  'Ninja',
  '-DCMAKE_BUILD_TYPE=Release',
  '-DHERMES_ENABLE_TOOLS=ON',
  '-DHERMES_UNICODE_LITE=ON',
])
run('cmake', ['--build', host, '--target', 'hermesc', '--parallel', String(jobs)])

if (target === 'ios') {
  const build = resolve(output, `ios-simulator-${architecture}`)
  run('cmake', [
    '-C',
    options,
    '-S',
    source,
    '-B',
    build,
    '-G',
    'Ninja',
    '-DCMAKE_BUILD_TYPE=Debug',
    '-DCMAKE_SYSTEM_NAME=iOS',
    '-DHERMES_APPLE_TARGET_PLATFORM=iphonesimulator',
    '-DCMAKE_OSX_SYSROOT=iphonesimulator',
    `-DCMAKE_OSX_ARCHITECTURES=${architecture}`,
    `-DCMAKE_OSX_DEPLOYMENT_TARGET=${deploymentTarget}`,
    `-DIMPORT_HOST_COMPILERS=${resolve(host, 'ImportHostCompilers.cmake')}`,
  ])
  run('cmake', ['--build', build, '--target', 'hermesvm_a', 'jsi', '--parallel', String(jobs)])
  mkdirSync(resolve(build, 'lib'), { recursive: true })
  run('xcrun', [
    'libtool',
    '-static',
    '-o',
    resolve(build, 'lib/libNitroTestHermes.a'),
    resolve(build, 'lib/libhermesvm_a.a'),
    resolve(build, 'jsi/libjsi.a'),
  ])

  const headers = resolve(build, 'include')
  rmSync(headers, { recursive: true, force: true })
  for (const [directory, destination] of [
    ['API/hermes', 'hermes'],
    ['API/jsi/jsi', 'jsi'],
    ['public/hermes/Public', 'hermes/Public'],
  ]) {
    cpSync(resolve(source, directory), resolve(headers, destination), {
      recursive: true,
      filter: (path) => statSync(path).isDirectory() || path.endsWith('.h'),
    })
  }
  writeFileSync(
    resolve(headers, 'module.modulemap'),
    `module NitroTestHermes {
  requires cplusplus
  header "hermes/hermes.h"
  export *
}
`
  )

  rmSync(xcframework, { recursive: true, force: true })
  run('xcodebuild', [
    '-create-xcframework',
    '-library',
    resolve(build, 'lib/libNitroTestHermes.a'),
    '-headers',
    headers,
    '-output',
    xcframework,
  ])
  writeFileSync(fingerprintFile, fingerprint)
}
