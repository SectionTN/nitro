import {
  NativeComponentRegistry,
  type HostComponent,
  type ViewProps,
} from 'react-native'
import type { HybridView } from './HybridView'

type AttributeValue<T, V = T> =
  | true
  | {
      diff?: (arg1: T, arg2: T) => boolean
      process?: (arg1: V) => T
    }

type ReactNativeViewConfig = ReturnType<
  Parameters<typeof NativeComponentRegistry.get>[1]
>

export type ViewConfig<Props> = Omit<
  ReactNativeViewConfig,
  'validAttributes'
> & {
  validAttributes: {
    [K in keyof Props]: AttributeValue<Props[K]>
  }
}

/**
 * Represents all default props a Nitro HybridView has.
 */
interface DefaultHybridViewProps<RefType> {
  /**
   * A `ref` to the {@linkcode HybridObject} this Hybrid View is rendering.
   *
   * Receives the native HybridView instance as a function prop.
   * @example
   * ```jsx
   * function App() {
   *   return (
   *     <HybridScrollView
   *       hybridRef={(ref) => {
   *         ref.scrollTo(400)
   *       }}
   *     />
   *   )
   * }
   * ```
   */
  hybridRef?: (ref: RefType) => void
}

/**
 * A renderable native view with React props and a Nitro instance available through hybridRef.
 *
 * @note Every React Native view has a {@linkcode DefaultHybridViewProps.hybridRef hybridRef} which can be used to gain access
 *       to the underlying Nitro {@linkcode HybridView}.
 * @note Every method can be called on the Ref. Including setting properties directly.
 */
export type ReactNativeView<Props, Ref extends HybridView> = HostComponent<
  DefaultHybridViewProps<Ref> & Props & ViewProps
>

type ValidAttributes<Props> = ViewConfig<Props>['validAttributes']
/**
 * Wraps all valid attributes of {@linkcode TProps} using Nitro's
 * default `diff` and `process` functions. The identity processor preserves
 * function props as raw JSI values instead of React Native event markers.
 */
function wrapValidAttributes<TProps>(
  attributes: ValidAttributes<TProps>
): ValidAttributes<TProps> {
  for (const key in attributes) {
    attributes[key] = {
      diff: (a, b) => a !== b,
      process: (i) => i,
    }
  }
  return attributes
}

/**
 * Finds and returns a native view (aka "HostComponent") via the given {@linkcode name}.
 *
 * The view is bridged to a native Hybrid Object using Nitro Views.
 */
export function getHostComponent<Props, Ref extends HybridView>(
  name: string,
  getViewConfig: () => ViewConfig<Props>
): ReactNativeView<Props, Ref> {
  return NativeComponentRegistry.get(name, () => {
    const config = getViewConfig()
    config.validAttributes = wrapValidAttributes(config.validAttributes)
    return config
  })
}
