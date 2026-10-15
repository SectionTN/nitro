# Repository split

The split starts at Nitro commit `d498e237e9b4117c4abe38c023adf486c75f856a`, with tracked tree `d5e639fb4d492f433ff70b25ec59ccf4a130a3fc`. That complete commit and its history were pushed to `margelo/react-native-nitro-modules/main` before files were removed here. The shared source changes live on `core-split` in this repository, and the React Native integration lives on `main` in the wrapper. The baseline commit remains in the wrapper's history for comparison.

## Ownership

This repository owns `packages/nitro-core/`, `packages/nitrogen/`, and the Docusaurus site in `docs/`. The runtime sources are grouped under `packages/nitro-core/native/{cpp,apple,android}` and `packages/nitro-core/js/src`. Native names, registration, generated APIs, and React Native behavior stay unchanged. The native sources still contain React Native-specific code.

The `nitro-core` npm package publishes the shared native sources, JavaScript API, and TypeScript definitions together. It owns HybridObject types, the NitroModulesProxy contract, runtime access, version checks, and constructor helpers. It has no React Native dependency. Nitrogen depends on `nitro-core`. The native sources and embedded JS version come from the same package release.

[react-native-nitro-modules](https://github.com/margelo/react-native-nitro-modules) owns the public `react-native-nitro-modules` package metadata, RN JS bootstrap, views and worklets integration, CocoaPods/Gradle/CMake integration, RN codegen configuration, apps, tests, fixtures, and init template. It depends on the exact matching `nitro-core` version and re-exports its shared API. Release snapshots resolve core and Nitrogen through exact npm dependencies and a lockfile. The wrapper’s first regular release commits that transition to `main`. Until then, its pinned submodule supplies the same packages as local workspaces so a clean checkout remains buildable.

The wrapper's `sync-core` command stages `native/cpp/`, `native/apple/`, and `native/android/src/` from its installed `nitro-core` dependency into its existing `cpp/`, `ios/`, and `android/src/` paths. Those directories are ignored generated outputs. The wrapper maintains its own `src/` directory. Shared JS resolves from the `nitro-core` dependency. Nitrogen is installed as a development dependency.

`packages/template` stays in the React Native repository because it creates an RN library with CocoaPods, Gradle, and React Native package metadata. Nitrogen owns the init command and downloads that template from the wrapper's `main` branch.

## Development and validation

In this repository:

```sh
bun bootstrap
bun run build
bun typecheck
```

The root build compiles `nitro-core` before Nitrogen. Both use the same package version. Nitrogen accepts the compatible `^VERSION` range of core definitions; the RN package uses an exact core version to match its native runtime.

In `react-native-nitro-modules`, run `bun bootstrap` on a clean checkout. It installs dependencies, stages sources from the installed core package, and builds the workspace. Use `bun specs` for the existing generation fixtures and the existing app commands for iOS, Android, and harness tests. See that repository's contribution guide for native toolchain setup.

For a shared change, validate it in the wrapper checkout as well: stage the changed core sources, build Nitrogen, regenerate the existing fixtures, and run the relevant native builds and tests. Commit expected generated bindings in the wrapper. Core CI builds and typechecks the shared JS packages and packs both npm packages; RN generation, native builds, runtime tests, and performance workflows live in the wrapper.

## Updating core

1. Make the shared change in Nitro's `core-split` branch, build it, and commit and push it.
2. Release matching `nitro-core` and `nitrogen` packages through core CI.
3. In the React Native repository, update the exact core and Nitrogen dependencies, sync the wrapper version, install dependencies, and run `bun run build` and `bun specs`. Run the affected native tests and inspect generated output.
4. Commit the wrapper's package metadata, lockfile, and expected fixture changes. Release the RN package only after the core packages are available on npm.

For unreleased development, use `npm pack --pack-destination <temporary-directory>` in each core package and install both tarballs into a temporary wrapper checkout. This tests the actual package contents without publishing. Do not commit local tarball paths. Normal builds use dependencies recorded in the wrapper lockfile.

## Versions and releases

The root, `nitro-core`, Nitrogen, and embedded JS/native versions move together. `bun version:set <version>` updates their manifests, Nitrogen's core dependency, `packages/nitro-core/js/src/version.ts`, and the authoritative `packages/nitro-core/native/cpp/utils/NitroDefines.hpp`. Then run `bun install` to update the lockfile. `bun check-versions` verifies consistency. Do not edit a staged wrapper header to bump a version.

Run `bun release VERSION [npm-tag]` with an exact version to push a temporary request branch and start CI. After the split is merged, GitHub Actions also offers **Run workflow**. CI updates the shared versions, validates the packages, pushes a version commit and `vVERSION` tag, publishes `nitro-core` followed by `nitrogen`, then completes the GitHub release. Pushes to `main` produce separate nightly version commits and tags without changing its stable package versions.

The React Native repository adopts completed core releases by updating exact npm dependencies, syncing its versions, and publishing `react-native-nitro-modules` with the same npm tag. A wrapper-only fix is released by starting a patch release here. See [RELEASING.md](RELEASING.md) for setup requirements, prereleases, nightlies, and recovery after a failed publish. npm trusted publishers must be configured before the first release. Nitro's `main` stays unchanged until the split is merged.

None of the npm packages needs the Git checkout at consumer install time. The RN tarball contains native sources at their existing paths and RN-specific JS; its shared JS comes from its `nitro-core` dependency. The core tarball contains the shared native sources and JS/TS, and the Nitrogen tarball contains the CLI and generator. Licenses are included in all three packages. Apps, test fixtures, docs, Git metadata, and development build caches stay out of the tarballs.
