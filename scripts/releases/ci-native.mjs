import { appendFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { git } from './lib.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
export const nativeWorkflows = ['test-runtime-ios', 'test-runtime-android', 'harness-ios', 'harness-android']

async function githubJSON(url, env) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${env.GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Workflow run lookup failed (${response.status})`)
  return response.json()
}

async function successfulPushRuns({ env, branch, fetchJSON }) {
  const url = new URL(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/release.yml/runs`)
  url.search = new URLSearchParams({ branch: branch, event: 'push', status: 'success', per_page: '100' }).toString()
  const data = await fetchJSON(url, env)
  if (!Array.isArray(data.workflow_runs)) throw new Error('Workflow run lookup returned no run list')
  return data.workflow_runs
}

async function releaseSucceeded({ env, run, fetchJSON }) {
  if (!Number.isSafeInteger(run.id) || run.id <= 0) throw new Error('Workflow run lookup returned no run ID')
  const url = new URL(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/runs/${run.id}/jobs?per_page=100`)
  const data = await fetchJSON(url, env)
  if (!Array.isArray(data.jobs)) throw new Error('Workflow job lookup returned no job list')
  return data.jobs.some((job) => job.name === 'release' && job.conclusion === 'success')
}

export async function resolveNativeChecks({ cwd = root, env = process.env, fetchJSON = githubJSON } = {}) {
  const allChecks = Object.fromEntries(nativeWorkflows.map((name) => [name, true]))
  if (env.GITHUB_EVENT_NAME !== 'push') return allChecks

  try {
    const commit = env.RELEASE_VALIDATED_COMMIT
    const branch = env.RELEASE_BRANCH
    if (!/^[a-f0-9]{40}$/.test(commit ?? '') || !['main', 'v1'].includes(branch)) throw new Error('Missing release commit or branch')
    const runs = await successfulPushRuns({ env: env, branch: branch, fetchJSON: fetchJSON })
    let baseline
    for (const run of runs) {
      if (
        run?.conclusion !== 'success' ||
        run.event !== 'push' ||
        run.head_branch !== branch ||
        !/^[a-f0-9]{40}$/.test(run.head_sha ?? '')
      ) {
        continue
      }
      try {
        git(['merge-base', '--is-ancestor', run.head_sha, commit], { cwd: cwd })
      } catch {
        // Missing commits and rewritten branches cannot establish a validated baseline.
        continue
      }
      // An entirely skipped workflow can succeed without validating or publishing anything.
      if (!(await releaseSucceeded({ env: env, run: run, fetchJSON: fetchJSON }))) continue
      baseline = run.head_sha
      break
    }
    if (!baseline) throw new Error('No successful push run is an ancestor of this commit')

    // Compare with successful CI, so a docs push still validates changes from cancelled runs.
    // A manual release's version bump can conservatively select native checks again.
    const changed = git(['diff', '--name-only', '--no-renames', '-z', baseline, commit], { cwd: cwd }).split('\0').filter(Boolean)
    if (changed.includes('.github/workflows/release.yml')) return allChecks
    const checks = {}
    for (const name of nativeWorkflows) {
      const workflow = Bun.YAML.parse(readFileSync(path.join(cwd, '.github/workflows', `${name}.yml`), 'utf8'))
      const paths = workflow?.on?.pull_request?.paths
      if (!Array.isArray(paths) || paths.length === 0 || paths.some((pattern) => typeof pattern !== 'string' || pattern.startsWith('!'))) {
        throw new Error(`Unsupported pull request paths for ${name}`)
      }
      checks[name] = paths.some((pattern) => {
        const glob = new Bun.Glob(pattern)
        return changed.some((filename) => glob.match(filename))
      })
    }
    console.log(`Native checks compare ${baseline} to ${commit}: ${nativeWorkflows.filter((name) => checks[name]).join(', ') || 'none'}`)
    return checks
  } catch (error) {
    console.warn(`Running all native checks: ${error.message}`)
    return allChecks
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const checks = await resolveNativeChecks()
  appendFileSync(process.env.GITHUB_OUTPUT, nativeWorkflows.map((name) => `${name}=${checks[name]}\n`).join(''))
}
