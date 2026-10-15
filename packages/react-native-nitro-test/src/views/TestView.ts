// TODO: HybridViews are not supported by this version of Nitrogen yet.
//       Nitrogen fails with "HybridView specs are not supported. Use a declared HybridObject class instead.",
//       so this view is disabled until views are ported to the new `export declare class` syntax.

// import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
// import TestViewConfig from '../../nitrogen/generated/shared/json/TestViewConfig.json'
// import {
//   type TestViewMethods,
//   type TestViewProps,
// } from '../specs/TestView.nitro'
//
// /**
//  * Represents the HybridView `TestView`, which can be rendered as a React Native view.
//  */
// export const TestView = getHostComponent<TestViewProps, TestViewMethods>(
//   'TestView',
//   () => TestViewConfig
// )
//
// export type TestViewRef = HybridRef<TestViewProps, TestViewMethods>
