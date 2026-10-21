import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { StringDecoder } from 'node:string_decoder'

const defaults = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)))
const { values } = parseArgs({
  options: {
    'os': { type: 'string', default: defaults.os },
    'device': { type: 'string' },
    'arch': { type: 'string', default: defaults.arch },
    'jobs': {
      type: 'string',
      default: process.env.NITRO_TEST_JOBS ?? String(defaults.jobs),
    },
    'destination': { type: 'string', default: process.env.NITRO_IOS_DESTINATION },
    'sanitizer': { type: 'string', default: 'none' },
    'skip-hermes-build': { type: 'boolean', default: false },
    'build-only': { type: 'boolean', default: false },
    'skip-build': { type: 'boolean', default: false },
    'help': { type: 'boolean', short: 'h' },
  },
})
if (values.help) {
  console.log(`Usage: bun tests/standalone/test-runner/ios/run.mjs [options]

Defaults live in tests/standalone/test-runner/ios/config.json.
  --os VERSION          Simulator OS, e.g. 26 or 26.5 (default: ${defaults.os})
  --device NAME         Exact simulator name (default: ${defaults.device ?? 'first available iPhone'})
  --arch ARCH           auto, arm64 or x86_64 (default: ${defaults.arch})
  --jobs N              Parallel build jobs (default: ${defaults.jobs})
  --destination VALUE   Explicit xcodebuild destination, overriding OS/device selection
  --sanitizer MODE      none, address or thread (default: none)
  --skip-hermes-build   Reuse an XCFramework already built for this architecture/toolchain
  --build-only          Compile the test runner without launching tests
  --skip-build          Run the most recently built test runner without compiling
  -h, --help            Show this help

DEVELOPER_DIR selects Xcode. NITRO_IOS_DESTINATION and NITRO_TEST_JOBS remain supported.`)
  process.exit(0)
}
if (!/^\d+(\.\d+){0,2}$/.test(values.os)) {
  throw new Error('--os must be a version such as 26 or 26.5')
}
if (!['auto', 'arm64', 'x86_64'].includes(values.arch)) {
  throw new Error('--arch must be auto, arm64 or x86_64')
}
if (!['none', 'address', 'thread'].includes(values.sanitizer)) {
  throw new Error('--sanitizer must be none, address or thread')
}
if (values['build-only'] && values['skip-build']) throw new Error('--build-only and --skip-build cannot be combined')
const architecture = values.arch === 'auto' ? { arm64: 'arm64', x64: 'x86_64' }[process.arch] : values.arch
if (!architecture) throw new Error(`Unsupported host architecture: ${process.arch}`)
const jobs = Number(values.jobs)
if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error('--jobs must be a positive integer')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const environment = { ...process.env }
// A single cooperative worker catches native runners that block Swift Tasks
// needed to resolve their JavaScript Promises.
environment.TEST_RUNNER_LIBDISPATCH_COOPERATIVE_POOL_STRICT = '1'
function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: environment,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? '')
    process.exit(result.status ?? 1)
  }
  return result.stdout
}

let simulator
let destination = values.destination
if (!destination) {
  const { devices } = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], true))
  const deviceName = values.device ?? defaults.device
  const runtimes = Object.keys(devices)
    .filter((name) => {
      const version = name.split('.iOS-')[1]?.replaceAll('-', '.')
      return version === values.os || version?.startsWith(`${values.os}.`)
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .reverse()
  const device = runtimes
    .flatMap((runtime) => devices[runtime])
    .find((item) => (deviceName ? item.name === deviceName : item.name.startsWith('iPhone')))
  if (!device)
    throw new Error(
      `No available ${deviceName ?? 'iPhone'} simulator matches iOS ${values.os}. Install one or select --os, --device or --destination.`
    )
  destination = `platform=iOS Simulator,id=${device.udid}`
  simulator = device.udid
}
if (!values['skip-build'] && values['skip-hermes-build']) {
  const framework = path.join(root, 'tests/standalone/.build/hermes/NitroTestHermes.xcframework')
  if (!existsSync(path.join(framework, 'Info.plist'))) {
    throw new Error('No Hermes XCFramework found. Run without --skip-hermes-build first.')
  }
} else if (!values['skip-build']) {
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
const buildDirectory = path.join(root, 'tests/standalone/.build/ios', values.sanitizer)
const results = path.join(buildDirectory, 'results', `RuntimeTests-${Date.now()}-${process.pid}`)
mkdirSync(results, { recursive: true })
if (values.sanitizer !== 'none') {
  const option = values.sanitizer === 'address' ? 'ASAN_OPTIONS' : 'TSAN_OPTIONS'
  // xcodebuild forwards TEST_RUNNER_ variables to every test process. Preserve
  // Xcode's options, but make a sanitizer finding terminate the test runner.
  environment[`TEST_RUNNER_${option}`] = `__CURRENT_VALUE__:halt_on_error=1:abort_on_error=1:log_path=${path.join(results, 'sanitizer')}`
}
async function xcodebuild(args, logName, pollResults) {
  const log = openSync(path.join(results, logName), 'w')
  const outputTails = new Map()
  let sanitizerFailure = false
  const diagnostic = /(?:ERROR|WARNING|SUMMARY): (?:Address|Thread)Sanitizer:/
  const timer = pollResults ? setInterval(pollResults, 250) : undefined
  const started = performance.now()
  const status = await new Promise((resolve, reject) => {
    const child = spawn('xcodebuild', args, {
      cwd: root,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    for (const [source, target] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ]) {
      source.on('data', (chunk) => {
        target.write(chunk)
        writeSync(log, chunk)
        const output = (outputTails.get(source) ?? '') + chunk.toString()
        sanitizerFailure ||= diagnostic.test(output)
        outputTails.set(source, output.slice(-256))
      })
    }
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  }).finally(() => {
    clearInterval(timer)
    pollResults?.()
    closeSync(log)
  })
  console.log(`${args[0]} finished in ${((performance.now() - started) / 1000).toFixed(1)}s`)
  if (sanitizerFailure) console.error('Sanitizer reported an error.')
  return status || (sanitizerFailure ? 1 : 0)
}

if (!values['skip-build']) {
  const status = await xcodebuild(
    [
      'build-for-testing',
      '-project',
      'tests/standalone/test-runner/ios/NitroRuntimeTests.xcodeproj',
      '-scheme',
      'NitroRuntimeTests',
      '-destination',
      destination,
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
    'build.log'
  )
  if (status || values['build-only']) {
    console.log(`Build results: ${results}`)
    process.exit(status)
  }
}

// Use the build's test specification directly, avoiding another package resolution.
const products = path.join(buildDirectory, 'DerivedData', 'Build', 'Products')
const testRun = (existsSync(products) ? readdirSync(products) : [])
  .filter((name) => name.startsWith('NitroRuntimeTests_') && name.endsWith(`-${architecture}.xctestrun`))
  .map((name) => path.join(products, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
if (!testRun) throw new Error('No built test runner found. Run without --skip-build first.')
if (simulator) {
  // Finish simulator migration before launching the test process.
  run('xcrun', ['simctl', 'bootstatus', simulator, '-b'])
}

const streamPath = path.join(results, 'events.jsonl')
writeFileSync(streamPath, '')
const stream = openSync(streamPath, 'r')
let offset = 0
let pending = ''
const decoder = new StringDecoder('utf8')
const testResults = []
function pollResults() {
  const bytes = Buffer.alloc(64 * 1024)
  let count
  while ((count = readSync(stream, bytes, 0, bytes.length, offset)) > 0) {
    offset += count
    pending += decoder.write(bytes.subarray(0, count))
    let newline
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline)
      pending = pending.slice(newline + 1)
      if (!line.trim()) continue
      const event = JSON.parse(line)
      if (event.name?._value !== 'testFinished') continue
      const test = event.structuredPayload?.test
      let name = test.name._value
      if (name === 'javaScript(_:)') {
        // Xcode encodes Swift Testing parameter descriptions as UTF-8 hex.
        const argument = new URL(test.identifierURL._value).searchParams.get('args')
        if (argument) name = `${Buffer.from(argument, 'hex').toString('utf8')}.test.ts`
      }
      const status = { Success: 'PASS', Failure: 'FAIL', Skipped: 'SKIP' }[test.testStatus._value] ?? test.testStatus._value
      const duration = `${Number(test.duration?._value ?? 0).toFixed(2)}s`
      testResults.push({ name, status, duration })
      console.log(`[${status}] ${name} (${duration})`)
    }
  }
}
const status = await xcodebuild(
  [
    'test-without-building',
    '-xctestrun',
    testRun,
    '-destination',
    destination,
    '-resultBundlePath',
    path.join(results, 'RuntimeTests.xcresult'),
    '-resultStreamPath',
    streamPath,
    // Keep test failures and sanitizer logs without collecting a simulator sysdiagnose.
    '-collect-test-diagnostics',
    'never',
    '-parallel-testing-enabled',
    'YES',
    // Swift Testing runs cases concurrently inside one process, bounded to four native workers.
    '-parallel-testing-worker-count',
    '1',
  ],
  'xcodebuild.log',
  pollResults
).finally(() => closeSync(stream))
let sanitizerFailure = false
for (const name of readdirSync(results).filter((name) => name.startsWith('sanitizer.'))) {
  const report = readFileSync(path.join(results, name), 'utf8')
  if (report.trim()) {
    process.stderr.write(report)
    sanitizerFailure = true
  }
}
const summaryResult = spawnSync(
  'xcrun',
  ['xcresulttool', 'get', 'test-results', 'summary', '--path', path.join(results, 'RuntimeTests.xcresult')],
  {
    cwd: root,
    env: environment,
    encoding: 'utf8',
  }
)
let summaryFailure = false
if (summaryResult.status === 0) {
  const summary = JSON.parse(summaryResult.stdout)
  writeFileSync(path.join(results, 'summary.json'), summaryResult.stdout)
  const counts = summary.devicesAndConfigurations?.[0]
  const message = `${counts?.passedTests ?? 0} passed, ${counts?.failedTests ?? 0} failed, ${counts?.skippedTests ?? 0} skipped`
  console.log(`Swift tests: ${message}`)
  summaryFailure = summary.result !== 'Passed' || !counts?.passedTests
  for (const failure of summary.testFailures ?? []) console.error(`${failure.testName}: ${failure.failureText}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = testResults.map(({ name, status, duration }) => `| ${name} | ${status} | ${duration} |`).join('\n')
    const failures = (summary.testFailures ?? [])
      .map(({ testName, failureText }) => `\n#### ${testName}\n\n\`\`\`text\n${failureText}\n\`\`\`\n`)
      .join('')
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Standalone iOS (${values.sanitizer})\n\n${message}\n\n| Suite or runner contract | Result | Duration |\n| --- | --- | --- |\n${rows}\n${failures}`
    )
  }
} else {
  console.error('Could not read the Swift test result summary.')
  process.stderr.write(summaryResult.stderr ?? '')
  summaryFailure = true
}
console.log(`Test results: ${results}`)
if (sanitizerFailure) console.error('Sanitizer reported an error.')
process.exitCode = status || (sanitizerFailure || summaryFailure ? 1 : 0)
