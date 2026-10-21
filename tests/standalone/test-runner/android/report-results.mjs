import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { XMLParser } from 'fast-xml-parser'

const directory = process.argv[2] ?? fileURLToPath(new URL('./build/outputs/androidTest-results/connected', import.meta.url))
const reports = existsSync(directory) ? [...new Bun.Glob('**/TEST-*.xml').scanSync({ cwd: directory, absolute: true })].sort() : []
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  htmlEntities: true,
  isArray: (name) => ['testsuite', 'testcase', 'failure', 'error', 'skipped'].includes(name),
})

function collectCases(suite) {
  return [...(suite.testcase ?? []), ...(suite.testsuite ?? []).flatMap(collectCases)]
}

const cases = reports.flatMap((report) => {
  const xml = parser.parse(readFileSync(report, 'utf8'))
  return (xml.testsuite ?? xml.testsuites?.testsuite ?? []).flatMap(collectCases)
})
const lines = []
let passed = 0
let failed = 0
let skipped = 0
for (const test of cases) {
  const name = [test.classname?.split('.').at(-1), test.name].filter(Boolean).join('.')
  const failure = test.failure?.[0] ?? test.error?.[0]
  if (failure !== undefined) {
    failed++
    lines.push(`✗ ${name}`)
    const details = typeof failure === 'string' ? failure : failure['#text']?.trim() || failure.message || ''
    if (details.trim()) {
      for (const line of details.trim().split('\n')) lines.push(`  ${line}`)
    }
  } else if (test.skipped !== undefined) {
    skipped++
    lines.push(`- ${name} (skipped)`)
  } else {
    passed++
    lines.push(`✓ ${name}`)
  }
}
lines.push(cases.length ? `${passed} passed, ${failed} failed, ${skipped} skipped` : 'No JUnit results were produced.')
const result = lines.join('\n')
console.log(result)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Android JUnit results\n\n\`\`\`text\n${result}\n\`\`\`\n`)
}
