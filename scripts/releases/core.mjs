import { mkdtempSync } from 'node:fs'
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
const version = process.env.RELEASE_VERSION
parseVersion(version)
const npmTag = npmTagFor(version, process.env.RELEASE_NPM_TAG)
const tag = `v${version}`
const dryRun = process.env.RELEASE_DRY_RUN === 'true'
const branch =
  process.env.RELEASE_BRANCH ??
  process.env.GITHUB_REF_NAME ??
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
  git(['merge-base', '--is-ancestor', commit, `origin/${branch}`])
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
  git(['checkout', '--detach', commit])
  run('node', ['scripts/set-version.mjs', '--check'])
  if (readJSON('package.json').version !== version)
    throw new Error('Tagged version does not match input')
  const release = getRelease(repository, tag)
  if (release?.assets.some((asset) => asset.name === 'nitro-release.json')) {
    manifest = downloadRelease(repository, tag, 'nitro-release.json', directory)
    if (manifest.commit !== commit || manifest.npmTag !== npmTag)
      throw new Error(
        'Saved release differs from its Git tag or requested npm tag'
      )
    if (!release.draft) {
      await assertPublishedPackages(manifest)
      console.log(`${tag} is already complete`)
      process.exit(0)
    }
  }
} else {
  if (git(['rev-parse', 'HEAD']) !== git(['rev-parse', `origin/${branch}`]))
    throw new Error('Release checkout must match the remote branch tip')
  if (compareVersions(version, readJSON('package.json').version) <= 0)
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
  for (const releaseTag of releaseTags) {
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
      'packages/nitro-core/js/version.ts',
      'packages/nitro-core/cpp/utils/NitroDefines.hpp',
      'bun.lock',
    ])
    git(['diff', '--exit-code'])
    git(['commit', '-m', `chore: release ${version}`])
    git([
      'tag',
      '--annotate',
      tag,
      '--message',
      `Nitro-Release: ${tag}\n\nNpm-Tag: ${npmTag}`,
    ])
    git([
      'push',
      '--atomic',
      'origin',
      `HEAD:refs/heads/${branch}`,
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
console.log(
  `Released ${tag}. The RN repository will pick up this completed release.`
)
