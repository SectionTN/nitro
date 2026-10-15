// TODO: HybridViews are not supported by this version of Nitrogen yet.
//       Nitrogen fails with "HybridView specs are not supported. Use a declared HybridObject class instead.",
//       so this view is disabled until views are ported to the new `export declare class` syntax.

// import type {
//   HybridView,
//   HybridViewMethods,
//   HybridViewProps,
// } from 'react-native-nitro-modules'
//
// export interface RecyclableTestViewProps extends HybridViewProps {
//   isBlue: boolean
//   nativeDefaultValue?: number
// }
// export interface RecyclableTestViewMethods extends HybridViewMethods {
//   getInvalidLifecycleOrderCount(): number
//   getOnDropViewCount(): number
//   getPrepareForRecycleCount(): number
//   getNativeDefaultValueSetterCallCount(): number
// }
//
// export type RecyclableTestView = HybridView<
//   RecyclableTestViewProps,
//   RecyclableTestViewMethods
// >
