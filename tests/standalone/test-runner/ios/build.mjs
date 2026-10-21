import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { defaults, getBuildConfiguration, root, run, xcodebuild } from './utils.mjs'

const { values } = parseArgs({
  options: {
    'arch': { type: 'string', default: defaults.arch },
    'jobs': { type: 'string', default: process.env.NITRO_TEST_JOBS ?? String(defaults.jobs) },
    'sanitizer': { type: 'string', default: 'none' },
    'skip-hermes-build': { type: 'boolean', default: false },
    'help': { type: 'boolean', short: 'h' },
  },
})
if (values.help) {
  console.log(`Usage: bun tests/standalone/test-runner/ios/build.mjs [options]

  --arch ARCH           auto, arm64 or x86_64 (default: ${defaults.arch})
  --jobs N              Parallel build jobs (default: ${defaults.jobs})
  --sanitizer MODE      none, address or thread (default: none)
  --skip-hermes-build   Reuse an XCFramework already built for this architecture/toolchain
  -h, --help            Show this help

DEVELOPER_DIR selects Xcode. NITRO_TEST_JOBS overrides the default build jobs.`)
  process.exit(0)
}
const { architecture, buildDirectory } = getBuildConfiguration(values)
const jobs = Number(values.jobs)
if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error('--jobs must be a positive integer')
if (values['skip-hermes-build']) {
  const framework = path.join(root, 'tests/standalone/.build/hermes/NitroTestHermes.xcframework')
  if (!existsSync(path.join(framework, 'Info.plist'))) {
    throw new Error('No Hermes XCFramework found. Run without --skip-hermes-build first.')
  }
} else {
  run(process.execPath, [
    'tests/standalone/hermes/build.mjs',
    'ios',
    '--arch',
    architecture,
    '--jobs',
    String(jobs),
    '--deployment-target',
    defaults.deploymentTarget,
  ])
}
const results = path.join(buildDirectory, 'results', `Build-${Date.now()}-${process.pid}`)
mkdirSync(results, { recursive: true })
const status = await xcodebuild(
  [
    'build-for-testing',
    '-project',
    'tests/standalone/test-runner/ios/NitroRuntimeTests.xcodeproj',
    '-scheme',
    'NitroRuntimeTests',
    '-destination',
    'generic/platform=iOS Simulator',
    '-derivedDataPath',
    path.join(buildDirectory, 'DerivedData'),
    '-resultBundlePath',
    path.join(results, 'Build.xcresult'),
    '-enableAddressSanitizer',
    values.sanitizer === 'address' ? 'YES' : 'NO',
    '-enableThreadSanitizer',
    values.sanitizer === 'thread' ? 'YES' : 'NO',
    '-jobs',
    String(jobs),
    'CODE_SIGNING_ALLOWED=NO',
    `ARCHS=${architecture}`,
    `IPHONEOS_DEPLOYMENT_TARGET=${defaults.deploymentTarget}`,
  ],
  path.join(results, 'build.log')
)
console.log(`Build results: ${results}`)
process.exitCode = status
