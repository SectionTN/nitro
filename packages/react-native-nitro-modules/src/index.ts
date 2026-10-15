import { installWorkletsSupport } from './worklets/installWorkletsSupport'

export * from './AnyHybridObject'
export * from './AnyJSON'
export * from './BoxedHybridObject'
export * from './CustomType'
export { HybridObject } from './HybridObject'
export { iOS, Android } from './HybridObjectDecorators'
export type {
  HybridObjectPlatformOptions,
  SwiftHybridObjectImplementation,
  SwiftProtocolConformance,
  CppHybridObjectImplementation,
  KotlinHybridObjectImplementation,
  KotlinImplementedInterface,
} from './HybridObjectPlatformOptions'
export * from './NitroModules'
export * from './NitroModulesProxy'
export * from './Inline'
export * from './Int64'

export * from './views/HybridView'
export * from './views/getHostComponent'
export * from './views/callback'

installWorkletsSupport()
