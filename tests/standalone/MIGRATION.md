# Runtime test migration from main

Source: `40d58894b` on `main`. The behavior cases come from
`apps/example/__tests__`; their native fixtures come from
`packages/react-native-nitro-test` and `packages/react-native-nitro-test-external`.

The migration preserves the source assertions and fixture behavior, including
known failures. Production Nitro and Nitrogen fixes belong in follow-up PRs.
Existing exclusions for unsafe or unsupported platform/build combinations remain
explicit; failures introduced by running the migrated cases are not excluded.

## Inventory

Each shared test runs against both `TestObjectCpp` and
`TestObjectSwiftKotlin`, except suites that explicitly target one implementation.
The counts below include those individual implementation cases and expanded
data-driven cases.

| Source suite   | Migrated cases |
| -------------- | -------------: |
| array-buffers  |             82 |
| arrays         |            118 |
| callbacks      |             96 |
| cpp-only       |             52 |
| errors         |             28 |
| external       |             48 |
| hybrid-objects |             86 |
| inheritance    |             60 |
| maps           |            126 |
| memory         |             11 |
| nitro-modules  |             75 |
| optionals      |            118 |
| primitives     |            164 |
| promises       |             66 |
| stress         |              2 |
| structs        |            116 |
| variants       |            166 |
| **Total**      |      **1,414** |

The two JS runner checks and the native runner contract tests remain alongside
these suites. The Promise runner check uses `TestObjectSwiftKotlin`. The original
boolean/Fibonacci placeholder fixture and its three cases are removed; the full
fixtures are defined in `runtime/specs/TestObject.nitro.ts`.

## Exclusions and adaptations

- The eight `nitro.views.harness.tsx` cases depend on React Native rendering,
  view refs, Fabric, or recycling. Their view specs and native implementations
  are not migrated, including the `getIsViewBlue` fixture method.
- The `PlatformObject` OS-version comparison uses React Native's `Platform`
  constants and is excluded. The native platform fixture remains available.
- Registry expectations remove the two view registrations. Version checks use
  `nitro-core`.
- HardwareBuffer tests remain: Android platform APIs do not require React Native.
- The external fixture remains a separate native module, preserving tests of
  cross-module HybridObjects and optional primitives.
- Harness assertions become Chai assertions. Callback recording and native
  waits replace Harness spies/polling and JavaScript timer dependencies.
  Identity checks preserve `Object.is` behavior, and the two variant assertions
  with omitted optional fields preserve `toEqual`'s undefined-key semantics.
- The host supplies platform metadata and `gc()` directly through JSI.

The two package `src/__tests__/index.test.tsx` files contain only
`it.todo('write a test')`, so they contribute no executable cases. The 18
`scripts/performance/*.test.ts` suites test the React Native benchmark/reporting
toolchain (Bun, subprocesses, filesystem, GitHub reports), which is not part of
`core-split`'s native runtime. They are not copied into the Hermes runner.
