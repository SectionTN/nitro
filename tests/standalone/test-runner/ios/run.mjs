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
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { StringDecoder } from 'node:string_decoder'

import { defaults, environment, getBuildConfiguration, root, run, xcodebuild } from './utils.mjs'
const { values } = parseArgs({
  options: {
    os: { type: 'string', default: defaults.os },
    device: { type: 'string' },
    arch: { type: 'string', default: defaults.arch },
    destination: { type: 'string', default: process.env.NITRO_IOS_DESTINATION },
    sanitizer: { type: 'string', default: 'none' },
    help: { type: 'boolean', short: 'h' },
  },
})
if (values.help) {
  console.log(`Usage: bun tests/standalone/test-runner/ios/run.mjs [options]

Defaults live in tests/standalone/test-runner/ios/config.json.
  --os VERSION          Simulator OS, e.g. 26 or 26.5 (default: ${defaults.os})
  --device NAME         Exact simulator name (default: ${defaults.device ?? 'first available iPhone'})
  --arch ARCH           auto, arm64 or x86_64 (default: ${defaults.arch})
  --destination VALUE   Explicit xcodebuild destination, overriding OS/device selection
  --sanitizer MODE      none, address or thread (default: none)
  -h, --help            Show this help

DEVELOPER_DIR selects Xcode. NITRO_IOS_DESTINATION overrides the default destination.`)
  process.exit(0)
}
if (!/^\d+(\.\d+){0,2}$/.test(values.os)) {
  throw new Error('--os must be a version such as 26 or 26.5')
}
const { architecture, buildDirectory } = getBuildConfiguration(values)

// A single cooperative worker catches native runners that block Swift Tasks
// needed to resolve their JavaScript Promises.
environment.TEST_RUNNER_LIBDISPATCH_COOPERATIVE_POOL_STRICT = '1'
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
const results = path.join(buildDirectory, 'results', `RuntimeTests-${Date.now()}-${process.pid}`)
mkdirSync(results, { recursive: true })
if (values.sanitizer !== 'none') {
  const option = values.sanitizer === 'address' ? 'ASAN_OPTIONS' : 'TSAN_OPTIONS'
  // xcodebuild forwards TEST_RUNNER_ variables to every test process. Preserve
  // Xcode's options, but make a sanitizer finding terminate the test runner.
  environment[`TEST_RUNNER_${option}`] = `__CURRENT_VALUE__:halt_on_error=1:abort_on_error=1:log_path=${path.join(results, 'sanitizer')}`
}
// Use the build's test specification directly, avoiding another package resolution.
const products = path.join(buildDirectory, 'DerivedData', 'Build', 'Products')
const testRun = (existsSync(products) ? readdirSync(products) : [])
  .filter((name) => name.startsWith('NitroRuntimeTests_') && name.endsWith(`-${architecture}.xctestrun`))
  .map((name) => path.join(products, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
if (!testRun) throw new Error('No built test runner found. Run ios/build.mjs first.')
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
  path.join(results, 'xcodebuild.log'),
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
