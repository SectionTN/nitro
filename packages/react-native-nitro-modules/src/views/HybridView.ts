import type { HybridObject } from '../HybridObject'

/**
 * Represents props for a Hybrid View.
 * Such props are implemented on the native side, and can be
 * set from JS using React props.
 * @example
 * ```ts
 * // Definition:
 * type Direction = 'horizontal' | 'vertical'
 * interface ScrollViewProps extends HybridViewProps {
 *   direction: Direction
 * }
 * export declare class ScrollView extends HybridView<ScrollViewProps> {}
 *
 * // in React:
 * function App() {
 *   return <HybridScrollView direction="vertical" />
 * }
 * ```
 */
export interface HybridViewProps {
  /* no default props */
}

/**
 * Represents methods for a Hybrid View.
 * Such methods are implemented on the native side, and can be
 * called from JS using the `hybridRef`.
 * @example
 * ```ts
 * // Definition:
 * interface ScrollViewProps extends HybridViewProps { … }
 * interface ScrollViewMethods extends HybridViewMethods {
 *   scrollTo(y: number): void
 * }
 * export declare class ScrollView extends HybridView<ScrollViewProps, ScrollViewMethods> {}
 *
 * // in React:
 * function App() {
 *   const ref = useRef<ScrollView>(null)
 *   useLayoutEffect(() => {
 *     ref.current.scrollTo(400)
 *   }, [])
 *   return <HybridScrollView hybridRef={ref} />
 * }
 * ```
 */
export interface HybridViewMethods {}

/**
 * The type of a {@linkcode DefaultHybridViewProps.hybridRef hybridRef}.
 * @example
 * ```ts
 * // declaration:
 * interface ScrollViewProps extends HybridViewProps { … }
 * interface ScrollViewMethods extends HybridViewMethods {
 *   scrollTo(y: number): void
 * }
 * export declare class ScrollView extends HybridView<ScrollViewProps, ScrollViewMethods> {}
 * export type ScrollViewRef = HybridRef<ScrollViewProps, ScrollViewMethods>
 *
 * // in react:
 * function App() {
 *   const ref = useRef<ScrollViewRef>(null)
 *   useLayoutEffect(() => {
 *     ref.current.scrollTo(400)
 *   }, [])
 *   return <ScrollView hybridRef={ref} />
 * }
 * ```
 */
export type HybridRef<
  Props extends HybridViewProps,
  Methods extends HybridViewMethods = {},
> = HybridObject & Props & Methods

/**
 * This interface acts as a tag for Hybrid Views so nitrogen detects them.
 */
export interface HybridViewTag {
  readonly __hybridViewTag?: never
}

interface HybridViewConstructor {
  new <
    Props extends HybridViewProps,
    Methods extends HybridViewMethods = {},
  >(): HybridViewTag & HybridObject & Props & Methods
  readonly prototype: HybridObject
}

/**
 * Represents a Nitro Hybrid View.
 *
 * The Hybrid View's implementation is in native iOS or Android, and is backed
 * by a {@linkcode HybridObject}.
 *
 * Each view has {@linkcode HybridViewProps}, and can optionally also
 * have custom {@linkcode HybridViewMethods}.
 *
 * Properties can be set using React props, and methods can be called after obtaining
 * a reference to the {@linkcode HybridObject} via {@linkcode DefaultHybridViewProps.hybridRef hybridRef}.
 *
 * Declare a view with `export declare class` in a `.nitro.ts` spec.
 * `HybridView` has no runtime value, so import it as a type.
 * @example
 * ```ts
 * import { iOS, Android, type HybridView } from 'react-native-nitro-modules'
 *
 * interface ScrollViewProps extends HybridViewProps { … }
 * interface ScrollViewMethods extends HybridViewMethods { … }
 *
 * @iOS({ language: 'swift', implementation: { className: 'HybridScrollView' } })
 * @Android({ language: 'kotlin', implementation: { className: 'HybridScrollView' } })
 * export declare class ScrollView extends HybridView<ScrollViewProps, ScrollViewMethods> {}
 * ```
 */
export declare const HybridView: HybridViewConstructor
export type HybridView<
  Props extends HybridViewProps,
  Methods extends HybridViewMethods = {},
> = HybridViewTag & HybridObject & Props & Methods
