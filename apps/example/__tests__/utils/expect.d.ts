import type { Assertion, Tester } from '@vitest/expect'

// Harness' `expect` implements these at runtime, but its `ExpectStatic` type
// (from `@vitest/expect`) only gets them through the `vitest` package.
// `expect.assertions()`/`expect.hasAssertions()` are left out on purpose:
// Harness never checks them.
declare module '@vitest/expect' {
  interface ExpectStatic {
    soft: <T>(actual: T, message?: string) => Assertion<T>
    unreachable: (message?: string) => never
    addEqualityTesters: (testers: Array<Tester>) => void
  }
}
