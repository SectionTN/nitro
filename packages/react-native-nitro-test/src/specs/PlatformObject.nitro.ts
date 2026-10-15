import { Android, iOS, type HybridObject } from 'react-native-nitro-modules'

export * from '#nitro/PlatformObject'

// This object is implemented in Swift and Kotlin
@iOS({
  language: 'swift',
  implementation: { className: 'HybridPlatformObject' },
})
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridPlatformObject' },
})
export declare class PlatformObject extends HybridObject {
  public constructor()

  getOSVersion(): string
}
