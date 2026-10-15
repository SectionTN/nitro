import { appendFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertCI,
  assertClean,
  assertPublishedPackages,
  compareVersions,
  downloadRelease,
  finishRelease,
  getRelease,
  git,
  isNightly,
  nightlyVersion,
  npmTagFor,
  packPackage,
  parseVersion,
  publishPackages,
  readJSON,
  registryPackage,
  run,
  saveDraft,
  validateManifest,
} from './lib.mjs'
import { checkConsumer } from './check-consumer.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
process.chdir(root)
const repository = 'margelo/nitro'
const requestRef = process.env.RELEASE_REQUEST_REF
const request = requestRef ? requestRef.split('/') : undefined
if (
  request &&
  (request.length !== 5 ||
    request[0] !== 'release-request' ||
    !/^\d+$/.test(request[4]))
) {
  throw new Error('Invalid release request branch')
}
const automaticNightly = process.env.RELEASE_MODE === 'nightly'
let sourceCommit = git(['rev-parse', 'HEAD'])
const version = automaticNightly
  ? nightlyVersion(
      readJSON('package.json').version,
      process.env.GITHUB_RUN_NUMBER,
      sourceCommit
    )
  : (request?.[2] ?? process.env.RELEASE_VERSION)
parseVersion(version)
const nightly = isNightly(version)
const npmTag = npmTagFor(
  version,
  automaticNightly ? 'nightly' : (request?.[3] ?? process.env.RELEASE_NPM_TAG)
)
if (nightly !== (npmTag === 'nightly'))
  throw new Error('Nightly versions must use the nightly npm tag')
const tag = `v${version}`
const dryRun = process.env.RELEASE_DRY_RUN === 'true'
function reportCompletedRelease() {
  if (!dryRun && process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`)
}
const branch =
  request?.[1] ||
  process.env.RELEASE_BRANCH ||
  process.env.GITHUB_REF_NAME ||
  git(['branch', '--show-current'])
if (!['main', 'core-split'].includes(branch))
  throw new Error('Release from main or core-split')
if (!dryRun) assertCI(repository)
assertClean()
git(['fetch', 'origin', branch, '--tags'])
const directory = mkdtempSync(path.join(tmpdir(), 'nitro-release-'))
const exists = !!git(['tag', '--list', tag])
let manifest

if (exists) {
  const commit = git(['rev-parse', `${tag}^{commit}`])
  const annotation = git([
    'for-each-ref',
    '--format=%(contents)',
    `refs/tags/${tag}`,
  ])
  if (
    !annotation.split('\n').includes(`Nitro-Release: ${tag}`) ||
    !annotation.split('\n').includes(`Npm-Tag: ${npmTag}`)
  ) {
    throw new Error(
      `Tag ${tag} was not created by this release workflow with npm tag ${npmTag}`
    )
  }
  sourceCommit = annotation
    .split('\n')
    .find((line) => line.startsWith('Source-Commit: '))
    ?.slice('Source-Commit: '.length)
  if (!/^[a-f0-9]{40}$/.test(sourceCommit))
    throw new Error('Release tag does not record its source commit')
  if (nightly && git(['rev-parse', `${tag}^`]) !== sourceCommit)
    throw new Error('Nightly commit must be based on its recorded source')
  git([
    'merge-base',
    '--is-ancestor',
    nightly ? sourceCommit : commit,
    `origin/${branch}`,
  ])
  git(['checkout', '--detach', commit])
  run('node', ['scripts/set-version.mjs', '--check'])
  if (readJSON('package.json').version !== version)
    throw new Error('Tagged version does not match input')
  const release = getRelease(repository, tag)
  if (release?.assets.some((asset) => asset.name === 'nitro-release.json')) {
    manifest = downloadRelease(repository, tag, 'nitro-release.json', directory)
    if (
      manifest.commit !== commit ||
      manifest.npmTag !== npmTag ||
      manifest.sourceCommit !== sourceCommit
    )
      throw new Error(
        'Saved release differs from its Git tag or requested npm tag'
      )
    if (!release.draft) {
      await assertPublishedPackages(manifest)
      console.log(`${tag} is already complete`)
      if (requestRef && !dryRun) git(['push', 'origin', '--delete', requestRef])
      reportCompletedRelease()
      process.exit(0)
    }
  }
} else {
  if (nightly && !automaticNightly)
    throw new Error(
      'New nightlies are created by pushes to main; rerun their original workflow to retry'
    )
  if (
    automaticNightly &&
    !dryRun &&
    (branch !== 'main' || sourceCommit !== process.env.GITHUB_SHA)
  )
    throw new Error('Nightlies must build the exact main push commit')
  if (nightly)
    git(['merge-base', '--is-ancestor', sourceCommit, `origin/${branch}`])
  if (!nightly && sourceCommit !== git(['rev-parse', `origin/${branch}`]))
    throw new Error('Release checkout must match the remote branch tip')
  if (
    !nightly &&
    compareVersions(version, readJSON('package.json').version) <= 0
  )
    throw new Error(
      'A new release must increase the version. To recover a release, use its existing version.'
    )
  // A failed run may have pushed its tag without reaching the draft checkpoint.
  const releaseTags = git([
    'for-each-ref',
    '--format=%(refname:short) %(contents:subject)',
    'refs/tags',
  ])
    .split('\n')
    .filter((line) => /^v\S+ Nitro-Release: v\S+(?: |$)/.test(line))
    .map((line) => line.split(' ')[0])
  for (const releaseTag of nightly
    ? []
    : releaseTags.filter((name) => !isNightly(name.slice(1)))) {
    const release = getRelease(repository, releaseTag)
    if (!release || release.draft)
      throw new Error(`Resume ${releaseTag} before starting another release`)
  }
  for (const name of ['nitro-core', 'nitrogen']) {
    if (await registryPackage(name, version))
      throw new Error(`${name}@${version} already exists on npm`)
  }
  run('node', ['scripts/set-version.mjs', version])
}

if (!manifest) {
  run('bun', [
    'install',
    '--ignore-scripts',
    ...(exists ? ['--frozen-lockfile'] : []),
  ])
  run('node', ['--test', 'scripts/releases/lib.test.mjs'])
  run('bun', ['run', 'build'])
  run('bun', ['run', 'typecheck'])
  const packages = ['nitro-core', 'nitrogen'].map((name) =>
    packPackage(path.join(root, 'packages', name), directory)
  )
  checkConsumer(packages.map((pkg) => path.join(directory, pkg.filename)))
  if (dryRun) {
    console.log(
      `Validated ${tag} (${npmTag}); no commit, tag, push or publication. Tarballs: ${directory}`
    )
    process.exit(0)
  }
  if (!exists) {
    git(['config', 'user.name', 'Marc Rousavy'])
    git(['config', 'user.email', 'me@mrousavy.com'])
    git([
      'add',
      'package.json',
      'packages/nitro-core/package.json',
      'packages/nitrogen/package.json',
      'packages/nitro-core/js/src/version.ts',
      'packages/nitro-core/native/cpp/utils/NitroDefines.hpp',
      'bun.lock',
    ])
    git(['diff', '--exit-code'])
    git(['commit', '-m', `chore: release ${version}`])
    git([
      'tag',
      '--annotate',
      tag,
      '--message',
      `Nitro-Release: ${tag}\n\nNpm-Tag: ${npmTag}\nSource-Commit: ${sourceCommit}`,
    ])
    git([
      'push',
      '--atomic',
      'origin',
      ...(!nightly ? [`HEAD:refs/heads/${branch}`] : []),
      `refs/tags/${tag}`,
    ])
  } else {
    assertClean()
  }
  manifest = validateManifest(
    {
      schema: 1,
      repository,
      version,
      tag,
      commit: git(['rev-parse', 'HEAD']),
      npmTag,
      sourceCommit,
      packages,
    },
    { repository, tag, packages: ['nitro-core', 'nitrogen'] }
  )
  saveDraft(manifest, directory, 'nitro-release.json')
}
if (dryRun) {
  console.log(`Saved artifacts for ${tag} verified. No publication.`)
  process.exit(0)
}
await publishPackages(manifest, directory)
finishRelease(manifest)
if (requestRef) git(['push', 'origin', '--delete', requestRef])
reportCompletedRelease()
console.log(
  `Released ${tag}. The RN repository will pick up this completed release.`
)
