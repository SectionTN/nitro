# nitro-core

Nitro's shared runtime sources and JavaScript API.

The Git directory contains `android/`, `apple/`, `cpp/`, and `js/`. The npm package
publishes only the JavaScript API and TypeScript definitions from `js/`. Native
sources still include React Native-specific code and are staged into the
`react-native-nitro-modules` package for CocoaPods and Android builds.

```ts
import type { HybridObject } from 'nitro-core'

export interface Image extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
  readonly width: number
  readonly height: number
}
```

The package includes `HybridObject`, platform and custom type definitions,
`NitroModulesProxy`, and helpers such as `getHybridObjectConstructor`.
Nitrogen reads these definitions when generating native bindings.

Importing the package does not install Nitro or require a native runtime.
The host integration installs the native proxy and dispatcher, checks its
version, then calls `getNitroModules()` to initialize the exported
`NitroModules` binding. The binding is the native object itself.
Call `getInstalledNitro()` to check whether the current runtime has a proxy.

Each loaded module instance has its own `NitroModules` binding. Code loaded
independently, including a separate CommonJS or ESM copy, should call
`getNitroModules()` to initialize its binding and access the runtime's native
proxy.

React Native applications should initialize Nitro through
`react-native-nitro-modules`, which re-exports these APIs and handles native
installation and worklets support. Existing imports remain valid:

```ts
import { NitroModules, type HybridObject } from 'react-native-nitro-modules'
```

Keep `nitro-core`, Nitrogen, and the host integration on the same release version.
The host integration package distributes native sources and platform build
integration; this npm package contains JavaScript and TypeScript only.

The React Native entry resolves to compiled JavaScript. After editing this
package, run `bun run build` before rebuilding an app. Validate native changes
with the existing tests and fixtures in the React Native repository.
