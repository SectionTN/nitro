import { closeSync, openSync, readFileSync, writeSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const defaults = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)))
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
export const environment = { ...process.env }

export function getBuildConfiguration({ arch = defaults.arch, sanitizer = 'none' }) {
  if (!['auto', 'arm64', 'x86_64'].includes(arch)) throw new Error('--arch must be auto, arm64 or x86_64')
  if (!['none', 'address', 'thread'].includes(sanitizer)) throw new Error('--sanitizer must be none, address or thread')
  const architecture = arch === 'auto' ? { arm64: 'arm64', x64: 'x86_64' }[process.arch] : arch
  if (!architecture) throw new Error(`Unsupported host architecture: ${process.arch}`)
  return { architecture, buildDirectory: path.join(root, 'tests/standalone/.build/ios', sanitizer) }
}

export function run(command, args, capture = false) {
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

export async function xcodebuild(args, logPath, pollResults) {
  const log = openSync(logPath, 'w')
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
