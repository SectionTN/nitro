# Repository split

The split starts at Nitro commit `d498e237e9b4117c4abe38c023adf486c75f856a`, with tracked tree `d5e639fb4d492f433ff70b25ec59ccf4a130a3fc`. That complete commit and its history were pushed to `margelo/react-native-nitro-modules/main` before files were removed here. The shared source changes live on `core-split` in this repository, and the React Native integration lives on `main` in the wrapper. The baseline commit remains in the wrapper's history for comparison.

## Ownership

This repository owns `packages/nitro-core/` and `packages/nitrogen/`. The runtime sources are grouped under `packages/nitro-core/{android,apple,cpp,js}`. Native names, registration, generated APIs, and React Native behavior stay unchanged. The native sources still contain React Native-specific code.

The `nitro-core` npm package publishes only the shared JS/TS API from `packages/nitro-core/js/`. It owns HybridObject types, the NitroModulesProxy contract, runtime access, version checks, and constructor helpers. It has no React Native dependency. Nitrogen depends on `nitro-core`. Native sources remain in this Git repository and are distributed by the host integration package.

[react-native-nitro-modules](https://github.com/margelo/react-native-nitro-modules) owns the public `react-native-nitro-modules` package metadata, RN JS bootstrap, views and worklets integration, CocoaPods/Gradle/CMake integration, RN codegen configuration, apps, tests, fixtures, docs, and init template. It depends on the exact matching `nitro-core` version and re-exports its shared API. Its `nitro` submodule at `packages/react-native-nitro-modules/nitro` pins this repository to a specific commit. The submodule's `core-split` branch setting is a development hint; normal bootstrap and builds use the committed SHA.

The wrapper's `sync-core` command stages `packages/nitro-core/cpp/`, `packages/nitro-core/apple/`, and `packages/nitro-core/android/src/` into its existing `cpp/`, `ios/`, and `android/src/` paths. Those directories are ignored generated outputs. The wrapper maintains its own `src/` directory. Both `nitro-core` and Nitrogen run directly from the pinned submodule as workspace packages; their sources are not copied into the RN package.

`packages/template` stays in the React Native repository because it creates an RN library with CocoaPods, Gradle, and React Native package metadata. Nitrogen owns the init command and downloads that template from the wrapper's `main` branch.

## Development and validation

In this repository:

```sh
bun bootstrap
bun run build
bun typecheck
```

The root build compiles `nitro-core` before Nitrogen. Both use the same package version. Nitrogen accepts the compatible `^VERSION` range of core definitions; the RN package uses an exact core version to match its native runtime.

In `react-native-nitro-modules`, run `bun bootstrap` on a clean checkout. It initializes the pinned submodule, stages sources, installs dependencies, and builds the workspace. Use `bun specs` for the existing generation fixtures and the existing app commands for iOS, Android, and harness tests. See that repository's contribution guide for native toolchain setup.

For a shared change, validate it in the wrapper checkout as well: stage the changed core sources, build Nitrogen, regenerate the existing fixtures, and run the relevant native builds and tests. Commit expected generated bindings in the wrapper. Core CI builds and typechecks the shared JS packages and packs both npm packages; RN generation, native builds, runtime tests, and performance workflows live in the wrapper.

## Updating the pinned core

1. Make the shared change in Nitro's `core-split` branch, build it, and commit and push it.
2. In the React Native repository on `main`, run `git -C packages/react-native-nitro-modules/nitro fetch origin`, then `git -C packages/react-native-nitro-modules/nitro checkout <pushed-core-sha>`.
3. Run `git add packages/react-native-nitro-modules/nitro` to record the new pin, then `bun update-core-version` if the version changed, `bun install`, `bun run build`, and `bun specs`. Run the affected native tests and inspect generated output.
4. Commit the wrapper's `nitro` gitlink and any metadata, lockfile, or fixture changes. Push the wrapper commit after its pinned core commit is available remotely.

Local edits in `packages/react-native-nitro-modules/nitro` are allowed during development. Before publishing, commit and push them and record the resulting SHA in the wrapper. Never use `git submodule update --remote` in normal builds or consumer installation.

## Versions and releases

The root, `nitro-core`, Nitrogen, and embedded JS/native versions move together. `bun version:set <version>` updates their manifests, Nitrogen's core dependency, `packages/nitro-core/js/version.ts`, and the authoritative `packages/nitro-core/cpp/utils/NitroDefines.hpp`. Then run `bun install` to update the lockfile. `bun check-versions` verifies consistency. Do not edit a staged wrapper header to bump a version.

Run `bun release VERSION [npm-tag]` with an exact version to push a temporary request branch and start CI. After the split is merged, GitHub Actions also offers **Run workflow**. CI updates the shared versions, validates the packages, pushes a version commit and `vVERSION` tag, publishes `nitro-core` followed by `nitrogen`, then completes the GitHub release. Pushes to `main` produce separate nightly version commits and tags without changing its stable package versions.

The React Native repository polls completed core releases, pins the exact tagged commit, syncs its versions, and publishes `react-native-nitro-modules` with the same npm tag. A wrapper-only fix is released by starting a patch release here. See [RELEASING.md](RELEASING.md) for setup requirements, prereleases, nightlies, and recovery after a failed publish. npm trusted publishers must be configured before the first release. Nitro's `main` stays unchanged until the split is merged.

None of the npm packages needs the Git checkout at consumer install time. The RN tarball contains native sources at their existing paths and RN-specific JS; its shared JS comes from its `nitro-core` dependency. The core tarball contains only shared JS/TS, and the Nitrogen tarball contains the CLI and generator. Licenses are included in all three packages. Apps, test fixtures, docs, Git metadata, and development build caches stay out of the tarballs.
