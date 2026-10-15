# Repository split

The split starts at Nitro commit `d498e237e9b4117c4abe38c023adf486c75f856a`, with tracked tree `d5e639fb4d492f433ff70b25ec59ccf4a130a3fc`. That complete commit and its history were pushed to `margelo/react-native-nitro/main` before files were removed here. The integration changes live on `core-split` in both repositories, so the wrapper's initial `main` remains available for comparison. No changes were imported from `react-nitro`.

## Ownership

This repository owns `packages/react-native-nitro-modules/{cpp,ios,android/src,src}` and `packages/nitrogen`. These retain their existing names and React Native behavior, including HybridObjects, views, Fabric, worklets, native registration, generated APIs, and autolinking.

The runtime workspace here is private. It builds the shared JS/TS API for local development and for Nitrogen's existing dependency on `react-native-nitro-modules`. There is no new public core npm package.

[react-native-nitro](https://github.com/margelo/react-native-nitro) owns the public `react-native-nitro-modules` package metadata, CocoaPods/Gradle/CMake integration, RN codegen configuration, apps, tests, fixtures, docs, and init template. Its `core` submodule pins this repository to a specific commit. The submodule's `core-split` branch setting is a development hint; normal bootstrap and builds use the committed SHA.

The wrapper's `sync-core` command stages the shared implementation into the original package paths. Those files are ignored generated outputs. Edit the implementation in `core/packages/react-native-nitro-modules`, then stage it again. Nitrogen runs directly from `core/packages/nitrogen` in the wrapper workspace.

## Development and validation

In this repository:

```sh
bun bootstrap
bun run build
bun typecheck
```

The root build compiles the shared API before Nitrogen. Local workspace resolution uses the private runtime package with its unchanged name. The published Nitrogen package continues to depend on the public RN package using the existing compatible version range.

In `react-native-nitro`, run `bun bootstrap` on a clean checkout. It initializes the pinned submodule, stages sources, installs dependencies, and builds the workspace. Use `bun specs` for the existing generation fixtures and the existing app commands for iOS, Android, and harness tests. See that repository's contribution guide for native toolchain setup.

For a shared change, validate it in the wrapper checkout as well: stage the changed core sources, build Nitrogen, regenerate the existing fixtures, and run the relevant native builds and tests. Commit expected generated bindings in the wrapper. Core CI builds and typechecks the retained packages and packs Nitrogen; RN generation, native builds, runtime tests, and performance workflows live in the wrapper.

## Updating the pinned core

1. Make the shared change in Nitro's `core-split` branch, build it, and commit and push it.
2. In `react-native-nitro`, run `git -C core fetch origin`, then `git -C core checkout <pushed-core-sha>`.
3. Run `git add core` to record the new pin, then `bun update-core-version` if the version changed, `bun install`, `bun run build`, and `bun specs`. Run the affected native tests and inspect generated output.
4. Commit the wrapper's `core` gitlink and any metadata, lockfile, or fixture changes. Push the wrapper commit after its pinned core commit is available remotely.

Local edits in `core` are allowed during development. Before publishing, commit and push them and record the resulting SHA in the wrapper. Never use `git submodule update --remote` in normal builds or consumer installation.

## Versions and releases

The root, shared runtime package, Nitrogen package, Nitrogen's runtime dependency, and `NITRO_VERSION` move together. In this repository, `bun version:set <version>` updates all of them, including the authoritative `cpp/utils/NitroDefines.hpp`; then run `bun install` to update the lockfile. `bun check-versions` verifies consistency. Do not edit a staged wrapper header to bump a version.

Release preparation follows the same order as a core update: set and validate the version here, push the core commit, update the wrapper pin and package versions, and validate both real npm tarballs. Pack with `npm pack` from each package directory. Nitrogen's pack hook builds its output. The wrapper's pack hook stages and builds its output.

When ready to publish, this repository's `bun release` uses release-it to bump the synchronized versions and publish only `nitrogen`. It also creates the configured core Git tag and GitHub release. For an already prepared version, use release-it's `--no-increment` option. After any release commit, update and validate the wrapper pin again before running the wrapper's release command, which publishes only `react-native-nitro-modules`.

Neither package needs the Git checkout at consumer install time. The RN tarball contains actual implementation files at its existing paths, and the Nitrogen tarball contains its CLI and generator sources. Licenses are included in both packages. Apps, test fixtures, docs, Git metadata, and development build caches stay out of the tarballs.
