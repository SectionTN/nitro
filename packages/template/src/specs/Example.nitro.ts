import { Android, iOS, type HybridObject } from 'react-native-nitro-modules'

export * from '#nitro/Example'

/**
 * An example HybridObject, implemented in Swift (`ios/HybridExample.swift`).
 * Create new instances in JS with `new Example()`.
 */
@iOS({ language: 'swift', implementation: { className: 'HybridExample' } })
@Android({ language: 'kotlin', implementation: { className: 'HybridExample' } })
export declare class Example extends HybridObject {
  public constructor()

  add(a: number, b: number): number
}
