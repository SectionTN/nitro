# Contributing to Nitro

Nitro owns the shared native runtime, its JS/TS API, and Nitrogen. React Native packaging, apps, tests, docs, and templates live in [react-native-nitro-modules](https://github.com/margelo/react-native-nitro-modules). Read [REPOSITORY_SPLIT.md](REPOSITORY_SPLIT.md) for setup, pinned core updates, and the release sequence.

## Scope and code review

Keep changes focused. Bug fixes and features need a test that reproduces the problem; runtime and generation fixtures live in the wrapper repository. A PR containing only a minimal failing test is also welcome. Link related PRs across repositories so reviewers can run the core change with its test.

Reuse the existing specs and types, add the smallest assertion or method that covers the issue, and preserve existing cases. Avoid unrelated refactors, generated boilerplate, and speculative changes. AI-assisted contributions must meet the same requirements as other changes.

## Development

Use Bun for workspace installation and builds:

```sh
bun bootstrap
bun run build
bun typecheck
bun lint-all
```

The runtime package at `packages/react-native-nitro-modules` is the canonical source location and is private in this repository. Its name and APIs stay unchanged. `packages/nitrogen` is the published generator, including React Native view generation and autolinking.

For native or generator changes, use a `react-native-nitro-modules` checkout on `main` with your core commit in its `packages/react-native-nitro-modules/nitro` submodule. Run `bun sync-core`, build the workspace, run `bun specs`, and build the example app on the affected platforms. Run the existing harness tests for behavioral changes. Commit generated fixture changes in the wrapper repository. The [wrapper contribution guide](https://github.com/margelo/react-native-nitro-modules/blob/main/CONTRIBUTING.md) and [docs](https://nitro.margelo.com/docs/resources/contributing) describe the existing test harness and toolchains.

## Before requesting review

- Target `core-split` here and `main` in the React Native repository.
- Include or link a regression test for each fix. For a reproduction-only PR, describe the expected failure.
- Run the retained package builds, typechecks, and relevant linters here.
- Regenerate the wrapper's fixtures and run the relevant native builds and tests.
- Preserve existing test coverage and report checks that could not run.
- Use Conventional Commit messages (`fix:`, `feat:`, `docs:`, `chore:`, `perf:`).

Core CI builds and typechecks the retained packages, runs linters, checks Nitrogen init, and packs Nitrogen. The wrapper owns generation comparisons, native builds, runtime harness tests, and performance CI. Validate shared changes there before merging them.
