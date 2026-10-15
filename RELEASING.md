# Releasing Nitro

Choose one version in this repository. CI publishes `nitro-core` and `nitrogen`, then completes the GitHub release. The React Native repository picks up that release, pins its exact core commit, and publishes `react-native-nitro-modules` at the same version. After the split is merged, pushes to `main` also publish nightly versions.

## One-time setup

The release workflow lives on `core-split`; `main` stays unchanged until the split is merged. Before the merge, use the CLI command below to start a release through a temporary request branch. GitHub's **Run workflow** button and automatic nightlies become available once the workflow is on `main`. The React Native release workflow must be on that repository's `main` branch for scheduled runs.

Configure a GitHub Actions trusted publisher in the npm settings for each package:

| npm package | GitHub repository | Workflow filename |
| --- | --- | --- |
| `nitro-core` | `margelo/nitro` | `release.yml` |
| `nitrogen` | `margelo/nitro` | `release.yml` |
| `react-native-nitro-modules` | `margelo/react-native-nitro-modules` | `release.yml` |

The workflows use npm OIDC authentication. These npm settings must be configured separately; committing the workflows does not grant publish access. No npm token or cross-repository dispatch token is needed.

Actions also needs permission to push the release commit and tag and create GitHub releases in each repository. If branch protection is enabled, allow the release workflow's push or adjust the release process before publishing. Release commits use Marc Rousavy's Git identity (`Marc Rousavy <me@mrousavy.com>`).

## Start a release

Choose an exact version, such as `0.37.2` or `0.38.0-beta.1`. CI does not infer a bump from commit messages. From a checkout with push access:

```sh
git switch core-split
bun release 0.37.2
bun release 0.38.0-beta.1
```

Each command starts a separate release. `bun release VERSION [npm-tag]` creates and pushes a temporary `release-request/<source-branch>/<version>/<npm-tag>/<timestamp>` branch from the remote source branch's tip. That push starts the workflow, which removes the request branch after success. Push the changes you want to release before running the command; uncommitted files and local-only commits are not included.

After merging the split into `main`, releases can also start from GitHub Actions on a phone or browser: open `.github/workflows/release.yml`, choose **Run workflow**, set `source-branch` to `main`, and enter the version. The input controls which code is released, separately from GitHub's workflow branch selector.

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

The `react-native-nitro-modules` workflow polls completed Nitro releases every 15 minutes. GitHub may delay scheduled runs. It processes regular releases oldest first, including beta and RC versions, then pending nightlies newest first. Only releases with a `nitro-release.json` manifest are considered; legacy releases are ignored. A failed nightly does not block a newer fix or a regular release.

For each release, the wrapper pins `packages/react-native-nitro-modules/nitro` to the exact tagged core commit, updates its package versions and dependencies, stages the native sources, validates the package, and publishes `react-native-nitro-modules`. It uses the core release's version and npm tag, then creates its own GitHub release. Normal builds continue to use the committed submodule SHA.

The root, shared packages, JS version, and native version move together. Nitrogen keeps its compatible `^VERSION` dependency on `nitro-core`; the RN package pins `nitro-core` to exactly `VERSION` so the JS and native runtime match. The wrapper does not publish either core package.

## Nightlies

Once the split is merged, a push to `main` starts a nightly for that source revision. Its version includes the workflow run number and source commit, for example `0.37.2-nightly.123.gabcdef012345`. A stable base of `0.37.1` advances to `0.37.2-nightly...`; a prerelease base of `0.38.0-beta.1` produces `0.38.0-nightly...`. Rerunning the same workflow keeps the same version.

CI creates a separate version commit and release tag for each nightly. It leaves `main` and its stable package versions unchanged. Nightlies use npm's `nightly` tag and GitHub prereleases, so installing `latest` continues to select the stable release. The React Native repository follows completed nightly releases through the same polling workflow and creates its own nightly release commit without advancing the stable submodule pin on `main`.

If an older nightly finishes after a newer one, it is still published under its exact version with an npm tag of `nightly-<release-commit-prefix>`. It does not move the shared `nightly` tag backwards. Release runs are serialized; GitHub's queue limit still applies during bursts of pushes.

## Resume a failed release

Rerun the failed workflow or request the same version again. Keep the same npm tag. For a nightly, rerun its original workflow so the run number and version stay the same. CI reuses the existing release commit, tag, and saved artifacts, checks each package's npm integrity against the saved tarball, and publishes only the missing packages. The GitHub release is completed after all packages succeed.

Do not delete or move a release tag, replace a saved tarball, or bump again just to retry a failed publish. npm versions are immutable. An integrity mismatch requires investigation before continuing; a registry or authentication error must not be treated as an unpublished package.

A failed wrapper release can resume from its saved artifacts as well. The wrapper only follows completed core releases, so a draft core release does not start downstream publication. Check both repositories' Actions runs to follow the full release.

## Development checks

`bun version:set VERSION` remains available for local preparation, and `bun check-versions` verifies the shared versions. The release workflow normally handles version changes. Implementation changes belong in this repository; do not bump `NITRO_VERSION` in the wrapper's generated header.

Before releasing native changes, run the relevant iOS/Android builds and Harness tests in the React Native repository with the proposed core commit. The core release's package and consumer checks do not replace those native tests. See [REPOSITORY_SPLIT.md](REPOSITORY_SPLIT.md) for development pin updates and [CONTRIBUTING.md](CONTRIBUTING.md) for validation expectations.
