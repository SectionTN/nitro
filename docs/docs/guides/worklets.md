---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Worklets/Threading

Nitro itself is fully runtime-agnostic, which means every [Hybrid Object](../concepts/hybrid-objects) can be used from any JS Runtime or Worklet Context.

This allows the caller to call into native Nitro Modules from libraries like [react-native-worklets-core](https://github.com/margelo/react-native-worklets-core), or [react-native-reanimated](https://github.com/software-mansion/react-native-reanimated).
You can use a Nitro [Hybrid Object](../concepts/hybrid-objects) on the default React JS context, on the UI context, or on any other background worklet context.

<Tabs groupId="worklet-library">
  <TabItem value="rnw" label="react-native-worklets (Reanimated)" default>
  ```ts
  import { Image } from './Image.nitro'

  const image = new Image('/path/to/photo.png')
  runOnUI(() => {
    'worklet'
    console.log(image.width, image.height)
  })()
  ```
  </TabItem>
  <TabItem value="rnwc" label="react-native-worklets-core (Margelo)">
  ```ts
  import { Image } from './Image.nitro'

  const image = new Image('/path/to/photo.png')
  const boxed = NitroModules.box(image)

  const context = Worklets.createContext('DummyContext')
  context.runAsync(() => {
    'worklet'
    const unboxed = boxed.unbox()
    console.log(unboxed.width, unboxed.height)
  })
  ```
  </TabItem>
</Tabs>

These examples use the [Image spec](../concepts/hybrid-objects), whose constructor accepts a file path. Both runtimes refer to the same native image.

## Dispatcher

Synchronous Hybrid Object methods can run on any runtime, but asynchronous APIs (Promises and callbacks) require a `Dispatcher`.
If you call an asynchronous API on a runtime that Nitro doesn't know, it likely doesn't have a `Dispatcher`, so it doesn't know how to call back to the JS Thread after the asynchronous operation has finished (Promise resolve or callback call).

If **you** created that `jsi::Runtime`, you need to create a `Dispatcher` for it and implement `runSync`, `runAsync`, and `isOnDispatcher`:

```cpp
#include <NitroModules/Dispatcher.hpp>
using namespace margelo::nitro;

class MyRuntimeDispatcher: public Dispatcher {
public:
  void runSync(std::function<void()>&& function) override;
  void runAsync(std::function<void()>&& function) override;
  bool isOnDispatcher() override;
};
```

Then, simply install this `Dispatcher` into your runtime so Nitro can use it:

```cpp
auto myDispatcher = std::make_shared<MyRuntimeDispatcher>();
Dispatcher::installRuntimeGlobalDispatcher(myRuntime, myDispatcher);
```

This needs to be done once, ideally immediately after creating the `jsi::Runtime`.

Your `runSync` and `runAsync` implementations must run the given `function` on the same Thread that the `jsi::Runtime` was created on - see [`CallInvokerDispatcher.hpp`](https://github.com/margelo/nitro/blob/v1/packages/react-native-nitro-modules/include/NitroModulesReactNative/detail/CallInvokerDispatcher.hpp) for an example.

## Boxing

A [Hybrid Object](../concepts/hybrid-objects) is a JS object with `jsi::NativeState` and a prototype chain.
If you need to interop with legacy APIs or APIs that can't deal with `jsi::NativeState` yet, you can _box_ the Hybrid Object into a `jsi::HostObject`:

```ts
const image = new Image('/path/to/photo.png')
const boxed = NitroModules.box(image) // <-- jsi::HostObject
```

The `boxed` object is a simple `jsi::HostObject` (see [`BoxedHybridObject.hpp`](https://github.com/margelo/nitro/blob/main/packages/nitro-core/native/cpp/include/NitroModules/BoxedHybridObject.hpp)), which can later be _unboxed_ again:

```ts
const unboxed = boxed.unbox() // The same native Image
console.log(unboxed.width, unboxed.height)
```

:::info
This is how Hybrid Objects are captured inside Worklet Contexts under the hood as well!
:::
