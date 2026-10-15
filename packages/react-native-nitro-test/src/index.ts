import { TestObjectCpp, TestObjectSwiftKotlin } from './specs/TestObject.nitro'
import { PlatformObject } from './specs/PlatformObject.nitro'
import { Base } from './specs/Base.nitro'
import { Child } from './specs/Child.nitro'

// Export all Hybrid Object classes and types
export * from './specs/Base.nitro'
export * from './specs/Child.nitro'
export * from './specs/PlatformObject.nitro'
export * from './specs/TestObject.nitro'
export { Base, Child, PlatformObject, TestObjectCpp, TestObjectSwiftKotlin }

// Export all HybridObject singleton instances
export const HybridTestObjectCpp = new TestObjectCpp()
export const HybridTestObjectSwiftKotlin = new TestObjectSwiftKotlin()
export const HybridBase = new Base()
export const HybridChild = new Child()
export const HybridPlatformObject = new PlatformObject()

// TODO: HybridViews are not supported by this version of Nitrogen yet.
// export { TestView, type TestViewRef } from './views/TestView'
// export {
//   RecyclableTestView,
//   type RecyclableTestViewRef,
// } from './views/RecyclableTestView'
