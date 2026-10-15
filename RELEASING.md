# Releasing Nitro

Choose one version in this repository. CI publishes `nitro-core` and `nitrogen`, then completes the GitHub release. The React Native repository picks up that release, pins its exact core commit, and publishes `react-native-nitro-modules` at the same version.

## One-time setup

The release workflow is developed on `core-split`. GitHub requires the workflow to exist on the repository's default branch before manual dispatch is available. Register a launcher on `main`, or merge the split, before trying to run it. Until the merge, set the `source-branch` input to `core-split` when starting a release. The React Native release workflow must be on that repository's `main` branch for scheduled runs.

Configure a GitHub Actions trusted publisher in the npm settings for each package:

| npm package | GitHub repository | Workflow filename |
| --- | --- | --- |
| `nitro-core` | `margelo/nitro` | `release.yml` |
| `nitrogen` | `margelo/nitro` | `release.yml` |
| `react-native-nitro-modules` | `margelo/react-native-nitro-modules` | `release.yml` |

The workflows use npm OIDC authentication. These npm settings must be configured separately; committing the workflows does not grant publish access. No npm token or cross-repository dispatch token is needed.

Actions also needs permission to push the release commit and tag and create GitHub releases in each repository. If branch protection is enabled, allow the release workflow's push or adjust the release process before publishing. Release commits use Marc Rousavy's Git identity (`Marc Rousavy <me@mrousavy.com>`).

## Start a release

From GitHub Actions, open `.github/workflows/release.yml`, choose **Run workflow**, set `source-branch` to `core-split` until the split is merged, and enter an exact `version`, such as `0.37.2` or `0.38.0-beta.1`. The `source-branch` input controls which code is released, separately from GitHub's workflow branch selector. The version is the maintainer's decision; CI does not infer a bump from commit messages. This can be done from a phone or browser.

Alternatively, with GitHub CLI authenticated:

```sh
git switch core-split
bun release 0.37.2
bun release 0.38.0-beta.1
```

Each command starts a separate release. `bun release VERSION [npm-tag]` dispatches the workflow on the current branch. It does not publish from the local checkout. Push the changes you want to release before dispatching.

Leave `npm-tag` empty to use `latest` for stable versions or the first prerelease identifier for prereleases (`beta` for `0.38.0-beta.1`, `rc` for `0.38.0-rc.1`). If that identifier does not start with a lowercase letter, it uses `next`. Supply an npm tag explicitly when needed:

```sh
bun release 0.38.0-beta.1 beta
```

A new release version must be greater than the current version. `0.37.1` was published before the split, so the first split release must use a new version. To publish a change made only in the React Native repository, start a patch release here with no core code changes.

## What CI publishes

The core workflow:

1. Updates the root, `nitro-core`, and Nitrogen package versions, Nitrogen's core dependency, `js/version.ts`, and `NITRO_VERSION`, then refreshes `bun.lock`.
2. Builds and typechecks both packages, packs them with `npm pack`, and checks the tarballs in a consumer outside the workspace.
3. Pushes the version commit and `vVERSION` tag together with an atomic Git push.
4. Saves the tarballs and `nitro-release.json` manifest on a draft GitHub release so a retry can use the same artifacts.
5. Publishes `nitro-core`, then `nitrogen`, using the selected npm tag.
6. Publishes the GitHub release after both npm packages succeed, marking prerelease versions accordingly.

The `react-native-nitro-modules` workflow polls completed Nitro releases every 15 minutes. GitHub may delay scheduled runs. It processes the oldest pending release with a `nitro-release.json` manifest, including prereleases; legacy releases without that manifest are ignored.

For each release, the wrapper pins `packages/react-native-nitro-modules/nitro` to the exact tagged core commit, updates its package versions and dependencies, stages the native sources, validates the package, and publishes `react-native-nitro-modules`. It uses the core release's version and npm tag, then creates its own GitHub release. Normal builds continue to use the committed submodule SHA.

The root, shared packages, JS version, and native version move together. Nitrogen keeps its compatible `^VERSION` dependency on `nitro-core`; the RN package pins `nitro-core` to exactly `VERSION` so the JS and native runtime match. The wrapper does not publish either core package.

## Resume a failed release

Rerun the failed workflow or dispatch the same version again. Keep the same npm tag. CI reuses the existing release commit, tag, and saved artifacts, checks each package's npm integrity against the saved tarball, and publishes only the missing packages. The GitHub release is completed after all packages succeed.

Do not delete or move a release tag, replace a saved tarball, or bump again just to retry a failed publish. npm versions are immutable. An integrity mismatch requires investigation before continuing; a registry or authentication error must not be treated as an unpublished package.

A failed wrapper release can resume from its saved artifacts as well. The wrapper only follows completed core releases, so a draft core release does not start downstream publication. Check both repositories' Actions runs to follow the full release.

## Development checks

`bun version:set VERSION` remains available for local preparation, and `bun check-versions` verifies the shared versions. The release workflow normally handles version changes. Implementation changes belong in this repository; do not bump `NITRO_VERSION` in the wrapper's generated header.

Before releasing native changes, run the relevant iOS/Android builds and Harness tests in the React Native repository with the proposed core commit. The core release's package and consumer checks do not replace those native tests. See [REPOSITORY_SPLIT.md](REPOSITORY_SPLIT.md) for development pin updates and [CONTRIBUTING.md](CONTRIBUTING.md) for validation expectations.
