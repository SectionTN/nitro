// TODO: HybridViews are not supported by this version of Nitrogen yet.
//       Nitrogen fails with "HybridView specs are not supported. Use a declared HybridObject class instead.",
//       so this view is disabled until views are ported to the new `export declare class` syntax.

// import { getHostComponent, type HybridRef } from 'react-native-nitro-modules'
// import RecyclableTestViewConfig from '../../nitrogen/generated/shared/json/RecyclableTestViewConfig.json'
// import {
//   type RecyclableTestViewMethods,
//   type RecyclableTestViewProps,
// } from '../specs/RecyclableTestView.nitro'
//
// /**
//  * Represents the HybridView `TestView`, which can be rendered as a React Native view.
//  */
// export const RecyclableTestView = getHostComponent<
//   RecyclableTestViewProps,
//   RecyclableTestViewMethods
// >('RecyclableTestView', () => RecyclableTestViewConfig)
//
// export type RecyclableTestViewRef = HybridRef<
//   RecyclableTestViewProps,
//   RecyclableTestViewMethods
// >
