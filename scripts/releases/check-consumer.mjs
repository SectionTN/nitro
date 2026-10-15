import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run, writeJSON } from './lib.mjs'

export function checkConsumer(tarballs) {
  const consumer = mkdtempSync(path.join(tmpdir(), 'nitro-release-consumer-'))
  writeJSON(path.join(consumer, 'package.json'), {
    name: 'nitro-release-consumer',
    version: '1.0.0',
    private: true,
  })
  run('npm', ['install', '--no-audit', '--no-fund', ...tarballs], {
    cwd: consumer,
  })
  for (const name of ['nitro-core', 'nitrogen']) {
    const location = path.join(consumer, 'node_modules', name)
    if (lstatSync(location).isSymbolicLink())
      throw new Error(`Consumer uses a workspace link for ${name}`)
    for (const entry of [
      '.git',
      'node_modules',
      'apps',
      'docs',
      'nitro',
      'hermes',
    ]) {
      if (existsSync(path.join(location, entry)))
        throw new Error(`Unexpected packaged entry: ${name}/${entry}`)
    }
  }
  for (const name of ['react-native', 'react-native-nitro-modules']) {
    if (existsSync(path.join(consumer, 'node_modules', name)))
      throw new Error(`Unexpected dependency: ${name}`)
  }
  run(
    'node',
    [
      '--input-type=module',
      '-e',
      "import { getInstalledNitro } from 'nitro-core'; if (getInstalledNitro() !== undefined) throw Error('Unexpected runtime')",
    ],
    { cwd: consumer }
  )
  run(
    'node',
    [
      '-e',
      "if (require('nitro-core').getInstalledNitro() !== undefined) throw Error('Unexpected runtime')",
    ],
    { cwd: consumer }
  )
  writeFileSync(
    path.join(consumer, 'Math.nitro.ts'),
    "import type { HybridObject } from 'nitro-core'\nexport interface Math extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> { add(a: number, b: number): number }\n"
  )
  writeJSON(path.join(consumer, 'tsconfig.json'), {
    compilerOptions: {
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      target: 'ESNext',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
    },
    include: ['*.ts'],
  })
  writeJSON(path.join(consumer, 'nitro.json'), {
    cxxNamespace: ['releasecheck'],
    ios: { iosModuleName: 'ReleaseCheck' },
    android: {
      androidNamespace: ['releasecheck'],
      androidCxxLibName: 'ReleaseCheck',
    },
    autolinking: {},
    ignorePaths: ['**/node_modules'],
  })
  const tsc = fileURLToPath(
    new URL('../../node_modules/typescript/bin/tsc', import.meta.url)
  )
  run('node', [tsc, '--project', path.join(consumer, 'tsconfig.json')], {
    cwd: consumer,
  })
  run('node', ['node_modules/nitrogen/lib/index.js'], { cwd: consumer })
  const header = path.join(
    consumer,
    'nitrogen/generated/shared/c++/HybridMathSpec.hpp'
  )
  if (!existsSync(header) || !readFileSync(header, 'utf8').includes('add('))
    throw new Error('Packed Nitrogen did not generate the consumer spec')
  console.log(`Validated packed core packages in ${consumer}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkConsumer(process.argv.slice(2).map((file) => path.resolve(file)))
}
