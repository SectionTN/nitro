# Nitro native sources

This directory owns Nitro's C++, Swift, and Kotlin/JNI implementation. Its package manifest is private and records the native source version.

Shared JavaScript and TypeScript APIs live in [`nitro-core`](../nitro-core). React Native JS initialization, views, worklets integration, and npm/native build configuration live in [margelo/react-native-nitro-modules](https://github.com/margelo/react-native-nitro-modules).

The React Native repository stages `cpp/`, `ios/`, and `android/src/` from its pinned Nitro submodule before building and packing. Edit native implementation files here, then validate them in that repository. See [the split guide](../../REPOSITORY_SPLIT.md) for the update and release sequence.
