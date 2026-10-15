import {
  Android,
  iOS,
  type HybridObject,
  type Int64,
  type UInt64,
} from 'react-native-nitro-modules'

export * from '#nitro/SomeExternalObject'

// A Type specifically testing optional primitives
export interface OptionalPrimitivesHolder {
  optionalNumber?: number
  optionalBoolean?: boolean
  optionalUInt64?: UInt64
  optionalInt64?: Int64
}

/**
 * This hybrid object is implemented in Swift and Kotlin.
 * It can be called from Swift/Kotlin, as well as C++ directly.
 * Other modules (like `react-native-nitro-test`) can implement it too.
 */
@iOS({
  language: 'swift',
  allowMultipleImplementations: true,
  implementation: { className: 'HybridSomeExternalObject' },
})
@Android({
  language: 'kotlin',
  allowMultipleImplementations: true,
  implementation: { className: 'HybridSomeExternalObject' },
})
export declare class SomeExternalObject extends HybridObject {
  public constructor()

  getValue(): string

  // This tests a weird Swift bug: when a Hybrid Object imported in another
  // module (aka an "external HybridObject") uses optional primitives (here
  // bool or double), the Swift compiler fails because the optional's `.value`
  // accessor seems to not be generated properly.
  // See https://github.com/swiftlang/swift/issues/84848
  createOptionalPrimitivesHolder(
    optionalNumber?: number,
    optionalBoolean?: boolean,
    optionalUInt64?: UInt64,
    optionalInt64?: Int64
  ): OptionalPrimitivesHolder
}
