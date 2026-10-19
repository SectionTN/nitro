---
description: Render native Hybrid Views with generated React components and access their native methods.
---

# Hybrid Views

A Hybrid View is a [Hybrid Object](hybrid-objects) rendered by React Native's Fabric renderer. Declare a class extending `HybridView`, with writable properties for props and methods for imperative native calls:

```ts title="CameraView.nitro.ts"
import { iOS, Android, type HybridView } from 'react-native-nitro-modules'

export * from '#nitro/CameraView'

@iOS({ language: 'swift', implementation: { className: 'HybridCameraView' } })
@Android({ language: 'kotlin', implementation: { className: 'HybridCameraView' } })
export declare class CameraView extends HybridView {
  enableFlash: boolean
  onReady?: () => void
  focus(): void
}
```

Nitrogen generates `CameraViewComponent`, `CameraViewProps`, and `CameraViewRef`. Fabric creates the native instance, so views do not declare public constructors.

```tsx
import { CameraViewComponent } from './CameraView.nitro'

function App() {
  return (
    <CameraViewComponent
      enableFlash={false}
      onReady={() => console.log('Ready')}
      hybridRef={(camera) => camera.focus()}
    />
  )
}
```

`hybridRef` receives the native Hybrid Object. The normal React `ref` retains React Native's host-instance behavior. See [View components](../guides/view-components) for implementation, lifecycle, and packaging.
