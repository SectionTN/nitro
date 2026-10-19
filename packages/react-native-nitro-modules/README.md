<a href="https://nitro.margelo.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/margelo/nitro/main/docs/static/img/banner-react-native-nitro-modules-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/margelo/nitro/main/docs/static/img/banner-react-native-nitro-modules-light.png" />
    <img alt="React Native Nitro Modules" src="https://raw.githubusercontent.com/margelo/nitro/main/docs/static/img/banner-react-native-nitro-modules-light.png" />
  </picture>
</a>

<br />

**react-native-nitro-modules** is the core React Native Nitro package for building fast, type-safe native modules with statically compiled JSI bindings.

It uses JSI to generate C++ templates that can bridge virtually any JS type to a C++ type with minimal overhead.

## Installation

Nitro V1 requires React Native 0.88 or newer with the New Architecture. iOS builds use Swift Package Manager and require Swift 6.4 or newer.

### Inside an app

Install the alpha package as a dependency in your React Native app:

```sh
npm i react-native-nitro-modules@alpha
```

For iOS, run `npx react-native spm` from the app directory, then open the app's `.xcodeproj` in Xcode. If the project already uses CocoaPods, convert it with `npx react-native spm add --deintegrate` first. That conversion requires CocoaPods to remove its existing integration. Subsequent builds use SwiftPM.

The package re-exports the shared `nitro-core` API and installs it into the React Native runtime through React Native's JSI bindings hooks.

### Inside a Nitro Module library

Install matching versions of `nitro-core`, `react-native-nitro-modules`, and `nitrogen` for development. Declare the runtime packages as peers and install them in your example app. During the alpha, use the exact matching prerelease version in those ranges.

## Usage

Declare native classes in `.nitro.ts` specs and run Nitrogen:

```ts
import { iOS, Android, type HybridObject } from 'react-native-nitro-modules'

export * from '#nitro/Math'

@iOS({ language: 'swift', implementation: { className: 'HybridMath' } })
@Android({ language: 'kotlin', implementation: { className: 'HybridMath' } })
export declare class Math extends HybridObject {
  constructor()
  add(a: number, b: number): number
}
```

In the library's `package.json`:

```json
{
  "imports": {
    "#nitro/*": "./nitrogen/generated/shared/javascript/*.cjs"
  },
  "swiftpmConfig": {
    "name": "NitroMath",
    "dependencies": ["react-native-nitro-modules"]
  }
}
```

`swiftpmConfig.name` must match `iosModuleName` in `nitro.json` and your `Package.swift` product. Nitrogen generates native build targets and class registration. The podspec supplies React Native discovery metadata.

Use `moduleResolution: "bundler"` (or `node16`/`nodenext`) and `resolvePackageJsonImports: true` in TypeScript. If Metro compiles the specs, enable decorator parsing in the app's Babel configuration:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  parserOpts: { plugins: ['decorators'] },
}
```

Implement the generated native spec, then import the class from its `.nitro` file:

```ts
import { Math } from './Math.nitro'

const math = new Math()
console.log(math.add(2, 3))
```

Re-export it by name from your package entry point: `export { Math } from './Math.nitro'`.

- [Build a Nitro Module](https://nitro.margelo.com/docs/getting-started/how-to-build-a-nitro-module)
- [Supported types](https://nitro.margelo.com/docs/types/typing-system)
- [View components](https://nitro.margelo.com/docs/guides/view-components)
- [Handwritten C++ bindings without Nitrogen](https://nitro.margelo.com/docs/concepts/hybrid-objects#handwritten-c-bindings)

C++ implementations inherit the generated spec's nested `Class` descriptor and use the default `HybridObject` constructor. Handwritten bindings define their own descriptor and register it with `HybridClassRegistry`.
