import { Android, iOS, type HybridObject } from 'react-native-nitro-modules'

export * from '#nitro/Base'

// This is a simple `HybridObject` with just one value.
// Other `HybridObject`s (like `Child`) can extend it, and other native classes can implement it.
@iOS({
  language: 'swift',
  allowMultipleImplementations: true,
  allowInheritance: true,
  implementation: { className: 'HybridBase' },
})
@Android({
  language: 'kotlin',
  allowMultipleImplementations: true,
  allowInheritance: true,
  implementation: { className: 'HybridBase' },
})
export declare class Base extends HybridObject {
  public constructor()

  readonly baseValue: number
}
