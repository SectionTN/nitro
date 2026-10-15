// TODO: HybridViews are not supported by this version of Nitrogen yet.
//       Nitrogen fails with "HybridView specs are not supported. Use a declared HybridObject class instead.",
//       so this view is disabled until views are ported to the new `export declare class` syntax.

// import type {
//   HybridView as HybridViewAlias,
//   HybridViewMethods,
//   HybridViewProps,
//   Int64,
// } from 'react-native-nitro-modules'
//
// export type ColorScheme = 'light' | 'dark'
//
// export interface TestViewProps extends HybridViewProps {
//   isBlue: boolean
//   hasBeenCalled: boolean
//   int64Value: Int64
//   colorScheme: ColorScheme
//   someCallback: () => void
//   nativeDefaultValue?: number
// }
// export interface TestViewMethods extends HybridViewMethods {
//   getOnDropViewCount(): number
//   getIsBlueSetterCallCount(): number
//   getNativeDefaultValueSetterCallCount(): number
//   someMethod(): void
// }
//
// export type TestView = HybridViewAlias<TestViewProps, TestViewMethods>
