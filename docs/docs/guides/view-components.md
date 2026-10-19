---
description: Build Nitro v1 view components with declared HybridView classes, generated React exports, and native lifecycle hooks.
---

# View components

Nitro views use Fabric with Nitro's type converters for props. Follow the [module setup](../getting-started/how-to-build-a-nitro-module) first, including the `#nitro/*` package imports, TypeScript resolution, decorator parsing, and native build integration.

## Declare the view

```ts title="CameraView.nitro.ts"
import { iOS, Android, type HybridView } from 'react-native-nitro-modules'

export * from '#nitro/CameraView'

@iOS({ language: 'swift', implementation: { className: 'HybridCameraView' } })
@Android({ language: 'kotlin', implementation: { className: 'HybridCameraView' } })
export declare class CameraView extends HybridView {
  enableFlash: boolean
  onReady?: () => void
  readonly isReady: boolean
  focus(): void
}
```

Writable properties become React props. Readonly properties and methods are available on the native ref. A view needs a concrete native implementation; omit its constructor or declare it protected because Fabric creates it.

Run `npx nitrogen` after changing the spec. Nitrogen generates native bindings, the Fabric view configuration, and runtime exports for the class and component.

## Implement the view

The Swift class implements the generated spec and supplies a stable `UIView` instance:

```swift title="HybridCameraView.swift"
import UIKit
import NitroModules

class HybridCameraView: HybridCameraViewSpec {
  var enableFlash = false
  var onReady: (any Callback<(), Void>)?
  var isReady: Bool { true }
  var view: UIView = UIView()

  func focus() throws {
    // Focus the native camera here.
  }
}
```

On Android, implement the generated Kotlin spec and provide its native view:

```kotlin title="HybridCameraView.kt"
class HybridCameraView(context: ThemedReactContext): HybridCameraViewSpec() {
  override var enableFlash = false
  override var onReady: (() -> Unit)? = null
  override val isReady: Boolean get() = true
  override val view: View = View(context)

  override fun focus() {
    // Focus the native camera here.
  }
}
```

Add the generated `HybridCameraViewManager()` to your React Native package's `createViewManagers` list. The spec decorators select native implementations; no separate `nitro.json` constructor registration is needed.

## Export and render

Use named exports in your package entry point:

```ts title="index.ts"
export {
  CameraView,
  CameraViewComponent,
  type CameraViewProps,
  type CameraViewRef,
} from './CameraView.nitro'
```

The generated component includes ordinary React Native `ViewProps` such as `style` and `onLayout`. There is no need to import a generated JSON config or call `getHostComponent` yourself.

```tsx
import { CameraViewComponent } from 'my-camera-library'

function App() {
  return (
    <CameraViewComponent
      style={{ flex: 1 }}
      enableFlash={false}
      onReady={() => console.log('Ready')}
      hybridRef={(camera) => camera.focus()}
    />
  )
}
```

`hybridRef` receives the `CameraView` instance and can call native methods or inspect readonly properties. React's normal `ref` points to the host instance.

## Props and threading

Props support Nitro types, including structs, callbacks, ArrayBuffers, and other Hybrid Objects. Callbacks are passed directly as functions. For Swift, a callback prop uses `Callback`, so native code can call it asynchronously without accessing JS from the UI thread.

React prop updates run on the UI thread. Direct calls and property writes through `hybridRef` run on the caller's thread. Dispatch native UI operations to the UI thread as needed.

Override `beforeUpdate()` and `afterUpdate()` to batch work around a React prop update. For example, collect changes in setters and apply the combined native update in `afterUpdate()`.

## Recycling

Use `onDropView()` for cleanup when Fabric drops the view. Keep cleanup safe for the view's lifecycle and cancel work that should no longer update it.

To opt into recycling, implement `RecyclableView` and reset transient state in `prepareForRecycle()`:

```swift
class HybridCameraView: HybridCameraViewSpec, RecyclableView {
  // Implement the spec's properties, view, and methods here.

  func prepareForRecycle() {
    // Cancel pending requests and reset preview state.
  }
}
```

In Kotlin, implement `RecyclableView` from `com.margelo.nitro.views` and override `prepareForRecycle()`. Reset images, pending operations, and other state that must not leak into the next use of the native view.
